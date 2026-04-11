import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type EnrollmentInsert = Database['public']['Tables']['enrollments']['Insert'];

export type BulkEnrollStudentRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  school_id: string | null;
  school_name: string | null;
  section_class: string | null;
  class_id: string | null;
};

export type BulkEnrollClassRow = {
  id: string;
  name: string;
  program_id: string | null;
  school_id: string | null;
  programs: { name: string } | null;
  schools: { name: string } | null;
};

const ACTIVE_STUDENT_OR = 'is_active.eq.true,is_active.is.null';

export class EnrollmentService {
  async listTeacherSchoolIds(teacherId: string): Promise<string[]> {
    const { data, error } = await supabase.from('teacher_schools').select('school_id').eq('teacher_id', teacherId);
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => r.school_id).filter(Boolean))] as string[];
  }

  /**
   * Students visible for bulk class enrolment (aligned with web portal-users scoped vs admin).
   * Teachers: primary `school_id` + `teacher_schools`, including legacy `school_name` rows with null `school_id`.
   */
  async listStudentsForBulkEnroll(params: {
    role: string;
    teacherId?: string | null;
    schoolId?: string | null;
  }): Promise<BulkEnrollStudentRow[]> {
    const sel = 'id, full_name, email, school_id, school_name, section_class, class_id';

    if (params.role === 'admin') {
      const { data, error } = await supabase
        .from('portal_users')
        .select(sel)
        .eq('role', 'student')
        .or(ACTIVE_STUDENT_OR)
        .order('full_name', { ascending: true })
        .limit(800);
      if (error) throw error;
      return (data ?? []) as BulkEnrollStudentRow[];
    }

    const schoolIds: string[] = [];
    if (params.schoolId) schoolIds.push(params.schoolId);
    if (params.teacherId) {
      const ts = await this.listTeacherSchoolIds(params.teacherId);
      ts.forEach((id) => {
        if (id && !schoolIds.includes(id)) schoolIds.push(id);
      });
    }
    if (schoolIds.length === 0) return [];

    const { data: schoolRows, error: schErr } = await supabase.from('schools').select('id, name').in('id', schoolIds);
    if (schErr) throw schErr;
    const schoolNames = [...new Set((schoolRows ?? []).map((s) => s.name).filter(Boolean))] as string[];

    const q1 = supabase
      .from('portal_users')
      .select(sel)
      .eq('role', 'student')
      .or(ACTIVE_STUDENT_OR)
      .in('school_id', schoolIds)
      .order('full_name', { ascending: true })
      .limit(800);

    const r1 = await q1;
    if (r1.error) throw r1.error;

    let legacyRows: BulkEnrollStudentRow[] = [];
    if (schoolNames.length > 0) {
      const r2 = await supabase
        .from('portal_users')
        .select(sel)
        .eq('role', 'student')
        .or(ACTIVE_STUDENT_OR)
        .is('school_id', null)
        .in('school_name', schoolNames)
        .order('full_name', { ascending: true })
        .limit(800);
      if (r2.error) throw r2.error;
      legacyRows = (r2.data ?? []) as BulkEnrollStudentRow[];
    }

    const byId = new Map<string, BulkEnrollStudentRow>();
    for (const row of [...(r1.data ?? []), ...legacyRows]) {
      byId.set(row.id, row as BulkEnrollStudentRow);
    }
    return Array.from(byId.values()).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }

  /** Schools the teacher may attach to a newly created class (primary + `teacher_schools`). */
  async listSchoolsForTeacherBulkPicker(teacherId: string, primarySchoolId: string | null) {
    const { data: ts, error } = await supabase
      .from('teacher_schools')
      .select('school_id, schools!teacher_schools_school_id_fkey(id, name)')
      .eq('teacher_id', teacherId);
    if (error) throw error;
    const map = new Map<string, string>();
    for (const r of ts ?? []) {
      const s = r.schools as { id: string; name: string } | null;
      if (s?.id) map.set(s.id, s.name);
    }
    if (primarySchoolId) {
      const { data: prim } = await supabase.from('schools').select('id, name').eq('id', primarySchoolId).maybeSingle();
      if (prim?.id) map.set(prim.id, prim.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Classes for bulk picker: admin sees all; teacher sees own classes (matches web `/api/classes` default). */
  async listClassesForBulkPicker(params: { isAdmin: boolean; teacherId?: string | null }): Promise<BulkEnrollClassRow[]> {
    let q = supabase
      .from('classes')
      .select('id, name, program_id, school_id, programs(name), schools(name)')
      .order('created_at', { ascending: false })
      .limit(250);
    if (!params.isAdmin && params.teacherId) q = q.eq('teacher_id', params.teacherId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as BulkEnrollClassRow[];
  }

  /**
   * Batch assign students to a class, sync `current_students`, ensure programme enrolments — mirrors web
   * `PUT /api/classes/[id]/enroll` (school boundary for non-admin; ineligible students skipped).
   */
  async bulkEnrollStudentsInClass(params: { classId: string; studentIds: string[]; callerRole: string }): Promise<{
    enrolled: number;
    skipped: number;
  }> {
    const { classId, studentIds, callerRole } = params;
    if (!studentIds.length) return { enrolled: 0, skipped: 0 };

    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('id, name, program_id, school_id')
      .eq('id', classId)
      .single();
    if (clsErr) throw clsErr;
    if (!cls) throw new Error('Class not found');

    let allowedIds = [...studentIds];
    if (callerRole !== 'admin' && cls.school_id) {
      const { data: clsSchool } = await supabase.from('schools').select('name').eq('id', cls.school_id).maybeSingle();
      const clsSchoolName = clsSchool?.name ?? null;

      const { data: studentRows, error: stErr } = await supabase
        .from('portal_users')
        .select('id, school_id, school_name')
        .in('id', studentIds)
        .eq('role', 'student');
      if (stErr) throw stErr;

      allowedIds = (studentRows ?? [])
        .filter((s) => {
          const sameById = s.school_id === cls.school_id;
          const sameByName = !!(clsSchoolName && s.school_name === clsSchoolName);
          return sameById || sameByName;
        })
        .map((s) => s.id);

      if (allowedIds.length === 0) {
        throw new Error('No eligible students: all selected students belong to a different school.');
      }
    }

    const { data: studentsBefore, error: beforeErr } = await supabase
      .from('portal_users')
      .select('id, class_id')
      .in('id', allowedIds)
      .eq('role', 'student');
    if (beforeErr) throw beforeErr;
    const prevClassIds = [
      ...new Set(
        (studentsBefore ?? [])
          .map((s) => s.class_id)
          .filter((cid): cid is string => typeof cid === 'string' && !!cid && cid !== classId),
      ),
    ];

    const { error: updateErr } = await supabase
      .from('portal_users')
      .update({ class_id: classId, section_class: cls.name })
      .in('id', allowedIds)
      .eq('role', 'student');
    if (updateErr) throw updateErr;

    const syncCount = async (cid: string) => {
      const { count, error } = await supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cid)
        .eq('role', 'student');
      if (error) throw error;
      await supabase.from('classes').update({ current_students: count ?? 0 }).eq('id', cid);
    };

    await syncCount(classId);
    for (const prevCid of prevClassIds) await syncCount(prevCid);

    if (cls.program_id) {
      const now = new Date().toISOString();
      const day = now.split('T')[0];
      const rows: EnrollmentInsert[] = allowedIds.map((user_id) => ({
        user_id,
        program_id: cls.program_id,
        role: 'student',
        status: 'active',
        progress_pct: 0,
        enrollment_date: day,
        created_at: now,
        updated_at: now,
      }));
      const { error: upErr } = await supabase.from('enrollments').upsert(rows, { onConflict: 'user_id,program_id' });
      if (upErr) throw upErr;
    }

    return { enrolled: allowedIds.length, skipped: studentIds.length - allowedIds.length };
  }

  async listStudentsForEnrolPicker(params: { scopeSchoolId?: string | null; applySchoolScope: boolean }) {
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(300);
    if (params.applySchoolScope && params.scopeSchoolId) {
      q = q.eq('school_id', params.scopeSchoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listProgramsForEnrolPicker(params: { scopeSchoolId?: string | null; applySchoolScope: boolean }) {
    let q = supabase
      .from('programs')
      .select('id, name, description, difficulty_level, price')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (params.applySchoolScope && params.scopeSchoolId) {
      q = q.eq('school_id', params.scopeSchoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async upsertEnrollments(rows: EnrollmentInsert[]) {
    if (!rows.length) return;
    const { error } = await supabase.from('enrollments').upsert(rows, { onConflict: 'user_id,program_id' });
    if (error) throw error;
  }

  async assignPortalUsersToClass(userIds: string[], classId: string, sectionClassName: string | null) {
    if (!userIds.length) return;
    const { error } = await supabase
      .from('portal_users')
      .update({ class_id: classId, section_class: sectionClassName })
      .in('id', userIds);
    if (error) throw error;
  }
}

export const enrollmentService = new EnrollmentService();

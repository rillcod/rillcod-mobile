import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type ClassRow = Database['public']['Tables']['classes']['Row'];

export class ClassService {
  private async listAuthorizedSchoolIdsForCaller(params: {
    callerRole?: string | null;
    callerId?: string | null;
    callerSchoolId?: string | null;
  }) {
    const { callerRole, callerId, callerSchoolId } = params;
    if (callerRole === 'admin') return [];

    const schoolIds: string[] = [];
    if (callerSchoolId) schoolIds.push(callerSchoolId);

    if (callerRole === 'teacher' && callerId) {
      const linkedSchoolIds = await this.listTeacherSchoolIds(callerId);
      linkedSchoolIds.forEach((id) => {
        if (id && !schoolIds.includes(id)) schoolIds.push(id);
      });
    }

    return schoolIds;
  }

  private async listTeacherSchoolIds(teacherId: string) {
    const { data, error } = await supabase
      .from('teacher_schools')
      .select('school_id')
      .eq('teacher_id', teacherId);
    if (error) throw error;
    return [...new Set((data ?? []).map((row: { school_id: string }) => row.school_id).filter(Boolean))] as string[];
  }

  private async listTeacherIdsAssignedToSchool(schoolId: string) {
    const { data, error } = await supabase
      .from('teacher_schools')
      .select('teacher_id')
      .eq('school_id', schoolId);
    if (error) throw error;
    return [...new Set((data ?? []).map((row: { teacher_id: string }) => row.teacher_id).filter(Boolean))] as string[];
  }

  private async syncCurrentStudents(classIds: string[]) {
    const uniqueIds = [...new Set(classIds.filter(Boolean))];
    for (const classId of uniqueIds) {
      const { count, error } = await supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('role', 'student');
      if (error) throw error;
      const { error: updateError } = await supabase.from('classes').update({ current_students: count ?? 0 }).eq('id', classId);
      if (updateError) throw updateError;
    }
  }

  private async getClassSchoolName(schoolId: string | null) {
    if (!schoolId) return null;
    const { data, error } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
    if (error) throw error;
    return data?.name ?? null;
  }

  private async assertRosterAccess(params: {
    classId: string;
    callerRole?: string | null;
    callerId?: string | null;
    callerSchoolId?: string | null;
  }) {
    const { data: cls, error } = await supabase
      .from('classes')
      .select('id, name, school_id')
      .eq('id', params.classId)
      .maybeSingle();
    if (error) throw error;
    if (!cls) throw new Error('Class not found');

    const schoolName = await this.getClassSchoolName(cls.school_id);

    if (!params.callerRole || params.callerRole === 'admin') {
      return { cls, schoolName };
    }

    if (!cls.school_id) {
      throw new Error('This class is missing a school link and cannot be managed from mobile yet.');
    }

    if (params.callerRole === 'school') {
      if (!params.callerSchoolId || params.callerSchoolId !== cls.school_id) {
        throw new Error('You can only manage classes inside your own school.');
      }
      return { cls, schoolName };
    }

    if (params.callerRole === 'teacher') {
      const schoolIds = await this.listAuthorizedSchoolIdsForCaller(params);
      if (!schoolIds.includes(cls.school_id)) {
        throw new Error('You are not assigned to this class school.');
      }
      return { cls, schoolName };
    }

    throw new Error('You do not have permission to manage this class roster.');
  }

  /** Add-class form: teachers visible in picker (no `is_active` filter — matches legacy UI). */
  async listTeachersForClassPicker(params: { schoolId?: string | null; isAdmin: boolean; limit?: number }) {
    const lim = params.limit ?? 100;
    if (!params.isAdmin && params.schoolId) {
      const linkedTeacherIds = await this.listTeacherIdsAssignedToSchool(params.schoolId);
      const [primary, linked] = await Promise.all([
        supabase.from('portal_users').select('id, full_name, email').eq('role', 'teacher').eq('school_id', params.schoolId).limit(lim),
        linkedTeacherIds.length
          ? supabase.from('portal_users').select('id, full_name, email').eq('role', 'teacher').in('id', linkedTeacherIds).limit(lim)
          : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[], error: null }),
      ]);
      if (primary.error) throw primary.error;
      if (linked.error) throw linked.error;
      const byId = new Map<string, { id: string; full_name: string; email: string }>();
      for (const row of [...(primary.data ?? []), ...(linked.data ?? [])]) byId.set(row.id, row);
      return Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    const { data, error } = await supabase.from('portal_users').select('id, full_name, email').eq('role', 'teacher').limit(lim);
    if (error) throw error;
    return data ?? [];
  }

  async listTeacherOptions(params: { schoolId?: string | null; isAdmin: boolean }) {
    if (!params.isAdmin && params.schoolId) {
      const linkedTeacherIds = await this.listTeacherIdsAssignedToSchool(params.schoolId);
      const [primary, linked] = await Promise.all([
        supabase
          .from('portal_users')
          .select('id, full_name, email')
          .eq('role', 'teacher')
          .eq('is_active', true)
          .eq('school_id', params.schoolId)
          .order('full_name', { ascending: true })
          .limit(150),
        linkedTeacherIds.length
          ? supabase
              .from('portal_users')
              .select('id, full_name, email')
              .eq('role', 'teacher')
              .eq('is_active', true)
              .in('id', linkedTeacherIds)
              .order('full_name', { ascending: true })
              .limit(150)
          : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[], error: null }),
      ]);
      if (primary.error) throw primary.error;
      if (linked.error) throw linked.error;
      const byId = new Map<string, { id: string; full_name: string; email: string }>();
      for (const row of [...(primary.data ?? []), ...(linked.data ?? [])]) byId.set(row.id, row);
      return Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(150);
    if (error) throw error;
    return data ?? [];
  }

  async listActiveProgramOptions(limit = 150) {
    const { data, error } = await supabase
      .from('programs')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listClassesForManagement(params: { role?: string | null; teacherId?: string; schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 150;
    let q = supabase
      .from('classes')
      .select(
        'id, name, description, teacher_id, program_id, school_id, current_students, max_students, schedule, status, created_at, programs(name), schools(name), portal_users!classes_teacher_id_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
      .limit(lim);
    if (params.role === 'teacher' && params.teacherId) {
      const schoolIds = await this.listAuthorizedSchoolIdsForCaller({
        callerRole: 'teacher',
        callerId: params.teacherId,
        callerSchoolId: params.schoolId,
      });
      if (!schoolIds.length) return [];
      q = q.in('school_id', schoolIds);
    } else if (params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async countStudentsInClass(classId: string) {
    const { count, error } = await supabase
      .from('portal_users')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('role', 'student');
    if (error) throw error;
    return count ?? 0;
  }

  /** Teacher profile: class picker list. */
  async listClassSummariesForTeacher(teacherId: string, limit = 20) {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', teacherId)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updateClass(classId: string, payload: Database['public']['Tables']['classes']['Update']) {
    const { error } = await supabase.from('classes').update(payload).eq('id', classId);
    if (error) throw error;
  }

  async createClass(payload: Database['public']['Tables']['classes']['Insert']) {
    const { error } = await supabase.from('classes').insert(payload);
    if (error) throw error;
  }

  async createClassReturningRow(payload: Database['public']['Tables']['classes']['Insert']) {
    const { data, error } = await supabase.from('classes').insert(payload).select('id, name, program_id, school_id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to create class');
    return data;
  }

  /** Add / edit class screen: single row with teacher + programme names. */
  async getClassForEditor(classId: string) {
    const { data, error } = await supabase
      .from('classes')
      .select(
        'id, name, description, teacher_id, program_id, school_id, max_students, start_date, end_date, schedule, status, portal_users!classes_teacher_id_fkey(full_name), programs!classes_program_id_fkey(name)',
      )
      .eq('id', classId)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Class detail screen: same embed hints as `listClassesForManagement` so PostgREST/RLS
   * resolves like the list query. Falls back to a row-only select if embedded resources fail.
   */
  async getClassDetailWithRelations(classId: string) {
    const id = classId?.trim();
    if (!id) throw new Error('CLASS_NOT_FOUND');

    const withJoins =
      'id, name, description, schedule, max_students, current_students, status, created_at, start_date, end_date, program_id, school_id, teacher_id, portal_users!classes_teacher_id_fkey(full_name, email), programs!classes_program_id_fkey(name), schools!classes_school_id_fkey(name)';

    const joined = await supabase.from('classes').select(withJoins).eq('id', id).maybeSingle();
    if (!joined.error && joined.data) return joined.data;

    const bare = await supabase
      .from('classes')
      .select(
        'id, name, description, schedule, max_students, current_students, status, created_at, start_date, end_date, program_id, school_id, teacher_id',
      )
      .eq('id', id)
      .maybeSingle();
    if (bare.error) throw bare.error;
    if (!bare.data) throw new Error('CLASS_NOT_FOUND');

    const row = bare.data;
    let portal_users: { full_name: string | null; email: string | null } | null = null;
    let programs: { name: string } | null = null;
    let schools: { name: string } | null = null;

    if (row.teacher_id) {
      const t = await supabase.from('portal_users').select('full_name, email').eq('id', row.teacher_id).maybeSingle();
      if (!t.error && t.data) portal_users = t.data;
    }
    if (row.program_id) {
      const p = await supabase.from('programs').select('name').eq('id', row.program_id).maybeSingle();
      if (!p.error && p.data) programs = p.data;
    }
    if (row.school_id) {
      const s = await supabase.from('schools').select('name').eq('id', row.school_id).maybeSingle();
      if (!s.error && s.data) schools = s.data;
    }

    return {
      ...row,
      portal_users,
      programs,
      schools,
    };
  }

  /** Mark attendance: reuse today’s session row if one exists for this class. */
  async getClassSessionIdForDate(
    classId: string,
    sessionDate: string,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    await this.assertRosterAccess({
      classId,
      callerRole: context?.callerRole,
      callerId: context?.callerId,
      callerSchoolId: context?.callerSchoolId,
    });
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('session_date', sessionDate)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  async insertClassSessionReturningId(
    row: Database['public']['Tables']['class_sessions']['Insert'],
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    if (row.class_id) {
      await this.assertRosterAccess({
        classId: row.class_id,
        callerRole: context?.callerRole,
        callerId: context?.callerId,
        callerSchoolId: context?.callerSchoolId,
      });
    }
    const { data, error } = await supabase.from('class_sessions').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to create class session');
    return data.id;
  }

  async listActiveStudentsInClass(
    classId: string,
    limit = 300,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    if (context?.callerRole) {
      await this.assertRosterAccess({
        classId,
        callerRole: context.callerRole,
        callerId: context.callerId,
        callerSchoolId: context.callerSchoolId,
      });
    }
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, section_class')
      .eq('role', 'student')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listAssignmentsForClass(classId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, title, description, due_date, max_points, assignment_type, created_at')
      .eq('class_id', classId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listClassSessionsForDetail(classId: string, limit = 12) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id, session_date, start_time, end_time, topic, title, description, status')
      .eq('class_id', classId)
      .order('session_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async insertClassSession(row: Database['public']['Tables']['class_sessions']['Insert']) {
    const { error } = await supabase.from('class_sessions').insert(row);
    if (error) throw error;
  }

  async searchStudentsForEnrollment(params: {
    query: string;
    schoolId?: string | null;
    schoolIds?: string[];
    schoolNames?: string[];
    limit?: number;
  }) {
    const lim = params.limit ?? 12;
    const q = params.query.trim();
    const schoolIds = [...new Set([...(params.schoolIds ?? []), ...(params.schoolId ? [params.schoolId] : [])])];
    const schoolNames = [...new Set((params.schoolNames ?? []).filter(Boolean))];

    const requests: PromiseLike<{ data: any[] | null; error: any }>[] = [];
    const primaryReq = supabase
      .from('portal_users')
      .select('id, full_name, email, section_class')
      .eq('role', 'student')
      .eq('is_active', true)
      .ilike('full_name', `%${q}%`)
      .limit(lim);

    requests.push(schoolIds.length ? primaryReq.in('school_id', schoolIds) : primaryReq);

    if (schoolNames.length) {
      requests.push(
        supabase
          .from('portal_users')
          .select('id, full_name, email, section_class')
          .eq('role', 'student')
          .eq('is_active', true)
          .is('school_id', null)
          .in('school_name', schoolNames)
          .ilike('full_name', `%${q}%`)
          .limit(lim),
      );
    }

    const results = await Promise.all(requests);
    const merged = new Map<string, { id: string; full_name: string; email: string; section_class: string | null }>();
    for (const result of results) {
      if (result.error) throw result.error;
      for (const row of result.data ?? []) merged.set(row.id, row);
    }

    return Array.from(merged.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(0, lim);
  }

  async assignStudentToClass(
    studentId: string,
    classId: string,
    sectionClassName: string | null,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    const { cls, schoolName } = await this.assertRosterAccess({
      classId,
      callerRole: context?.callerRole,
      callerId: context?.callerId,
      callerSchoolId: context?.callerSchoolId,
    });

    const { data: studentRow, error: studentError } = await supabase
      .from('portal_users')
      .select('id, class_id, school_id, school_name')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle();
    if (studentError) throw studentError;
    if (!studentRow) throw new Error('Student not found');

    if (cls.school_id) {
      const sameById = studentRow.school_id === cls.school_id;
      const sameByName = !!(schoolName && studentRow.school_name === schoolName);
      if (!sameById && !sameByName) {
        throw new Error('This student belongs to a different school and cannot be added here.');
      }
    }

    const previousClassId = studentRow.class_id;
    const { error } = await supabase
      .from('portal_users')
      .update({ class_id: classId, section_class: sectionClassName })
      .eq('id', studentId)
      .eq('role', 'student');
    if (error) throw error;
    await this.syncCurrentStudents([classId, previousClassId ?? '']);
  }

  async removeStudentFromClass(
    studentId: string,
    classId: string,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    await this.assertRosterAccess({
      classId,
      callerRole: context?.callerRole,
      callerId: context?.callerId,
      callerSchoolId: context?.callerSchoolId,
    });
    const { error } = await supabase
      .from('portal_users')
      .update({ class_id: null, section_class: null })
      .eq('id', studentId)
      .eq('class_id', classId)
      .eq('role', 'student');
    if (error) throw error;
    await this.syncCurrentStudents([classId]);
  }

  async deleteClass(classId: string) {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) throw error;
  }
}

export const classService = new ClassService();


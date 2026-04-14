import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type PortalUser = Database['public']['Tables']['portal_users']['Row'];
export type Registration = Database['public']['Tables']['students']['Row'];

/** Fields used by admin / school student directory screens */
export type StudentDirectoryRow = Pick<
  PortalUser,
  'id' | 'full_name' | 'email' | 'school_name' | 'is_active' | 'created_at' | 'section_class'
>;

export class StudentService {
  async listStudents(schoolId?: string | null) {
    let query = supabase
      .from('portal_users')
      .select('*')
      .eq('role', 'student')
      .eq('is_deleted', false)
      .order('full_name', { ascending: true });

    if (schoolId) query = query.eq('school_id', schoolId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /** Invoice / billing pickers: active students, optional school scope. */
  async listActiveStudentsForBilling(params: { schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 200;
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email, school_id')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(lim);
    if (params.schoolId) q = q.eq('school_id', params.schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Registration (`students`) rows for bulk receipts / offline billing — not the same as portal roster.
   */
  async listRegistrationStudentsForBilling(params: { schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 300;
    let q = supabase
      .from('students')
      .select('id, name, full_name, email, student_email, school_id, school_name, parent_email')
      .eq('status', 'approved')
      .eq('is_active', true)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('name', { ascending: true })
      .limit(lim);
    if (params.schoolId) q = q.eq('school_id', params.schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      display_name: String(r.full_name || r.name || 'Student').trim(),
      email: String(r.student_email || r.email || '').trim(),
      school_id: r.school_id,
      school_name: r.school_name,
      parent_email: r.parent_email,
    }));
  }

  async getProspectiveStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async approveStudent(registrationId: string, data: Partial<PortalUser>) {
    const now = new Date().toISOString();
    const { error: createError } = await supabase.from('portal_users').insert({
      email: data.email!,
      full_name: data.full_name!,
      role: 'student',
      is_active: true,
      is_deleted: false,
      school_id: data.school_id || null,
      section_class: data.section_class || null,
      student_id: registrationId,
      created_at: now,
      updated_at: now,
    });

    if (createError) throw createError;

    await supabase
      .from('students')
      .update({ status: 'approved', updated_at: now })
      .eq('id', registrationId);

    return true;
  }

  async rejectStudent(registrationId: string) {
    const { error } = await supabase
      .from('students')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', registrationId);
    if (error) throw error;
    return true;
  }

  async createStudent(payload: Database['public']['Tables']['portal_users']['Insert']) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('portal_users')
      .insert({
        ...payload,
        role: 'student',
        is_active: payload.is_active ?? true,
        is_deleted: payload.is_deleted ?? false,
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateStudent(id: string, updates: Partial<PortalUser>) {
    const { data, error } = await supabase
      .from('portal_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteStudent(id: string) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  /** First `students.id` for a parent email (parent portal pickers). */
  async getFirstStudentRegistrationIdForParentEmail(parentEmail: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('parent_email', parentEmail)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  /** Linked portal user id from `students` registration row. */
  async getPortalUserIdForStudentRegistration(studentsTableId: string) {
    const { data, error } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentsTableId)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id ?? null;
  }

  /** Canonical parent -> student resolver used across parent result/grade/billing screens. */
  async resolveParentStudentPortalUserId(params: {
    explicitRegistrationId?: string | null;
    explicitPortalUserId?: string | null;
    parentEmail?: string | null;
  }) {
    if (params.explicitPortalUserId) return params.explicitPortalUserId;
    if (params.explicitRegistrationId) {
      return this.getPortalUserIdForStudentRegistration(params.explicitRegistrationId);
    }
    if (!params.parentEmail) return null;
    const registrations = await this.listRegistrationsForParentEmail(params.parentEmail);
    const firstWithPortalUser = registrations.find((row) => !!row.user_id);
    return firstWithPortalUser?.user_id ?? null;
  }

  /** Students linked to classes taught by this teacher (directory / roster). */
  async listStudentsByTeacherClasses(teacherId: string, limit = 200) {
    const { data: classes } = await supabase.from('classes').select('id').eq('teacher_id', teacherId);
    const classIds = (classes ?? []).map((c) => c.id);
    if (classIds.length === 0) return { rows: [] as StudentDirectoryRow[], total: 0 };

    const { data, count } = await supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, is_active, created_at, section_class', { count: 'exact' })
      .eq('role', 'student')
      .eq('is_deleted', false)
      .in('class_id', classIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    return {
      rows: (data ?? []) as StudentDirectoryRow[],
      total: count ?? data?.length ?? 0,
    };
  }

  /** Admin: all students; school role: scoped by `school_id`. */
  async listStudentsDirectory(params: { isAdmin: boolean; schoolId?: string | null; limit?: number }) {
    const limit = params.limit ?? 100;
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, is_active, created_at, section_class', { count: 'exact' })
      .eq('role', 'student')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!params.isAdmin && params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }

    const { data, count } = await q;
    return {
      rows: (data ?? []) as StudentDirectoryRow[],
      total: count ?? data?.length ?? 0,
    };
  }

  /** Student detail screen: portal profile row. */
  async getStudentPortalProfileForDetail(studentId: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, school_name, section_class, date_of_birth, is_active, created_at')
      .eq('id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getStudentRegistrationFieldsByUserId(userId: string) {
    const { data, error } = await supabase
      .from('students')
      .select('parent_email, parent_name, grade_level')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listSubmissionsForStudentDetail(portalUserId: string, limit = 40) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('id, status, grade, feedback, submitted_at, assignments(title, max_points, assignment_type)')
      .eq('portal_user_id', portalUserId)
      .order('submitted_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async countEnrollmentsForUser(userId: string) {
    const { count, error } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  async listProgressReportsForStudentPortalId(studentId: string, limit = 20) {
    const { data, error } = await supabase
      .from('student_progress_reports')
      .select(
        'id, course_name, report_term, overall_grade, overall_score, report_date, is_published, theory_score, practical_score, attendance_score, participation_score',
      )
      .eq('student_id', studentId)
      .order('report_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listAttendanceRowsForStudentDetail(userId: string, limit = 60) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, status, created_at, class_sessions(session_date, classes(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Parent hub: registration rows for `students.parent_email`. */
  async listRegistrationsForParentEmail(parentEmail: string) {
    const { data, error } = await supabase
      .from('students')
      .select(
        'id, full_name, school_name, grade_level, status, gender, date_of_birth, parent_relationship, user_id',
      )
      .eq('parent_email', parentEmail);
    if (error) throw error;
    return (data ?? []) as Pick<
      Registration,
      | 'id'
      | 'full_name'
      | 'school_name'
      | 'grade_level'
      | 'status'
      | 'gender'
      | 'date_of_birth'
      | 'parent_relationship'
      | 'user_id'
    >[];
  }

  /** Wipe Students screen: directory with optional school scope for teacher/school roles. */
  async listStudentsForWipeScreen(params: { restrictToSchoolId?: string | null }) {
    let query = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, is_active, created_at')
      .eq('role', 'student')
      .order('full_name')
      .limit(500);
    if (params.restrictToSchoolId) {
      query = query.eq('school_id', params.restrictToSchoolId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async bulkSetPortalStudentsActive(studentIds: string[], isActive: boolean) {
    if (!studentIds.length) return;
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .in('id', studentIds);
    if (error) throw error;
  }

  async bulkHardDeletePortalStudents(studentIds: string[]) {
    if (!studentIds.length) return;
    const { error } = await supabase.from('portal_users').delete().in('id', studentIds);
    if (error) throw error;
  }

  /** Public marketing registration → `students` pending row (approvals queue). Returns `id` for Paystack checkout (RLS may block `.select()` for anon). */
  async insertPublicStudentInterestRow(row: Database['public']['Tables']['students']['Insert']): Promise<{ id: string }> {
    const id =
      row.id ??
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    const { error } = await supabase.from('students').insert({ ...row, id });
    if (error) throw error;
    return { id };
  }
}

export const studentService = new StudentService();

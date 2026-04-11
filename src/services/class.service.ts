import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type ClassRow = Database['public']['Tables']['classes']['Row'];

export class ClassService {
  /** Add-class form: teachers visible in picker (no `is_active` filter — matches legacy UI). */
  async listTeachersForClassPicker(params: { schoolId?: string | null; isAdmin: boolean; limit?: number }) {
    const lim = params.limit ?? 100;
    let q = supabase.from('portal_users').select('id, full_name, email').eq('role', 'teacher').limit(lim);
    if (!params.isAdmin && params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listTeacherOptions(params: { schoolId?: string | null; isAdmin: boolean }) {
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(150);
    if (!params.isAdmin && params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
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

  async listClassesForManagement(params: { teacherId?: string; schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 150;
    let q = supabase
      .from('classes')
      .select(
        'id, name, description, teacher_id, program_id, school_id, current_students, max_students, schedule, status, created_at, programs(name), schools(name), portal_users!classes_teacher_id_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
      .limit(lim);
    if (params.teacherId) q = q.eq('teacher_id', params.teacherId);
    else if (params.schoolId) q = q.eq('school_id', params.schoolId);
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
  async getClassSessionIdForDate(classId: string, sessionDate: string) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('session_date', sessionDate)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  async insertClassSessionReturningId(row: Database['public']['Tables']['class_sessions']['Insert']) {
    const { data, error } = await supabase.from('class_sessions').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to create class session');
    return data.id;
  }

  async listActiveStudentsInClass(classId: string, limit = 300) {
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

  async searchStudentsForEnrollment(params: { query: string; schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 12;
    const q = params.query.trim();
    let req = supabase
      .from('portal_users')
      .select('id, full_name, email, section_class')
      .eq('role', 'student')
      .eq('is_active', true)
      .ilike('full_name', `%${q}%`)
      .limit(lim);
    if (params.schoolId) req = req.eq('school_id', params.schoolId);
    const { data, error } = await req;
    if (error) throw error;
    return data ?? [];
  }

  async assignStudentToClass(studentId: string, classId: string, sectionClassName: string) {
    const { error } = await supabase
      .from('portal_users')
      .update({ class_id: classId, section_class: sectionClassName })
      .eq('id', studentId);
    if (error) throw error;
  }

  async removeStudentFromClass(studentId: string, classId: string) {
    const { error } = await supabase
      .from('portal_users')
      .update({ class_id: null, section_class: null })
      .eq('id', studentId)
      .eq('class_id', classId);
    if (error) throw error;
  }

  async deleteClass(classId: string) {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) throw error;
  }
}

export const classService = new ClassService();

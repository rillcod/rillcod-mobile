import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type PortalUser = Database['public']['Tables']['portal_users']['Row'];

export type TeacherDirectoryRow = Pick<
  PortalUser,
  'id' | 'full_name' | 'email' | 'phone' | 'school_name' | 'is_active' | 'created_at'
> & { school_count?: number };

export class TeacherService {
  async listTeachers(schoolId?: string | null) {
    let query = supabase
      .from('portal_users')
      .select('*')
      .eq('role', 'teacher')
      .eq('is_deleted', false)
      .order('full_name', { ascending: true });

    if (schoolId) query = query.eq('school_id', schoolId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getTeacherDetail(teacherId: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('*, schools(name)')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single();
    if (error) throw error;
    return data;
  }

  async createTeacher(payload: Database['public']['Tables']['portal_users']['Insert']) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('portal_users')
      .insert({
        ...payload,
        role: 'teacher',
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

  async updateTeacher(id: string, updates: Partial<PortalUser>) {
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

  async deleteTeacher(id: string) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  /** School ids linked to a teacher (for scoped reports / rosters). */
  async listSchoolIdsForTeacher(teacherId: string, fallbackSchoolId?: string | null) {
    const { data: ts } = await supabase
      .from('teacher_schools')
      .select('school_id')
      .eq('teacher_id', teacherId);
    const ids = (ts ?? []).map((r: { school_id: string }) => r.school_id).filter(Boolean);
    if (ids.length === 0 && fallbackSchoolId) return [fallbackSchoolId];
    return ids;
  }

  /** Admin teachers list with `school_count` from `teacher_schools`. */
  async listTeachersAdminWithSchoolCounts(limit = 200): Promise<TeacherDirectoryRow[]> {
    const { data } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, school_name, is_active, created_at')
      .eq('role', 'teacher')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data?.length) return [];

    const ids = data.map((t) => t.id);
    const { data: assignments } = await supabase.from('teacher_schools').select('teacher_id').in('teacher_id', ids);

    const countMap: Record<string, number> = {};
    (assignments ?? []).forEach((a: { teacher_id: string }) => {
      countMap[a.teacher_id] = (countMap[a.teacher_id] ?? 0) + 1;
    });

    return data.map((t) => ({
      ...t,
      school_count: countMap[t.id] ?? 0,
    }));
  }

  /** Teacher detail: school links with `schools` row for navigation. */
  async listTeacherSchoolLinksForDetail(teacherId: string, limit = 20) {
    const { data, error } = await supabase
      .from('teacher_schools')
      .select('id, school_id, is_primary, schools!teacher_schools_school_id_fkey(id, name, state, status)')
      .eq('teacher_id', teacherId)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Add / edit teacher screen: profile row + `teacher_schools` with school names. */
  async loadTeacherEditorState(teacherId: string) {
    const [userRes, assignRes] = await Promise.all([
      supabase
        .from('portal_users')
        .select('id, full_name, email, phone, bio, school_id, school_name')
        .eq('id', teacherId)
        .maybeSingle(),
      supabase
        .from('teacher_schools')
        .select('school_id, is_primary, schools!teacher_schools_school_id_fkey(id, name)')
        .eq('teacher_id', teacherId),
    ]);
    if (userRes.error) throw userRes.error;
    if (assignRes.error) throw assignRes.error;
    return { teacher: userRes.data, assignments: assignRes.data ?? [] };
  }

  /** Replace all school links (trigger syncs `portal_users.school_id` for primary). */
  async replaceTeacherSchoolAssignments(params: {
    teacherId: string;
    schoolIds: string[];
    primarySchoolId: string;
    assignedBy: string | null;
  }) {
    const { error: delErr } = await supabase.from('teacher_schools').delete().eq('teacher_id', params.teacherId);
    if (delErr) throw delErr;
    if (params.schoolIds.length === 0) return;
    const rows = params.schoolIds.map((sid) => ({
      teacher_id: params.teacherId,
      school_id: sid,
      assigned_by: params.assignedBy,
      is_primary: sid === params.primarySchoolId,
    }));
    const { error } = await supabase.from('teacher_schools').insert(rows);
    if (error) throw error;
  }

  /** After Auth sign-up (or existing auth user): upsert `portal_users` by email. */
  async upsertTeacherPortalAfterSignUp(row: {
    userId?: string | null;
    email: string;
    full_name: string;
    phone: string | null;
    bio: string | null;
  }) {
    const { data, error } = await supabase
      .from('portal_users')
      .upsert(
        {
          ...(row.userId ? { id: row.userId } : {}),
          email: row.email,
          full_name: row.full_name,
          role: 'teacher',
          phone: row.phone,
          bio: row.bio,
          is_active: true,
          is_deleted: false,
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to create teacher');
    return data.id;
  }

  /** School partner: teachers assigned via `teacher_schools`. */
  async listTeachersForSchoolPartner(schoolId: string): Promise<TeacherDirectoryRow[]> {
    const { data: assignments } = await supabase
      .from('teacher_schools')
      .select(
        'teacher_id, is_primary, portal_users!teacher_schools_teacher_id_fkey(id, full_name, email, phone, school_name, is_active, created_at)',
      )
      .eq('school_id', schoolId)
      .order('is_primary', { ascending: false });

    return ((assignments ?? []) as any[])
      .map((a) => {
        const pu = Array.isArray(a.portal_users) ? a.portal_users[0] : a.portal_users;
        return { ...pu, school_count: undefined } as TeacherDirectoryRow;
      })
      .filter((t) => !!t?.id);
  }

  /** School detail: assign teacher and return row shaped like the screen’s `normalizeAssignment` input. */
  async insertTeacherSchoolAssignmentReturningRow(params: {
    schoolId: string;
    teacherId: string;
    assignedBy: string | null;
  }) {
    const { data, error } = await supabase
      .from('teacher_schools')
      .insert({
        school_id: params.schoolId,
        teacher_id: params.teacherId,
        assigned_by: params.assignedBy,
      })
      .select('id, teacher_id, portal_users!teacher_schools_teacher_id_fkey(id, full_name, email)')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteTeacherSchoolAssignmentById(assignmentId: string) {
    const { error } = await supabase.from('teacher_schools').delete().eq('id', assignmentId);
    if (error) throw error;
  }
}

export const teacherService = new TeacherService();

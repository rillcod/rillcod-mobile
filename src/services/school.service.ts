import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type School = Database['public']['Tables']['schools']['Row'];

export type SchoolDirectoryRow = Pick<
  School,
  'id' | 'name' | 'contact_person' | 'email' | 'phone' | 'address' | 'state' | 'status' | 'created_at'
>;

export class SchoolService {
  async listSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /** Approved schools for pickers (bulk enrol, class create). */
  async listApprovedSchoolsMini(limit = 200) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async getProspectiveSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('status', 'pending')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async approveSchool(schoolId: string) {
    const { error } = await supabase
      .from('schools')
      .update({ status: 'approved', is_active: true, updated_at: new Date().toISOString() })
      .eq('id', schoolId);
    if (error) throw error;
    return true;
  }

  async getSchoolDetail(schoolId: string) {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    if (error) throw error;
    return data;
  }

  async registerSchool(payload: Database['public']['Tables']['schools']['Insert']) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('schools')
      .insert({
        ...payload,
        status: 'pending',
        is_active: payload.is_active ?? true,
        is_deleted: false,
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateSchool(id: string, updates: Partial<School>) {
    const { data, error } = await supabase
      .from('schools')
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

  async deleteSchool(id: string) {
    const { error } = await supabase
      .from('schools')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  /** Linked student portal user IDs for the authenticated parent (uses `get_parent_student_ids` RPC). */
  async getParentStudentIds() {
    const { data, error } = await supabase.rpc('get_parent_student_ids');
    if (error) throw error;
    return data ?? [];
  }

  async listApprovedSchoolOptions(limit = 100) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name')
      .eq('status', 'approved')
      .order('name')
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Public school registration: status lookup by applicant email (latest row). */
  async getLatestSchoolApplicationByEmail(email: string) {
    const { data, error } = await supabase
      .from('schools')
      .select('name, status, created_at')
      .eq('email', email.trim().toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Admin add-school flow: insert with caller-controlled `status` (e.g. pending vs approved). */
  async insertSchoolReturningIdName(row: Database['public']['Tables']['schools']['Insert']) {
    const { data, error } = await supabase.from('schools').insert(row).select('id, name').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Could not create school');
    return data;
  }

  /** When a school is approved, ensure a `school` role portal row exists (matches Add School screen upsert). */
  async upsertSchoolPortalUserByEmail(params: {
    email: string;
    full_name: string;
    school_id: string;
    school_name: string;
  }) {
    const { error } = await supabase.from('portal_users').upsert(
      {
        email: params.email,
        full_name: params.full_name,
        role: 'school',
        is_active: true,
        is_deleted: false,
        school_id: params.school_id,
        school_name: params.school_name,
      },
      { onConflict: 'email' },
    );
    if (error) throw error;
  }

  async getSchoolOptionRow(schoolId: string) {
    const { data, error } = await supabase.from('schools').select('id, name').eq('id', schoolId).limit(1);
    if (error) throw error;
    return data ?? [];
  }

  /** Admin schools list (non-deleted, recent first) — matches Schools screen columns. */
  async listSchoolsForAdminScreen(limit = 100): Promise<SchoolDirectoryRow[]> {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, contact_person, email, phone, address, state, status, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as SchoolDirectoryRow[];
  }

  /** `SchoolDetailScreen` initial load: school row, assignments, students, optional teacher picker pool. */
  async loadSchoolDetailScreenData(schoolId: string, options: { includeTeacherPicker: boolean }) {
    const schoolP = supabase.from('schools').select('*').eq('id', schoolId).single();
    const assignP = supabase
      .from('teacher_schools')
      .select('id, teacher_id, portal_users!teacher_schools_teacher_id_fkey(id, full_name, email)')
      .eq('school_id', schoolId)
      .limit(50);
    const studentsP = supabase
      .from('portal_users')
      .select('id, full_name, email, section_class')
      .eq('role', 'student')
      .eq('school_id', schoolId)
      .limit(100);
    const teachersP = options.includeTeacherPicker
      ? supabase
          .from('portal_users')
          .select('id, full_name, email')
          .eq('role', 'teacher')
          .eq('is_active', true)
          .limit(100)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[], error: null });

    const [schoolRes, assignRes, studentsRes, teachersRes] = await Promise.all([
      schoolP,
      assignP,
      studentsP,
      teachersP,
    ]);

    if (schoolRes.error) throw schoolRes.error;

    return {
      school: schoolRes.data,
      assignmentRows: assignRes.data ?? [],
      students: studentsRes.data ?? [],
      teacherPickerPool: teachersRes.data ?? [],
    };
  }

  /** School partner overview: KPIs + top students by mean assignment grade (scoped by `school_id` on linked portal users). */
  async fetchSchoolOverviewDashboard(schoolId: string) {
    const [stuRes, teachRes, classRes, approvalRes] = await Promise.all([
      supabase
        .from('portal_users')
        .select('id, is_active', { count: 'exact', head: false })
        .eq('role', 'student')
        .eq('school_id', schoolId),
      supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('school_id', schoolId),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('school_id', schoolId)
        .eq('is_active', false),
    ]);

    const allStudents = stuRes.data || [];
    const activeCount = allStudents.filter((s: { is_active?: boolean | null }) => s.is_active).length;

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { data: sessionRows } = await supabase
      .from('class_sessions')
      .select('id')
      .gte('session_date', today)
      .lt('session_date', tomorrow);
    const sessionIds = (sessionRows ?? []).map((row: { id: string }) => row.id);
    const { count: attCount } = sessionIds.length
      ? await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .in('session_id', sessionIds)
          .eq('status', 'present')
      : { count: 0 };

    const stats = {
      students: stuRes.count ?? allStudents.length,
      teachers: teachRes.count ?? 0,
      classes: classRes.count ?? 0,
      attendance_today: attCount ?? 0,
      active_students: activeCount,
      pending_approvals: approvalRes.count ?? 0,
    };

    const { data: subData } = await supabase
      .from('assignment_submissions')
      .select(
        'portal_user_id, grade, portal_users!assignment_submissions_portal_user_id_fkey(full_name, school_id)',
      )
      .eq('status', 'graded')
      .not('grade', 'is', null)
      .limit(200);

    const grouped: Record<string, { name: string; total: number; count: number }> = {};
    for (const s of subData ?? []) {
      const row = s as {
        portal_user_id: string;
        grade: number | null;
        portal_users?: { full_name?: string | null; school_id?: string | null } | null;
      };
      const u = row.portal_users;
      if (!u || u.school_id !== schoolId) continue;
      if (!grouped[row.portal_user_id]) {
        grouped[row.portal_user_id] = { name: u.full_name ?? '', total: 0, count: 0 };
      }
      grouped[row.portal_user_id].total += row.grade ?? 0;
      grouped[row.portal_user_id].count += 1;
    }
    const topStudents = Object.entries(grouped)
      .map(([id, v]) => ({ id, full_name: v.name, total_grade: Math.round(v.total / v.count) }))
      .sort((a, b) => b.total_grade - a.total_grade)
      .slice(0, 5);

    return { stats, topStudents };
  }
}

export const schoolService = new SchoolService();

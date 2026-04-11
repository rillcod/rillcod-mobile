import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type AdminDirectoryUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  school_id: string | null;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
  section_class: string | null;
  last_login: string | null;
  linked_school_count?: number;
};

export class PortalUserAdminService {
  async listUsersForAdminScreen(limit = 200): Promise<AdminDirectoryUserRow[]> {
    const { data, error } = await supabase
      .from('portal_users')
      .select(
        'id, full_name, email, role, school_name, school_id, is_active, created_at, section_class, phone, last_login',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const rows = (data ?? []) as AdminDirectoryUserRow[];
    const teacherIds = rows.filter((u) => u.role === 'teacher').map((u) => u.id);
    const linkedSchoolMap: Record<string, number> = {};
    if (teacherIds.length > 0) {
      const { data: teacherLinks } = await supabase
        .from('teacher_schools')
        .select('teacher_id')
        .in('teacher_id', teacherIds);
      (teacherLinks ?? []).forEach((row: { teacher_id: string }) => {
        linkedSchoolMap[row.teacher_id] = (linkedSchoolMap[row.teacher_id] ?? 0) + 1;
      });
    }
    return rows.map((user) => ({
      ...user,
      linked_school_count: linkedSchoolMap[user.id] ?? (user.school_id ? 1 : 0),
    }));
  }

  async setPortalUserActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive })
      .eq('id', userId);
    if (error) throw error;
  }

  async hardDeletePortalUser(userId: string) {
    const { error } = await supabase.from('portal_users').delete().eq('id', userId);
    if (error) throw error;
  }

  async updatePortalUserAdminEdit(
    userId: string,
    payload: Pick<
      Database['public']['Tables']['portal_users']['Update'],
      'full_name' | 'role' | 'phone' | 'is_active' | 'school_id' | 'school_name'
    >,
  ) {
    const { error } = await supabase.from('portal_users').update(payload).eq('id', userId);
    if (error) throw error;
  }
}

export const portalUserAdminService = new PortalUserAdminService();

import { supabase } from '../lib/supabase';

export type ParentDirectoryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
  child_count?: number;
  approved_children?: number;
};

export class ParentService {
  async getPortalProfileForParentDetail(parentId: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, is_active, created_at')
      .eq('id', parentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listRegistrationChildrenByParentEmail(parentEmail: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, school_name, current_class, status, user_id, parent_relationship')
      .eq('parent_email', parentEmail)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async setPortalUserActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }

  async clearStudentParentLink(studentId: string) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: null,
        parent_name: null,
        parent_phone: null,
        parent_relationship: null,
      })
      .eq('id', studentId);
    if (error) throw error;
  }

  async listParentsDirectoryWithChildStats(limit = 200): Promise<ParentDirectoryRow[]> {
    const { data: parentRows, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, is_active, created_at')
      .eq('role', 'parent')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const parentsData = (parentRows ?? []) as ParentDirectoryRow[];
    if (!parentsData.length) return [];

    const emails = parentsData.map((item) => item.email).filter(Boolean);
    const { data: childRows } = emails.length
      ? await supabase.from('students').select('id, parent_email, status').in('parent_email', emails)
      : { data: [] };

    const counts: Record<string, { total: number; approved: number }> = {};
    (childRows ?? []).forEach((child: { parent_email: string | null; status: string | null }) => {
      if (!child.parent_email) return;
      if (!counts[child.parent_email]) counts[child.parent_email] = { total: 0, approved: 0 };
      counts[child.parent_email].total += 1;
      if (child.status === 'approved') counts[child.parent_email].approved += 1;
    });

    return parentsData.map((item) => ({
      ...item,
      child_count: counts[item.email]?.total ?? 0,
      approved_children: counts[item.email]?.approved ?? 0,
    }));
  }

  async updateParentPortalProfile(params: {
    parentId: string;
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
  }) {
    const { error } = await supabase
      .from('portal_users')
      .update({
        full_name: params.full_name,
        email: params.email,
        phone: params.phone,
        is_active: params.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.parentId);
    if (error) throw error;
  }

  async syncStudentsParentContactByOldEmail(params: {
    oldEmail: string;
    newEmail: string;
    newName: string;
    newPhone: string | null;
  }) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: params.newEmail,
        parent_name: params.newName,
        parent_phone: params.newPhone,
      })
      .eq('parent_email', params.oldEmail);
    if (error) throw error;
  }

  async signUpParentAndUpsertPortal(params: {
    email: string;
    password: string;
    full_name: string;
    phone: string | null;
    is_active: boolean;
  }) {
    const signUp = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: { data: { full_name: params.full_name, role: 'parent' } },
    });
    if (signUp.error && !signUp.error.message.toLowerCase().includes('already registered')) {
      throw signUp.error;
    }
    const userId = signUp.data.user?.id;
    const { error } = await supabase.from('portal_users').upsert(
      {
        ...(userId ? { id: userId } : {}),
        email: params.email,
        full_name: params.full_name,
        phone: params.phone,
        role: 'parent',
        is_active: params.is_active,
        is_deleted: false,
      },
      { onConflict: 'email' },
    );
    if (error) throw error;
    return { tempPassword: params.password };
  }

  async unlinkStudentsByParentEmail(parentEmail: string) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: null,
        parent_name: null,
        parent_phone: null,
        parent_relationship: null,
      })
      .eq('parent_email', parentEmail);
    if (error) throw error;
  }

  async deleteParentPortalUser(parentId: string) {
    const { error } = await supabase.from('portal_users').delete().eq('id', parentId);
    if (error) throw error;
  }

  async toggleParentPortalActive(parentId: string, isActive: boolean) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', parentId);
    if (error) throw error;
  }
}

export const parentService = new ParentService();

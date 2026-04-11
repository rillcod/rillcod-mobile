import { supabase } from '../lib/supabase';

export class ProjectService {
  async listLabProjectsForScreen(params: { isStaff: boolean; currentUserId: string }) {
    let q = supabase
      .from('lab_projects')
      .select(
        params.isStaff
          ? 'id, user_id, title, updated_at, portal_users!lab_projects_user_id_fkey(full_name)'
          : 'id, user_id, title, updated_at',
      )
      .order('updated_at', { ascending: false });
    if (!params.isStaff) q = q.eq('user_id', params.currentUserId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listPortfolioProjectsForScreen(params: { isStaff: boolean; currentUserId: string }) {
    let q = supabase
      .from('portfolio_projects')
      .select(
        params.isStaff
          ? 'id, user_id, title, updated_at, portal_users!portfolio_projects_user_id_fkey(full_name)'
          : 'id, user_id, title, updated_at',
      )
      .order('updated_at', { ascending: false });
    if (!params.isStaff) q = q.eq('user_id', params.currentUserId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getLabProjectById(projectId: string) {
    const { data, error } = await supabase
      .from('lab_projects')
      .select(
        'id, title, language, code, blocks_xml, preview_url, assignment_id, lesson_id, updated_at, portal_users!lab_projects_user_id_fkey(full_name)',
      )
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getPortfolioProjectById(projectId: string) {
    const { data, error } = await supabase
      .from('portfolio_projects')
      .select(
        'id, title, description, tags, project_url, image_url, category, is_featured, created_at, updated_at, portal_users!portfolio_projects_user_id_fkey(full_name)',
      )
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listOwnLabProjects(userId: string, limit = 40) {
    const { data, error } = await supabase
      .from('lab_projects')
      .select('id, title, language, code, blocks_xml, preview_url, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updateLabProject(projectId: string, payload: { title: string; language: string; code: string; updated_at: string }) {
    const { error } = await supabase.from('lab_projects').update(payload).eq('id', projectId);
    if (error) throw error;
  }

  async insertLabProjectReturningId(row: {
    user_id: string;
    title: string;
    language: string;
    code: string;
    is_public: boolean;
  }) {
    const { data, error } = await supabase.from('lab_projects').insert(row).select('id').single();
    if (error) throw error;
    return data?.id ?? null;
  }

  async deleteLabProject(projectId: string) {
    const { error } = await supabase.from('lab_projects').delete().eq('id', projectId);
    if (error) throw error;
  }

  async listOwnPortfolioProjectsForStudent(userId: string) {
    const { data, error } = await supabase
      .from('portfolio_projects')
      .select('id, title, description, category, project_url, image_url, tags, is_featured, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async updatePortfolioProject(
    projectId: string,
    payload: {
      title: string;
      description: string | null;
      category: string;
      project_url: string | null;
      image_url: string | null;
      tags: string[];
      updated_at: string;
    },
  ) {
    const { error } = await supabase.from('portfolio_projects').update(payload).eq('id', projectId);
    if (error) throw error;
  }

  async insertPortfolioProject(row: {
    user_id: string;
    title: string;
    description: string | null;
    category: string;
    project_url: string | null;
    image_url: string | null;
    tags: string[];
  }) {
    const { error } = await supabase.from('portfolio_projects').insert(row);
    if (error) throw error;
  }

  async deletePortfolioProject(projectId: string) {
    const { error } = await supabase.from('portfolio_projects').delete().eq('id', projectId);
    if (error) throw error;
  }
}

export const projectService = new ProjectService();

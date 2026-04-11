import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Announcement = Database['public']['Tables']['announcements']['Row'];
export type AnnouncementBoardRow = Pick<
  Announcement,
  'id' | 'title' | 'content' | 'target_audience' | 'created_at' | 'school_id'
>;

export interface AnnouncementInput {
  title: string;
  content: string;
  target_audience?: string | null;
  is_active?: boolean;
  school_id?: string | null;
}

export class AnnouncementService {
  async listAnnouncements(audience?: string, limit: number = 20) {
    let query = supabase
      .from('announcements')
      .select('*, portal_users(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (audience && audience !== 'admin') {
      query = query.in('target_audience', ['all', audience]);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getAnnouncement(id: string) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, portal_users(full_name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /** Active rows for Messages “board” (same scoping as mobile Messages screen). */
  async listActiveForBoard(params: { isAdmin: boolean; schoolId?: string | null; limit?: number }) {
    const limit = params.limit ?? 50;
    let q = supabase
      .from('announcements')
      .select('id, title, content, target_audience, created_at, school_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!params.isAdmin) {
      if (params.schoolId) {
        q = q.or(`school_id.eq.${params.schoolId},school_id.is.null`);
      } else {
        q = q.is('school_id', null);
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as AnnouncementBoardRow[];
  }

  async createAnnouncement(input: AnnouncementInput, authorId: string) {
    const { data, error } = await supabase
      .from('announcements')
      .insert([
        {
          title: input.title,
          content: input.content,
          author_id: authorId,
          target_audience: input.target_audience ?? 'all',
          is_active: input.is_active !== false,
          school_id: input.school_id ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAnnouncement(id: string, updates: Partial<AnnouncementInput>) {
    const { data, error } = await supabase
      .from('announcements')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAnnouncement(id: string) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

export const announcementService = new AnnouncementService();

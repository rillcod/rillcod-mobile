import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type ParentFeedbackInsert = Database['public']['Tables']['parent_feedback']['Insert'];
export type ParentFeedbackStatus = Database['public']['Tables']['parent_feedback']['Row']['status'];

export class FeedbackService {
  async listParentFeedbackForStaff(params: { statusFilter: string; limit?: number }) {
    const lim = params.limit ?? 100;
    let q = supabase
      .from('parent_feedback')
      .select(
        'id, created_at, category, rating, message, is_anonymous, status, portal_users!parent_feedback_portal_user_id_fkey(full_name, email, school_name)',
      )
      .order('created_at', { ascending: false })
      .limit(lim);
    if (params.statusFilter !== 'all') {
      q = q.eq('status', params.statusFilter as NonNullable<ParentFeedbackStatus>);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      category: row.category,
      rating: row.rating ?? null,
      message: row.message,
      is_anonymous: row.is_anonymous,
      status: row.status,
      parent_name: row.is_anonymous ? null : row.portal_users?.full_name ?? null,
      parent_email: row.is_anonymous ? null : row.portal_users?.email ?? null,
      school_name: row.portal_users?.school_name ?? null,
    }));
  }

  async submitParentFeedback(row: ParentFeedbackInsert) {
    const { error } = await supabase.from('parent_feedback').insert(row);
    if (error) throw error;
  }

  async updateParentFeedbackStatus(id: string, status: NonNullable<ParentFeedbackStatus>) {
    const { error } = await supabase
      .from('parent_feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}

export const feedbackService = new FeedbackService();

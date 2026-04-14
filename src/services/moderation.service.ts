import { supabase } from '../lib/supabase';

export type ModerationStatus = 'pending' | 'reviewed' | 'dismissed' | 'removed';

export interface FlaggedItem {
  id: string;
  reporter_id: string;
  content_id: string;
  content_type: 'topic' | 'reply' | string;
  reason: string;
  status: ModerationStatus;
  moderator_notes?: string;
  moderator_id?: string;
  created_at: string;
  updated_at: string;
  reporter?: {
    full_name: string;
    email: string;
  };
}

export class ModerationService {
  async listFlaggedContent(status?: ModerationStatus | 'all', limit = 100) {
    let query = supabase
      .from('flagged_content')
      .select('*, reporter:portal_users!flagged_content_reporter_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as FlaggedItem[];
  }

  async resolveFlaggedItem(id: string, moderatorId: string, status: ModerationStatus, notes?: string) {
    const { data, error } = await supabase
      .from('flagged_content')
      .update({
        status,
        moderator_id: moderatorId,
        moderator_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as FlaggedItem;
  }

  async resolveFlag(id: string, status: ModerationStatus, notes?: string, moderatorId?: string) {
    const actor = moderatorId ?? null;
    const { data, error } = await supabase
      .from('flagged_content')
      .update({
        status,
        moderator_notes: notes || null,
        moderator_id: actor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as FlaggedItem;
  }

  async flagContent(reporterId: string, contentId: string, contentType: string, reason: string, metadata?: any) {
    const { data, error } = await supabase
      .from('flagged_content')
      .insert([{
        reporter_id: reporterId,
        content_id: contentId,
        content_type: contentType,
        reason,
        metadata,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data as FlaggedItem;
  }
}

export const moderationService = new ModerationService();

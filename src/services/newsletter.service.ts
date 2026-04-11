import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type NewsletterRow = Pick<
  Database['public']['Tables']['newsletters']['Row'],
  'id' | 'title' | 'content' | 'status' | 'created_at' | 'published_at' | 'image_url' | 'author_id' | 'school_id'
>;

export type NewsletterDeliveryStatRow = {
  newsletter_id: string | null;
  user_id: string | null;
  is_viewed: boolean | null;
};

export type AudienceRole = 'students' | 'teachers' | 'schools' | 'parents';

export class NewsletterService {
  async listNewslettersForStaff(params: { schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 120;
    let q = supabase
      .from('newsletters')
      .select('id, title, content, status, created_at, published_at, image_url, author_id, school_id')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (params.schoolId) q = q.eq('school_id', params.schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as NewsletterRow[];
  }

  async aggregateDeliveryStatsByNewsletterIds(newsletterIds: string[]) {
    if (!newsletterIds.length) return {} as Record<string, { total: number; viewed: number }>;
    const { data, error } = await supabase
      .from('newsletter_delivery')
      .select('newsletter_id, user_id, is_viewed')
      .in('newsletter_id', newsletterIds);
    if (error) throw error;
    const nextMap: Record<string, { total: number; viewed: number }> = {};
    ((data ?? []) as NewsletterDeliveryStatRow[]).forEach((row) => {
      if (!row.newsletter_id) return;
      if (!nextMap[row.newsletter_id]) nextMap[row.newsletter_id] = { total: 0, viewed: 0 };
      nextMap[row.newsletter_id].total += 1;
      if (row.is_viewed) nextMap[row.newsletter_id].viewed += 1;
    });
    return nextMap;
  }

  async loadPublishedNewslettersForReader(userId: string) {
    const { data: deliveries, error: dErr } = await supabase
      .from('newsletter_delivery')
      .select('newsletter_id, is_viewed')
      .eq('user_id', userId)
      .order('delivered_at', { ascending: false });
    if (dErr) throw dErr;
    const newsletterIds = ((deliveries ?? []) as NewsletterDeliveryStatRow[])
      .map((item) => item.newsletter_id)
      .filter((value): value is string => !!value);

    if (newsletterIds.length === 0) {
      return { newsletters: [] as NewsletterRow[], deliveryMap: {} as Record<string, { total: number; viewed: number }> };
    }

    const { data: items, error } = await supabase
      .from('newsletters')
      .select('id, title, content, status, created_at, published_at, image_url, author_id, school_id')
      .in('id', newsletterIds)
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) throw error;

    await supabase
      .from('newsletter_delivery')
      .update({ is_viewed: true })
      .eq('user_id', userId)
      .in('newsletter_id', newsletterIds)
      .eq('is_viewed', false);

    return { newsletters: (items ?? []) as NewsletterRow[], deliveryMap: {} };
  }

  async upsertNewsletterDraft(params: {
    id?: string | null;
    title: string;
    content: string;
    authorId: string | null;
    schoolId: string | null;
  }) {
    const payload = {
      title: params.title,
      content: params.content,
      author_id: params.authorId,
      school_id: params.schoolId,
      status: 'draft' as const,
    };
    if (params.id) {
      const { error } = await supabase.from('newsletters').update(payload).eq('id', params.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('newsletters').insert(payload);
      if (error) throw error;
    }
  }

  async publishNewsletterToAudience(params: {
    newsletterId: string;
    schoolScopeId?: string | null;
    audience: 'all' | AudienceRole;
  }) {
    let recipientsQuery = supabase.from('portal_users').select('id').eq('is_active', true);
    if (params.schoolScopeId) {
      recipientsQuery = recipientsQuery.eq('school_id', params.schoolScopeId);
    }
    if (params.audience !== 'all') {
      const roleMap: Record<AudienceRole, string> = {
        students: 'student',
        teachers: 'teacher',
        schools: 'school',
        parents: 'parent',
      };
      recipientsQuery = recipientsQuery.eq('role', roleMap[params.audience]);
    }
    const { data: recipients, error: recipientError } = await recipientsQuery.limit(500);
    if (recipientError) throw recipientError;
    const recipientIds = (recipients ?? []).map((item: { id: string }) => item.id).filter(Boolean);
    if (recipientIds.length === 0) {
      throw new Error('NO_RECIPIENTS');
    }
    const deliveryRows = recipientIds.map((uid: string) => ({
      newsletter_id: params.newsletterId,
      user_id: uid,
    }));
    const { error: deliveryError } = await supabase.from('newsletter_delivery').insert(deliveryRows);
    if (deliveryError) throw deliveryError;
    const { error: publishError } = await supabase
      .from('newsletters')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', params.newsletterId);
    if (publishError) throw publishError;
    return recipientIds.length;
  }

  async deleteNewsletter(id: string) {
    const { error } = await supabase.from('newsletters').delete().eq('id', id);
    if (error) throw error;
  }
}

export const newsletterService = new NewsletterService();

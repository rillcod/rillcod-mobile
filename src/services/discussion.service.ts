import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { gamificationService } from './gamification.service';

export type Topic = Database['public']['Tables']['discussion_topics']['Row'];
export type Reply = Database['public']['Tables']['discussion_replies']['Row'];

export class DiscussionService {
  async listTopics(courseId: string) {
    const { data, error } = await supabase
      .from('discussion_topics')
      .select('*, portal_users(full_name, avatar_url)')
      .eq('course_id', courseId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getTopicDetail(topicId: string) {
    const { data: topic, error: topicError } = await supabase
      .from('discussion_topics')
      .select('*, portal_users(full_name, avatar_url, role)')
      .eq('id', topicId)
      .single();

    if (topicError) throw topicError;

    const { data: replies, error: replyError } = await supabase
      .from('discussion_replies')
      .select('*, portal_users(full_name, avatar_url, role)')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true });

    if (replyError) throw replyError;

    return { topic, replies: replies ?? [] };
  }

  async createTopic(courseId: string, authorId: string, title: string, content: string) {
    const now = new Date().toISOString();
    const { data: topic, error } = await supabase
      .from('discussion_topics')
      .insert([{
        course_id: courseId,
        created_by: authorId,
        title,
        content,
        created_at: now,
        updated_at: now,
      }])
      .select()
      .single();

    if (error) throw error;

    // Award XP
    await gamificationService.awardPoints(authorId, 'discussion_post', topic.id, 'Started a new discussion');

    return topic;
  }

  async createReply(topicId: string, authorId: string, content: string, parentReplyId?: string) {
    const now = new Date().toISOString();
    const { data: reply, error } = await supabase
      .from('discussion_replies')
      .insert([{
        topic_id: topicId,
        created_by: authorId,
        content,
        parent_reply_id: parentReplyId || null,
        created_at: now,
        updated_at: now,
      }])
      .select()
      .single();

    if (error) throw error;

    // Award XP
    await gamificationService.awardPoints(authorId, 'discussion_post', reply.id, 'Replied to a discussion');

    return reply;
  }

  async upvote(type: 'topic' | 'reply', id: string) {
    const table = type === 'topic' ? 'discussion_topics' : 'discussion_replies';
    
    // In a real system, track if user already upvoted
    const { data } = await supabase.from(table).select('upvotes').eq('id', id).single();
    const current = data?.upvotes || 0;

    const { error } = await supabase
      .from(table)
      .update({ upvotes: current + 1 })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async moderate(topicId: string, action: 'pin' | 'lock' | 'unpin' | 'unlock' | 'resolve') {
    const updates: any = {};
    if (action === 'pin') updates.is_pinned = true;
    if (action === 'unpin') updates.is_pinned = false;
    if (action === 'lock') updates.is_locked = true;
    if (action === 'unlock') updates.is_locked = false;
    if (action === 'resolve') updates.is_resolved = true;

    const { error } = await supabase.from('discussion_topics').update(updates).eq('id', topicId);
    if (error) throw error;
    return true;
  }

  async searchDiscussions(courseId: string, query: string) {
    const { data, error } = await supabase
      .from('discussion_topics')
      .select('*, portal_users(full_name)')
      .eq('course_id', courseId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

    if (error) throw error;
    return data ?? [];
  }
}

export const discussionService = new DiscussionService();

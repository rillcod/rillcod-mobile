import { supabase } from '../lib/supabase';

export class EngageService {
  async listEngagePostsWithAuthors(limit = 100) {
    const { data, error } = await supabase
      .from('engage_posts')
      .select(
        'id, user_id, title, content, code_snippet, likes, created_at, portal_users!engage_posts_user_id_fkey(full_name, role)',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async incrementPostLikes(postId: string, nextLikes: number) {
    const { error } = await supabase.from('engage_posts').update({ likes: nextLikes }).eq('id', postId);
    if (error) throw error;
  }

  async deleteEngagePost(postId: string) {
    const { error } = await supabase.from('engage_posts').delete().eq('id', postId);
    if (error) throw error;
  }

  async insertEngagePost(row: {
    user_id: string;
    author_name: string;
    title: string;
    content: string;
    code_snippet: string | null;
    language: string | null;
    likes: number;
  }) {
    const { error } = await supabase.from('engage_posts').insert(row);
    if (error) throw error;
  }
}

export const engageService = new EngageService();

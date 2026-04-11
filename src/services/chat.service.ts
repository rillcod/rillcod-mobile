import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export class ChatService {
  /** Recent messages for inbox grouping (newest first). */
  async listMailboxPreview(userId: string, limit = 120) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, subject, message, sender_id, recipient_id, is_read, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Direct messages where this user is the recipient and has not read yet (tab badge / inbox total). */
  async countUnreadForRecipient(recipientId: string) {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  }

  async listDirectoryContacts(excludeUserId: string, roles: string[], limit = 40) {
    if (!roles.length) return [];
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, role')
      .neq('id', excludeUserId)
      .in('role', roles)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async lookupUsersByIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, role')
      .in('id', ids);
    if (error) throw error;
    return data ?? [];
  }

  async fetchThreadAscending(userId: string, otherUserId: string, limit = 160) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, message, sender_id, created_at, subject')
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
      )
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async markUnreadFromSenderRead(recipientId: string, senderId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: now })
      .eq('recipient_id', recipientId)
      .eq('sender_id', senderId)
      .eq('is_read', false);
    if (error) throw error;
  }

  async insertMessage(row: MessageInsert) {
    const { error } = await supabase.from('messages').insert(row);
    if (error) throw error;
  }

  async sendMessage(senderId: string, recipientId: string, content: string, subject?: string) {
    const now = new Date().toISOString();
    const { data: message, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: senderId,
          recipient_id: recipientId,
          message: content,
          subject,
          created_at: now,
          updated_at: now,
        },
      ])
      .select('*, sender:portal_users!sender_id(full_name)')
      .single();

    if (error) throw error;
    return message;
  }

  async getMessages(userId: string, otherId?: string) {
    let query = supabase
      .from('messages')
      .select('*, sender:portal_users!sender_id(full_name), recipient:portal_users!recipient_id(full_name)')
      .order('created_at', { ascending: false });

    if (otherId) {
      query = query.or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`,
      );
    } else {
      query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async markAsRead(id: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: now })
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Subscribes to new messages for a user.
   */
  subscribeToMessages(userId: string, onNewMessage: (payload: any) => void) {
    return supabase
      .channel(`user-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => onNewMessage(payload.new)
      )
      .subscribe();
  }
}

export const chatService = new ChatService();

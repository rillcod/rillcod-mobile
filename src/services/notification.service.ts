import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

export class NotificationService {
  /** In-app notification row (badges, system messages, etc.). */
  async createInAppNotification(params: {
    userId: string;
    title: string;
    message: string;
    type?: string | null;
    actionUrl?: string | null;
  }) {
    const now = new Date().toISOString();
    const row: NotificationInsert = {
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type ?? 'info',
      action_url: params.actionUrl ?? null,
      is_read: false,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase.from('notifications').insert(row);
    if (error) throw error;
    return true;
  }

  /** @deprecated Prefer createInAppNotification — kept for web-port call sites. */
  async logNotification(
    userId: string,
    title: string,
    message: string,
    type?: string | null,
    actionUrl?: string | null
  ) {
    return this.createInAppNotification({ userId, title, message, type, actionUrl });
  }

  async listNotifications(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  async markAsRead(notificationId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  }

  async markAllAsRead(userId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return true;
  }

  async getUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count ?? 0;
  }

  /** Newsletter rows delivered to the user that they have not opened (inbox-style badge). */
  async countUnviewedNewsletterDeliveries(userId: string) {
    const { count, error } = await supabase
      .from('newsletter_delivery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_viewed', false);

    if (error) throw error;
    return count ?? 0;
  }

  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  }
}

export const notificationService = new NotificationService();

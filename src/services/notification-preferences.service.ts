import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type NotificationPreferencesRow = Database['public']['Tables']['notification_preferences']['Row'];
export type NotificationPreferencesInsert = Database['public']['Tables']['notification_preferences']['Insert'];

const DEFAULTS: Omit<NotificationPreferencesInsert, 'portal_user_id' | 'id'> = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  assignment_reminders: true,
  grade_notifications: true,
  announcement_notifications: true,
  discussion_replies: true,
  marketing_emails: false,
};

export class NotificationPreferencesService {
  async getForUser(portalUserId: string): Promise<NotificationPreferencesRow | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('portal_user_id', portalUserId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Upsert by `portal_user_id` (unique). */
  async upsertForUser(portalUserId: string, patch: Partial<NotificationPreferencesInsert>) {
    const row: NotificationPreferencesInsert = {
      portal_user_id: portalUserId,
      ...DEFAULTS,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('notification_preferences').upsert(row, { onConflict: 'portal_user_id' });
    if (error) throw error;
  }

  defaults() {
    return { ...DEFAULTS };
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();

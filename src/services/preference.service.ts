import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export interface UserPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  assignment_reminders: boolean;
  grade_notifications: boolean;
  announcement_notifications: boolean;
  discussion_replies: boolean;
  marketing_emails: boolean;
}

const DEFAULTS: UserPreferences = {
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
  assignment_reminders: true,
  grade_notifications: true,
  announcement_notifications: true,
  discussion_replies: true,
  marketing_emails: false,
};

export class PreferenceService {
  async getPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('portal_user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return DEFAULTS;

    return {
      email_enabled: data.email_enabled ?? DEFAULTS.email_enabled,
      sms_enabled: data.sms_enabled ?? DEFAULTS.sms_enabled,
      push_enabled: data.push_enabled ?? DEFAULTS.push_enabled,
      assignment_reminders: data.assignment_reminders ?? DEFAULTS.assignment_reminders,
      grade_notifications: data.grade_notifications ?? DEFAULTS.grade_notifications,
      announcement_notifications: data.announcement_notifications ?? DEFAULTS.announcement_notifications,
      discussion_replies: data.discussion_replies ?? DEFAULTS.discussion_replies,
      marketing_emails: data.marketing_emails ?? DEFAULTS.marketing_emails,
    };
  }

  async updatePreferences(userId: string, prefs: Partial<UserPreferences>) {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        portal_user_id: userId,
        ...prefs,
        updated_at: new Date().toISOString()
      }, { onConflict: 'portal_user_id' });

    if (error) throw error;
    return true;
  }
}

export const preferenceService = new PreferenceService();

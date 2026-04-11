import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type LiveSessionInsert = Database['public']['Tables']['live_sessions']['Insert'];
export type LiveSessionRow = Database['public']['Tables']['live_sessions']['Row'];

export interface ScheduleSessionParams {
  hostId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes?: number;
  platform?: 'zoom' | 'google_meet' | 'teams' | 'discord' | 'other';
  sessionUrl?: string;
  programId?: string;
  schoolId?: string;
  notes?: string;
}

export class LiveSessionService {
  async listSessions(filters?: { programId?: string; hostId?: string; schoolId?: string }) {
    let query = supabase
      .from('live_sessions')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (filters?.programId) query = query.eq('program_id', filters.programId);
    if (filters?.hostId) query = query.eq('host_id', filters.hostId);
    if (filters?.schoolId) query = query.eq('school_id', filters.schoolId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /** Live sessions list UI: program name join, newest first. */
  async listSessionsForScreen() {
    const { data, error } = await supabase
      .from('live_sessions')
      .select(
        'id, title, description, scheduled_at, status, program_id, session_url, platform, duration_minutes, recording_url, host_id, created_at, programs(name)',
      )
      .order('scheduled_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async updateSessionStatus(sessionId: string, status: string) {
    const { error } = await supabase.from('live_sessions').update({ status }).eq('id', sessionId);
    if (error) throw error;
  }

  async deleteSession(sessionId: string) {
    const { error } = await supabase.from('live_sessions').delete().eq('id', sessionId);
    if (error) throw error;
  }

  async insertSession(row: LiveSessionInsert) {
    const { error } = await supabase.from('live_sessions').insert(row);
    if (error) throw error;
  }

  async getSession(sessionId: string) {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*, portal_users:host_id(full_name)')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return data;
  }

  async scheduleLiveSession(params: ScheduleSessionParams) {
    const { data, error } = await supabase
      .from('live_sessions')
      .insert([{
        host_id: params.hostId,
        title: params.title,
        description: params.description ?? null,
        scheduled_at: params.scheduledAt,
        duration_minutes: params.durationMinutes ?? 60,
        platform: params.platform ?? 'zoom',
        session_url: params.sessionUrl ?? null,
        program_id: params.programId ?? null,
        school_id: params.schoolId ?? null,
        notes: params.notes ?? null,
        status: 'scheduled',
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async joinSession(sessionId: string, userId: string) {
    // Record attendance
    const { data: existing } = await supabase
      .from('live_session_attendance')
      .select('id')
      .eq('session_id', sessionId)
      .eq('portal_user_id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('live_session_attendance').insert([{
        session_id: sessionId,
        portal_user_id: userId,
        joined_at: new Date().toISOString(),
      }]);
    }

    const { data: session, error } = await supabase
      .from('live_sessions')
      .select('session_url, status')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return session;
  }

  async leaveSession(sessionId: string, userId: string) {
    const { data: attendance } = await supabase
      .from('live_session_attendance')
      .select('id, joined_at')
      .eq('session_id', sessionId)
      .eq('portal_user_id', userId)
      .maybeSingle();

    if (attendance && attendance.joined_at) {
      const leftAt = new Date();
      const joinedAt = new Date(attendance.joined_at);
      const duration = Math.floor((leftAt.getTime() - joinedAt.getTime()) / 60000);

      await supabase
        .from('live_session_attendance')
        .update({ left_at: leftAt.toISOString(), duration_minutes: duration })
        .eq('id', attendance.id);
    }
    return true;
  }

  async listPolls(sessionId: string) {
    const { data, error } = await supabase
      .from('live_session_polls')
      .select('*, live_session_poll_options(*)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async submitPollResponse(pollId: string, optionIds: string[], userId: string) {
    const payload = optionIds.map(optionId => ({
      poll_id: pollId,
      option_id: optionId,
      portal_user_id: userId,
    }));
    const { error } = await supabase.from('live_session_poll_responses').insert(payload);
    if (error) throw error;
    return true;
  }
}

export const liveSessionService = new LiveSessionService();

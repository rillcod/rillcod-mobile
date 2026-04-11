import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type ActivityType = 'lesson_complete' | 'assignment_submit' | 'quiz_pass' | 'discussion_post' | 'daily_login' | 'mission_complete';

const POINTS_CONFIG: Record<ActivityType, number> = {
  lesson_complete: 10,
  assignment_submit: 25,
  quiz_pass: 50,
  discussion_post: 5,
  daily_login: 10,
  mission_complete: 75
};

export class GamificationService {
  async awardPoints(userId: string, activityType: ActivityType, referenceId?: string, description?: string) {
    const points = POINTS_CONFIG[activityType];

    // 1. Log transaction
    await supabase.from('point_transactions').insert([{
      portal_user_id: userId,
      points,
      activity_type: activityType,
      reference_id: referenceId,
      description
    }]);

    // 2. Fetch current points and streak
    const { data: currentPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('portal_user_id', userId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    let streak = currentPoints?.current_streak || 0;
    let lastActivity = currentPoints?.last_activity_date;

    if (lastActivity) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivity === yesterdayStr) {
        streak += 1;
      } else if (lastActivity !== today) {
        streak = 1;
      }
    } else {
      streak = 1;
    }

    const totalPoints = (currentPoints?.total_points || 0) + points;
    const newLevel = this.calculateLevel(totalPoints);

    const { error } = await supabase.from('user_points').upsert({
      portal_user_id: userId,
      total_points: totalPoints,
      current_streak: streak,
      longest_streak: Math.max(streak, currentPoints?.longest_streak || 0),
      last_activity_date: today,
      achievement_level: newLevel,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    return { points, totalPoints, newLevel, streak };
  }

  private calculateLevel(points: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
    if (points >= 5000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    if (points >= 500) return 'Silver';
    return 'Bronze';
  }

  async getLeaderboard(courseId?: string, limitRows = 20) {
    let query;
    if (courseId) {
      const { data: course } = await supabase.from('courses').select('program_id').eq('id', courseId).single();
      if (!course?.program_id) return [];

      query = supabase
        .from('enrollments')
        .select('user_id, portal_users(full_name, profile_image_url), user_points(total_points, achievement_level)')
        .eq('program_id', course.program_id)
        .order('user_points(total_points)', { ascending: false });
    } else {
      query = supabase
        .from('user_points')
        .select('portal_user_id, total_points, achievement_level, portal_users(full_name, profile_image_url)')
        .order('total_points', { ascending: false });
    }

    const { data, error } = await query.limit(limitRows);
    if (error) throw error;

    return (data ?? []).map((item: any, index: number) => {
      const user = item.portal_users || item.portal_user;
      const points = item.user_points || item;
      return {
        rank: index + 1,
        user_id: item.user_id || item.portal_user_id,
        name: user?.full_name,
        points: points?.total_points || 0,
        level: points?.achievement_level || 'Bronze',
        avatar: user?.profile_image_url
      };
    });
  }

  async getUserStats(userId: string) {
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('portal_user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async listRecentPointTransactions(portalUserId: string, limit = 20) {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('id, points, activity_type, description, created_at')
      .eq('portal_user_id', portalUserId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Array<Database['public']['Tables']['point_transactions']['Row']>;
  }

  /** Level label + points for profile / dashboard widgets (no row → defaults). */
  async getUserLevel(userId: string): Promise<{ level: string; total_points: number }> {
    const row = await this.getUserStats(userId);
    return {
      level: row?.achievement_level ?? 'Bronze',
      total_points: row?.total_points ?? 0,
    };
  }

  /**
   * Leaderboard derived from graded assignment scores (sum of `grade` per user).
   * Used by the mobile Leaderboard screen (distinct from `getLeaderboard` / `user_points`).
   */
  async getGradedSubmissionScoreLeaderboard(limitRows = 500) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select(
        'portal_user_id, grade, status, portal_users!assignment_submissions_portal_user_id_fkey(full_name, school_name, section_class)',
      )
      .eq('status', 'graded')
      .limit(limitRows);
    if (error) throw error;

    const map: Record<string, { full_name: string; school_name: string | null; xp: number }> = {};
    (data ?? []).forEach((row: any) => {
      const uid = row.portal_user_id;
      if (!uid) return;
      if (!map[uid]) {
        map[uid] = {
          full_name: row.portal_users?.full_name ?? 'Unknown',
          school_name: row.portal_users?.school_name ?? null,
          xp: 0,
        };
      }
      map[uid].xp += row.grade ?? 0;
    });

    return Object.entries(map)
      .map(([portal_user_id, val]) => ({ portal_user_id, ...val, rank: 0 }))
      .sort((a, b) => b.xp - a.xp)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  /**
   * Portal-wide XP leaderboard (`user_points`), same row shape as graded-score leaderboard for UI reuse.
   */
  async getPortalXpLeaderboard(limitRows = 500) {
    const { data, error } = await supabase
      .from('user_points')
      .select('portal_user_id, total_points, portal_users(full_name, school_name)')
      .order('total_points', { ascending: false })
      .limit(limitRows);
    if (error) throw error;

    return (data ?? []).map((row: any, index: number) => ({
      portal_user_id: row.portal_user_id as string,
      full_name: (row.portal_users?.full_name as string) ?? 'Unknown',
      school_name: (row.portal_users?.school_name as string | null) ?? null,
      xp: Number(row.total_points) || 0,
      rank: index + 1,
    }));
  }
}

export const gamificationService = new GamificationService();

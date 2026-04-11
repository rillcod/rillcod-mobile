import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { notificationService } from './notification.service';

export interface BadgeCriteria {
  type: 'course_complete' | 'points_milestone' | 'streak_milestone' | 'discussion_expert';
  threshold?: number;
  course_id?: string;
}

export class BadgeService {
  async awardBadgeIfEligible(userId: string, criteriaType: BadgeCriteria['type'], data: any = {}) {
    const { data: badges } = await supabase
      .from('badges')
      .select('*')
      .eq('is_active', true);

    if (!badges) return;

    for (const badge of badges) {
      const criteria = badge.criteria as unknown as BadgeCriteria;
      if (criteria.type !== criteriaType) continue;

      const { data: existing } = await supabase
        .from('user_badges')
        .select('*')
        .eq('portal_user_id', userId)
        .eq('badge_id', badge.id)
        .maybeSingle();

      if (existing) continue;

      let isEligible = false;

      if (criteriaType === 'course_complete') {
        if (criteria.course_id === data.courseId) isEligible = true;
      } else if (criteriaType === 'points_milestone') {
        if (data.totalPoints >= (criteria.threshold || 0)) isEligible = true;
      } else if (criteriaType === 'streak_milestone') {
        if (data.streak >= (criteria.threshold || 0)) isEligible = true;
      }

      if (isEligible) {
        await this.awardBadge(userId, badge.id);
      }
    }
  }

  private async awardBadge(userId: string, badgeId: string) {
    const { data: badge } = await supabase.from('badges').select('name').eq('id', badgeId).single();

    const { error } = await supabase.from('user_badges').insert([{
      portal_user_id: userId,
      badge_id: badgeId,
      earned_at: new Date().toISOString()
    }]);

    if (!error) {
      await notificationService.createInAppNotification({
        userId,
        title: 'New badge earned',
        message: `You earned the “${badge?.name ?? 'new'}” badge. Open your profile to view it.`,
        type: 'success',
      });
    }
  }

  async getPlayerBadges(userId: string) {
    const { data, error } = await supabase
      .from('user_badges')
      .select('earned_at, badges(*)')
      .eq('portal_user_id', userId);

    if (error) throw error;
    return data;
  }
}

export const badgeService = new BadgeService();

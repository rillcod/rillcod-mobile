import { supabase } from '../lib/supabase';

export type SubStatus = 'active' | 'cancelled' | 'expired' | 'suspended';

export interface Subscription {
  id: string;
  school_id: string;
  plan_name: string;
  plan_type: string | null;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  status: SubStatus;
  start_date: string;
  end_date: string | null;
  max_students: number | null;
  max_teachers: number | null;
  features: Record<string, any>;
  created_at: string;
  schools?: { id: string; name: string; email: string } | null;
}

export class SubscriptionService {
  async listSubscriptions(limit = 100) {
    const { data, error } = await supabase
      .from('school_subscriptions')
      .select('*, schools(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Subscription[];
  }

  async getSchoolSubscription(schoolId: string) {
    const { data, error } = await supabase
      .from('school_subscriptions')
      .select('*, schools(id, name, email)')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    return data as Subscription | null;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>) {
    const { data, error } = await supabase
      .from('school_subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Subscription;
  }

  async createSubscription(sub: Omit<Subscription, 'id' | 'created_at' | 'schools'>) {
    const { data, error } = await supabase
      .from('school_subscriptions')
      .insert([sub])
      .select()
      .single();

    if (error) throw error;
    return data as Subscription;
  }

  async cancelSubscription(id: string) {
    const { error } = await supabase
      .from('school_subscriptions')
      .update({ status: 'cancelled', end_date: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }
}

export const subscriptionService = new SubscriptionService();

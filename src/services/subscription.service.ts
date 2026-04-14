import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

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
  private mapRowToSubscription(
    row: Database['public']['Tables']['subscriptions']['Row'] & { schools?: { id: string; name: string; email: string } | null },
  ): Subscription {
    return {
      id: row.id,
      school_id: row.school_id ?? '',
      plan_name: row.subscription_plan ?? 'School plan',
      plan_type: row.pricing_model ?? null,
      billing_cycle: (row.billing_cycle as 'monthly' | 'quarterly' | 'yearly') ?? 'monthly',
      amount: Number(row.amount ?? 0),
      currency: row.currency ?? 'NGN',
      status: (row.status as SubStatus) ?? 'expired',
      start_date: row.current_period_start ?? row.created_at ?? new Date().toISOString(),
      end_date: row.current_period_end ?? null,
      max_students: null,
      max_teachers: null,
      features: {},
      created_at: row.created_at ?? new Date().toISOString(),
      schools: row.schools ?? null,
    };
  }

  async listAllSubscriptions(limit = 100) {
    return this.listSubscriptions(limit);
  }

  async listSubscriptions(limit = 100) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, schools(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => this.mapRowToSubscription(row as any));
  }

  async getSchoolSubscription(schoolId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, schools(id, name, email)')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapRowToSubscription(data as any) : null;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>) {
    const payload: Database['public']['Tables']['subscriptions']['Update'] = {
      subscription_plan: updates.plan_name,
      pricing_model: updates.plan_type ?? undefined,
      billing_cycle: updates.billing_cycle,
      amount: updates.amount,
      currency: updates.currency,
      status: updates.status,
      current_period_start: updates.start_date,
      current_period_end: updates.end_date,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('subscriptions')
      .update(payload)
      .eq('id', id)
      .select('*, schools(id, name, email)')
      .single();

    if (error) throw error;
    return this.mapRowToSubscription(data as any);
  }

  async createSubscription(sub: Omit<Subscription, 'id' | 'created_at' | 'schools'>) {
    const row: Database['public']['Tables']['subscriptions']['Insert'] = {
      school_id: sub.school_id,
      owner_type: 'school',
      subscription_plan: sub.plan_name,
      pricing_model: sub.plan_type ?? 'fixed',
      billing_cycle: sub.billing_cycle,
      amount: sub.amount,
      currency: sub.currency,
      status: sub.status,
      current_period_start: sub.start_date,
      current_period_end: sub.end_date,
      auto_rollover: true,
    };
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([row])
      .select('*, schools(id, name, email)')
      .single();

    if (error) throw error;
    return this.mapRowToSubscription(data as any);
  }

  async cancelSubscription(id: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  computeNextBillingDate(row: Pick<Subscription, 'billing_cycle' | 'end_date' | 'start_date'>, now = new Date()) {
    const anchor = row.end_date ? new Date(row.end_date) : row.start_date ? new Date(row.start_date) : now;
    if (Number.isNaN(anchor.getTime())) return null;
    const next = new Date(anchor.getTime());
    if (row.billing_cycle === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (row.billing_cycle === 'quarterly') next.setMonth(next.getMonth() + 3);
    else next.setFullYear(next.getFullYear() + 1);
    return next.toISOString();
  }

  async renewSubscriptionCycle(id: string, row: Pick<Subscription, 'billing_cycle' | 'end_date' | 'start_date'>) {
    const nextEnd = this.computeNextBillingDate(row);
    const updates: Partial<Subscription> = {
      status: 'active',
      end_date: nextEnd,
    };
    return this.updateSubscription(id, updates);
  }

  async setSubscriptionStatus(id: string, status: SubStatus) {
    return this.updateSubscription(id, { status });
  }
}

export const subscriptionService = new SubscriptionService();

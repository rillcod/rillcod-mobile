import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type RegistrationBatchSummary = Pick<
  Database['public']['Tables']['registration_batches']['Row'],
  'id' | 'school_name' | 'class_name' | 'student_count' | 'created_at' | 'created_by'
>;

export type RegistrationResultRow = Pick<
  Database['public']['Tables']['registration_results']['Row'],
  'id' | 'batch_id' | 'full_name' | 'email' | 'password' | 'class_name' | 'status' | 'error' | 'created_at'
>;

export class RegistrationService {
  /** Admin school picker: approved schools only. */
  async listApprovedSchoolSummaries(limit = 100) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name')
      .eq('status', 'approved')
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listRecentBatches(params: {
    isAdmin: boolean;
    schoolId?: string | null;
    role?: string | null;
    createdByUserId?: string | null;
    limit?: number;
  }) {
    const lim = params.limit ?? 20;
    let q = supabase
      .from('registration_batches')
      .select('id, school_name, class_name, student_count, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (params.isAdmin) {
      // no scope filter — RLS may still restrict rows
    } else if (params.role === 'teacher' && params.createdByUserId) {
      q = q.eq('created_by', params.createdByUserId);
    } else if (params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as RegistrationBatchSummary[];
  }

  async listResultsForBatch(batchId: string) {
    const { data, error } = await supabase
      .from('registration_results')
      .select('id, batch_id, full_name, email, password, class_name, status, error, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as RegistrationResultRow[];
  }

  async createBatch(row: Database['public']['Tables']['registration_batches']['Insert']) {
    const { data, error } = await supabase.from('registration_batches').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Could not create registration batch');
    return data.id;
  }

  async recordBatchResult(row: Database['public']['Tables']['registration_results']['Insert']) {
    const { error } = await supabase.from('registration_results').insert(row);
    if (error) throw error;
  }

  async insertProspectiveStudent(row: Database['public']['Tables']['students']['Insert']) {
    const { error } = await supabase.from('students').insert(row);
    if (error) throw error;
  }

  async insertPendingTeacher(row: Database['public']['Tables']['portal_users']['Insert']) {
    const { error } = await supabase.from('portal_users').insert(row);
    if (error) throw error;
  }
}

export const registrationService = new RegistrationService();

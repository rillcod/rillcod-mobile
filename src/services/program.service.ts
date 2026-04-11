import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Program = Database['public']['Tables']['programs']['Row'];

export interface ProgramInput {
  name: string;
  description?: string;
  duration_weeks?: number;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  price?: number;
  max_students?: number;
  is_active?: boolean;
  school_id?: string | null;
}

export class ProgramService {
  async listPrograms(filters?: { schoolId?: string; isActive?: boolean }) {
    let query = supabase
      .from('programs')
      .select('*', { count: 'exact' });

    if (filters?.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error, count } = await query
      .order('name', { ascending: true });

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getProgram(id: string) {
    const { data, error } = await supabase
      .from('programs')
      .select('*, schools(name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createProgram(input: ProgramInput, schoolId: string) {
    const { data, error } = await supabase
      .from('programs')
      .insert([
        {
          ...input,
          school_id: schoolId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProgram(id: string, input: Partial<ProgramInput>) {
    const { data, error } = await supabase
      .from('programs')
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProgram(id: string) {
    const { error } = await supabase
      .from('programs')
      .delete() // Web uses hard delete, but maybe mobile should soft delete if we use is_deleted elsewhere.
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /** Learn hub: active programmes for catalogue (newest first). */
  async listActiveCatalog() {
    const { data, error } = await supabase
      .from('programs')
      .select('id, name, description, difficulty_level, duration_weeks, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Programmes admin / school management screen (with school name join). */
  async listProgramsForManagement(params: { isAdmin: boolean; schoolId?: string | null }) {
    let q = supabase
      .from('programs')
      .select(
        'id, name, description, duration_weeks, difficulty_level, price, max_students, is_active, school_id, created_at, schools(name)',
      )
      .order('created_at', { ascending: false });
    if (!params.isAdmin && params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
}

export const programService = new ProgramService();

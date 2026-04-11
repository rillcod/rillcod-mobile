import { supabase } from '../lib/supabase';

export class CardService {
  async searchStudentsForIdCardByName(nameFragment: string, limit = 20) {
    const frag = nameFragment.trim();
    if (frag.length < 2) return [];
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class, created_at')
      .eq('role', 'student')
      .ilike('full_name', `%${frag}%`)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}

export const cardService = new CardService();

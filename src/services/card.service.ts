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

  async listStudentsByClass(className: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class, created_at')
      .eq('role', 'student')
      .eq('section_class', className)
      .order('full_name');
    if (error) throw error;
    return data ?? [];
  }

  async listUniqueClasses() {
    const { data, error } = await supabase
      .from('portal_users')
      .select('section_class')
      .eq('role', 'student')
      .not('section_class', 'is', null);
    
    if (error) throw error;
    
    // Extract unique non-null class names
    const classes = Array.from(new Set(data.map(r => r.section_class))).sort();
    return classes as string[];
  }
}

export const cardService = new CardService();

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export class SearchService {
  async searchAll(query: string, schoolId?: string) {
    const [courses, programs, teachers] = await Promise.all([
      this.searchCourses(query, schoolId),
      this.searchPrograms(query, schoolId),
      this.searchTeachers(query, schoolId)
    ]);

    return {
      courses,
      programs,
      teachers
    };
  }

  async searchCourses(query: string, schoolId?: string) {
    let q = supabase
      .from('courses')
      .select('*, programs(name)')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10);

    if (schoolId) {
      q = q.eq('school_id', schoolId);
    }

    const { data } = await q;
    return data || [];
  }

  async searchPrograms(query: string, schoolId?: string) {
    let q = supabase
      .from('programs')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10);

    if (schoolId) {
      q = q.eq('school_id', schoolId);
    }

    const { data } = await q;
    return data || [];
  }

  async searchTeachers(query: string, schoolId?: string) {
    let q = supabase
      .from('portal_users')
      .select('id, full_name, profile_image_url')
      .eq('role', 'teacher')
      .ilike('full_name', `%${query}%`)
      .limit(10);

    if (schoolId) {
      q = q.eq('school_id', schoolId);
    }

    const { data } = await q;
    return data || [];
  }
}

export const searchService = new SearchService();

import { supabase } from '../lib/supabase';
import { fileService } from './file.service';
import type { Database } from '../types/supabase';

export type ContentLibrary = Database['public']['Tables']['content_library']['Row'];
export type ContentType = 'video' | 'document' | 'quiz' | 'presentation' | 'interactive';

export interface ListFilters {
  type?: ContentType | null;
  tag?: string | null;
  subject?: string | null;
  gradeLevel?: string | null;
  query?: string | null;
  role?: string | null;
  schoolId?: string | null;
}

export class LibraryService {
  async listContent(filters: ListFilters = {}) {
    const { role, schoolId } = filters;
    const isStaff = role === 'admin' || role === 'teacher' || role === 'school';

    let query = supabase
      .from('content_library')
      .select('*, files(public_url, file_type, thumbnail_url, file_size)');

    // Visibility rules
    if (schoolId) {
      query = query.or(`school_id.eq.${schoolId},school_id.is.null`);
    } else if (role !== 'admin') {
      query = query.is('school_id', null);
    }

    if (filters.type) query = query.eq('content_type', filters.type);
    if (filters.tag) query = query.contains('tags', [filters.tag]);
    if (filters.subject) query = query.eq('subject', filters.subject);
    if (filters.gradeLevel) query = query.eq('grade_level', filters.gradeLevel);
    if (filters.query) query = query.ilike('title', `%${filters.query}%`);

    query = query.eq('is_active', true);
    if (!isStaff) query = query.eq('is_approved', true);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getContent(contentId: string) {
    const { data, error } = await supabase
      .from('content_library')
      .select('*, files(public_url, file_type, thumbnail_url, file_size, mime_type)')
      .eq('id', contentId)
      .single();

    if (error) throw error;
    return data;
  }

  async getMyContentRating(userId: string, contentId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('content_ratings')
      .select('rating')
      .eq('portal_user_id', userId)
      .eq('content_id', contentId)
      .maybeSingle();
    if (error) throw error;
    return typeof data?.rating === 'number' ? data.rating : null;
  }

  async rateContent(userId: string, itemId: string, rating: number, review?: string) {
    const { error } = await supabase.from('content_ratings').upsert({
      portal_user_id: userId,
      content_id: itemId,
      rating,
      review: review ?? null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'portal_user_id,content_id' });

    if (error) throw error;

    // Refresh average rating
    const { data: ratings } = await supabase
      .from('content_ratings')
      .select('rating')
      .eq('content_id', itemId);

    const values = ratings?.map((r) => r.rating).filter((r): r is number => typeof r === 'number');
    if (values && values.length > 0) {
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      await supabase.from('content_library')
        .update({
          rating_average: Number(avg.toFixed(2)),
          rating_count: values.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    }
    return true;
  }

  async copyToCourse(contentId: string, courseId: string) {
    const { data: content } = await supabase
      .from('content_library')
      .select('*')
      .eq('id', contentId)
      .single();

    if (!content) throw new Error('Content not found');

    let fileData: any = null;
    if (content.file_id) {
      try {
        fileData = await fileService.getFileMetadata(content.file_id);
      } catch {
        fileData = null;
      }
    }

    const { error: materialErr } = await supabase
      .from('course_materials')
      .insert([{
        course_id: courseId,
        title: content.title,
        description: content.description,
        file_url: fileData?.public_url ?? null,
        file_type: fileData?.file_type ?? content.content_type,
        file_size: fileData?.file_size ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
      }]);

    if (materialErr) throw materialErr;

    await supabase
      .from('content_library')
      .update({
        usage_count: (content.usage_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    return true;
  }
}

export const libraryService = new LibraryService();

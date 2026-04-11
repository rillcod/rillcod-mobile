import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type FileRecord = Database['public']['Tables']['files']['Row'];

export class FileService {
  /**
   * Generates a signed URL for a file.
   * If the file is stored in R2, it returns the web project's proxy URL.
   * If it's in Supabase, it generates a standard signed URL.
   */
  async getFileUrl(fileId: string) {
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !file) throw error || new Error('File not found');

    // Use the stored public URL if available
    if (file.public_url) return file.public_url;

    // Standard Supabase bucket fallback if storage_provider is 'supabase' (hypothetical)
    if (file.storage_provider === 'supabase') {
      const { data, error: urlError } = await supabase.storage
        .from('content')
        .createSignedUrl(file.storage_path, 3600);
      
      if (urlError) throw urlError;
      return data.signedUrl;
    }

    // Default to resolving via the web app's proxy if storage_provider is 'r2'
    const WEB_APP_URL = 'https://app.rillcod.com'; // Should be in config
    return `${WEB_APP_URL}/api/media/${file.storage_path}`;
  }

  async listFiles(filters?: { schoolId?: string; type?: string }) {
    let query = supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.schoolId) query = query.eq('school_id', filters.schoolId);
    if (filters?.type) query = query.eq('file_type', filters.type);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getFileMetadata(id: string) {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async trackDownload(fileId: string) {
    const { error } = await supabase.rpc('increment_download_count', { file_id: fileId });
    if (error) console.error('Failed to track download:', error);
  }
}

export const fileService = new FileService();

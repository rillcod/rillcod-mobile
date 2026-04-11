import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type VaultItemInsert = Database['public']['Tables']['vault_items']['Insert'];

export class VaultService {
  async listVaultItemsForUser(userId: string) {
    const { data, error } = await supabase
      .from('vault_items')
      .select('id, user_id, title, language, code, description, tags, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async deleteVaultItem(itemId: string) {
    const { error } = await supabase.from('vault_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  async upsertVaultItem(params: { editingId: string | null; payload: VaultItemInsert }) {
    if (params.editingId) {
      const { error } = await supabase.from('vault_items').update(params.payload).eq('id', params.editingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('vault_items').insert([params.payload]);
      if (error) throw error;
    }
  }
}

export const vaultService = new VaultService();

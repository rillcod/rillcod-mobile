import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const META_BLOCK = 'pathways_v1';

export const PATHWAYS_STORAGE = {
  missions: 'rillcod_missions_done_v2',
  protocol: 'rillcod_protocol_done_v2',
} as const;

export type PathwaysMetadataBlock = {
  missions_done?: string[];
  protocol_done?: string[];
  updated_at?: string;
};

function uniq(ids: string[]) {
  return Array.from(new Set((ids ?? []).filter(Boolean)));
}

async function readRemoteBlock(portalUserId: string): Promise<PathwaysMetadataBlock | null> {
  const { data, error } = await supabase.from('portal_users').select('metadata').eq('id', portalUserId).maybeSingle();
  if (error || !data?.metadata || typeof data.metadata !== 'object') return null;
  const meta = data.metadata as Record<string, unknown>;
  const block = meta[META_BLOCK];
  if (!block || typeof block !== 'object') return null;
  return block as PathwaysMetadataBlock;
}

async function writeRemoteBlock(portalUserId: string, patch: Partial<PathwaysMetadataBlock>) {
  const { data, error } = await supabase.from('portal_users').select('metadata').eq('id', portalUserId).maybeSingle();
  if (error) {
    console.warn('[pathwaysProgress]', error.message);
    return;
  }
  const base = data?.metadata && typeof data.metadata === 'object' ? { ...(data.metadata as object) } : {};
  const meta = base as Record<string, unknown>;
  const prev = (meta[META_BLOCK] && typeof meta[META_BLOCK] === 'object' ? { ...(meta[META_BLOCK] as object) } : {}) as PathwaysMetadataBlock;
  meta[META_BLOCK] = { ...prev, ...patch, updated_at: new Date().toISOString() };
  const { error: upErr } = await supabase
    .from('portal_users')
    .update({ metadata: meta as never, updated_at: new Date().toISOString() })
    .eq('id', portalUserId);
  if (upErr) console.warn('[pathwaysProgress] sync', upErr.message);
}

export const pathwaysProgressService = {
  async loadMissionsDone(portalUserId: string | undefined): Promise<string[]> {
    const localRaw = await AsyncStorage.getItem(PATHWAYS_STORAGE.missions);
    let local: string[] = [];
    try {
      local = localRaw ? (JSON.parse(localRaw) as string[]) : [];
    } catch {
      local = [];
    }
    if (!portalUserId) return uniq(local);
    const remote = await readRemoteBlock(portalUserId);
    const remoteIds = remote?.missions_done ?? [];
    return uniq([...remoteIds, ...local]);
  },

  async saveMissionsDone(portalUserId: string | undefined, ids: string[]): Promise<void> {
    const next = uniq(ids);
    await AsyncStorage.setItem(PATHWAYS_STORAGE.missions, JSON.stringify(next));
    if (portalUserId) await writeRemoteBlock(portalUserId, { missions_done: next });
  },

  async loadProtocolDone(portalUserId: string | undefined): Promise<string[]> {
    const localRaw = await AsyncStorage.getItem(PATHWAYS_STORAGE.protocol);
    let local: string[] = [];
    try {
      local = localRaw ? (JSON.parse(localRaw) as string[]) : [];
    } catch {
      local = [];
    }
    if (!portalUserId) return uniq(local);
    const remote = await readRemoteBlock(portalUserId);
    const remoteIds = remote?.protocol_done ?? [];
    return uniq([...remoteIds, ...local]);
  },

  async saveProtocolDone(portalUserId: string | undefined, ids: string[]): Promise<void> {
    const next = uniq(ids);
    await AsyncStorage.setItem(PATHWAYS_STORAGE.protocol, JSON.stringify(next));
    if (portalUserId) await writeRemoteBlock(portalUserId, { protocol_done: next });
  },
};

import { supabase } from '../lib/supabase';

/** Tables may be absent from generated `Database` types until `npm run sync-types`. */
const ioDb = supabase as any;

export class IotService {
  async listIotDevicesOrderedByLastSeen() {
    const { data, error } = await ioDb.from('iot_devices').select('*').order('last_seen', { ascending: false });
    return { data: data as Record<string, unknown>[] | null, error };
  }

  async listIotAlertsRecent(limit = 20) {
    const { data, error } = await ioDb
      .from('iot_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: data as Record<string, unknown>[] | null, error };
  }
}

export const iotService = new IotService();

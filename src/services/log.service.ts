import { supabase } from '../lib/supabase';

export interface LogEntry {
  id: string;
  user_id: string;
  action?: string;           // audit logs
  event_type?: string;       // activity logs
  table_name?: string;       // audit logs
  record_id?: string;        // audit logs
  old_data?: any;           // audit logs
  new_data?: any;           // audit logs
  description?: string;      // activity logs
  metadata?: any;            // activity/audit logs
  created_at: string;
  portal_users?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export interface LogFilter {
  type: 'activity' | 'audit';
  userId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export class LogService {
  async getLogs(filter: LogFilter) {
    const { type, userId, eventType, from, to, page, limit } = filter;
    const offset = (page - 1) * limit;

    const tableName = type === 'audit' ? 'audit_logs' : 'activity_logs';
    const eventField = type === 'audit' ? 'action' : 'event_type';

    let query: any = supabase
      .from(tableName)
      .select('*, portal_users(id, full_name, email, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq('user_id', userId);
    if (eventType) {
      query = type === 'audit'
        ? query.eq('action', eventType)
        : query.eq('event_type' as any, eventType);
    }
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: (data ?? []) as LogEntry[],
      total: count ?? 0,
      page,
      limit
    };
  }

  async logActivity(userId: string, eventType: string, description: string, schoolId?: string, metadata?: any) {
    const { error } = await supabase.from('activity_logs').insert([{
      user_id: userId,
      event_type: eventType,
      description,
      school_id: schoolId,
      metadata,
      created_at: new Date().toISOString()
    }]);
    if (error) console.error('Failed to log activity:', error);
  }
}

export const logService = new LogService();

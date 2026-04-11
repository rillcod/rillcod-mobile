import { supabase } from '../lib/supabase';

export class TimetableService {
  async listTimetablesForSchoolScope(schoolId?: string | null, limit = 20) {
    let q = supabase
      .from('timetables')
      .select('id, title, academic_year, term, is_active, section')
      .order('is_active', { ascending: false })
      .limit(limit);
    if (schoolId) q = q.eq('school_id', schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listSlotsForTimetable(timetableId: string) {
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('id, day_of_week, start_time, end_time, subject, room, notes, portal_users:teacher_id(full_name)')
      .eq('timetable_id', timetableId)
      .order('start_time');
    if (error) throw error;
    return (data ?? []).map((s: any) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      subject: s.subject,
      teacher_name: s.portal_users?.full_name ?? null,
      room: s.room,
      notes: s.notes,
    }));
  }
}

export const timetableService = new TimetableService();

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Attendance = Database['public']['Tables']['attendance']['Row'];

export interface AttendanceInput {
  session_id: string;
  user_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export class AttendanceService {
  private async listTeacherSchoolIds(teacherId: string, primarySchoolId?: string | null) {
    const { data, error } = await supabase.from('teacher_schools').select('school_id').eq('teacher_id', teacherId);
    if (error) throw error;
    const schoolIds = [...new Set((data ?? []).map((row) => row.school_id).filter(Boolean))] as string[];
    if (primarySchoolId && !schoolIds.includes(primarySchoolId)) schoolIds.unshift(primarySchoolId);
    return schoolIds;
  }

  private async assertSessionAccess(params: {
    sessionId: string;
    callerRole?: string | null;
    callerId?: string | null;
    callerSchoolId?: string | null;
  }) {
    const { data: session, error } = await supabase
      .from('class_sessions')
      .select('classes!inner(school_id)')
      .eq('id', params.sessionId)
      .single();
    if (error) throw error;

    const classSchoolId = (session.classes as { school_id: string | null }).school_id;
    if (!params.callerRole || params.callerRole === 'admin') return;

    if (!classSchoolId) {
      throw new Error('This class session is missing a school link.');
    }

    if (params.callerRole === 'school') {
      if (!params.callerSchoolId || params.callerSchoolId !== classSchoolId) {
        throw new Error('Access denied');
      }
      return;
    }

    if (params.callerRole === 'teacher') {
      const schoolIds = await this.listTeacherSchoolIds(params.callerId ?? '', params.callerSchoolId);
      if (!schoolIds.includes(classSchoolId)) {
        throw new Error('Access denied');
      }
    }
  }

  /** Class picker for staff attendance UI (teacher vs school scope). */
  async listClassesForAttendancePicker(params: {
    role?: string | null;
    teacherId?: string;
    schoolId?: string | null;
    limit?: number;
  }) {
    const lim = params.limit ?? 50;
    let q = supabase.from('classes').select('id, name').order('name', { ascending: true }).limit(lim);
    if (params.role === 'teacher' && params.teacherId) {
      const schoolIds = await this.listTeacherSchoolIds(params.teacherId, params.schoolId);
      if (!schoolIds.length) return [];
      q = q.in('school_id', schoolIds);
    } else if (params.schoolId) {
      q = q.eq('school_id', params.schoolId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listSessionsForClass(classId: string, limit = 30) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id, class_id, session_date, topic, start_time, created_at')
      .eq('class_id', classId)
      .order('session_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Student self-view: own attendance rows (no session join). */
  async listAttendanceRowsForStudent(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, user_id, created_at, status, notes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Class detail attendance tab: roll-up by session. */
  async listAttendanceStatusBySessionIds(sessionIds: string[]) {
    if (!sessionIds.length) return [];
    const { data, error } = await supabase
      .from('attendance')
      .select('session_id, status')
      .in('session_id', sessionIds);
    if (error) throw error;
    return data ?? [];
  }

  async listAttendance(
    sessionId: string,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    if (context?.callerRole) await this.assertSessionAccess({ sessionId, ...context });

    const { data, error } = await supabase
      .from('attendance')
      .select('*, portal_users(full_name, email)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createAttendance(
    input: AttendanceInput,
    context?: { callerRole?: string | null; callerId?: string | null; callerSchoolId?: string | null },
  ) {
    if (context?.callerRole) await this.assertSessionAccess({ sessionId: input.session_id, ...context });

    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        ...input,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAttendance(id: string, input: Partial<AttendanceInput>) {
    const { data, error } = await supabase
      .from('attendance')
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getStudentPercentage(userId: string, classId: string, schoolId?: string | null) {
    const { data: cls } = await supabase
      .from('classes')
      .select('school_id')
      .eq('id', classId)
      .single();

    if (!cls || (schoolId && cls.school_id !== schoolId)) {
      throw new Error('Class not found');
    }

    const { data: sessions, error } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('class_id', classId);

    if (error || !sessions || sessions.length === 0) return 0;

    const sessionIds = sessions.map(s => s.id);
    const { data: attendances } = await supabase
      .from('attendance')
      .select('status')
      .eq('user_id', userId)
      .in('session_id', sessionIds);

    if (!attendances) return 0;

    const total = sessionIds.length;
    const presentCount = attendances.filter(a => a.status === 'present' || a.status === 'late').length;

    return Math.round((presentCount / total) * 100) || 0;
  }

  /** Parent attendance: rows keyed by `students.id` (registration). */
  async listParentAttendanceByStudentsRegistrationId(studentRegistrationId: string, limit = 60) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, status, notes, created_at, class_sessions(session_date, topic, classes(name))')
      .eq('student_id', studentRegistrationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.class_sessions?.session_date ?? r.created_at?.slice(0, 10) ?? '',
      status: r.status as 'present' | 'absent' | 'late' | 'excused',
      note: r.notes,
      course_name: r.class_sessions?.classes?.name ?? r.class_sessions?.topic ?? null,
    }));
  }

  async listAttendanceStatusesForStudentsRegistration(studentRegistrationId: string, limit = 60) {
    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentRegistrationId)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}

export const attendanceService = new AttendanceService();

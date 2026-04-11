import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type ReportBuilderStudentRow = {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  section_class: string | null;
  school_id?: string | null;
};

export type StudentProgressReportInsert = Database['public']['Tables']['student_progress_reports']['Insert'];
export type StudentProgressReportUpdate = Database['public']['Tables']['student_progress_reports']['Update'];

export class ReportBuilderService {
  async loadStudentPickerRows(params: {
    role: string | undefined;
    userId: string | undefined;
    schoolId: string | null | undefined;
  }) {
    const isTeacher = params.role === 'teacher';
    const isSchool = params.role === 'school';

    if (isTeacher && params.userId) {
      const [{ data: classes }, { data: ts }] = await Promise.all([
        supabase.from('classes').select('id').eq('teacher_id', params.userId),
        supabase.from('teacher_schools').select('school_id').eq('teacher_id', params.userId),
      ]);
      const classIds = (classes ?? []).map((c: { id: string }) => c.id);
      let q = supabase
        .from('portal_users')
        .select('id, full_name, email, school_name, section_class, school_id')
        .eq('role', 'student')
        .order('full_name')
        .limit(200);
      if (classIds.length > 0) {
        q = q.in('class_id', classIds);
      } else {
        const sids = (ts ?? []).map((r: { school_id: string | null }) => r.school_id).filter(Boolean);
        const schoolIds = sids.length ? sids : params.schoolId ? [params.schoolId] : [];
        if (!schoolIds.length) return [] as ReportBuilderStudentRow[];
        q = q.in('school_id', schoolIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReportBuilderStudentRow[];
    }

    let q2 = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class, school_id')
      .eq('role', 'student')
      .order('full_name')
      .limit(200);
    if (isSchool && params.schoolId) {
      q2 = q2.eq('school_id', params.schoolId);
    }
    const { data: d2, error: e2 } = await q2;
    if (e2) throw e2;
    return (d2 ?? []) as ReportBuilderStudentRow[];
  }

  async getStudentRowForReport(studentId: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class, school_id')
      .eq('id', studentId)
      .single();
    if (error) throw error;
    return data as ReportBuilderStudentRow;
  }

  async fetchSmartHintSignals(portalUserId: string) {
    const [{ data: subs }, { data: att }] = await Promise.all([
      supabase
        .from('assignment_submissions')
        .select('grade')
        .eq('portal_user_id', portalUserId)
        .eq('status', 'graded')
        .not('grade', 'is', null)
        .limit(50),
      supabase.from('attendance').select('status').eq('user_id', portalUserId).limit(80),
    ]);
    return { submissions: subs ?? [], attendance: att ?? [] };
  }

  async listProgressReportsForStudent(studentId: string, limit = 25) {
    const { data, error } = await supabase
      .from('student_progress_reports')
      .select('*')
      .eq('student_id', studentId)
      .order('report_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updateProgressReport(reportId: string, payload: StudentProgressReportUpdate) {
    const { error } = await supabase.from('student_progress_reports').update(payload).eq('id', reportId);
    if (error) throw error;
  }

  async insertProgressReport(payload: StudentProgressReportInsert) {
    const { error } = await supabase.from('student_progress_reports').insert([payload]);
    if (error) throw error;
  }
}

export const reportBuilderService = new ReportBuilderService();

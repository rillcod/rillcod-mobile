import { supabase } from '../lib/supabase';
import type { Database, Json } from '../types/supabase';
import { teacherService } from './teacher.service';

export class AnalyticsService {
  async trackEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
    extras?: { schoolId?: string | null; userAgent?: string | null },
  ) {
    const payload: Database['public']['Tables']['activity_logs']['Insert'] = {
      user_id: userId,
      event_type: eventType,
      metadata: metadata as Json,
      school_id: extras?.schoolId ?? null,
      user_agent: extras?.userAgent ?? null,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('activity_logs').insert(payload);
    if (error) console.warn('Analytics trackEvent:', error.message);
  }

  async trackVideoEngagement(userId: string, lessonId: string, watchTime: number, completionPercentage: number) {
    const now = new Date().toISOString();
    const { error } = await supabase.from('lesson_progress').upsert(
      {
        portal_user_id: userId,
        lesson_id: lessonId,
        time_spent_minutes: watchTime / 60,
        progress_percentage: completionPercentage,
        last_accessed_at: now,
        updated_at: now,
        status: 'in_progress',
      },
      { onConflict: 'lesson_id,portal_user_id' }
    );
    if (error) console.warn('Analytics trackVideoEngagement:', error.message);
  }

  async getCoursePerformance(courseId: string) {
    const { data: courseData } = await supabase
      .from('courses')
      .select('program_id')
      .eq('id', courseId)
      .single();

    const programId = courseData?.program_id;
    if (!programId) return { totalStudents: 0, completionRate: 0, avgExamScore: 0, avgAssignmentGrade: 0 };

    const { data: students } = await supabase
      .from('enrollments')
      .select('user_id, status')
      .eq('program_id', programId);

    const total = students?.length || 0;
    const completed = students?.filter(s => s.status === 'completed').length || 0;

    const { data: examAvg } = await supabase.rpc('get_course_avg_exam_score', { p_course_id: courseId });
    const { data: assignmentAvg } = await supabase.rpc('get_course_avg_assignment_grade', { p_course_id: courseId });

    return {
      totalStudents: total,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      avgExamScore: examAvg || 0,
      avgAssignmentGrade: assignmentAvg || 0
    };
  }

  async getAtRiskStudents(schoolId?: string) {
    const { data, error } = await supabase.rpc('get_at_risk_students', {
      p_school_id: schoolId || undefined,
      p_days_inactive: 7
    });

    if (error) throw error;
    return data;
  }

  async generateStudentReport(studentId: string) {
    const { data: performance } = await supabase
      .from('student_progress_reports') // Adjusted from web's potential view name
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    const { data: activity } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(50);

    return {
      summary: performance,
      recentActivity: activity,
      generatedAt: new Date().toISOString()
    };
  }

  /** Analytics dashboard (admin / teacher / school): KPIs, school distribution, at-risk list. */
  async fetchStaffAnalyticsDashboard(profile: { id: string; role: string; school_id?: string | null }) {
    const isAdmin = profile.role === 'admin';
    const isTeacher = profile.role === 'teacher';

    let teacherSchoolIds: string[] = [];
    if (isTeacher) {
      teacherSchoolIds = await teacherService.listSchoolIdsForTeacher(profile.id, profile.school_id ?? null);
    }

    let studentsQuery = supabase
      .from('portal_users')
      .select('id, last_login', { count: 'exact' })
      .eq('role', 'student');
    let teachersQuery = supabase
      .from('portal_users')
      .select('id', { count: 'exact' })
      .eq('role', 'teacher')
      .eq('is_active', true);
    let schoolsQuery = supabase.from('schools').select('id, name', { count: 'exact' }).eq('status', 'approved');
    let pendingQuery = supabase.from('students').select('id', { count: 'exact' }).eq('status', 'pending');
    let reportsQuery = supabase.from('student_progress_reports').select('id', { count: 'exact' }).eq('is_published', true);
    let invoicesQuery = supabase.from('invoices').select('amount, status');

    if (isTeacher && teacherSchoolIds.length > 0) {
      studentsQuery = studentsQuery.in('school_id', teacherSchoolIds);
      teachersQuery = teachersQuery.in('school_id', teacherSchoolIds);
      schoolsQuery = schoolsQuery.in('id', teacherSchoolIds);
      pendingQuery = pendingQuery.in('school_id', teacherSchoolIds);
      reportsQuery = reportsQuery.in('school_id', teacherSchoolIds);
      invoicesQuery = invoicesQuery.in('school_id', teacherSchoolIds);
    } else if (!isAdmin && profile.school_id) {
      const sid = profile.school_id;
      studentsQuery = studentsQuery.eq('school_id', sid);
      teachersQuery = teachersQuery.eq('school_id', sid);
      schoolsQuery = schoolsQuery.eq('id', sid);
      pendingQuery = pendingQuery.eq('school_id', sid);
      reportsQuery = reportsQuery.eq('school_id', sid);
      invoicesQuery = invoicesQuery.eq('school_id', sid);
    }

    let ownClassesCount = 0;
    let ownAssignmentsCount = 0;
    if (isTeacher) {
      const [clsRes, asnRes] = await Promise.all([
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', profile.id),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
      ]);
      ownClassesCount = clsRes.count ?? 0;
      ownAssignmentsCount = asnRes.count ?? 0;
    }

    const [studentsRes, teachersRes, schoolsRes, pendingRes, reportsRes, invoicesRes] = await Promise.all([
      studentsQuery,
      teachersQuery,
      schoolsQuery,
      pendingQuery,
      reportsQuery,
      invoicesQuery,
    ]);

    const invoices = (invoicesRes.data ?? []) as { amount?: number; status?: string }[];
    const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
    const pendingRevenue = invoices
      .filter((i) => ['pending', 'overdue'].includes(i.status ?? ''))
      .reduce((s, i) => s + (i.amount || 0), 0);

    const totalStudents = studentsRes.count ?? 0;
    const activeThreshold = 7 * 24 * 60 * 60 * 1000;
    const activeStudents = ((studentsRes.data ?? []) as { last_login?: string | null }[]).filter((s) => {
      if (!s.last_login) return false;
      return Date.now() - new Date(s.last_login).getTime() < activeThreshold;
    }).length;

    const stats = {
      totalStudents: isTeacher ? ownClassesCount : totalStudents,
      activeStudents: isTeacher ? ownAssignmentsCount : activeStudents,
      totalTeachers: isTeacher ? teacherSchoolIds.length : (teachersRes.count ?? 0),
      totalSchools: isAdmin ? (schoolsRes.count ?? 0) : isTeacher ? teacherSchoolIds.length : 1,
      pendingApprovals: pendingRes.count ?? 0,
      publishedReports: reportsRes.count ?? 0,
      avgProgress: totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0,
      totalRevenue,
      pendingRevenue,
    };

    let schoolEnrollments: { name: string; count: number }[] = [];
    if (isAdmin || (isTeacher && teacherSchoolIds.length > 1)) {
      let distQuery = supabase
        .from('portal_users')
        .select('school_id, schools(name)')
        .eq('role', 'student');
      if (isTeacher) {
        distQuery = distQuery.in('school_id', teacherSchoolIds);
      }
      const { data: dist } = await distQuery;
      const counts: Record<string, number> = {};
      (dist ?? []).forEach((d: any) => {
        const name = d.schools?.name || 'Individual';
        counts[name] = (counts[name] || 0) + 1;
      });
      schoolEnrollments = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    let riskQuery = supabase
      .from('portal_users')
      .select('id, full_name, last_login')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('last_login', { ascending: true })
      .limit(8);

    if (isTeacher && teacherSchoolIds.length > 0) {
      riskQuery = riskQuery.in('school_id', teacherSchoolIds);
    } else if (!isAdmin && profile.school_id) {
      riskQuery = riskQuery.eq('school_id', profile.school_id);
    }

    const { data: riskStudents } = await riskQuery;
    const atRisk = ((riskStudents ?? []) as { id: string; full_name?: string | null; last_login?: string | null }[])
      .filter((student) => {
        if (!student.last_login) return true;
        return Date.now() - new Date(student.last_login).getTime() > 7 * 24 * 60 * 60 * 1000;
      })
      .slice(0, 5)
      .map((student) => ({
        id: student.id,
        name: student.full_name ?? 'Unknown Student',
        lastLogin: student.last_login ?? null,
      }));

    return { stats, schoolEnrollments, atRisk };
  }
}

export const analyticsService = new AnalyticsService();

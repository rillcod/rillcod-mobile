import { supabase } from '../lib/supabase';
import { chatService } from './chat.service';

// --- Types ---
export interface StatCard {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  color: string;
}

// --- Helpers ---
function timeAgo(iso: string | null) {
  if (!iso) return 'now';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export class DashboardService {
  async getAdminStats(colors: any) {
    const [stus, schs, tchs, pendingStudents, pendingSchools, paidInvoices] = await Promise.all([
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('schools').select('id', { count: 'exact', head: true }),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', false),
      supabase.from('schools').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('invoices').select('amount').eq('status', 'paid'),
    ]);

    const totalRevenue = ((paidInvoices.data ?? []) as any[]).reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    const pendingApprovals = (pendingStudents.count ?? 0) + (pendingSchools.count ?? 0);

    return [
      { icon: 'SC', label: 'PARTNER SCHOOLS', value: (schs.count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'TC', label: 'ACTIVE TEACHERS', value: (tchs.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'ST', label: 'TOTAL STUDENTS', value: (stus.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'AP', label: 'PENDING APPROVALS', value: pendingApprovals.toLocaleString(), color: pendingApprovals > 0 ? colors.error : colors.success },
      { icon: 'RV', label: 'TOTAL REVENUE', value: `₦${totalRevenue.toLocaleString()}`, color: colors.warning },
    ];
  }

  async getRecentActivity(colors: any) {
    const [rawSubs, rawCbt] = await Promise.all([
      supabase.from('assignment_submissions').select('id, status, submitted_at, portal_user_id, user_id, assignments(title)').order('submitted_at', { ascending: false }).limit(8),
      supabase.from('cbt_sessions').select('id, status, end_time, user_id, cbt_exams(title)').order('end_time', { ascending: false }).limit(8),
    ]);

    const allUserIds = [
      ...((rawSubs.data ?? []).map((item: any) => item.portal_user_id ?? item.user_id)),
      ...((rawCbt.data ?? []).map((item: any) => item.user_id)),
    ].filter(Boolean);
    const uniqueUserIds = [...new Set(allUserIds)];
    
    const { data: userData } = uniqueUserIds.length
      ? await supabase.from('portal_users').select('id, full_name').in('id', uniqueUserIds)
      : { data: [] };

    const userMap: Record<string, string> = {};
    (userData ?? []).forEach((user: any) => {
      userMap[user.id] = user.full_name ?? 'Student';
    });

    const recentActivity: ActivityItem[] = [];
    (rawSubs.data ?? []).forEach((item: any) => {
      recentActivity.push({
        id: `sub-${item.id}`,
        title: `${userMap[item.portal_user_id ?? item.user_id] ?? 'Student'} submitted`,
        desc: `Assignment: ${item.assignments?.title ?? 'Untitled'}`,
        time: timeAgo(item.submitted_at),
        icon: 'AS',
        color: item.status === 'graded' ? colors.success : colors.primary,
      });
    });
    (rawCbt.data ?? []).forEach((item: any) => {
      recentActivity.push({
        id: `cbt-${item.id}`,
        title: `${userMap[item.user_id] ?? 'Student'} completed`,
        desc: `Exam: ${item.cbt_exams?.title ?? 'Untitled'}`,
        time: timeAgo(item.end_time),
        icon: 'CB',
        color: item.status === 'passed' ? colors.success : colors.warning,
      });
    });

    return recentActivity.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
  }

  async getTeacherDashboardData(teacherId: string, colors: any) {
    const { data: ownClassesData } = await supabase.from('classes').select('id').eq('teacher_id', teacherId);
    const ownClassIds = (ownClassesData ?? []).map((c: any) => c.id);

    const { data: ownAssignmentsData } = await supabase.from('assignments').select('id').eq('created_by', teacherId);
    const ownAssignmentIds = (ownAssignmentsData ?? []).map((a: any) => a.id);

    // Roster seats = portal student rows assigned to this teacher's classes (`portal_users.class_id`),
    // not `enrollments` (program-level; no `class_id` on that table).
    const studentsCount =
      ownClassIds.length > 0
        ? (
            await supabase
              .from('portal_users')
              .select('id', { count: 'exact', head: true })
              .eq('role', 'student')
              .eq('is_deleted', false)
              .in('class_id', ownClassIds)
          ).count
        : 0;

    return {
      stats: [
        { icon: 'CL', label: 'YOUR CLASSES', value: ownClassIds.length.toLocaleString(), color: colors.primary },
        { icon: 'ST', label: 'ENROLLED STUDENTS', value: (studentsCount ?? 0).toLocaleString(), color: colors.info },
        { icon: 'AS', label: 'YOUR ASSIGNMENTS', value: ownAssignmentIds.length.toLocaleString(), color: colors.warning },
      ],
      ownClassIds,
      ownAssignmentIds,
    };
  }

  async getSchoolDashboardData(schoolId: string, colors: any) {
    const [students, teachers, classes, pending] = await Promise.all([
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', schoolId),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId).eq('is_active', false),
    ]);

    return [
      { icon: 'ST', label: 'ENROLLED STUDENTS', value: (students.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'TC', label: 'TEACHERS', value: (teachers.count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'CL', label: 'CLASSES', value: (classes.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'PN', label: 'PENDING ACCOUNTS', value: (pending.count ?? 0).toLocaleString(), color: colors.warning },
    ];
  }

  async getTimetableSlots(timetableIds: string[], teacherId?: string) {
    if (timetableIds.length === 0) return [];
    
    let query = supabase
      .from('timetable_slots')
      .select('id, subject, room, start_time, teacher_id')
      .in('timetable_id', timetableIds);

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data } = await query.order('start_time', { ascending: true }).limit(4);
    
    return ((data ?? []) as any[]).map((item: any) => ({
      id: item.id,
      title: item.subject ?? 'Class session',
      subtitle: item.room ? `Room ${item.room}` : 'Room not set',
      time: item.start_time ?? 'TBD',
    }));
  }

  async getParentDashboardData(parentEmail: string, colors: any) {
    const { data: childrenData } = await supabase
      .from('students')
      .select('id, full_name, user_id, school_name, grade_level, status')
      .eq('parent_email', parentEmail);

    const children = (childrenData ?? []) as any[];
    const userIds = children.map((child) => child.user_id).filter(Boolean) as string[];

    const [reportsRes, certsRes, invoicesRes] = await Promise.all([
      userIds.length ? supabase.from('student_progress_reports').select('id', { count: 'exact', head: true }).in('student_id', userIds).eq('is_published', true) : { count: 0 },
      userIds.length ? supabase.from('certificates').select('id', { count: 'exact', head: true }).in('portal_user_id', userIds) : { count: 0 },
      userIds.length ? supabase.from('invoices').select('id', { count: 'exact', head: true }).in('portal_user_id', userIds).in('status', ['pending', 'overdue']) : { count: 0 },
    ]);

    return {
      children,
      stats: [
        { icon: 'CH', label: 'LINKED CHILDREN', value: children.length.toLocaleString(), color: colors.accent },
        { icon: 'RP', label: 'PUBLISHED REPORTS', value: (reportsRes.count ?? 0).toLocaleString(), color: colors.primary },
        { icon: 'CT', label: 'CERTIFICATES', value: (certsRes.count ?? 0).toLocaleString(), color: colors.success },
        { icon: 'IV', label: 'UNPAID INVOICES', value: (invoicesRes.count ?? 0).toLocaleString(), color: colors.warning },
      ]
    };
  }

  calculateTeacherWorkload(submissions: any[]) {
    const now = Date.now();
    return submissions.reduce(
      (acc, row) => {
        const submittedAtMs = row.submitted_at ? new Date(row.submitted_at).getTime() : now;
        const dueDateMs = row.assignments?.due_date ? new Date(row.assignments.due_date).getTime() : null;
        const ageHours = (now - submittedAtMs) / (1000 * 60 * 60);
        const hoursToDue = dueDateMs == null ? Number.POSITIVE_INFINITY : (dueDateMs - now) / (1000 * 60 * 60);
        if (hoursToDue < 0 || ageHours >= 72) acc.urgent += 1;
        else if (hoursToDue <= 48 || ageHours >= 24) acc.dueSoon += 1;
        else acc.routine += 1;
        return acc;
      },
      { urgent: 0, dueSoon: 0, routine: 0 }
    );
  }

  /** Teacher assignment inbox: recent submissions + count still needing grades. */
  async getTeacherSubmissionsFeed(assignmentIds: string[], limit = 6) {
    if (!assignmentIds.length) {
      return { feed: [] as any[], ungradedCount: 0 };
    }
    const [feedRes, ungradedRes] = await Promise.all([
      supabase
        .from('assignment_submissions')
        .select('id, status, submitted_at, assignments(title, due_date)')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false })
        .limit(limit),
      supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .eq('status', 'submitted')
        .is('grade', null),
    ]);
    return { feed: feedRes.data ?? [], ungradedCount: ungradedRes.count ?? 0 };
  }

  async countUnreadInboxMessages(recipientId: string) {
    return chatService.countUnreadForRecipient(recipientId);
  }

  async getActiveTimetableIdsForSchool(schoolId: string) {
    const { data } = await supabase
      .from('timetables')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_active', true);
    return (data ?? []).map((r: { id: string }) => r.id);
  }

  async listSchoolInvoicePreviews(school_id: string, limit = 6) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount, currency, status, due_date, schools(name)')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listAdminSchoolInvoicePreviews(limit = 6) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, amount, currency, status, due_date, schools(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Active announcements for home banner (school + role filter in app layer). */
  async listAnnouncementsForAudience(params: { role: string; schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 8;
    const role = params.role;
    const schoolId = params.schoolId ?? null;
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, created_at, target_audience, school_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(Math.min(lim * 4, 40));
    if (error) throw error;
    const rows = (data ?? []) as {
      id: string;
      title: string;
      content: string;
      created_at: string | null;
      target_audience: string | null;
      school_id: string | null;
    }[];
    return rows
      .filter((row) => {
        if (row.school_id != null && row.school_id !== schoolId) return false;
        const aud = (row.target_audience ?? 'all').toLowerCase().trim();
        if (!aud || aud === 'all' || aud === 'everyone') return true;
        return aud === role.toLowerCase();
      })
      .slice(0, lim);
  }

  /** Upcoming live sessions for programmes the student is enrolled in. */
  async listUpcomingLiveSessionsForStudent(portalUserId: string, limit = 6) {
    const { data: enr, error: enrErr } = await supabase
      .from('enrollments')
      .select('program_id')
      .eq('user_id', portalUserId);
    if (enrErr) throw enrErr;
    const pids = [...new Set((enr ?? []).map((e: { program_id: string | null }) => e.program_id).filter(Boolean))] as string[];
    if (!pids.length) return [];
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('live_sessions')
      .select('id, title, scheduled_at, session_url, platform, status, program_id, programs(name)')
      .in('program_id', pids)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Parallel counts + submissions used by the student home dashboard. */
  async getStudentDashboardSnapshot(userId: string) {
    const [
      reportsRes,
      certsRes,
      submissionsRes,
      cbtRes,
      pointsRes,
      leaderboardRes,
      progressRes,
      enrollmentRes,
      submissionRowsRes,
      studentProgressIncompleteRes,
    ] = await Promise.all([
      supabase
        .from('student_progress_reports')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', userId)
        .eq('is_published', true),
      supabase
        .from('certificates')
        .select('id', { count: 'exact', head: true })
        .eq('portal_user_id', userId),
      supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('portal_user_id', userId),
      supabase.from('cbt_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase
        .from('user_points')
        .select('total_points, current_streak')
        .eq('portal_user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_points')
        .select('portal_user_id, total_points')
        .order('total_points', { ascending: false })
        .limit(100),
      supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('portal_user_id', userId)
        .eq('status', 'completed'),
      supabase
        .from('enrollments')
        .select('program_id, programs(id, name)')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('assignment_submissions')
        .select('id, status, grade, submitted_at, assignments(title, max_points, due_date)')
        .eq('portal_user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(30),
      supabase
        .from('student_progress')
        .select('id', { count: 'exact', head: true })
        .eq('portal_user_id', userId)
        .is('completed_at', null),
    ]);

    return {
      reportsRes,
      certsRes,
      submissionsRes,
      cbtRes,
      pointsRes,
      leaderboardRes,
      progressRes,
      enrollmentRes,
      submissionRowsRes,
      studentProgressIncompleteRes,
    };
  }

  /** Next lesson in programme for Learn-style “continue” tiles (student). */
  async resolveNextLessonInProgram(programId: string, completedLessonIds: string[]) {
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('program_id', programId)
      .eq('is_active', true)
      .eq('is_locked', false);
    const courseIds = (courses ?? []).map((c: { id: string }) => c.id);
    if (!courseIds.length) return { nextLessonTitle: null as string | null, nextLessonId: null as string | null };

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title')
      .in('course_id', courseIds)
      .eq('status', 'active')
      .order('order_index', { ascending: true })
      .limit(20);

    const done = new Set(completedLessonIds);
    const list = (lessons ?? []) as { id: string; title: string }[];
    const next = list.find((l) => !done.has(l.id)) ?? list[0];
    return { nextLessonTitle: next?.title ?? null, nextLessonId: next?.id ?? null };
  }
}

export const dashboardService = new DashboardService();

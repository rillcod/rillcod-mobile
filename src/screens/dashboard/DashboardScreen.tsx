import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiText, MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { FONT_FAMILY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { COLORS } from '../../constants/colors';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import { PresenceList } from '../../components/PresenceList';

const { width } = Dimensions.get('window');

interface StatCard {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  color: string;
}

interface SchoolPayment {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  schools: { name: string }[] | { name: string } | null;
}

interface ChildLink {
  id: string;
  full_name: string;
  user_id: string | null;
  school_name?: string | null;
  grade_level?: string | null;
  status?: string | null;
}

interface QuickLink {
  icon: string;
  label: string;
  screen: string;
  color: string;
  desc: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
}

interface TeacherActionCenter {
  ungradedAssignments: number;
  ungradedExams: number;
}

interface ParentHeadline {
  outstandingBalance: number;
  overdueInvoices: number;
  unreadNotifications: number;
  currency: string;
}

interface StudentMission {
  nextLessonTitle: string | null;
  nextLessonId: string | null;
  pendingAssignments: number;
  xp: number;
  streak: number;
  leaderboardRank: number | null;
}

const ACTION_SCREENS: Record<string, string> = {
  Students: 'Students',
  Schools: 'Schools',
  Teachers: 'Teachers',
  Parents: 'Parents',
  Approvals: 'Approvals',
  Attendance: 'Attendance',
  Payments: 'Payments',
  Timetable: 'Timetable',
  Classes: 'Classes',
  CBT: 'CBT',
  Reports: 'Reports',
  Assignments: 'Assignments',
  Messages: 'Messages',
  Settings: 'Settings',
  Analytics: 'Analytics',
  Grades: 'Grades',
  Certificates: 'Certificates',
  Invoices: 'Invoices',
  MyChildren: 'MyChildren',
  ParentResults: 'ParentResults',
  ParentAttendance: 'ParentAttendance',
  ParentGrades: 'ParentGrades',
  ParentInvoices: 'ParentInvoices',
  ParentCertificates: 'ParentCertificates',
  Courses: 'Learn',
  Learn: 'Learn',
  AI: 'AI',
};

const ADMIN_HOME_ACTIONS = [
  { icon: 'SC', label: 'Partner Schools', screen: 'Schools', color: COLORS.info },
  { icon: 'TC', label: 'Manage Teachers', screen: 'Teachers', color: COLORS.primary },
  { icon: 'AN', label: 'Analytics', screen: 'Analytics', color: COLORS.success },
  { icon: 'ST', label: 'Settings', screen: 'Settings', color: COLORS.accent },
];

const ADMIN_NAV_LINKS = [
  { icon: 'AP', label: 'Approvals', screen: 'Approvals', color: COLORS.success },
  { icon: 'AN', label: 'Analytics', screen: 'Analytics', color: COLORS.info },
  { icon: 'GR', label: 'Grades', screen: 'Grades', color: COLORS.accent },
  { icon: 'SC', label: 'Schools', screen: 'Schools', color: COLORS.primary },
];

const TEACHER_QUICK_LINKS: QuickLink[] = [
  { icon: 'AT', label: 'Attendance', screen: 'Attendance', color: COLORS.success, desc: 'Register student presence and view sessions' },
  { icon: 'AS', label: 'Assignments', screen: 'Assignments', color: COLORS.warning, desc: 'Create, review, and grade submissions' },
  { icon: 'CB', label: 'CBT Centre', screen: 'CBT', color: COLORS.primary, desc: 'Manage exams and computer-based tests' },
  { icon: 'RP', label: 'Reports', screen: 'Reports', color: COLORS.accent, desc: 'Open result publishing and report tools' },
];

const SCHOOL_QUICK_LINKS: QuickLink[] = [
  { icon: 'ST', label: 'Students', screen: 'Students', color: COLORS.info, desc: 'Manage enrolled students and records' },
  { icon: 'TC', label: 'Teachers', screen: 'Teachers', color: COLORS.primary, desc: 'Track teacher accounts and staffing' },
  { icon: 'PM', label: 'Payments', screen: 'Payments', color: COLORS.warning, desc: 'Review invoices, balances, and dues' },
  { icon: 'OV', label: 'Overview', screen: 'SchoolOverview', color: COLORS.success, desc: 'Open the full school command center' },
];

const PARENT_QUICK_LINKS: QuickLink[] = [
  { icon: 'CH', label: 'My Children', screen: 'MyChildren', color: COLORS.accent, desc: 'See linked children and their progress' },
  { icon: 'RP', label: 'Report Cards', screen: 'ParentResults', color: COLORS.primary, desc: 'Open published reports and term results' },
  { icon: 'IV', label: 'Invoices', screen: 'ParentInvoices', color: COLORS.warning, desc: 'Pay fees and review invoice status' },
  { icon: 'MG', label: 'Messages', screen: 'Messages', color: COLORS.info, desc: 'Reach teachers and school staff' },
];

const STUDENT_QUICK_LINKS: QuickLink[] = [
  { icon: 'LR', label: 'Learning', screen: 'Learn', color: COLORS.info, desc: 'Resume courses and active lessons' },
  { icon: 'AS', label: 'Assignments', screen: 'Assignments', color: COLORS.primary, desc: 'Submit coursework and review tasks' },
  { icon: 'CB', label: 'CBT', screen: 'CBT', color: COLORS.warning, desc: 'Take tests and practice assessments' },
  { icon: 'LB', label: 'Leaderboard', screen: 'Leaderboard', color: COLORS.success, desc: 'Track ranking, progress, and momentum' },
];

function timeAgo(iso: string | null) {
  if (!iso) return 'now';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'NGN'} ${Number(amount ?? 0).toLocaleString()}`;
  }
}

export default function DashboardScreen({ navigation }: any) {
  const { profile, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const [stats, setStats] = useState<StatCard[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [schoolPayments, setSchoolPayments] = useState<SchoolPayment[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [upcomingSlots, setUpcomingSlots] = useState<ScheduleItem[]>([]);
  const [teacherActionCenter, setTeacherActionCenter] = useState<TeacherActionCenter | null>(null);
  const [parentChildren, setParentChildren] = useState<ChildLink[]>([]);
  const [parentHeadline, setParentHeadline] = useState<ParentHeadline | null>(null);
  const [studentMission, setStudentMission] = useState<StudentMission | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = profile?.role ?? 'student';

  const getRoleConfig = () => {
    switch (role) {
      case 'admin':
        return {
          color: colors.error,
          label: 'ADMINISTRATOR',
          actions: [
            { icon: 'ST', label: 'Students', color: colors.info },
            { icon: 'SC', label: 'Schools', color: colors.primary },
            { icon: 'AI', label: 'AI', color: colors.primary },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'AN', label: 'Analytics', color: colors.success },
            { icon: 'RP', label: 'Reports', color: colors.accent },
          ],
        };
      case 'teacher':
        return {
          color: colors.primary,
          label: 'INSTRUCTOR',
          actions: [
            { icon: 'CL', label: 'Classes', color: colors.primary },
            { icon: 'AI', label: 'AI', color: colors.primary },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'AT', label: 'Attendance', color: colors.success },
            { icon: 'AS', label: 'Assignments', color: colors.info },
            { icon: 'MG', label: 'Messages', color: colors.accent },
          ],
        };
      case 'parent':
        return {
          color: colors.accent,
          label: 'PARENT PORTAL',
          actions: [
            { icon: 'CH', label: 'MyChildren', color: colors.accent },
            { icon: 'RS', label: 'ParentResults', color: colors.primary },
            { icon: 'IV', label: 'ParentInvoices', color: colors.warning },
            { icon: 'GD', label: 'ParentGrades', color: colors.success },
            { icon: 'AT', label: 'ParentAttendance', color: '#7c3aed' },
            { icon: 'MG', label: 'Messages', color: colors.info },
          ],
        };
      default:
        return {
          color: colors.success,
          label: 'STUDENT',
          actions: [
            { icon: 'LR', label: 'Learn', color: colors.info },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'AI', label: 'AI', color: colors.primary },
            { icon: 'AS', label: 'Assignments', color: colors.primary },
            { icon: 'CT', label: 'Certificates', color: colors.success },
            { icon: 'RP', label: 'Reports', color: colors.accent },
          ],
        };
    }
  };

  const config = getRoleConfig();

  const greetingKey = () => {
    const h = new Date().getHours();
    if (h < 12) return 'dashboard.greeting_morning';
    if (h < 17) return 'dashboard.greeting_afternoon';
    return 'dashboard.greeting_evening';
  };

  const loadAdminData = useCallback(async () => {
    setQuickLinks([]);
    setUpcomingSlots([]);
    setTeacherActionCenter(null);
    setParentChildren([]);
    setParentHeadline(null);
    setStudentMission(null);
    const [stus, schs, tchs, partners, gradedAssignments, gradedCbt, rawSubs, rawCbt, invoices] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('schools').select('id', { count: 'exact', head: true }),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'school').eq('is_active', true),
      supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).not('grade', 'is', null),
      supabase.from('cbt_sessions').select('id', { count: 'exact', head: true }).not('score', 'is', null),
      supabase.from('assignment_submissions').select('id, status, submitted_at, portal_user_id, user_id, assignments(title)').order('submitted_at', { ascending: false }).limit(8),
      supabase.from('cbt_sessions').select('id, status, end_time, user_id, cbt_exams(title)').order('end_time', { ascending: false }).limit(8),
      supabase.from('invoices').select('id, invoice_number, amount, currency, status, due_date, schools(name)').not('school_id', 'is', null).order('created_at', { ascending: false }).limit(6),
    ]);

    setStats([
      { icon: 'SC', label: 'PARTNER SCHOOLS', value: (schs.count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'AC', label: 'PARTNER ACCOUNTS', value: (partners.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'TC', label: 'ACTIVE TEACHERS', value: (tchs.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'ST', label: 'TOTAL STUDENTS', value: (stus.count ?? 0).toLocaleString(), color: colors.warning },
      { icon: 'GD', label: 'SUBMISSIONS GRADED', value: ((gradedAssignments.count ?? 0) + (gradedCbt.count ?? 0)).toLocaleString(), color: colors.accent },
    ]);

    const allUserIds = [
      ...((rawSubs.data ?? []).map((item: any) => item.portal_user_id ?? item.user_id)),
      ...((rawCbt.data ?? []).map((item: any) => item.user_id)),
    ].filter(Boolean);
    const uniqueUserIds = [...new Set(allUserIds)];
    const userLookup = uniqueUserIds.length
      ? await supabase.from('portal_users').select('id, full_name').in('id', uniqueUserIds)
      : { data: [] as any[] };
    const userMap: Record<string, string> = {};
    (userLookup.data ?? []).forEach((user: any) => {
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
    setActivities(recentActivity.slice(0, 6));
    setSchoolPayments((invoices.data ?? []) as SchoolPayment[]);
  }, [colors]);

  const loadTeacherData = useCallback(async () => {
    const schoolId = profile?.school_id;
    const activeTimetableIds =
      schoolId
        ? ((await supabase.from('timetables').select('id').eq('school_id', schoolId).eq('is_active', true)).data ?? []).map((item: any) => item.id)
        : [];

    const [studentsRes, classesRes, assignmentsRes, attendanceRes, submissionsRes, ungradedAssignmentsRes, ungradedCbtRes, timetableRes] = await Promise.all([
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId ?? ''),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId ?? ''),
      supabase.from('assignments').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabase.from('assignment_submissions').select('id, status, submitted_at, assignments(title)').order('submitted_at', { ascending: false }).limit(6),
      supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted').is('grade', null),
      supabase.from('cbt_sessions').select('id', { count: 'exact', head: true }).eq('needs_grading', true),
      activeTimetableIds.length > 0
        ? supabase.from('timetable_slots').select('id, subject, room, start_time, teacher_id').in('timetable_id', activeTimetableIds).eq('teacher_id', profile?.id ?? '').order('start_time', { ascending: true }).limit(4)
        : Promise.resolve({ data: [] } as any),
    ]);

    setStats([
      { icon: 'CL', label: 'YOUR CLASSES', value: (classesRes.count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'ST', label: 'ACTIVE STUDENTS', value: (studentsRes.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'AS', label: 'ASSIGNMENTS', value: (assignmentsRes.count ?? 0).toLocaleString(), color: colors.warning },
      { icon: 'AT', label: 'RECENT ATTENDANCE', value: (attendanceRes.count ?? 0).toLocaleString(), color: colors.success },
    ]);

    setActivities(
      ((submissionsRes.data ?? []) as any[]).map((item: any) => ({
        id: item.id,
        title: 'Student submission received',
        desc: item.assignments?.title ?? 'Untitled assignment',
        time: timeAgo(item.submitted_at),
        icon: 'AS',
        color: item.status === 'graded' ? colors.success : colors.primary,
      }))
    );
    setTeacherActionCenter({
      ungradedAssignments: ungradedAssignmentsRes.count ?? 0,
      ungradedExams: ungradedCbtRes.count ?? 0,
    });
    setUpcomingSlots(
      ((timetableRes.data ?? []) as any[]).map((item: any) => ({
        id: item.id,
        title: item.subject ?? 'Class session',
        subtitle: item.room ? `Room ${item.room}` : 'Room not set',
        time: item.start_time ?? 'TBD',
      }))
    );
    setQuickLinks(TEACHER_QUICK_LINKS);
    setParentChildren([]);
    setParentHeadline(null);
    setStudentMission(null);
    setSchoolPayments([]);
  }, [colors, profile?.school_id]);

  const loadSchoolData = useCallback(async () => {
    const schoolId = profile?.school_id;
    const activeTimetableIds =
      schoolId
        ? ((await supabase.from('timetables').select('id').eq('school_id', schoolId).eq('is_active', true)).data ?? []).map((item: any) => item.id)
        : [];

    const [studentsRes, teachersRes, classesRes, pendingRes, invoicesRes, timetableRes] = await Promise.all([
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId ?? ''),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', schoolId ?? ''),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId ?? ''),
      supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId ?? '').eq('is_active', false),
      supabase.from('invoices').select('id, invoice_number, amount, currency, status, due_date, schools(name)').eq('school_id', schoolId ?? '').order('created_at', { ascending: false }).limit(6),
      activeTimetableIds.length > 0
        ? supabase.from('timetable_slots').select('id, subject, room, start_time').in('timetable_id', activeTimetableIds).order('start_time', { ascending: true }).limit(4)
        : Promise.resolve({ data: [] } as any),
    ]);

    setStats([
      { icon: 'ST', label: 'ENROLLED STUDENTS', value: (studentsRes.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'TC', label: 'TEACHERS', value: (teachersRes.count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'CL', label: 'CLASSES', value: (classesRes.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'PN', label: 'PENDING ACCOUNTS', value: (pendingRes.count ?? 0).toLocaleString(), color: colors.warning },
    ]);

    setActivities([
      { id: 'school-overview', title: 'School overview ready', desc: 'Review attendance, reports, and billing on mobile', time: 'now', icon: 'OV', color: colors.primary },
    ]);
    setUpcomingSlots(
      ((timetableRes.data ?? []) as any[]).map((item: any) => ({
        id: item.id,
        title: item.subject ?? 'Class session',
        subtitle: item.room ? `Room ${item.room}` : 'Room not set',
        time: item.start_time ?? 'TBD',
      }))
    );
    setQuickLinks(SCHOOL_QUICK_LINKS);
    setTeacherActionCenter(null);
    setParentChildren([]);
    setParentHeadline(null);
    setStudentMission(null);
    setSchoolPayments((invoicesRes.data ?? []) as SchoolPayment[]);
  }, [colors, profile?.school_id]);

  const loadParentData = useCallback(async () => {
    const { data: childrenData } = await supabase
      .from('students')
      .select('id, full_name, user_id, school_name, grade_level, status')
      .eq('parent_email', profile?.email ?? '');

    const children = (childrenData ?? []) as ChildLink[];
    const userIds = children.map((child) => child.user_id).filter(Boolean) as string[];

    const [reportsRes, certsRes, invoicesRes, unreadRes, invoiceListRes] = await Promise.all([
      userIds.length
        ? supabase.from('student_progress_reports').select('id', { count: 'exact', head: true }).in('student_id', userIds).eq('is_published', true)
        : Promise.resolve({ count: 0 }),
      userIds.length
        ? supabase.from('certificates').select('id', { count: 'exact', head: true }).in('portal_user_id', userIds)
        : Promise.resolve({ count: 0 }),
      userIds.length
        ? supabase.from('invoices').select('id', { count: 'exact', head: true }).in('portal_user_id', userIds).in('status', ['pending', 'overdue'])
        : Promise.resolve({ count: 0 }),
      profile?.id
        ? supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false)
        : Promise.resolve({ count: 0 }),
      userIds.length
        ? supabase.from('invoices').select('amount, currency, status').in('portal_user_id', userIds).in('status', ['pending', 'overdue'])
        : Promise.resolve({ data: [] }),
    ]);

    setStats([
      { icon: 'CH', label: 'LINKED CHILDREN', value: children.length.toLocaleString(), color: colors.accent },
      { icon: 'RP', label: 'PUBLISHED REPORTS', value: ((reportsRes as any).count ?? 0).toLocaleString(), color: colors.primary },
      { icon: 'CT', label: 'CERTIFICATES', value: ((certsRes as any).count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'IV', label: 'UNPAID INVOICES', value: ((invoicesRes as any).count ?? 0).toLocaleString(), color: colors.warning },
    ]);

    setActivities(
      children.slice(0, 4).map((child, index) => ({
        id: child.id,
        title: child.full_name,
        desc: index === 0 ? 'Open child portal tools from dashboard or portal hub' : 'Track results, invoices, and attendance',
        time: 'now',
        icon: 'CH',
        color: colors.accent,
      }))
    );
    const outstandingInvoices = ((invoiceListRes as any).data ?? []) as any[];
    setParentChildren(children);
    setParentHeadline({
      outstandingBalance: outstandingInvoices.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
      overdueInvoices: outstandingInvoices.filter((item) => item.status === 'overdue').length,
      unreadNotifications: (unreadRes as any).count ?? 0,
      currency: outstandingInvoices[0]?.currency ?? 'NGN',
    });
    setQuickLinks(PARENT_QUICK_LINKS);
    setUpcomingSlots([]);
    setTeacherActionCenter(null);
    setStudentMission(null);
    setSchoolPayments([]);
  }, [colors, profile?.email]);

  const loadStudentData = useCallback(async () => {
    const [reportsRes, certsRes, submissionsRes, cbtRes, pointsRes, leaderboardRes, progressRes, enrollmentRes] = await Promise.all([
      supabase.from('student_progress_reports').select('id', { count: 'exact', head: true }).eq('student_id', profile?.id ?? '').eq('is_published', true),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('portal_user_id', profile?.id ?? ''),
      supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('portal_user_id', profile?.id ?? ''),
      supabase.from('cbt_sessions').select('id', { count: 'exact', head: true }).eq('user_id', profile?.id ?? ''),
      supabase.from('user_points').select('total_points, current_streak').eq('portal_user_id', profile?.id ?? '').maybeSingle(),
      supabase.from('user_points').select('portal_user_id, total_points').order('total_points', { ascending: false }).limit(100),
      supabase.from('lesson_progress').select('lesson_id').eq('portal_user_id', profile?.id ?? '').eq('status', 'completed'),
      supabase.from('enrollments').select('program_id, programs(id, name)').eq('user_id', profile?.id ?? '').limit(1),
    ]);

    setStats([
      { icon: 'RP', label: 'REPORTS', value: (reportsRes.count ?? 0).toLocaleString(), color: colors.accent },
      { icon: 'CT', label: 'CERTIFICATES', value: (certsRes.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'AS', label: 'SUBMISSIONS', value: (submissionsRes.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'CB', label: 'CBT SESSIONS', value: (cbtRes.count ?? 0).toLocaleString(), color: colors.warning },
    ]);

    setActivities([
      { id: 'student-track', title: 'Learning track active', desc: 'Jump into lessons, assignments, reports, and exams', time: 'now', icon: 'LR', color: colors.primary },
    ]);
    let nextLessonTitle: string | null = null;
    let nextLessonId: string | null = null;
    const enrolledPrograms = (enrollmentRes.data ?? []) as any[];
    if (enrolledPrograms.length > 0) {
      const programId = enrolledPrograms[0]?.programs?.id;
      if (programId) {
        const { data: courses } = await supabase.from('courses').select('id').eq('program_id', programId);
        const courseIds = (courses ?? []).map((item: any) => item.id);
        if (courseIds.length > 0) {
          const [{ data: lessons }, doneRes] = await Promise.all([
            supabase.from('lessons').select('id, title').in('course_id', courseIds).eq('status', 'active').order('order_index', { ascending: true }).limit(20),
            Promise.resolve(progressRes),
          ]);
          const doneSet = new Set(((doneRes.data ?? []) as any[]).map((item: any) => item.lesson_id));
          const nextLesson = ((lessons ?? []) as any[]).find((item: any) => !doneSet.has(item.id)) ?? ((lessons ?? []) as any[])[0];
          nextLessonTitle = nextLesson?.title ?? null;
          nextLessonId = nextLesson?.id ?? null;
        }
      }
    }
    let leaderboardRank: number | null = null;
    const leaderboard = (leaderboardRes.data ?? []) as any[];
    const rankIndex = leaderboard.findIndex((item: any) => item.portal_user_id === profile?.id);
    if (rankIndex >= 0) leaderboardRank = rankIndex + 1;
    setStudentMission({
      nextLessonTitle,
      nextLessonId,
      pendingAssignments: submissionsRes.count ?? 0,
      xp: pointsRes.data?.total_points ?? 0,
      streak: pointsRes.data?.current_streak ?? 0,
      leaderboardRank,
    });
    setQuickLinks(STUDENT_QUICK_LINKS);
    setUpcomingSlots([]);
    setTeacherActionCenter(null);
    setParentChildren([]);
    setParentHeadline(null);
    setSchoolPayments([]);
  }, [colors, profile?.id]);

  const loadData = useCallback(async () => {
    if (!profile) return;

    const { data } = await supabase.from('announcements').select('id, title, content, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(4);
    setAnnouncements((data ?? []) as Announcement[]);

    if (profile.role === 'admin') {
      await loadAdminData();
    } else if (profile.role === 'teacher') {
      await loadTeacherData();
    } else if (profile.role === 'school') {
      await loadSchoolData();
    } else if (profile.role === 'parent') {
      await loadParentData();
    } else {
      await loadStudentData();
    }

    setLoading(false);
  }, [profile, loadAdminData, loadTeacherData, loadSchoolData, loadParentData, loadStudentData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.color} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroOuter}>
          <LinearGradient colors={isDark ? ['#000', '#0a0a0f'] : [colors.primary + '10', colors.bg]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.greeting, { color: colors.textMuted }]}>{t(greetingKey()).toUpperCase()} HELLO</Text>
                <MotiText from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} style={[styles.userName, { color: colors.textPrimary }]}>
                  {profile?.full_name?.split(' ')[0] ?? 'COMMANDER'}
                </MotiText>
                <View style={[styles.rolePill, { borderColor: config.color + '40', backgroundColor: config.color + '10' }]}>
                  <View style={[styles.roleDot, { backgroundColor: config.color }]} />
                  <Text style={[styles.roleText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.border }]} onPress={() => { light(); signOut(); }}>
                <Text style={styles.smallActionText}>OUT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
                <LinearGradient colors={colors.gradPrimary} style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(profile?.full_name ?? 'U')[0].toUpperCase()}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={[styles.statsRow, role === 'admin' && styles.statsRowWrap]}>
              {stats.map((s, i) => (
                <MotiView
                  key={`${s.label}-${i}`}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 + i * 70 }}
                  style={[
                    styles.statCard,
                    { borderColor: colors.border, backgroundColor: colors.bgCard },
                    role === 'admin' && styles.statCardAdmin,
                  ]}
                >
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
                </MotiView>
              ))}
            </View>
          </View>
        </View>

        <PresenceList />

        {role === 'student' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CURRENT LAB SESSION</Text>
              <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
            </View>
            <TouchableOpacity
              style={[styles.labCard, { backgroundColor: colors.bgCard, borderColor: colors.primary + '40' }]}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: 'active', projectTitle: 'Obstacle Robot' })}
            >
              <LinearGradient colors={[colors.primary + '10', 'transparent']} style={StyleSheet.absoluteFill} />
              <View style={styles.labInfo}>
                <Text style={[styles.labTag, { color: colors.primary }]}>ACTIVE BUILD</Text>
                <Text style={[styles.labTitle, { color: colors.textPrimary }]}>Obstacle Avoidance Robot</Text>
                <Text style={[styles.labDesc, { color: colors.textSecondary }]}>Step 4/12: Wiring the Ultrasonic sensor to Digital Pin 7.</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { backgroundColor: colors.primary, width: '33.3%' }]} />
                </View>
              </View>
              <View style={styles.labIconWrap}>
                <Text style={styles.badgeCode}>RB</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {role === 'admin' ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.adminList}>
                {ADMIN_HOME_ACTIONS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.adminRowCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate(item.screen)}
                  >
                    <View style={[styles.adminRowIcon, { backgroundColor: item.color + '12', borderColor: item.color + '33' }]}>
                      <Text style={[styles.codeIcon, { color: item.color }]}>{item.icon}</Text>
                    </View>
                    <Text style={[styles.adminRowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    <Text style={[styles.adminRowArrow, { color: colors.textMuted }]}>OPEN</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SCHOOL BILLING RECORDS</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.warning }]} />
              </View>
              {schoolPayments.length === 0 ? (
                <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <Text style={styles.emptyCode}>PM</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO SCHOOL INVOICES YET</Text>
                </View>
              ) : schoolPayments.map((payment) => {
                const school = Array.isArray(payment.schools) ? payment.schools[0] : payment.schools;
                const symbol = payment.currency === 'NGN' ? 'NGN ' : payment.currency === 'USD' ? '$' : `${payment.currency} `;
                const statusColor = payment.status === 'paid' ? colors.success : payment.status === 'overdue' ? colors.error : colors.warning;
                return (
                  <TouchableOpacity
                    key={payment.id}
                    style={[styles.billingCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Payments')}
                  >
                    <View style={styles.billingTop}>
                      <Text style={[styles.billingSchool, { color: colors.textPrimary }]} numberOfLines={1}>{school?.name ?? 'Unknown School'}</Text>
                      <Text style={[styles.billingAmount, { color: colors.textPrimary }]}>{symbol}{Number(payment.amount ?? 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.billingBottom}>
                      <Text style={[styles.billingMeta, { color: colors.textMuted }]}>#{payment.invoice_number}</Text>
                      <Text style={[styles.billingStatus, { color: statusColor }]}>{String(payment.status).toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RECENT ACTIVITY</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.info }]} />
              </View>
              {activities.length === 0 ? (
                <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <Text style={styles.emptyCode}>AC</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO RECENT ADMIN ACTIVITY</Text>
                </View>
              ) : activities.map((item) => (
                <View key={item.id} style={[styles.activityCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                    <Text style={[styles.codeIcon, { color: item.color }]}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.activityDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.desc}</Text>
                  </View>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{item.time}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NAVIGATE TO</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.accent }]} />
              </View>
              <View style={styles.adminList}>
                {ADMIN_NAV_LINKS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.adminRowCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate(item.screen)}
                  >
                    <View style={[styles.adminRowIcon, { backgroundColor: item.color + '12', borderColor: item.color + '33' }]}>
                      <Text style={[styles.codeIcon, { color: item.color }]}>{item.icon}</Text>
                    </View>
                    <Text style={[styles.adminRowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    <Text style={[styles.adminRowArrow, { color: colors.textMuted }]}>OPEN</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {role === 'teacher' && teacherActionCenter && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SMART COMMAND CENTER</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.warning }]} />
                </View>
                <View style={styles.featureGrid}>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Assignments')}
                  >
                    <Text style={[styles.featureEyebrow, { color: teacherActionCenter.ungradedAssignments > 0 ? colors.error : colors.success }]}>
                      {teacherActionCenter.ungradedAssignments > 0 ? 'PENDING' : 'CLEAR'}
                    </Text>
                    <Text style={[styles.featureValue, { color: teacherActionCenter.ungradedAssignments > 0 ? colors.error : colors.success }]}>
                      {teacherActionCenter.ungradedAssignments}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>ASSIGNMENT QUEUE</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Review and grade student assignment submissions.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('CBT')}
                  >
                    <Text style={[styles.featureEyebrow, { color: teacherActionCenter.ungradedExams > 0 ? colors.warning : colors.success }]}>
                      {teacherActionCenter.ungradedExams > 0 ? 'REVIEW' : 'READY'}
                    </Text>
                    <Text style={[styles.featureValue, { color: teacherActionCenter.ungradedExams > 0 ? colors.warning : colors.success }]}>
                      {teacherActionCenter.ungradedExams}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>CBT GRADING</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Open exam sessions that still need attention.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {role === 'parent' && parentHeadline && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PARENT PORTAL</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.accent }]} />
                </View>
                <View style={styles.featureGrid}>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ParentInvoices')}
                  >
                    <Text style={[styles.featureEyebrow, { color: parentHeadline.outstandingBalance > 0 ? colors.error : colors.success }]}>
                      {parentHeadline.outstandingBalance > 0 ? 'PAYMENT DUE' : 'ALL CLEAR'}
                    </Text>
                    <Text style={[styles.featureValue, { color: parentHeadline.outstandingBalance > 0 ? colors.error : colors.success }]}>
                      {parentHeadline.outstandingBalance > 0 ? formatCurrency(parentHeadline.outstandingBalance, parentHeadline.currency) : '0'}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>OUTSTANDING BALANCE</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {parentHeadline.overdueInvoices > 0 ? `${parentHeadline.overdueInvoices} overdue invoices need attention.` : 'All linked child invoices are in good standing.'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Notifications')}
                  >
                    <Text style={[styles.featureEyebrow, { color: parentHeadline.unreadNotifications > 0 ? colors.warning : colors.info }]}>
                      {parentHeadline.unreadNotifications > 0 ? 'NEW ALERTS' : 'INBOX QUIET'}
                    </Text>
                    <Text style={[styles.featureValue, { color: parentHeadline.unreadNotifications > 0 ? colors.warning : colors.info }]}>
                      {parentHeadline.unreadNotifications}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>UNREAD NOTIFICATIONS</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Stay on top of school notices, messages, and updates.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {role === 'student' && studentMission && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NEXT MISSION</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.featureGrid}>
                  <TouchableOpacity
                    style={[styles.featureCard, styles.featureCardWide, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (studentMission.nextLessonId) {
                        navigation.navigate('LessonDetail', { lessonId: studentMission.nextLessonId });
                      } else {
                        navigation.navigate('Learn');
                      }
                    }}
                  >
                    <Text style={[styles.featureEyebrow, { color: colors.primary }]}>RESUME LEARNING</Text>
                    <Text style={[styles.featureTitleLarge, { color: colors.textPrimary }]}>
                      {studentMission.nextLessonTitle ?? 'Browse active lessons'}
                    </Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Continue your learning streak from mobile with one tap.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Assignments')}
                  >
                    <Text style={[styles.featureEyebrow, { color: studentMission.pendingAssignments > 0 ? colors.error : colors.success }]}>
                      {studentMission.pendingAssignments > 0 ? 'ACTION NEEDED' : 'ALL SUBMITTED'}
                    </Text>
                    <Text style={[styles.featureValue, { color: studentMission.pendingAssignments > 0 ? colors.error : colors.success }]}>
                      {studentMission.pendingAssignments}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>PENDING ASSIGNMENTS</Text>
                  </TouchableOpacity>
                  <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: colors.warning }]}>MOMENTUM</Text>
                    <Text style={[styles.featureValue, { color: colors.warning }]}>{studentMission.xp.toLocaleString()}</Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>XP</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {studentMission.leaderboardRank ? `Rank #${studentMission.leaderboardRank} with ${studentMission.streak} day streak.` : `${studentMission.streak} day streak active.`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>OPERATIONAL HUB</Text>
                <View style={[styles.sectionLine, { backgroundColor: config.color }]} />
              </View>
              <View style={styles.actionsGrid}>
                {config.actions.map((a, i) => (
                  <TouchableOpacity
                    key={`${a.label}-${i}`}
                    style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      light();
                      const screen = ACTION_SCREENS[a.label];
                      if (screen) navigation.navigate(screen);
                    }}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: a.color + '10', borderColor: a.color + '30' }]}>
                      <Text style={[styles.codeIcon, { color: a.color }]}>{a.icon}</Text>
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{a.label.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {role === 'parent' && parentChildren.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MY CHILDREN</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.accent }]} />
                </View>
                <View style={styles.cardStack}>
                  {parentChildren.slice(0, 3).map((child) => (
                    <TouchableOpacity
                      key={child.id}
                      style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('MyChildren')}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: colors.accent + '18' }]}>
                        <Text style={[styles.codeIcon, { color: colors.accent }]}>{child.full_name?.slice(0, 1)?.toUpperCase() ?? 'C'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{child.full_name}</Text>
                        <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                          {[child.school_name, child.grade_level].filter(Boolean).join(' · ') || 'Child profile linked to your account'}
                        </Text>
                      </View>
                      <Text style={[styles.infoMeta, { color: child.status === 'approved' ? colors.success : colors.warning }]}>
                        {(child.status ?? 'linked').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {(role === 'teacher' || role === 'school') && upcomingSlots.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>WHAT'S NEXT</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.info }]} />
                </View>
                <View style={styles.cardStack}>
                  {upcomingSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('Timetable')}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: colors.info + '16' }]}>
                        <Text style={[styles.codeIcon, { color: colors.info }]}>TM</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{slot.title}</Text>
                        <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>{slot.subtitle}</Text>
                      </View>
                      <Text style={[styles.infoMeta, { color: colors.info }]}>{slot.time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {quickLinks.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>QUICK ACCESS</Text>
                  <View style={[styles.sectionLine, { backgroundColor: config.color }]} />
                </View>
                <View style={styles.cardStack}>
                  {quickLinks.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate(item.screen)}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: item.color + '16' }]}>
                        <Text style={[styles.codeIcon, { color: item.color }]}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{item.label}</Text>
                        <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>BROADCAST LOGS</Text>
              </View>
              {announcements.length === 0 ? (
                <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <Text style={styles.emptyCode}>BC</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO ACTIVE BROADCASTS DETECTED</Text>
                </View>
              ) : announcements.map((item) => (
                <TouchableOpacity key={item.id} style={[styles.annCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]} activeOpacity={0.8}>
                  <View style={[styles.annBar, { backgroundColor: config.color }]} />
                  <View style={styles.annContent}>
                    <Text style={[styles.annTitle, { color: colors.textPrimary }]}>{item.title.toUpperCase()}</Text>
                    <Text style={[styles.annBody, { color: colors.textSecondary }]} numberOfLines={2}>{item.content}</Text>
                    <Text style={[styles.annDate, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.banner}>
          <LinearGradient colors={colors.gradPrimary} style={StyleSheet.absoluteFill} />
          <Text style={[styles.badgeCode, { color: '#fff' }]}>RC</Text>
          <View>
            <Text style={styles.bannerTitle}>RILLCOD ACADEMY CORE</Text>
            <Text style={styles.bannerSub}>AFRICA'S PREMIER STEM ENGINE · NIGERIA</Text>
          </View>
        </MotiView>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  heroOuter: { overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.border },
  heroContent: { paddingTop: Platform.OS === 'ios' ? 48 : 30, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.lg, gap: 10 },
  greeting: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 2 },
  userName: { fontFamily: FONT_FAMILY.display, fontSize: 32, marginBottom: 8 },
  rolePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  roleDot: { width: 4, height: 4, borderRadius: 2 },
  roleText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  logoutBtn: { width: 44, height: 44, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: colors.textPrimary, letterSpacing: 1 },
  avatarBtn: { position: 'relative' },
  avatarFallback: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONT_FAMILY.display, fontSize: 18, color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statsRowWrap: { flexWrap: 'wrap' },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, padding: 12, alignItems: 'center', gap: 4 },
  statCardAdmin: { minWidth: (width - SPACING.xl * 2 - 10) / 2 },
  statIcon: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 14, letterSpacing: 1 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: 16 },
  statLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 8, letterSpacing: 1, textAlign: 'center' },
  section: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 2 },
  sectionLine: { height: 2, flex: 1, borderRadius: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard: { width: (width - SPACING.xl * 2 - 16) / 3, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 14, alignItems: 'center', gap: 8 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 8, letterSpacing: 0.5, textAlign: 'center' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: (width - SPACING.xl * 2 - 10) / 2, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14, gap: 6 },
  featureCardWide: { width: '100%' },
  featureEyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  featureValue: { fontFamily: FONT_FAMILY.display, fontSize: 20 },
  featureTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.8 },
  featureTitleLarge: { fontFamily: FONT_FAMILY.display, fontSize: 18 },
  featureDesc: { fontFamily: FONT_FAMILY.body, fontSize: 11, lineHeight: 17 },
  cardStack: { gap: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14 },
  infoAvatar: { width: 42, height: 42, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, textTransform: 'uppercase' },
  infoDesc: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 2 },
  infoMeta: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1, textAlign: 'right' },
  adminList: { gap: 10 },
  adminRowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14 },
  adminRowIcon: { width: 42, height: 42, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  adminRowLabel: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
  adminRowArrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  billingCard: { borderWidth: 1, borderRadius: RADIUS.sm, padding: 14, marginBottom: 10 },
  billingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  billingSchool: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, textTransform: 'uppercase' },
  billingAmount: { fontFamily: FONT_FAMILY.display, fontSize: 16 },
  billingBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  billingMeta: { fontFamily: FONT_FAMILY.mono, fontSize: 10 },
  billingStatus: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14, marginBottom: 10 },
  activityIcon: { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, textTransform: 'uppercase' },
  activityDesc: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 2 },
  activityTime: { fontFamily: FONT_FAMILY.mono, fontSize: 9 },
  codeIcon: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: 1 },
  badgeCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 16, letterSpacing: 1 },
  annCard: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS.sm, marginBottom: 10, overflow: 'hidden' },
  annBar: { width: 4 },
  annContent: { flex: 1, padding: 12, gap: 4 },
  annTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, letterSpacing: 0.5 },
  annBody: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18 },
  annDate: { fontFamily: FONT_FAMILY.mono, fontSize: 9, marginTop: 4 },
  emptyCard: { padding: 24, alignItems: 'center', gap: 10, borderRadius: RADIUS.sm, borderWidth: 1 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  emptyCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 18, letterSpacing: 1 },
  banner: { marginHorizontal: SPACING.xl, marginTop: 20, borderRadius: RADIUS.sm, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  bannerTitle: { fontFamily: FONT_FAMILY.display, fontSize: 16, color: '#fff', letterSpacing: 1 },
  bannerSub: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  labCard: { padding: 16, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', marginTop: 6 },
  labInfo: { flex: 1, gap: 4 },
  labTag: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  labTitle: { fontFamily: FONT_FAMILY.display, fontSize: 18 },
  labDesc: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  labIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});

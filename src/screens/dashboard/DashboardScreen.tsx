import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Linking,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiText, MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { dashboardService } from '../../services/dashboard.service';
import { notificationService } from '../../services/notification.service';
import { announcementService } from '../../services/announcement.service';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { FONT_FAMILY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { COLORS } from '../../constants/colors';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import { PresenceList } from '../../components/PresenceList';
import { SectionErrorBoundary } from '../../components/ui/SectionErrorBoundary';
import { SemanticIcon } from '../../components/ui/SemanticIcon';
import { Ionicons } from '@expo/vector-icons';
import { ROUTES, TAB_ROUTES } from '../../navigation/routes';
import { useInboxUnreadCount } from '../../hooks/useInboxUnreadCount';

const { width } = Dimensions.get('window');

interface StatCard {
  icon: string;
  label: string;
  value: string | number;
  color: string;
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
  unreadMessages: number;
  unreadAlerts: number;
  todaySessionCount: number;
}

interface TeacherWorkload {
  urgent: number;
  dueSoon: number;
  routine: number;
}

interface ParentHeadline {
  outstandingBalance: number;
  overdueInvoices: number;
  unreadNotifications: number;
  currency: string;
}

interface ParentChildTrend {
  /** `students.id` for navigation into parent portal screens */
  recordId: string;
  studentName: string;
  publishedReports: number;
  gradedSubmissions: number;
  averagePercent: number | null;
}

interface SchoolTrendSnapshot {
  admissionsDeltaPct: number;
  paidInvoiceDeltaPct: number;
  gradedFlowDeltaPct: number;
}

interface StudentMission {
  nextLessonTitle: string | null;
  nextLessonId: string | null;
  pendingAssignments: number;
  xp: number;
  streak: number;
  leaderboardRank: number | null;
  coursesInProgress: number;
}

interface DashboardAnnouncement {
  id: string;
  title: string;
  content: string;
  created_at: string | null;
}

interface StudentLiveSessionRow {
  id: string;
  title: string;
  scheduled_at: string;
  session_url: string | null;
  platform: string;
  status: string;
  programs?: { name?: string | null } | null;
}

interface StudentPerformanceItem {
  id: string;
  title: string;
  grade: number;
  max_points: number;
  submitted_at: string | null;
}

interface StudentDueItem {
  id: string;
  title: string;
  due_date: string | null;
  urgency: 'today' | 'tomorrow' | 'week';
}

const ACTION_SCREENS: Record<string, string> = {
  Students: ROUTES.Students,
  Schools: ROUTES.Schools,
  Teachers: ROUTES.Teachers,
  Parents: ROUTES.Parents,
  Users: ROUTES.Users,
  Approvals: ROUTES.Approvals,
  Programs: ROUTES.Programs,
  Lessons: ROUTES.Lessons,
  Projects: ROUTES.Projects,
  Library: ROUTES.Library,
  Portfolio: ROUTES.Portfolio,
  Attendance: ROUTES.Attendance,
  Payments: ROUTES.Payments,
  Transactions: ROUTES.Transactions,
  Import: ROUTES.StudentImport,
  Feedback: ROUTES.ParentFeedback,
  'Bulk Pay': ROUTES.Payments,
  'Report Builder': ROUTES.ReportBuilder,
  Timetable: ROUTES.Timetable,
  Classes: ROUTES.Classes,
  CBT: ROUTES.CBT,
  Playground: ROUTES.Playground,
  LiveSessions: ROUTES.LiveSessions,
  Engage: ROUTES.Engage,
  Vault: ROUTES.Vault,
  Missions: ROUTES.Missions,
  Protocol: ROUTES.Protocol,
  Reports: ROUTES.Reports,
  ReportBuilder: ROUTES.ReportBuilder,
  Assignments: ROUTES.Assignments,
  Messages: ROUTES.Messages,
  Alerts: TAB_ROUTES.Alerts,
  Newsletters: ROUTES.Newsletters,
  Settings: ROUTES.Settings,
  Analytics: ROUTES.Analytics,
  Progress: ROUTES.Progress,
  SchoolOverview: ROUTES.SchoolOverview,
  SchoolBilling: ROUTES.Payments,
  Grades: ROUTES.Grades,
  ManageCertificates: ROUTES.ManageCertificates,
  Certificates: ROUTES.Certificates,
  Invoices: ROUTES.Invoices,
  EnrolStudents: ROUTES.EnrolStudents,
  BulkRegister: ROUTES.BulkRegister,
  WipeStudents: ROUTES.WipeStudents,
  CardBuilder: ROUTES.CardBuilder,
  MyChildren: ROUTES.MyChildren,
  ParentResults: ROUTES.ParentResults,
  ParentAttendance: ROUTES.ParentAttendance,
  ParentGrades: ROUTES.ParentGrades,
  ParentInvoices: ROUTES.ParentInvoices,
  ParentCertificates: ROUTES.ParentCertificates,
  ParentFeedback: ROUTES.ParentFeedback,
  Courses: TAB_ROUTES.Learn,
  Learn: TAB_ROUTES.Learn,
  AI: ROUTES.AI,
  'School Overview': ROUTES.SchoolOverview,
  'My Children': ROUTES.MyChildren,
  'Report Cards': ROUTES.ParentResults,
  'Parent Invoices': ROUTES.ParentInvoices,
  'Parent Grades': ROUTES.ParentGrades,
  'Parent Attendance': ROUTES.ParentAttendance,
  IoT: ROUTES.IoT,
  'People hub': ROUTES.PeopleHub,
  'Activity logs': ROUTES.ActivityLogs,
  Subscriptions: ROUTES.Subscriptions,
  Moderation: ROUTES.Moderation,
};

/**
 * Admin home quick actions — order mirrors web `DashboardNavigation` (admin): People hub (bulk register,
 * enrol, wipe, feedback, approvals) → academics/reports → finance → comms. People & Payments sit on the tab bar.
 */
const ADMIN_HOME_LINKS = [
  { icon: 'PH', label: 'People hub', screen: ROUTES.PeopleHub, color: COLORS.primary },
  { icon: 'ID', label: 'Card Builder', screen: ROUTES.CardBuilder, color: COLORS.gold },
  { icon: 'PR', label: 'Programs', screen: ROUTES.Programs, color: COLORS.info },
  { icon: 'RB', label: 'Report Builder', screen: ROUTES.ReportBuilder, color: COLORS.accent },
  { icon: 'RP', label: 'Reports', screen: ROUTES.Reports, color: COLORS.accent },
  { icon: 'MC', label: 'Manage Certificates', screen: ROUTES.ManageCertificates, color: COLORS.gold },
  { icon: 'GR', label: 'Grades', screen: ROUTES.Grades, color: COLORS.accent },
  { icon: 'CB', label: 'CBT', screen: ROUTES.CBT, color: COLORS.warning },
  { icon: 'AN', label: 'Analytics', screen: ROUTES.Analytics, color: COLORS.success },
  { icon: 'IT', label: 'IoT', screen: ROUTES.IoT, color: COLORS.info },
  { icon: 'LG', label: 'Activity logs', screen: ROUTES.ActivityLogs, color: COLORS.primary },
  { icon: 'SB', label: 'Subscriptions', screen: ROUTES.Subscriptions, color: COLORS.success },
  { icon: 'MD', label: 'Moderation', screen: ROUTES.Moderation, color: COLORS.error },
  { icon: 'NW', label: 'Newsletters', screen: ROUTES.Newsletters, color: COLORS.accent },
  { icon: 'SG', label: 'Settings', screen: ROUTES.Settings, color: COLORS.textMuted },
];

/** Order aligned with web `DashboardNavigation` (teacher): Teaching → Students → Reports → Content → community hubs. */
const TEACHER_QUICK_LINKS: QuickLink[] = [
  { icon: 'PH', label: 'People hub', screen: ROUTES.PeopleHub, color: COLORS.primary, desc: 'Students, parents, feedback inbox, approvals, imports, bulk enrol' },
  { icon: 'AL', label: 'Alerts', screen: ROUTES.NotificationInbox, color: COLORS.info, desc: 'Announcements and unread alerts' },
  { icon: 'ID', label: 'Profile', screen: ROUTES.UserProfile, color: COLORS.textMuted, desc: 'Account details and settings' },
  { icon: 'CL', label: 'My Classes', screen: ROUTES.Classes, color: COLORS.primary, desc: 'Your class rosters, sessions, and detail views (web: My Classes)' },
  { icon: 'LS', label: 'Lessons', screen: ROUTES.Lessons, color: COLORS.info, desc: 'Manage lesson content and delivery sequence' },
  { icon: 'AS', label: 'Assignments', screen: ROUTES.Assignments, color: COLORS.warning, desc: 'Create, review, and grade submissions' },
  { icon: 'CB', label: 'CBT Centre', screen: ROUTES.CBT, color: COLORS.primary, desc: 'Manage exams and computer-based tests' },
  { icon: 'AT', label: 'Attendance', screen: ROUTES.Attendance, color: COLORS.success, desc: 'Register student presence and view sessions' },
  { icon: 'TT', label: 'My week', screen: ROUTES.Timetable, color: COLORS.info, desc: 'Weekly timetable and room slots (web: Timetable)' },
  { icon: 'PJ', label: 'Projects', screen: ROUTES.Projects, color: COLORS.primary, desc: 'Lab projects and coursework' },
  { icon: 'BR', label: 'Register Students', screen: ROUTES.BulkRegister, color: COLORS.success, desc: 'Batch registration workflow' },
  { icon: 'AQ', label: 'Approvals', screen: ROUTES.Approvals, color: COLORS.success, desc: 'Pending student & summer-school queue' },
  { icon: 'GR', label: 'Grades', screen: ROUTES.Grades, color: COLORS.accent, desc: 'Graded work and score overview' },
  { icon: 'RB', label: 'Report Builder', screen: ROUTES.ReportBuilder, color: COLORS.accent, desc: 'Build and publish report cards faster' },
  { icon: 'RP', label: 'Reports', screen: ROUTES.Reports, color: COLORS.accent, desc: 'Open result publishing and report tools' },
  { icon: 'MC', label: 'Manage Certificates', screen: ROUTES.ManageCertificates, color: COLORS.gold, desc: 'Issue and track learner certificates' },
  { icon: 'LR', label: 'Library', screen: ROUTES.Library, color: COLORS.info, desc: 'School and shared learning materials' },
  { icon: 'PG', label: 'Playground', screen: ROUTES.Playground, color: '#7c3aed', desc: 'Open coding playground and saved projects' },
  { icon: 'LV', label: 'Live Sessions', screen: ROUTES.LiveSessions, color: COLORS.info, desc: 'Scheduled live classes and join links' },
];

/** Mirrors web school sidebar: overview → roster → classes → ops → reports → finance. */
const SCHOOL_QUICK_LINKS: QuickLink[] = [
  { icon: 'OV', label: 'School Overview', screen: ROUTES.SchoolOverview, color: COLORS.success, desc: 'Open school command metrics and health' },
  { icon: 'PH', label: 'People hub', screen: ROUTES.PeopleHub, color: COLORS.primary, desc: 'Students, teachers, parents, feedback, imports, enrolment' },
  { icon: 'CL', label: 'Classes', screen: ROUTES.Classes, color: COLORS.primary, desc: 'Class rosters and teaching groups' },
  { icon: 'AT', label: 'Attendance', screen: ROUTES.Attendance, color: COLORS.success, desc: 'Presence sessions and registers' },
  { icon: 'TT', label: 'Timetable', screen: ROUTES.Timetable, color: COLORS.info, desc: 'Weekly schedule for your school' },
  { icon: 'LV', label: 'Live Sessions', screen: ROUTES.LiveSessions, color: COLORS.info, desc: 'Live teaching blocks and links' },
  { icon: 'RP', label: 'Reports', screen: ROUTES.Reports, color: COLORS.accent, desc: 'Review published reports and outcomes' },
  { icon: 'GR', label: 'Grades', screen: ROUTES.Grades, color: COLORS.accent, desc: 'School-wide graded work' },
  { icon: 'PR', label: 'Progress', screen: ROUTES.Progress, color: COLORS.primary, desc: 'Track school-wide performance trends' },
  { icon: 'PM', label: 'Payments', screen: ROUTES.Payments, color: COLORS.warning, desc: 'Your school invoices & receipts; network policy set by admin' },
  { icon: 'AL', label: 'Alerts', screen: TAB_ROUTES.Alerts, color: COLORS.info, desc: 'Announcements, alerts, and delivery preferences' },
  { icon: 'MG', label: 'Messages', screen: ROUTES.Messages, color: COLORS.info, desc: 'Coordinate with admin, staff, and parents' },
];

const PARENT_QUICK_LINKS: QuickLink[] = [
  { icon: 'PH', label: 'People hub', screen: ROUTES.PeopleHub, color: COLORS.primary, desc: 'Family shortcuts, invoices, and feedback' },
  { icon: 'CH', label: 'My Children', screen: ROUTES.MyChildren, color: COLORS.accent, desc: 'See linked children and their progress' },
  { icon: 'RP', label: 'Report Cards', screen: ROUTES.ParentResults, color: COLORS.primary, desc: 'Open published reports and term results' },
  { icon: 'IV', label: 'Invoices', screen: ROUTES.ParentInvoices, color: COLORS.warning, desc: 'Pay fees and review invoice status' },
  { icon: 'PF', label: 'Feedback', screen: ROUTES.ParentFeedback, color: COLORS.accent, desc: 'Send feedback and keep communication active' },
  { icon: 'AL', label: 'Alerts', screen: TAB_ROUTES.Alerts, color: COLORS.info, desc: 'Announcements and inbox updates' },
  { icon: 'NW', label: 'Newsletters', screen: ROUTES.Newsletters, color: COLORS.accent, desc: 'Read school newsletters and communication posts' },
  { icon: 'MG', label: 'Messages', screen: ROUTES.Messages, color: COLORS.info, desc: 'Reach teachers and school staff' },
];

/** Student shortcuts aligned with web student nav (learn → work → labs → community). */
const STUDENT_QUICK_LINKS: QuickLink[] = [
  { icon: 'LR', label: 'Learning', screen: TAB_ROUTES.Learn, color: COLORS.info, desc: 'Resume courses and active lessons' },
  { icon: 'AS', label: 'Assignments', screen: ROUTES.Assignments, color: COLORS.primary, desc: 'Submit coursework and review tasks' },
  { icon: 'CB', label: 'CBT', screen: ROUTES.CBT, color: COLORS.warning, desc: 'Take tests and practice assessments' },
  { icon: 'PJ', label: 'Projects', screen: ROUTES.Projects, color: COLORS.accent, desc: 'Course projects and submissions' },
  { icon: 'BK', label: 'Library', screen: ROUTES.Library, color: COLORS.info, desc: 'Videos, docs, and shared content' },
  { icon: 'PG', label: 'Playground', screen: ROUTES.Playground, color: '#7c3aed', desc: 'Practice code in the sandbox' },
  { icon: 'PO', label: 'Portfolio', screen: ROUTES.Portfolio, color: COLORS.success, desc: 'Showcase your best builds' },
  { icon: 'LV', label: 'Live Sessions', screen: ROUTES.LiveSessions, color: COLORS.info, desc: 'Join scheduled live classes' },
  { icon: 'LB', label: 'Leaderboard', screen: ROUTES.Leaderboard, color: COLORS.success, desc: 'Track ranking, progress, and momentum' },
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

function percentageChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DashboardScreen({ navigation }: any) {
  const { profile, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const [stats, setStats] = useState<StatCard[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [schoolPayments, setSchoolPayments] = useState<SchoolPayment[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [upcomingSlots, setUpcomingSlots] = useState<ScheduleItem[]>([]);
  const [teacherActionCenter, setTeacherActionCenter] = useState<TeacherActionCenter | null>(null);
  const [teacherWorkload, setTeacherWorkload] = useState<TeacherWorkload | null>(null);
  const [parentChildren, setParentChildren] = useState<ChildLink[]>([]);
  const [parentHeadline, setParentHeadline] = useState<ParentHeadline | null>(null);
  const [parentTrends, setParentTrends] = useState<ParentChildTrend[]>([]);
  const [schoolTrends, setSchoolTrends] = useState<SchoolTrendSnapshot | null>(null);
  const [schoolUnreadAlerts, setSchoolUnreadAlerts] = useState(0);
  const [studentMission, setStudentMission] = useState<StudentMission | null>(null);
  const [studentLiveSessions, setStudentLiveSessions] = useState<StudentLiveSessionRow[]>([]);
  const [dashboardAnnouncements, setDashboardAnnouncements] = useState<DashboardAnnouncement[]>([]);
  const [announcementReadIds, setAnnouncementReadIds] = useState<Set<string>>(() => new Set());
  const [announcementDetail, setAnnouncementDetail] = useState<DashboardAnnouncement | null>(null);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformanceItem[]>([]);
  const [studentDueSoon, setStudentDueSoon] = useState<StudentDueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [loadFailures, setLoadFailures] = useState(0);
  const loadingRef = useRef(false);

  const role = profile?.role ?? 'student';
  const inboxUnread = useInboxUnreadCount(profile?.id);

  const unreadDashboardAnnouncements = useMemo(
    () => dashboardAnnouncements.filter((a) => !announcementReadIds.has(a.id)),
    [dashboardAnnouncements, announcementReadIds],
  );

  const confirmMarkAnnouncementRead = useCallback(async () => {
    const uid = profile?.id;
    const row = announcementDetail;
    if (!uid || !row) return;
    try {
      await announcementService.markAnnouncementRead(uid, row.id);
      setAnnouncementReadIds((prev) => new Set(prev).add(row.id));
      setAnnouncementDetail(null);
      await light();
    } catch {
      /* ignore */
    }
  }, [announcementDetail, profile?.id, light]);

  const getRoleConfig = () => {
    switch (role) {
      case 'admin':
        return {
          color: colors.error,
          label: 'ADMINISTRATOR',
          actions: [
            { icon: 'PH', label: 'People hub', color: colors.primary },
            { icon: 'PF', label: 'Feedback', color: colors.accent },
            { icon: 'PR', label: 'Programs', color: colors.info },
            { icon: 'AS', label: 'Assignments', color: colors.warning },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'AN', label: 'Analytics', color: colors.success },
            { icon: 'RP', label: 'Reports', color: colors.accent },
            { icon: 'IT', label: 'IoT', color: colors.info },
            { icon: 'AI', label: 'AI', color: colors.primary },
          ],
        };
      case 'teacher':
        return {
          color: colors.primary,
          label: 'INSTRUCTOR',
          actions: [
            { icon: 'PH', label: 'People hub', color: colors.primary },
            { icon: 'CL', label: 'Classes', color: colors.primary },
            { icon: 'LS', label: 'Lessons', color: colors.info },
            { icon: 'AS', label: 'Assignments', color: colors.warning },
            { icon: 'AT', label: 'Attendance', color: colors.success },
            { icon: 'TT', label: 'Timetable', color: colors.info },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'RB', label: 'Report Builder', color: colors.accent },
            { icon: 'MG', label: 'Messages', color: colors.info },
            { icon: 'AI', label: 'AI', color: colors.primary },
          ],
        };
      case 'school':
        return {
          color: colors.warning,
          label: 'SCHOOL PARTNER',
          actions: [
            { icon: 'OV', label: 'School Overview', color: colors.success },
            { icon: 'PH', label: 'People hub', color: colors.primary },
            { icon: 'CL', label: 'Classes', color: colors.primary },
            { icon: 'AT', label: 'Attendance', color: colors.success },
            { icon: 'TT', label: 'Timetable', color: colors.info },
            { icon: 'LV', label: 'LiveSessions', color: colors.info },
            { icon: 'RP', label: 'Reports', color: colors.accent },
            { icon: 'GR', label: 'Grades', color: colors.accent },
            { icon: 'PR', label: 'Progress', color: colors.primary },
            { icon: 'PM', label: 'Payments', color: colors.warning },
            { icon: 'BP', label: 'Bulk Pay', color: colors.warning },
          ],
        };
      case 'parent':
        return {
          color: colors.accent,
          label: 'PARENT PORTAL',
          actions: [
            { icon: 'PH', label: 'People hub', color: colors.primary },
            { icon: 'CH', label: 'My Children', color: colors.accent },
            { icon: 'RS', label: 'Report Cards', color: colors.primary },
            { icon: 'IV', label: 'Parent Invoices', color: colors.warning },
            { icon: 'GD', label: 'Parent Grades', color: colors.success },
            { icon: 'AT', label: 'Parent Attendance', color: '#7c3aed' },
            { icon: 'MG', label: 'Messages', color: colors.info },
          ],
        };
      default:
        return {
          color: colors.success,
          label: 'STUDENT',
          actions: [
            { icon: 'LR', label: 'Learn', color: colors.info },
            { icon: 'AS', label: 'Assignments', color: colors.primary },
            { icon: 'CB', label: 'CBT', color: colors.warning },
            { icon: 'PJ', label: 'Projects', color: colors.accent },
            { icon: 'BK', label: 'Library', color: colors.info },
            { icon: 'PG', label: 'Playground', color: '#7c3aed' },
            { icon: 'LV', label: 'LiveSessions', color: colors.info },
            { icon: 'GR', label: 'Grades', color: colors.success },
            { icon: 'RP', label: 'Reports', color: colors.accent },
            { icon: 'CT', label: 'Certificates', color: colors.success },
            { icon: 'AI', label: 'AI', color: colors.primary },
          ],
        };
    }
  };

  const config = getRoleConfig();

  const safeNavigate = useCallback((screen: string, params?: Record<string, any>) => {
    try {
      if (!screen) return;
      if (params) navigation.navigate(screen, params);
      else navigation.navigate(screen);
    } catch (error) {
      console.warn('Navigation blocked:', screen, error);
    }
  }, [navigation]);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await light();
      await signOut();
    } catch (error) {
      console.warn('Sign out failed:', error);
    } finally {
      setSigningOut(false);
    }
  }, [light, signOut, signingOut]);

  const greetingKey = () => {
    const h = new Date().getHours();
    if (h < 12) return 'dashboard.greeting_morning';
    if (h < 17) return 'dashboard.greeting_afternoon';
    return 'dashboard.greeting_evening';
  };

  const loadAdminData = useCallback(async () => {
    try {
      setQuickLinks([]);
      setUpcomingSlots([]);
      const [adminStats, recentActivity, invoices] = await Promise.all([
        dashboardService.getAdminStats(colors),
        dashboardService.getRecentActivity(colors),
        dashboardService.listAdminSchoolInvoicePreviews(6)
      ]);
      setStats(adminStats);
      setActivities(recentActivity);
      setSchoolPayments(invoices as SchoolPayment[]);
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
    }
  }, [colors]);

  const loadTeacherData = useCallback(async () => {
    const teacherId = profile?.id ?? '';
    const colorsObj = colors;

    const { stats: mainStats, ownClassIds, ownAssignmentIds } = await dashboardService.getTeacherDashboardData(teacherId, colorsObj);
    setStats(mainStats);

    const { feed, ungradedCount } = await dashboardService.getTeacherSubmissionsFeed(ownAssignmentIds, 6);
    const [unreadMessages, unreadNotifs, timetableSlots] = await Promise.all([
      dashboardService.countUnreadInboxMessages(teacherId),
      notificationService.getUnreadCount(teacherId),
      dashboardService.getTimetableSlots([], teacherId),
    ]);

    setActivities((feed as any[]).map((s) => ({
      id: s.id,
      title: 'Submission Received',
      desc: s.assignments?.title ?? 'Untitled',
      time: 'now',
      icon: 'AS',
      color: colorsObj.primary,
    })));

    setTeacherWorkload(dashboardService.calculateTeacherWorkload(feed ?? []));
    setUpcomingSlots(timetableSlots);
    setTeacherActionCenter({
      ungradedAssignments: ungradedCount,
      ungradedExams: 0,
      unreadMessages,
      unreadAlerts: unreadNotifs,
      todaySessionCount: timetableSlots.length,
    });
    setQuickLinks(TEACHER_QUICK_LINKS);
  }, [colors, profile?.id]);

  const loadSchoolData = useCallback(async () => {
    const schoolId = profile?.school_id;
    if (!schoolId) return;

    const schoolStats = await dashboardService.getSchoolDashboardData(schoolId, colors);
    setStats(schoolStats);

    const activeTimetableIds = await dashboardService.getActiveTimetableIdsForSchool(schoolId);

    const [invoicePreviews, upcomingSlotsData] = await Promise.all([
      dashboardService.listSchoolInvoicePreviews(schoolId, 6),
      dashboardService.getTimetableSlots(activeTimetableIds),
    ]);

    setUpcomingSlots(upcomingSlotsData);
    setSchoolPayments(invoicePreviews as SchoolPayment[]);
    setQuickLinks(SCHOOL_QUICK_LINKS);
  }, [colors, profile?.school_id]);

  const loadParentData = useCallback(async () => {
    const email = profile?.email;
    if (!email) return;

    const { children, stats: parentStats } = await dashboardService.getParentDashboardData(email, colors);
    setStats(parentStats);
    setParentChildren(children);
    setQuickLinks(PARENT_QUICK_LINKS);
  }, [colors, profile?.email]);

  const loadStudentData = useCallback(async () => {
    const userId = profile?.id ?? '';
    const [snapshot, liveSessions] = await Promise.all([
      dashboardService.getStudentDashboardSnapshot(userId),
      dashboardService.listUpcomingLiveSessionsForStudent(userId, 6),
    ]);
    setStudentLiveSessions((liveSessions ?? []) as StudentLiveSessionRow[]);
    const {
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
    } = snapshot;

    setStats([
      { icon: 'RP', label: 'REPORTS', value: (reportsRes.count ?? 0).toLocaleString(), color: colors.accent },
      { icon: 'CT', label: 'CERTIFICATES', value: (certsRes.count ?? 0).toLocaleString(), color: colors.success },
      { icon: 'AS', label: 'SUBMISSIONS', value: (submissionsRes.count ?? 0).toLocaleString(), color: colors.info },
      { icon: 'CB', label: 'CBT SESSIONS', value: (cbtRes.count ?? 0).toLocaleString(), color: colors.warning },
    ]);

    const submissionRows = ((submissionRowsRes.data ?? []) as any[]);
    const gradedPerformance = submissionRows
      .filter((item) => item.grade != null)
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        title: item.assignments?.title ?? 'Assignment',
        grade: Number(item.grade ?? 0),
        max_points: Number(item.assignments?.max_points ?? 100),
        submitted_at: item.submitted_at ?? null,
      })) as StudentPerformanceItem[];

    const now = new Date();
    const dueSoonItems = submissionRows
      .filter((item) => item.status !== 'graded' && item.assignments?.due_date)
      .map((item) => {
        const dueDate = new Date(item.assignments.due_date);
        const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return {
          id: item.id,
          title: item.assignments?.title ?? 'Assignment',
          due_date: item.assignments?.due_date ?? null,
          diffDays,
        };
      })
      .filter((item) => item.diffDays >= 0 && item.diffDays <= 7)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        due_date: item.due_date,
        urgency: item.diffDays < 1 ? 'today' : item.diffDays < 2 ? 'tomorrow' : 'week',
      })) as StudentDueItem[];

    setStudentPerformance(gradedPerformance);
    setStudentDueSoon(dueSoonItems);
    setActivities([]);
    let nextLessonTitle: string | null = null;
    let nextLessonId: string | null = null;
    const enrolledPrograms = (enrollmentRes.data ?? []) as any[];
    const doneLessonIds = ((progressRes.data ?? []) as any[]).map((item: any) => item.lesson_id).filter(Boolean);
    if (enrolledPrograms.length > 0) {
      const programId = enrolledPrograms[0]?.programs?.id;
      if (programId) {
        const hint = await dashboardService.resolveNextLessonInProgram(programId, doneLessonIds);
        nextLessonTitle = hint.nextLessonTitle;
        nextLessonId = hint.nextLessonId;
      }
    }
    let leaderboardRank: number | null = null;
    const leaderboard = (leaderboardRes.data ?? []) as any[];
    const rankIndex = leaderboard.findIndex((item: any) => item.portal_user_id === profile?.id);
    if (rankIndex >= 0) leaderboardRank = rankIndex + 1;
    setStudentMission({
      nextLessonTitle,
      nextLessonId,
      pendingAssignments: dueSoonItems.length,
      xp: pointsRes.data?.total_points ?? 0,
      streak: pointsRes.data?.current_streak ?? 0,
      leaderboardRank,
      coursesInProgress: studentProgressIncompleteRes.count ?? 0,
    });
    setQuickLinks(STUDENT_QUICK_LINKS);
    setUpcomingSlots([]);
    setTeacherActionCenter(null);
    setTeacherWorkload(null);
    setParentChildren([]);
    setParentHeadline(null);
    setParentTrends([]);
    setSchoolTrends(null);
    setSchoolPayments([]);
  }, [colors, profile]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      if (profile.role === 'admin') {
        await loadAdminData();
        setStudentLiveSessions([]);
      } else if (profile.role === 'teacher') {
        await loadTeacherData();
        setStudentLiveSessions([]);
      } else if (profile.role === 'school') {
        await loadSchoolData();
        setStudentLiveSessions([]);
      } else if (profile.role === 'parent') {
        await loadParentData();
        setStudentLiveSessions([]);
      } else {
        await loadStudentData();
      }
      setLoadFailures(0);
      setLastSyncAt(new Date());
    } catch (error) {
      console.warn('Dashboard data load failed:', error);
      setLoadFailures((prev) => prev + 1);
      // Keep previous successful state on transient failures.
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
    try {
      const ann = await dashboardService.listAnnouncementsForAudience({
        role: profile.role,
        schoolId: profile.school_id ?? null,
        limit: 6,
      });
      setDashboardAnnouncements(
        (ann ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          created_at: a.created_at,
        }))
      );
      try {
        const readList = await announcementService.listReadAnnouncementIds(profile.id);
        setAnnouncementReadIds(new Set(readList));
      } catch {
        setAnnouncementReadIds(new Set());
      }
    } catch {
      setDashboardAnnouncements([]);
      setAnnouncementReadIds(new Set());
    }
  }, [profile, loadAdminData, loadTeacherData, loadSchoolData, loadParentData, loadStudentData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [loadData])
  );

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) return;
    const timer = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadData, profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const schoolPendingAccounts = Number(
    stats.find((item) => item.label === 'PENDING ACCOUNTS')?.value ?? 0
  );
  const schoolDueInvoices = schoolPayments.filter(
    (item) => item.status === 'pending' || item.status === 'overdue'
  ).length;

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
              {role !== 'admin' ? (
                <TouchableOpacity
                  style={[styles.logoutBtn, { borderColor: colors.border, opacity: signingOut ? 0.7 : 1 }]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                >
                  <Text style={styles.smallActionText}>{signingOut ? 'EXIT…' : 'OUT'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.avatarBtn}
                onPress={() => safeNavigate(ROUTES.UserProfile)}
              >
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
                  <View style={styles.statIconWrap}>
                    <SemanticIcon code={s.icon} color={s.color} size={20} />
                  </View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
                </MotiView>
              ))}
            </View>
          </View>
        </View>

        <SectionErrorBoundary sectionName="Presence List">
          <PresenceList />
        </SectionErrorBoundary>

        <View style={styles.section}>
          <View style={[styles.syncBar, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>
              {lastSyncAt ? `Last sync ${timeAgo(lastSyncAt.toISOString())}` : 'Sync pending'}
            </Text>
            <Text style={[styles.syncState, { color: loadFailures > 0 ? colors.warning : colors.success }]}>
              {loadFailures > 0 ? `Degraded (${loadFailures})` : 'Healthy'}
            </Text>
          </View>
        </View>

        {unreadDashboardAnnouncements.length > 0 && (
          <SectionErrorBoundary sectionName="Announcements">
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ANNOUNCEMENTS</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.accent }]} />
              </View>
              <Text style={[styles.dismissHint, { color: colors.textMuted }]}>
                Data from your school or admin — tap to read the full post, then mark as read. Open Alerts for the full list including read items.
              </Text>
              <View style={{ gap: SPACING.sm }}>
                {unreadDashboardAnnouncements.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    activeOpacity={0.88}
                    onPress={() => setAnnouncementDetail(a)}
                    style={[styles.announcementCard, { borderColor: colors.accent + '55', backgroundColor: colors.bgCard }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={[styles.announcementTitle, { color: colors.textPrimary, flex: 1 }]}>{a.title}</Text>
                      <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: colors.primary }}>READ</Text>
                    </View>
                    <Text style={[styles.announcementBody, { color: colors.textSecondary }]} numberOfLines={4}>
                      {a.content}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SectionErrorBoundary>
        )}

        {role === 'student' && studentLiveSessions.length > 0 && (
          <SectionErrorBoundary sectionName="Live sessions">
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>UPCOMING LIVE SESSIONS</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.info }]} />
              </View>
              <View style={styles.cardStack}>
                {studentLiveSessions.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (s.session_url) {
                        Linking.openURL(s.session_url).catch(() => {});
                      } else {
                        safeNavigate(ROUTES.LiveSessions);
                      }
                    }}
                  >
                    <View style={[styles.infoAvatar, { backgroundColor: colors.info + '16' }]}>
                      <Ionicons name="videocam-outline" size={20} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                      <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                        {(s.programs as { name?: string | null } | null)?.name ?? 'Program'} · {s.platform}
                      </Text>
                    </View>
                    <Text style={[styles.infoMeta, { color: colors.info }]}>
                      {new Date(s.scheduled_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SectionErrorBoundary>
        )}

        {role === 'student' && (
          <SectionErrorBoundary sectionName="Student projects">
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROJECTS & BUILDS</Text>
              <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
            </View>
            <TouchableOpacity
              style={[styles.labCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => safeNavigate(ROUTES.Projects)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.primary + '08', 'transparent']} style={StyleSheet.absoluteFill} />
              <View style={styles.labInfo}>
                <Text style={[styles.labTag, { color: colors.primary }]}>OPEN WORKSPACE</Text>
                <Text style={[styles.labTitle, { color: colors.textPrimary }]}>Your projects</Text>
                <Text style={[styles.labDesc, { color: colors.textSecondary }]}>
                  Continue saved builds and coursework projects. Content comes from your account — no placeholder lessons.
                </Text>
              </View>
              <View style={[styles.labIconWrap, { borderColor: colors.border }]}>
                <Ionicons name="folder-open-outline" size={28} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
          </SectionErrorBoundary>
        )}

        <SectionErrorBoundary sectionName={`${String(role).toUpperCase()} Dashboard`}>
        {role === 'admin' ? (
          <>
            {/* Pending approvals alert banner */}
            {stats.find(s => s.label === 'PENDING APPROVALS' && Number(s.value) > 0) && (
              <MotiView
                from={{ opacity: 0, translateY: -8 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.approvalsBanner}
              >
                <TouchableOpacity
                  style={[styles.approvalsBannerInner, { backgroundColor: colors.error + '12', borderColor: colors.error + '40' }]}
                  activeOpacity={0.85}
                  onPress={() => safeNavigate(ROUTES.Approvals)}
                >
                  <View style={[styles.approvalsBannerDot, { backgroundColor: colors.error }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.approvalsBannerTitle, { color: colors.error }]}>
                      {stats.find(s => s.label === 'PENDING APPROVALS')?.value} Pending Approval{Number(stats.find(s => s.label === 'PENDING APPROVALS')?.value) !== 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.approvalsBannerSub, { color: colors.textSecondary }]}>
                      Students and schools awaiting activation — tap to review
                    </Text>
                  </View>
                  <Text style={[styles.approvalsBannerArrow, { color: colors.error }]}>›</Text>
                </TouchableOpacity>
              </MotiView>
            )}

            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.adminRowCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                activeOpacity={0.85}
                onPress={() => safeNavigate(ROUTES.NotificationInbox)}
              >
                <View style={[styles.adminRowIcon, { backgroundColor: colors.info + '12', borderColor: colors.info + '33' }]}>
                  <SemanticIcon code="AL" color={colors.info} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>Alerts & inbox</Text>
                  <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>
                    Announcements, system alerts, messages, and newsletters
                  </Text>
                </View>
                {inboxUnread > 0 ? (
                  <View style={[styles.adminInboxBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.adminInboxBadgeText}>{inboxUnread > 99 ? '99+' : inboxUnread}</Text>
                  </View>
                ) : (
                  <Text style={[styles.adminRowArrow, { color: colors.textMuted }]}>OPEN</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
                <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.adminList}>
                {ADMIN_HOME_LINKS.map((item) => (
                  <TouchableOpacity
                    key={`${item.screen}-${item.label}`}
                    style={[styles.adminRowCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(item.screen)}
                  >
                    <View style={[styles.adminRowIcon, { backgroundColor: item.color + '12', borderColor: item.color + '33' }]}>
                      <SemanticIcon code={item.icon} color={item.color} size={20} />
                    </View>
                    <Text style={[styles.adminRowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    <Text style={[styles.adminRowArrow, { color: colors.textMuted }]}>VIEW</Text>
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
                  <Text style={styles.emptyCode}>Billing</Text>
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
                    onPress={() => safeNavigate(ROUTES.Payments)}
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
                  <Text style={styles.emptyCode}>Activity</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO RECENT ADMIN ACTIVITY</Text>
                </View>
              ) : activities.map((item) => (
                <View key={item.id} style={[styles.activityCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                    <SemanticIcon code={item.icon} color={item.color} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.activityDesc, { color: colors.textSecondary }]} numberOfLines={1}>{item.desc}</Text>
                  </View>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{item.time}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {role === 'teacher' && teacherActionCenter && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>INSTRUCTOR COMMAND CENTER</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.warning }]} />
                </View>
                <View style={styles.featureGrid}>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Assignments)}
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
                    onPress={() => safeNavigate(ROUTES.CBT)}
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
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Messages)}
                  >
                    <Text style={[styles.featureEyebrow, { color: teacherActionCenter.unreadMessages > 0 ? colors.info : colors.success }]}>
                      {(teacherActionCenter.unreadMessages + teacherActionCenter.unreadAlerts) > 0 ? 'UNREAD' : 'INBOX CLEAR'}
                    </Text>
                    <Text style={[styles.featureValue, { color: (teacherActionCenter.unreadMessages + teacherActionCenter.unreadAlerts) > 0 ? colors.info : colors.success }]}>
                      {teacherActionCenter.unreadMessages + teacherActionCenter.unreadAlerts}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>MESSAGES</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Unread messages, notifications, and newsletter updates.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Timetable)}
                  >
                    <Text style={[styles.featureEyebrow, { color: teacherActionCenter.todaySessionCount > 0 ? colors.primary : colors.textMuted }]}>
                      {teacherActionCenter.todaySessionCount > 0 ? 'TODAY' : 'NO SESSIONS'}
                    </Text>
                    <Text style={[styles.featureValue, { color: teacherActionCenter.todaySessionCount > 0 ? colors.primary : colors.textMuted }]}>
                      {teacherActionCenter.todaySessionCount}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>CLASS SESSIONS</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Scheduled sessions in your classes today.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {role === 'teacher' && teacherWorkload && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>GRADING PRIORITY LANES</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.error }]} />
                </View>
                <View style={styles.featureGrid}>
                  <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: colors.error }]}>URGENT</Text>
                    <Text style={[styles.featureValue, { color: colors.error }]}>{teacherWorkload.urgent}</Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>REVIEW NOW</Text>
                  </View>
                  <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: colors.warning }]}>DUE SOON</Text>
                    <Text style={[styles.featureValue, { color: colors.warning }]}>{teacherWorkload.dueSoon}</Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>NEXT 48 HOURS</Text>
                  </View>
                  <View style={[styles.featureCard, styles.featureCardWide, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: colors.success }]}>ROUTINE</Text>
                    <Text style={[styles.featureValue, { color: colors.success }]}>{teacherWorkload.routine}</Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>NORMAL QUEUE</Text>
                  </View>
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
                    onPress={() => safeNavigate(ROUTES.ParentInvoices)}
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
                    onPress={() => safeNavigate(TAB_ROUTES.Alerts)}
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

            {role === 'school' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SCHOOL OPERATIONS CENTER</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.warning }]} />
                </View>
                <View style={styles.featureGrid}>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Students)}
                  >
                    <Text style={[styles.featureEyebrow, { color: schoolPendingAccounts > 0 ? colors.warning : colors.success }]}>
                      {schoolPendingAccounts > 0 ? 'REVIEW NEEDED' : 'CLEAR'}
                    </Text>
                    <Text style={[styles.featureValue, { color: schoolPendingAccounts > 0 ? colors.warning : colors.success }]}>
                      {schoolPendingAccounts}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>PENDING STUDENT ACCOUNTS</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {schoolPendingAccounts > 0
                        ? 'Activate pending learners to complete onboarding.'
                        : 'All school student accounts are currently active.'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Payments)}
                  >
                    <Text style={[styles.featureEyebrow, { color: schoolDueInvoices > 0 ? colors.error : colors.info }]}>
                      {schoolDueInvoices > 0 ? 'ACTION REQUIRED' : 'UP TO DATE'}
                    </Text>
                    <Text style={[styles.featureValue, { color: schoolDueInvoices > 0 ? colors.error : colors.info }]}>
                      {schoolDueInvoices}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>OPEN SCHOOL INVOICES</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {schoolDueInvoices > 0
                        ? 'Review unpaid invoices and settle outstanding balances.'
                        : 'No pending or overdue school invoices.'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(TAB_ROUTES.Alerts)}
                  >
                    <Text style={[styles.featureEyebrow, { color: schoolUnreadAlerts > 0 ? colors.info : colors.success }]}>
                      {schoolUnreadAlerts > 0 ? 'UNREAD ALERTS' : 'ALL CLEAR'}
                    </Text>
                    <Text style={[styles.featureValue, { color: schoolUnreadAlerts > 0 ? colors.info : colors.success }]}>
                      {schoolUnreadAlerts}
                    </Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>COMMUNICATIONS</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {schoolUnreadAlerts > 0
                        ? 'Open alerts inbox for notices, messages, and newsletters.'
                        : 'No unread notices across notifications and messages.'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.featureCard, styles.featureCardWide, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(ROUTES.Reports)}
                  >
                    <Text style={[styles.featureEyebrow, { color: colors.primary }]}>ACADEMIC OVERSIGHT</Text>
                    <Text style={[styles.featureTitleLarge, { color: colors.textPrimary }]}>Track reports, grades, and trends</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      Open reports to monitor student outcomes, performance movement, and intervention priority.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {role === 'school' && schoolTrends && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TREND ANALYTICS</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.featureGrid}>
                  <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: schoolTrends.admissionsDeltaPct >= 0 ? colors.success : colors.error }]}>ADMISSIONS</Text>
                    <Text style={[styles.featureValue, { color: schoolTrends.admissionsDeltaPct >= 0 ? colors.success : colors.error }]}>
                      {schoolTrends.admissionsDeltaPct >= 0 ? '+' : ''}{schoolTrends.admissionsDeltaPct}%
                    </Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>New learners vs last month</Text>
                  </View>
                  <View style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: schoolTrends.paidInvoiceDeltaPct >= 0 ? colors.success : colors.error }]}>COLLECTIONS</Text>
                    <Text style={[styles.featureValue, { color: schoolTrends.paidInvoiceDeltaPct >= 0 ? colors.success : colors.error }]}>
                      {schoolTrends.paidInvoiceDeltaPct >= 0 ? '+' : ''}{schoolTrends.paidInvoiceDeltaPct}%
                    </Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Paid invoices vs last month</Text>
                  </View>
                  <View style={[styles.featureCard, styles.featureCardWide, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <Text style={[styles.featureEyebrow, { color: schoolTrends.gradedFlowDeltaPct >= 0 ? colors.success : colors.error }]}>ACADEMIC FLOW</Text>
                    <Text style={[styles.featureValue, { color: schoolTrends.gradedFlowDeltaPct >= 0 ? colors.success : colors.error }]}>
                      {schoolTrends.gradedFlowDeltaPct >= 0 ? '+' : ''}{schoolTrends.gradedFlowDeltaPct}%
                    </Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Graded submissions vs last month</Text>
                  </View>
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
                        safeNavigate(ROUTES.LessonDetail, { lessonId: studentMission.nextLessonId });
                      } else {
                        safeNavigate(TAB_ROUTES.Learn);
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
                    onPress={() => safeNavigate(ROUTES.Assignments)}
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
                  <TouchableOpacity
                    style={[styles.featureCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    activeOpacity={0.85}
                    onPress={() => safeNavigate(TAB_ROUTES.Learn)}
                  >
                    <Text style={[styles.featureEyebrow, { color: colors.info }]}>PROGRESS</Text>
                    <Text style={[styles.featureValue, { color: colors.info }]}>{studentMission.coursesInProgress}</Text>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>COURSES IN FLIGHT</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      Active course records from your enrolment progress.
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {role === 'student' && (studentDueSoon.length > 0 || studentPerformance.length > 0) && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>STUDY INTELLIGENCE</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
                </View>
                {studentDueSoon.length > 0 && (
                  <View style={styles.cardStack}>
                    {studentDueSoon.map((item) => (
                      <TouchableOpacity
                        key={`due-${item.id}`}
                        style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                        activeOpacity={0.85}
                        onPress={() => safeNavigate(ROUTES.Assignments)}
                      >
                        <View style={[styles.infoAvatar, { backgroundColor: colors.warning + '16' }]}>
                          <Ionicons name="time-outline" size={20} color={colors.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                          <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                            {item.urgency === 'today' ? 'Due today' : item.urgency === 'tomorrow' ? 'Due tomorrow' : 'Due this week'}
                          </Text>
                        </View>
                        <Text style={[styles.infoMeta, { color: colors.warning }]}>
                          {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'Soon'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {studentPerformance.length > 0 && (
                  <View style={[styles.cardStack, { marginTop: 10 }]}>
                    {studentPerformance.map((item) => (
                      <TouchableOpacity
                        key={`perf-${item.id}`}
                        style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                        activeOpacity={0.85}
                        onPress={() => safeNavigate(ROUTES.Assignments)}
                      >
                        <View style={[styles.infoAvatar, { backgroundColor: colors.success + '16' }]}>
                          <Text style={[styles.codeIcon, { color: colors.success }]}>
                            {Math.round((item.grade / Math.max(item.max_points, 1)) * 100)}%
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                          <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                            {item.submitted_at ? `Graded ${timeAgo(item.submitted_at)}` : 'Recently graded'}
                          </Text>
                        </View>
                        <Text style={[styles.infoMeta, { color: colors.success }]}>
                          {item.grade}/{item.max_points}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
                      if (screen) safeNavigate(screen);
                    }}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: a.color + '10', borderColor: a.color + '30' }]}>
                      <SemanticIcon code={a.icon} color={a.color} size={20} />
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
                      onPress={() => safeNavigate(ROUTES.MyChildren)}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: colors.accent + '18' }]}>
                        <Text style={[styles.codeIcon, { color: colors.accent }]}>{child.full_name?.slice(0, 1)?.toUpperCase() ?? 'C'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{child.full_name}</Text>
                        <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                          {[child.school_name, child.grade_level].filter(Boolean).join(' · ') || 'Child profile linked to your account'}
                        </Text>
                        <View style={styles.childActionRow}>
                          <TouchableOpacity
                            onPress={() => safeNavigate(ROUTES.ParentAttendance, { studentId: child.id, studentName: child.full_name })}
                            style={[styles.childActionBtn, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.childActionText, { color: colors.info }]}>Attendance</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => safeNavigate(ROUTES.ParentGrades, { studentId: child.id, studentName: child.full_name })}
                            style={[styles.childActionBtn, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.childActionText, { color: colors.success }]}>Grades</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => safeNavigate(ROUTES.ParentResults, { studentId: child.id, studentName: child.full_name })}
                            style={[styles.childActionBtn, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.childActionText, { color: colors.primary }]}>Results</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => safeNavigate(ROUTES.ParentInvoices, { studentId: child.id, studentName: child.full_name })}
                            style={[styles.childActionBtn, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.childActionText, { color: colors.warning }]}>Invoices</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.infoMeta, { color: child.status === 'approved' ? colors.success : colors.warning }]}>
                        {(child.status ?? 'linked').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {role === 'parent' && parentTrends.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHILD ACADEMIC TRENDS</Text>
                  <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.cardStack}>
                  {parentTrends.map((item) => (
                    <TouchableOpacity
                      key={`trend-${item.recordId}`}
                      style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      activeOpacity={0.85}
                      onPress={() => safeNavigate(ROUTES.ParentResults, { studentId: item.recordId, studentName: item.studentName })}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: colors.primary + '16' }]}>
                        <Text style={[styles.codeIcon, { color: colors.primary }]}>{item.studentName.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{item.studentName}</Text>
                        <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                          {item.publishedReports} reports · {item.gradedSubmissions} graded tasks
                        </Text>
                      </View>
                      <Text style={[styles.infoMeta, { color: item.averagePercent != null && item.averagePercent >= 60 ? colors.success : colors.warning }]}>
                        {item.averagePercent != null ? `${item.averagePercent}%` : 'N/A'}
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
                      onPress={() => safeNavigate(ROUTES.Timetable)}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: colors.info + '16' }]}>
                        <Ionicons name="calendar-outline" size={20} color={colors.info} />
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
                      onPress={() => safeNavigate(item.screen)}
                    >
                      <View style={[styles.infoAvatar, { backgroundColor: item.color + '16' }]}>
                        <SemanticIcon code={item.icon} color={item.color} size={20} />
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

          </>
        )}
        </SectionErrorBoundary>

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={!!announcementDetail} transparent animationType="fade" onRequestClose={() => setAnnouncementDetail(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: SPACING.lg, maxHeight: '85%' }}>
            <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: 6 }}>ANNOUNCEMENT</Text>
            <Text style={{ fontFamily: FONT_FAMILY.display, fontSize: 20, color: colors.textPrimary, marginBottom: SPACING.md }}>{announcementDetail?.title}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator>
              <Text style={{ fontFamily: FONT_FAMILY.body, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{announcementDetail?.content}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                onPress={() => setAnnouncementDetail(null)}
              >
                <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: colors.textSecondary }}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.sm, backgroundColor: colors.primary, alignItems: 'center' }}
                onPress={() => void confirmMarkAnnouncementRead()}
              >
                <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: '#fff' }}>MARK AS READ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  statIconWrap: { height: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: 16 },
  statLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 8, letterSpacing: 1, textAlign: 'center' },
  section: { paddingHorizontal: SPACING.xl, marginTop: 20 },
  syncBar: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncText: { fontFamily: FONT_FAMILY.body, fontSize: 11 },
  syncState: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.4 },
  announcementCard: { borderWidth: 1, borderRadius: RADIUS.sm, padding: 14, gap: 6 },
  announcementTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, letterSpacing: 0.3 },
  announcementBody: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  dismissHint: { fontFamily: FONT_FAMILY.body, fontSize: 10, lineHeight: 14, marginBottom: 12 },
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
  childActionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  childActionBtn: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 5 },
  childActionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.3, textTransform: 'uppercase' },
  infoMeta: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1, textAlign: 'right' },
  adminList: { gap: 10 },
  adminRowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14 },
  adminRowIcon: { width: 42, height: 42, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  adminRowLabel: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
  adminRowArrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  adminInboxBadge: { minWidth: 24, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  adminInboxBadgeText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: 11 },
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
  annCard: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS.sm, marginBottom: 10, overflow: 'hidden' },
  annBar: { width: 4 },
  annContent: { flex: 1, padding: 12, gap: 4 },
  annTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, letterSpacing: 0.5 },
  annBody: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18 },
  annDate: { fontFamily: FONT_FAMILY.mono, fontSize: 9, marginTop: 4 },
  emptyCard: { padding: 24, alignItems: 'center', gap: 10, borderRadius: RADIUS.sm, borderWidth: 1 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1, textAlign: 'center' },
  emptyCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 18, letterSpacing: 1 },
  labCard: { padding: 16, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', marginTop: 6 },
  labInfo: { flex: 1, gap: 4 },
  labTag: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  labTitle: { fontFamily: FONT_FAMILY.display, fontSize: 18 },
  labDesc: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  labIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  approvalsBanner: { paddingHorizontal: SPACING.xl, marginTop: SPACING.lg },
  approvalsBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: RADIUS.sm, padding: 14 },
  approvalsBannerDot: { width: 8, height: 8, borderRadius: 4 },
  approvalsBannerTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  approvalsBannerSub: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 2 },
  approvalsBannerArrow: { fontFamily: FONT_FAMILY.display, fontSize: 22 },
});

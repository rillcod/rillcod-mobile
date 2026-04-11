import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text, ActivityIndicator, View, StyleSheet, Platform, Alert, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import { useInboxUnreadCount } from '../hooks/useInboxUnreadCount';
import { RoleGuard } from '../components/ui/RoleGuard';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Onboarding
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// Public registration
import PublicStudentRegistrationScreen from '../screens/public/PublicStudentRegistrationScreen';
import PublicSchoolRegistrationScreen from '../screens/public/PublicSchoolRegistrationScreen';

// Main tab screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import LearnScreen from '../screens/learn/LearnScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';

// Detail / stack screens
import AssignmentsScreen from '../screens/dashboard/AssignmentsScreen';
import GradesScreen from '../screens/dashboard/GradesScreen';
import CertificatesScreen from '../screens/dashboard/CertificatesScreen';
import InvoicesScreen from '../screens/dashboard/InvoicesScreen';
import MessagesScreen from '../screens/dashboard/MessagesScreen';
import SettingsScreen from '../screens/dashboard/SettingsScreen';
import MyChildrenScreen from '../screens/dashboard/MyChildrenScreen';
import AnalyticsScreen from '../screens/dashboard/AnalyticsScreen';
import ParentResultsScreen from '../screens/dashboard/ParentResultsScreen';
import ParentAttendanceScreen from '../screens/dashboard/ParentAttendanceScreen';
import ParentGradesScreen from '../screens/dashboard/ParentGradesScreen';
import ParentInvoicesScreen from '../screens/dashboard/ParentInvoicesScreen';
import ParentCertificatesScreen from '../screens/dashboard/ParentCertificatesScreen';
import ParentFeedbackScreen from '../screens/dashboard/ParentFeedbackScreen';

// New admin/shared screens
import PeopleHubScreen from '../screens/dashboard/PeopleHubScreen';
import StudentsScreen from '../screens/dashboard/StudentsScreen';
import StudentImportScreen from '../screens/dashboard/StudentImportScreen';
import TeachersScreen from '../screens/dashboard/TeachersScreen';
import SchoolsScreen from '../screens/dashboard/SchoolsScreen';
import ParentsScreen from '../screens/dashboard/ParentsScreen';
import ParentDetailScreen from '../screens/dashboard/ParentDetailScreen';
import ApprovalsScreen from '../screens/dashboard/ApprovalsScreen';
import AttendanceScreen from '../screens/dashboard/AttendanceScreen';
import PaymentsScreen from '../screens/dashboard/PaymentsScreen';
import BulkPaymentsScreen from '../screens/dashboard/BulkPaymentsScreen';
import TransactionsScreen from '../screens/dashboard/TransactionsScreen';
import TimetableScreen from '../screens/dashboard/TimetableScreen';
import ClassesScreen from '../screens/dashboard/ClassesScreen';
import CBTScreen from '../screens/dashboard/CBTScreen';
import ReportsScreen from '../screens/dashboard/ReportsScreen';
import StudentDetailScreen from '../screens/dashboard/StudentDetailScreen';
import AssignmentDetailScreen from '../screens/dashboard/AssignmentDetailScreen';
import TeacherDetailScreen from '../screens/dashboard/TeacherDetailScreen';
import ProjectDetailScreen from '../screens/dashboard/ProjectDetailScreen';
import AddStudentScreen from '../screens/dashboard/AddStudentScreen';
import AddSchoolScreen from '../screens/dashboard/AddSchoolScreen';
import AddTeacherScreen from '../screens/dashboard/AddTeacherScreen';
import AddClassScreen from '../screens/dashboard/AddClassScreen';
import SchoolDetailScreen from '../screens/dashboard/SchoolDetailScreen';
import StudentReportScreen from '../screens/dashboard/StudentReportScreen';
import BulkRegisterScreen from '../screens/dashboard/BulkRegisterScreen';
import ClassDetailScreen from '../screens/dashboard/ClassDetailScreen';
import CreateAssignmentScreen from '../screens/dashboard/CreateAssignmentScreen';
import ReportBuilderScreen from '../screens/dashboard/ReportBuilderScreen';
import AIScreen from '../screens/dashboard/AIScreen';
import CoursesScreen from '../screens/dashboard/CoursesScreen';
import ProjectsScreen from '../screens/dashboard/ProjectsScreen';
import LibraryScreen from '../screens/dashboard/LibraryScreen';
import LeaderboardScreen from '../screens/dashboard/LeaderboardScreen';
import LiveSessionsScreen from '../screens/dashboard/LiveSessionsScreen';
import EngageScreen from '../screens/dashboard/EngageScreen';
import VaultScreen from '../screens/dashboard/VaultScreen';
import PlaygroundScreen from '../screens/dashboard/PlaygroundScreen';
import PortfolioScreen from '../screens/dashboard/PortfolioScreen';
import MissionsScreen from '../screens/dashboard/MissionsScreen';
import ProtocolScreen from '../screens/dashboard/ProtocolScreen';
import ManageCertificatesScreen from '../screens/dashboard/ManageCertificatesScreen';
import NewslettersScreen from '../screens/dashboard/NewslettersScreen';
import CardBuilderScreen from '../screens/dashboard/CardBuilderScreen';
import UsersScreen from '../screens/dashboard/UsersScreen';
import EnrolStudentsScreen from '../screens/dashboard/EnrolStudentsScreen';
import WipeStudentsScreen from '../screens/dashboard/WipeStudentsScreen';
import ProgramsScreen from '../screens/dashboard/ProgramsScreen';
import LessonsScreen from '../screens/dashboard/LessonsScreen';
import LessonDetailScreen from '../screens/dashboard/LessonDetailScreen';
import CourseDiscussionScreen from '../screens/dashboard/CourseDiscussionScreen';
import DiscussionTopicScreen from '../screens/dashboard/DiscussionTopicScreen';
import LessonEditorScreen from '../screens/dashboard/LessonEditorScreen';
import CBTExaminationScreen from '../screens/dashboard/CBTExaminationScreen';
import CBTExamEditorScreen from '../screens/dashboard/CBTExamEditorScreen';
import CBTGradingScreen from '../screens/dashboard/CBTGradingScreen';
import SchoolOverviewScreen from '../screens/dashboard/SchoolOverviewScreen';
import SchoolBillingScreen from '../screens/dashboard/SchoolBillingScreen';
import CourseDetailScreen from '../screens/dashboard/CourseDetailScreen';
import CourseEditorScreen from '../screens/dashboard/CourseEditorScreen';
import MarkAttendanceScreen from '../screens/dashboard/MarkAttendanceScreen';
import ProgressScreen from '../screens/dashboard/ProgressScreen';
import IoTScreen from '../screens/dashboard/IoTScreen';

import { COLORS } from '../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../constants/typography';
import { RADIUS } from '../constants/spacing';

import type { RootStackParamList, TabParamList } from './types';
import { ROUTES, TAB_ROUTES, MAIN_STACK_TABS } from './routes';

const Stack = createNativeStackNavigator<any>();
const Tab   = createBottomTabNavigator<TabParamList>();

const ONBOARDING_KEY = 'rillcod_onboarding_done';
type Role = 'admin' | 'teacher' | 'school' | 'student' | 'parent';

function withRoleGuard(Component: React.ComponentType<any>, allow: Role[]) {
  return function GuardedScreen(props: any) {
    return (
      <RoleGuard allow={allow} navigation={props.navigation}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}

const AdminOnlySchoolsScreen = withRoleGuard(SchoolsScreen, ['admin']);
const StaffParentsScreen = withRoleGuard(ParentsScreen, ['admin', 'teacher', 'school']);
const StaffApprovalsScreen = withRoleGuard(ApprovalsScreen, ['admin', 'teacher', 'school']);
const AdminOnlyUsersScreen = withRoleGuard(UsersScreen, ['admin']);
const AdminOnlyAddSchoolScreen = withRoleGuard(AddSchoolScreen, ['admin']);
const AdminOnlyWipeStudentsScreen = withRoleGuard(WipeStudentsScreen, ['admin']);
const AdminOnlyCardBuilderScreen = withRoleGuard(CardBuilderScreen, ['admin']);
const AdminOnlyProgramsScreen = withRoleGuard(ProgramsScreen, ['admin']);
const StaffLessonsScreen = withRoleGuard(LessonsScreen, ['admin', 'teacher']);
const StaffEnrolStudentsScreen = withRoleGuard(EnrolStudentsScreen, ['admin', 'teacher', 'school']);
const StaffAnalyticsScreen = withRoleGuard(AnalyticsScreen, ['admin', 'school', 'teacher']);
const StaffTeachersScreen = withRoleGuard(TeachersScreen, ['admin', 'school']);
const StaffPeopleHubScreen = withRoleGuard(PeopleHubScreen, ['admin', 'teacher', 'school', 'parent']);
const StaffStudentsScreen = withRoleGuard(StudentsScreen, ['admin', 'teacher', 'school']);
const StaffStudentImportScreen = withRoleGuard(StudentImportScreen, ['admin', 'teacher', 'school']);
const StaffAttendanceScreen = withRoleGuard(AttendanceScreen, ['admin', 'teacher', 'school', 'student']);
const StaffPaymentsScreen = withRoleGuard(PaymentsScreen, ['admin', 'school']);
const StaffBulkPaymentsScreen = withRoleGuard(BulkPaymentsScreen, ['admin', 'school']);
const StaffTransactionsScreen = withRoleGuard(TransactionsScreen, ['admin', 'school']);
const ProgressAccessScreen = withRoleGuard(ProgressScreen, ['admin', 'school']);
const AdminOnlyIoTScreen = withRoleGuard(IoTScreen, ['admin']);
const StaffReportsScreen = withRoleGuard(ReportsScreen, ['admin', 'teacher', 'school', 'student']);
const StaffAssignmentsScreen = withRoleGuard(AssignmentsScreen, ['admin', 'teacher', 'student']);
const StaffGradesScreen = withRoleGuard(GradesScreen, ['admin', 'teacher', 'school', 'student']);
const StaffClassesScreen = withRoleGuard(ClassesScreen, ['admin', 'teacher', 'school']);
const StaffCBTScreen = withRoleGuard(CBTScreen, ['admin', 'teacher', 'student']);
const StaffProjectsScreen = withRoleGuard(ProjectsScreen, ['admin', 'teacher', 'student']);
const StaffLibraryScreen = withRoleGuard(LibraryScreen, ['admin', 'teacher', 'student']);
const StaffLiveSessionsScreen = withRoleGuard(LiveSessionsScreen, ['admin', 'teacher', 'school', 'student']);
const StaffEngageScreen = withRoleGuard(EngageScreen, ['admin', 'teacher', 'student']);
const StaffVaultScreen = withRoleGuard(VaultScreen, ['admin', 'teacher', 'student']);
const StaffMissionsScreen = withRoleGuard(MissionsScreen, ['admin', 'teacher', 'student']);
const StaffProtocolScreen = withRoleGuard(ProtocolScreen, ['admin', 'teacher', 'student']);
const RoleNewslettersScreen = withRoleGuard(NewslettersScreen, ['admin', 'teacher', 'student', 'parent']);
const StaffManageCertificatesScreen = withRoleGuard(ManageCertificatesScreen, ['admin', 'teacher']);
const StaffReportBuilderScreen = withRoleGuard(ReportBuilderScreen, ['admin', 'teacher']);
const StaffBulkRegisterScreen = withRoleGuard(BulkRegisterScreen, ['admin', 'teacher']);
const AdminOnlyAddTeacherScreen = withRoleGuard(AddTeacherScreen, ['admin']);
const StaffAddStudentScreen = withRoleGuard(AddStudentScreen, ['admin', 'teacher', 'school']);
const StaffAddClassScreen = withRoleGuard(AddClassScreen, ['admin', 'teacher']);
const StaffCreateAssignmentScreen = withRoleGuard(CreateAssignmentScreen, ['admin', 'teacher']);
const StaffSchoolOverviewScreen = withRoleGuard(SchoolOverviewScreen, ['school', 'admin']);
const StaffSchoolBillingScreen = withRoleGuard(SchoolBillingScreen, ['school', 'admin']);
const ParentResultsOnlyScreen = withRoleGuard(ParentResultsScreen, ['parent']);
const ParentAttendanceOnlyScreen = withRoleGuard(ParentAttendanceScreen, ['parent']);
const ParentGradesOnlyScreen = withRoleGuard(ParentGradesScreen, ['parent']);
const ParentInvoicesOnlyScreen = withRoleGuard(ParentInvoicesScreen, ['parent']);
const ParentCertificatesOnlyScreen = withRoleGuard(ParentCertificatesScreen, ['parent']);
const ParentFeedbackScreenGuard = withRoleGuard(ParentFeedbackScreen, ['admin', 'teacher', 'parent']);
const ParentChildrenOnlyScreen = withRoleGuard(MyChildrenScreen, ['parent']);
const PlaygroundAccessScreen = withRoleGuard(PlaygroundScreen, ['admin', 'teacher', 'student']);
const PortfolioAccessScreen = withRoleGuard(PortfolioScreen, ['student']);
const StaffTimetableScreen = withRoleGuard(TimetableScreen, ['admin', 'teacher', 'school', 'student']);
const StaffStudentDetailScreen = withRoleGuard(StudentDetailScreen, ['admin', 'teacher', 'school']);
const StaffAssignmentDetailScreen = withRoleGuard(AssignmentDetailScreen, ['admin', 'teacher', 'student']);
const StaffTeacherDetailScreen = withRoleGuard(TeacherDetailScreen, ['admin', 'school']);
const StaffProjectDetailScreen = withRoleGuard(ProjectDetailScreen, ['admin', 'teacher', 'student']);
const StaffClassDetailScreen = withRoleGuard(ClassDetailScreen, ['admin', 'teacher', 'school']);
const StaffCourseDetailScreen = withRoleGuard(CourseDetailScreen, ['admin', 'teacher', 'student']);
const StaffLessonDetailScreen = withRoleGuard(LessonDetailScreen, ['admin', 'teacher', 'student']);
const StaffCourseDiscussionScreen = withRoleGuard(CourseDiscussionScreen, ['admin', 'teacher', 'student']);
const StaffDiscussionTopicScreen = withRoleGuard(DiscussionTopicScreen, ['admin', 'teacher', 'student']);
const StaffLessonEditorScreen = withRoleGuard(LessonEditorScreen, ['admin', 'teacher', 'school']);
const StaffCourseEditorScreen = withRoleGuard(CourseEditorScreen, ['admin', 'teacher']);
const StaffMarkAttendanceScreen = withRoleGuard(MarkAttendanceScreen, ['admin', 'teacher', 'school']);
const StaffParentDetailScreen = withRoleGuard(ParentDetailScreen, ['admin', 'teacher', 'school']);
const StaffSchoolDetailScreen = withRoleGuard(SchoolDetailScreen, ['admin', 'school']);
const StaffStudentReportScreen = withRoleGuard(StudentReportScreen, ['admin', 'teacher', 'school']);
const StaffCBTExaminationScreen = withRoleGuard(CBTExaminationScreen, ['admin', 'teacher', 'student']);
const StaffCBTExamEditorScreen = withRoleGuard(CBTExamEditorScreen, ['admin', 'teacher']);
const StaffCBTGradingScreen = withRoleGuard(CBTGradingScreen, ['admin', 'teacher']);

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Tab bar: Ionicons outline (idle) / solid (focused), colors from navigator ─
function TabIcon({
  outlineName,
  solidName,
  focused,
  color,
  size = 22,
  badge,
}: {
  outlineName: IoniconName;
  solidName: IoniconName;
  focused: boolean;
  color: string;
  size?: number;
  badge?: number;
}) {
  const iconSize = size ?? 22;
  return (
    <MotiView
      animate={{
        scale: focused ? 1.06 : 1,
        backgroundColor: focused ? COLORS.primaryPale : 'transparent',
      }}
      transition={{ type: 'spring', damping: 18 }}
      style={styles.tabIconWrap}
    >
      {focused && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          style={styles.tabGlow}
        />
      )}
      <Ionicons name={focused ? solidName : outlineName} size={iconSize} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </MotiView>
  );
}

function AdminSignOutTabPlaceholder() {
  return <View style={{ flex: 1 }} />;
}

// ── Main bottom tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  const { profile, signOut } = useAuth();
  const unread = useInboxUnreadCount(profile?.id);
  const showLearnTab = profile?.role === 'student';
  const isAdmin = profile?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name={TAB_ROUTES.Dashboard}
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon outlineName="home-outline" solidName="home" focused={focused} color={color} size={size} />
          ),
        }}
      />
      {showLearnTab ? (
        <Tab.Screen
          name={TAB_ROUTES.Learn}
          component={LearnScreen}
          options={{
            tabBarLabel: 'Learn',
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon outlineName="book-outline" solidName="book" focused={focused} color={color} size={size} />
            ),
          }}
        />
      ) : null}
      {!isAdmin ? (
        <Tab.Screen
          name={TAB_ROUTES.Notifications}
          component={NotificationsScreen}
          options={{
            tabBarLabel: 'Alerts',
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon
                outlineName="notifications-outline"
                solidName="notifications"
                focused={focused}
                color={color}
                size={size}
                badge={unread}
              />
            ),
          }}
        />
      ) : null}
      {isAdmin ? (
        <>
          <Tab.Screen
            name={TAB_ROUTES.AdminApprovals}
            component={StaffApprovalsScreen}
            options={{
              tabBarLabel: 'Approvals',
              tabBarIcon: ({ focused, color, size }) => (
                <TabIcon outlineName="shield-outline" solidName="shield" focused={focused} color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name={TAB_ROUTES.AdminUsers}
            component={AdminOnlyUsersScreen}
            options={{
              tabBarLabel: 'Users',
              tabBarIcon: ({ focused, color, size }) => (
                <TabIcon outlineName="people-outline" solidName="people" focused={focused} color={color} size={size} />
              ),
            }}
          />
          <Tab.Screen
            name={TAB_ROUTES.AdminSignOut}
            component={AdminSignOutTabPlaceholder}
            options={{
              tabBarLabel: 'Sign out',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="log-out-outline" size={size} color={color} />
              ),
              tabBarButton: (props) => {
                const { children, style, accessibilityState } = props;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={accessibilityState}
                    activeOpacity={0.7}
                    style={style}
                    onPress={() => {
                      Alert.alert('Sign out', 'Leave the admin portal?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                      ]);
                    }}
                  >
                    {children}
                  </TouchableOpacity>
                );
              },
            }}
          />
        </>
      ) : null}
      {!isAdmin ? (
        <Tab.Screen
          name={TAB_ROUTES.Profile}
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon outlineName="person-outline" solidName="person" focused={focused} color={color} size={size} />
            ),
          }}
        />
      ) : null}
    </Tab.Navigator>
  );
}

// ── Main app stack (tabs + detail screens) ────────────────────────────────────
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name={MAIN_STACK_TABS} component={MainTabs} options={{ animation: 'fade' }} />
      <Stack.Screen name={ROUTES.NotificationInbox} component={NotificationsScreen} />
      <Stack.Screen name={ROUTES.UserProfile} component={ProfileScreen} />
      <Stack.Screen name={ROUTES.Assignments} component={StaffAssignmentsScreen} />
      <Stack.Screen name={ROUTES.Grades} component={StaffGradesScreen} />
      <Stack.Screen name={ROUTES.Certificates} component={CertificatesScreen} />
      <Stack.Screen name={ROUTES.Invoices} component={InvoicesScreen} />
      <Stack.Screen name={ROUTES.Messages} component={MessagesScreen} />
      <Stack.Screen name={ROUTES.Settings} component={SettingsScreen} />
      <Stack.Screen name={ROUTES.MyChildren} component={ParentChildrenOnlyScreen} />
      <Stack.Screen name={ROUTES.Analytics} component={StaffAnalyticsScreen} />
      <Stack.Screen name={ROUTES.ParentResults} component={ParentResultsOnlyScreen} />
      <Stack.Screen name={ROUTES.ParentAttendance} component={ParentAttendanceOnlyScreen} />
      <Stack.Screen name={ROUTES.ParentGrades} component={ParentGradesOnlyScreen} />
      <Stack.Screen name={ROUTES.ParentInvoices} component={ParentInvoicesOnlyScreen} />
      <Stack.Screen name={ROUTES.ParentCertificates} component={ParentCertificatesOnlyScreen} />
      <Stack.Screen name={ROUTES.ParentFeedback} component={ParentFeedbackScreenGuard} />
      <Stack.Screen name={ROUTES.PeopleHub} component={StaffPeopleHubScreen} />
      <Stack.Screen name={ROUTES.Students} component={StaffStudentsScreen} />
      <Stack.Screen name={ROUTES.StudentImport} component={StaffStudentImportScreen} />
      <Stack.Screen name={ROUTES.Teachers} component={StaffTeachersScreen} />
      <Stack.Screen name={ROUTES.Schools} component={AdminOnlySchoolsScreen} />
      <Stack.Screen name={ROUTES.Parents} component={StaffParentsScreen} />
      <Stack.Screen name={ROUTES.ParentDetail} component={StaffParentDetailScreen} />
      <Stack.Screen name={ROUTES.Approvals} component={StaffApprovalsScreen} />
      <Stack.Screen name={ROUTES.Attendance} component={StaffAttendanceScreen} />
      <Stack.Screen name={ROUTES.Payments} component={StaffPaymentsScreen} />
      <Stack.Screen name={ROUTES.BulkPayments} component={StaffBulkPaymentsScreen} />
      <Stack.Screen name={ROUTES.Transactions} component={StaffTransactionsScreen} />
      <Stack.Screen name={ROUTES.Progress} component={ProgressAccessScreen} />
      <Stack.Screen name={ROUTES.IoT} component={AdminOnlyIoTScreen} />
      <Stack.Screen name={ROUTES.Timetable} component={StaffTimetableScreen} />
      <Stack.Screen name={ROUTES.Classes} component={StaffClassesScreen} />
      <Stack.Screen name={ROUTES.CBT} component={StaffCBTScreen} />
      <Stack.Screen name={ROUTES.CBTExamination} component={StaffCBTExaminationScreen} />
      <Stack.Screen name={ROUTES.CBTExamEditor} component={StaffCBTExamEditorScreen} />
      <Stack.Screen name={ROUTES.CBTGrading} component={StaffCBTGradingScreen} />
      <Stack.Screen name={ROUTES.Reports} component={StaffReportsScreen} />
      <Stack.Screen name={ROUTES.StudentDetail} component={StaffStudentDetailScreen} />
      <Stack.Screen name={ROUTES.AssignmentDetail} component={StaffAssignmentDetailScreen} />
      <Stack.Screen name={ROUTES.TeacherDetail} component={StaffTeacherDetailScreen} />
      <Stack.Screen name={ROUTES.ProjectDetail} component={StaffProjectDetailScreen} />
      <Stack.Screen name={ROUTES.AddStudent} component={StaffAddStudentScreen} />
      <Stack.Screen name={ROUTES.AddSchool} component={AdminOnlyAddSchoolScreen} />
      <Stack.Screen name={ROUTES.AddTeacher} component={AdminOnlyAddTeacherScreen} />
      <Stack.Screen name={ROUTES.AddClass} component={StaffAddClassScreen} />
      <Stack.Screen name={ROUTES.SchoolDetail} component={StaffSchoolDetailScreen} />
      <Stack.Screen name={ROUTES.StudentReport} component={StaffStudentReportScreen} />
      <Stack.Screen name={ROUTES.BulkRegister} component={StaffBulkRegisterScreen} />
      <Stack.Screen name={ROUTES.ClassDetail} component={StaffClassDetailScreen} />
      <Stack.Screen name={ROUTES.CreateAssignment} component={StaffCreateAssignmentScreen} />
      <Stack.Screen name={ROUTES.ReportBuilder} component={StaffReportBuilderScreen} />
      <Stack.Screen name={ROUTES.AI} component={AIScreen} />
      <Stack.Screen name={ROUTES.Courses} component={CoursesScreen} />
      <Stack.Screen name={ROUTES.CourseEditor} component={StaffCourseEditorScreen} />
      <Stack.Screen name={ROUTES.Projects} component={StaffProjectsScreen} />
      <Stack.Screen name={ROUTES.Library} component={StaffLibraryScreen} />
      <Stack.Screen name={ROUTES.Leaderboard} component={LeaderboardScreen} />
      <Stack.Screen name={ROUTES.LiveSessions} component={StaffLiveSessionsScreen} />
      <Stack.Screen name={ROUTES.Engage} component={StaffEngageScreen} />
      <Stack.Screen name={ROUTES.Vault} component={StaffVaultScreen} />
      <Stack.Screen name={ROUTES.Playground} component={PlaygroundAccessScreen} />
      <Stack.Screen name={ROUTES.Portfolio} component={PortfolioAccessScreen} />
      <Stack.Screen name={ROUTES.Missions} component={StaffMissionsScreen} />
      <Stack.Screen name={ROUTES.Protocol} component={StaffProtocolScreen} />
      <Stack.Screen name={ROUTES.ManageCertificates} component={StaffManageCertificatesScreen} />
      <Stack.Screen name={ROUTES.Newsletters} component={RoleNewslettersScreen} />
      <Stack.Screen name={ROUTES.CardBuilder} component={AdminOnlyCardBuilderScreen} />
      <Stack.Screen name={ROUTES.Users} component={AdminOnlyUsersScreen} />
      <Stack.Screen name={ROUTES.EnrolStudents} component={StaffEnrolStudentsScreen} />
      <Stack.Screen name={ROUTES.WipeStudents} component={AdminOnlyWipeStudentsScreen} />
      <Stack.Screen name={ROUTES.Programs} component={AdminOnlyProgramsScreen} />
      <Stack.Screen name={ROUTES.Lessons} component={StaffLessonsScreen} />
      <Stack.Screen name={ROUTES.LessonDetail} component={StaffLessonDetailScreen} />
      <Stack.Screen name={ROUTES.CourseDiscussion} component={StaffCourseDiscussionScreen} />
      <Stack.Screen name={ROUTES.DiscussionTopic} component={StaffDiscussionTopicScreen} />
      <Stack.Screen name={ROUTES.LessonEditor} component={StaffLessonEditorScreen} />
      <Stack.Screen name={ROUTES.SchoolOverview} component={StaffSchoolOverviewScreen} />
      <Stack.Screen name={ROUTES.SchoolBilling} component={StaffSchoolBillingScreen} />
      <Stack.Screen name={ROUTES.CourseDetail} component={StaffCourseDetailScreen} />
      <Stack.Screen name={ROUTES.MarkAttendance} component={StaffMarkAttendanceScreen} />
    </Stack.Navigator>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { session, profile, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    // Fallback: if AsyncStorage hangs, default to done after 3s
    const t = setTimeout(() => setOnboardingDone(prev => prev ?? true), 3000);
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      clearTimeout(t);
      setOnboardingDone(val === 'true');
    }).catch(() => {
      clearTimeout(t);
      setOnboardingDone(true);
    });
    return () => clearTimeout(t);
  }, []);

  if (loading || onboardingDone === null || (session && !profile)) {
    return (
      <View style={styles.loader}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <ActivityIndicator color={COLORS.primary} size="large" />
        </MotiView>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {session && profile ? (
          <Stack.Screen name={ROUTES.Main} component={MainStack} />
        ) : onboardingDone ? (
          <>
            <Stack.Screen name={ROUTES.Login} component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name={ROUTES.Register} component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.ForgotPassword} component={ForgotPasswordScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.PublicStudentRegistration} component={PublicStudentRegistrationScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.PublicSchoolRegistration} component={PublicSchoolRegistrationScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <>
            <Stack.Screen
              name={ROUTES.Onboarding}
              options={{ animation: 'fade' }}
            >
              {(props: any) => (
                <OnboardingScreen
                  {...props}
                  navigation={{
                    ...props.navigation,
                    replace: async (screen: keyof RootStackParamList) => {
                      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                      setOnboardingDone(true);
                      props.navigation.replace(screen);
                    },
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name={ROUTES.Login} component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name={ROUTES.Register} component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.ForgotPassword} component={ForgotPasswordScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.PublicStudentRegistration} component={PublicStudentRegistrationScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name={ROUTES.PublicSchoolRegistration} component={PublicSchoolRegistrationScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: 'rgba(16,26,42,0.98)',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 78 : 62,
    elevation: 20,
    shadowColor: '#09101A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  tabLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs - 1,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  tabIconWrap: {
    width: 44,
    height: 34,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  tabGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.lg,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.bg,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: FONT_FAMILY.bodySemi,
    color: '#fff',
  },
});


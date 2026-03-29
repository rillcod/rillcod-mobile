import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface MenuItem {
  emoji: string;
  label: string;
  description: string;
  screen: string;
  color: string;
}
interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ── Admin nav ─────────────────────────────────────────────────────────────────
const ADMIN_SECTIONS: MenuSection[] = [
  {
    title: 'People',
    items: [
      { emoji: '🏫', label: 'Schools',           description: 'Partner schools',             screen: 'Schools',          color: COLORS.info },
      { emoji: '👩‍🏫', label: 'Teachers',          description: 'Manage teachers',             screen: 'Teachers',         color: '#7c3aed' },
      { emoji: '👥', label: 'Students',           description: 'All enrolled students',       screen: 'Students',         color: COLORS.admin },
      { emoji: '📋', label: 'Register Students',  description: 'Bulk-register new students',  screen: 'BulkRegister',     color: COLORS.info },
      { emoji: '🎓', label: 'Enrol Students',     description: 'Enrol into programmes',       screen: 'EnrolStudents',    color: COLORS.success },
      { emoji: '🗑️', label: 'Wipe Students',      description: 'Archive or remove students',  screen: 'WipeStudents',     color: COLORS.error },
      { emoji: '🪪', label: 'Card Builder',        description: 'Generate student ID cards',   screen: 'CardBuilder',      color: COLORS.gold },
      { emoji: '👤', label: 'Users',              description: 'All portal user accounts',    screen: 'Users',            color: '#7c3aed' },
      { emoji: '✅', label: 'Approvals',           description: 'Pending account approvals',   screen: 'Approvals',        color: COLORS.success },
    ],
  },
  {
    title: 'Academics',
    items: [
      { emoji: '🎯', label: 'Programs',    description: 'Learning programmes',      screen: 'Programs',    color: COLORS.primary },
      { emoji: '📖', label: 'Courses',     description: 'Courses & modules',        screen: 'Courses',     color: '#7c3aed' },
      { emoji: '📚', label: 'Classes',     description: 'Manage classes',           screen: 'Classes',     color: '#7c3aed' },
      { emoji: '📝', label: 'Assignments', description: 'View & grade assignments', screen: 'Assignments', color: COLORS.info },
      { emoji: '🔬', label: 'Projects',    description: 'Lab & portfolio projects', screen: 'Projects',    color: COLORS.accent },
      { emoji: '📊', label: 'Grades',      description: 'Grades & scores',          screen: 'Grades',      color: COLORS.success },
      { emoji: '🎯', label: 'CBT Exams',   description: 'Computer-based tests',     screen: 'CBT',         color: COLORS.admin },
      { emoji: '📋', label: 'Attendance',  description: 'Mark & view attendance',   screen: 'Attendance',  color: COLORS.warning },
      { emoji: '📅', label: 'Timetable',   description: 'Class schedules',          screen: 'Timetable',   color: COLORS.success },
    ],
  },
  {
    title: 'Content',
    items: [
      { emoji: '📚', label: 'Library',       description: 'Educational resources',        screen: 'Library',      color: COLORS.info },
      { emoji: '🏆', label: 'Leaderboard',   description: 'Student rankings & XP',        screen: 'Leaderboard',  color: COLORS.gold },
      { emoji: '📡', label: 'Live Sessions', description: 'Scheduled live classes',        screen: 'LiveSessions', color: COLORS.admin },
      { emoji: '💬', label: 'Engage',        description: 'Student discussion hub',        screen: 'Engage',       color: COLORS.accent },
      { emoji: '🔐', label: 'Vault',         description: 'Personal code snippet storage', screen: 'Vault',        color: '#7c3aed' },
      { emoji: '🎮', label: 'Missions',      description: 'Daily coding challenges',       screen: 'Missions',     color: COLORS.success },
      { emoji: '🧪', label: 'Protocol',      description: 'Structured learning pathway',   screen: 'Protocol',     color: COLORS.info },
    ],
  },
  {
    title: 'Reports',
    items: [
      { emoji: '🏗️', label: 'Report Builder',     description: 'Build student report cards',  screen: 'ReportBuilder',      color: COLORS.accent },
      { emoji: '📈', label: 'Progress Reports',    description: 'Student report cards',         screen: 'Reports',            color: COLORS.accent },
      { emoji: '🏅', label: 'Manage Certificates', description: 'Issue & revoke certificates',  screen: 'ManageCertificates', color: COLORS.gold },
      { emoji: '📊', label: 'Analytics',           description: 'Platform analytics',           screen: 'Analytics',          color: COLORS.info },
    ],
  },
  {
    title: 'Finance',
    items: [
      { emoji: '💳', label: 'Payments', description: 'Invoices & transactions', screen: 'Payments', color: COLORS.gold },
    ],
  },
  {
    title: 'AI & Tools',
    items: [
      { emoji: '🤖', label: 'AI Hub', description: 'Tutor, generator & code lab', screen: 'AI', color: '#7c3aed' },
    ],
  },
  {
    title: 'System',
    items: [
      { emoji: '💬', label: 'Messages',    description: 'Chat with teachers & staff',   screen: 'Messages',    color: COLORS.info },
      { emoji: '📰', label: 'Newsletters', description: 'Create & send newsletters',    screen: 'Newsletters', color: COLORS.accent },
      { emoji: '⚙️', label: 'Settings',    description: 'App preferences & account',   screen: 'Settings',    color: COLORS.textSecondary },
    ],
  },
];

// ── Teacher nav ───────────────────────────────────────────────────────────────
const TEACHER_SECTIONS: MenuSection[] = [
  {
    title: 'Teaching',
    items: [
      { emoji: '📚', label: 'My Classes',  description: 'Your assigned classes',     screen: 'Classes',     color: '#7c3aed' },
      { emoji: '📖', label: 'Lessons',     description: 'Manage lesson content',     screen: 'Lessons',     color: COLORS.info },
      { emoji: '📝', label: 'Assignments', description: 'Create & grade work',       screen: 'Assignments', color: COLORS.accent },
      { emoji: '🔬', label: 'Projects',    description: 'Lab & portfolio projects',  screen: 'Projects',    color: COLORS.accent },
      { emoji: '🎯', label: 'CBT Exams',   description: 'Computer-based tests',      screen: 'CBT',         color: COLORS.admin },
      { emoji: '📋', label: 'Attendance',  description: 'Mark student attendance',   screen: 'Attendance',  color: COLORS.warning },
      { emoji: '📅', label: 'Timetable',   description: 'Your class schedule',       screen: 'Timetable',   color: COLORS.success },
    ],
  },
  {
    title: 'Students',
    items: [
      { emoji: '👥', label: 'Students',          description: 'Your students',             screen: 'Students',   color: COLORS.admin },
      { emoji: '📋', label: 'Register Students', description: 'Add new students',          screen: 'BulkRegister', color: COLORS.info },
      { emoji: '📊', label: 'Grades',            description: 'Student grades & scores',   screen: 'Grades',     color: COLORS.success },
    ],
  },
  {
    title: 'Reports',
    items: [
      { emoji: '🏗️', label: 'Report Builder',     description: 'Build student report cards', screen: 'ReportBuilder',      color: COLORS.accent },
      { emoji: '📈', label: 'Progress Reports',    description: 'Student report cards',        screen: 'Reports',            color: COLORS.accent },
      { emoji: '🏅', label: 'Manage Certificates', description: 'Issue & revoke certificates', screen: 'ManageCertificates', color: COLORS.gold },
    ],
  },
  {
    title: 'Content',
    items: [
      { emoji: '📚', label: 'Library',         description: 'Educational resources',  screen: 'Library',     color: COLORS.info },
      { emoji: '💻', label: 'Code Playground', description: 'AI coding environment',  screen: 'AI',          color: '#7c3aed' },
      { emoji: '🏆', label: 'Leaderboard',     description: 'Student rankings & XP',  screen: 'Leaderboard', color: COLORS.gold },
    ],
  },
  {
    title: 'Community',
    items: [
      { emoji: '💬', label: 'Engage',    description: 'Student discussion hub',        screen: 'Engage',   color: COLORS.accent },
      { emoji: '🔐', label: 'Vault',     description: 'Personal code snippets',        screen: 'Vault',    color: '#7c3aed' },
      { emoji: '🎮', label: 'Missions',  description: 'Daily coding challenges',       screen: 'Missions', color: COLORS.success },
      { emoji: '🧪', label: 'Protocol',  description: 'Structured learning pathway',   screen: 'Protocol', color: COLORS.info },
    ],
  },
  {
    title: 'More',
    items: [
      { emoji: '📡', label: 'Live Sessions', description: 'Scheduled live classes',  screen: 'LiveSessions', color: COLORS.admin },
      { emoji: '💬', label: 'Messages',      description: 'Chat with staff',          screen: 'Messages',     color: COLORS.info },
      { emoji: '📰', label: 'Newsletters',   description: 'School communications',    screen: 'Newsletters',  color: COLORS.accent },
      { emoji: '⚙️', label: 'Settings',      description: 'App preferences',          screen: 'Settings',     color: COLORS.textSecondary },
    ],
  },
];

// ── School role nav ───────────────────────────────────────────────────────────
const SCHOOL_SECTIONS: MenuSection[] = [
  {
    title: 'Overview',
    items: [
      { emoji: '🏫', label: 'School Overview', description: 'Dashboard & statistics',    screen: 'SchoolOverview', color: COLORS.primary },
    ],
  },
  {
    title: 'Academics',
    items: [
      { emoji: '👥', label: 'My Students', description: 'Enrolled students',         screen: 'Students',     color: COLORS.admin },
      { emoji: '📚', label: 'Classes',     description: 'Your school classes',       screen: 'Classes',      color: '#7c3aed' },
      { emoji: '📋', label: 'Attendance',  description: 'Student attendance',        screen: 'Attendance',   color: COLORS.warning },
      { emoji: '📅', label: 'Timetable',   description: 'Class schedules',           screen: 'Timetable',    color: COLORS.success },
      { emoji: '📡', label: 'Live Sessions', description: 'Scheduled live classes',  screen: 'LiveSessions', color: COLORS.admin },
    ],
  },
  {
    title: 'Reports',
    items: [
      { emoji: '📈', label: 'Student Reports', description: 'View student report cards', screen: 'Reports',    color: COLORS.accent },
      { emoji: '📊', label: 'Grades',          description: 'Student grades & scores',   screen: 'Grades',     color: COLORS.success },
      { emoji: '📉', label: 'Performance',     description: 'School analytics overview', screen: 'Analytics',  color: COLORS.info },
    ],
  },
  {
    title: 'Finance',
    items: [
      { emoji: '💳', label: 'Payments', description: 'Fee invoices & transactions', screen: 'Payments', color: COLORS.gold },
    ],
  },
  {
    title: 'More',
    items: [
      { emoji: '💬', label: 'Messages', description: 'Chat with Rillcod staff', screen: 'Messages', color: COLORS.info },
      { emoji: '⚙️', label: 'Settings', description: 'App preferences',         screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

// ── Student nav ───────────────────────────────────────────────────────────────
const STUDENT_SECTIONS: MenuSection[] = [
  {
    title: 'Learning',
    items: [
      { emoji: '📖', label: 'Courses',     description: 'Your enrolled courses',    screen: 'Courses',     color: '#7c3aed' },
      { emoji: '📝', label: 'Assignments', description: 'Tasks & submissions',      screen: 'Assignments', color: COLORS.info },
      { emoji: '🔬', label: 'Projects',    description: 'Lab & portfolio projects', screen: 'Projects',    color: COLORS.accent },
      { emoji: '📊', label: 'Grades',      description: 'Your grades & scores',     screen: 'Grades',      color: COLORS.success },
      { emoji: '📋', label: 'Attendance',  description: 'Your attendance record',   screen: 'Attendance',  color: COLORS.warning },
      { emoji: '📅', label: 'Timetable',   description: 'Your class schedule',      screen: 'Timetable',   color: COLORS.success },
      { emoji: '🎯', label: 'CBT Exams',   description: 'Practice & sit exams',     screen: 'CBT',         color: COLORS.admin },
    ],
  },
  {
    title: 'Reports',
    items: [
      { emoji: '📋', label: 'My Report Card',   description: 'Your progress report',  screen: 'Reports',       color: COLORS.accent },
      { emoji: '🏆', label: 'My Certificates',  description: 'Earned certificates',    screen: 'Certificates',  color: COLORS.gold },
    ],
  },
  {
    title: 'Community',
    items: [
      { emoji: '🏆', label: 'Leaderboard', description: 'Student rankings & XP',       screen: 'Leaderboard', color: COLORS.gold },
      { emoji: '💬', label: 'Engage',      description: 'Discussion hub',               screen: 'Engage',      color: COLORS.accent },
      { emoji: '🔐', label: 'Vault',       description: 'Your code snippet storage',    screen: 'Vault',       color: '#7c3aed' },
      { emoji: '🎮', label: 'Missions',    description: 'Daily coding challenges',      screen: 'Missions',    color: COLORS.success },
      { emoji: '🧪', label: 'Protocol',    description: 'Structured learning pathway',  screen: 'Protocol',    color: COLORS.info },
    ],
  },
  {
    title: 'AI & Tools',
    items: [
      { emoji: '🤖', label: 'AI Tutor', description: 'Study with AI', screen: 'AI', color: '#7c3aed' },
    ],
  },
  {
    title: 'More',
    items: [
      { emoji: '📡', label: 'Live Sessions', description: 'Join live classes',    screen: 'LiveSessions', color: COLORS.admin },
      { emoji: '📚', label: 'Library',       description: 'Educational resources', screen: 'Library',      color: COLORS.info },
      { emoji: '💬', label: 'Messages',      description: 'Chat with teachers',    screen: 'Messages',     color: COLORS.info },
      { emoji: '⚙️', label: 'Settings',      description: 'App preferences',       screen: 'Settings',     color: COLORS.textSecondary },
    ],
  },
];

// ── Parent nav ────────────────────────────────────────────────────────────────
const PARENT_SECTIONS: MenuSection[] = [
  {
    title: 'Parent Portal',
    items: [
      { emoji: '👨‍👩‍👧‍👦', label: 'My Children',   description: "View children's progress",    screen: 'MyChildren',         color: COLORS.accentLight },
      { emoji: '📋', label: 'Attendance',      description: "Child's attendance",           screen: 'ParentAttendance',   color: COLORS.warning },
      { emoji: '📊', label: 'Grades',          description: "Child's grades",               screen: 'ParentGrades',       color: COLORS.success },
      { emoji: '🏆', label: 'Certificates',    description: "Child's certificates",         screen: 'ParentCertificates', color: COLORS.gold },
      { emoji: '📈', label: 'Results',         description: "Child's report cards",         screen: 'ParentResults',      color: COLORS.accent },
      { emoji: '💰', label: 'Invoices',        description: 'Fees & payment history',       screen: 'ParentInvoices',     color: COLORS.warning },
    ],
  },
  {
    title: 'More',
    items: [
      { emoji: '💬', label: 'Messages', description: 'Chat with school & staff', screen: 'Messages', color: COLORS.info },
      { emoji: '⚙️', label: 'Settings', description: 'App preferences',          screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

function getSectionsForRole(role: string): MenuSection[] {
  switch (role) {
    case 'admin':   return ADMIN_SECTIONS;
    case 'teacher': return TEACHER_SECTIONS;
    case 'school':  return SCHOOL_SECTIONS;
    case 'parent':  return PARENT_SECTIONS;
    default:        return STUDENT_SECTIONS;
  }
}

export default function MoreScreen({ navigation }: any) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const sections = getSectionsForRole(role);

  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    teacher: 'Teacher',
    school: 'School Partner',
    student: 'Student',
    parent: 'Parent',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.header}
        >
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle}>{roleLabel[role] ?? 'Dashboard'} menu</Text>
        </MotiView>

        {/* Sections */}
        {sections.map((section, si) => (
          <MotiView
            key={section.title}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: si * 50 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.label + item.screen}
                  style={styles.menuItem}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.color + '22' }]}>
                    <Text style={styles.icon}>{item.emoji}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDesc} numberOfLines={1}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </MotiView>
        ))}

        {/* Brand footer */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 400 }}
          style={styles.brandFooter}
        >
          <Image
            source={require('../../../assets/rillcod-icon.png')}
            style={styles.brandLogo}
            resizeMode="cover"
          />
          <Text style={styles.brandName}>Rillcod Academy</Text>
          <Text style={styles.brandTagline}>Empowering Future Leaders Through Code</Text>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  section: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  menuItem: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.xs + 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  icon: { fontSize: 22 },
  menuLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  menuDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  brandFooter: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  brandLogo: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  brandName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
  },
  brandTagline: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

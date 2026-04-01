import { COLORS } from '../constants/colors';

export interface PortalMenuItem {
  glyph: string;
  label: string;
  description: string;
  screen: string;
  color: string;
  featured?: boolean;
}

export interface PortalMenuSection {
  title: string;
  items: PortalMenuItem[];
}

const ADMIN_SECTIONS: PortalMenuSection[] = [
  {
    title: 'Operations',
    items: [
      { glyph: 'SC', label: 'Schools', description: 'Partner schools and approvals', screen: 'Schools', color: COLORS.info, featured: true },
      { glyph: 'TC', label: 'Teachers', description: 'Manage teacher accounts', screen: 'Teachers', color: '#7c3aed', featured: true },
      { glyph: 'AP', label: 'Approvals', description: 'Pending user approvals', screen: 'Approvals', color: COLORS.success, featured: true },
      { glyph: 'AN', label: 'Analytics', description: 'System-wide performance', screen: 'Analytics', color: COLORS.primary, featured: true },
    ],
  },
  {
    title: 'People',
    items: [
      { glyph: 'ST', label: 'Students', description: 'All enrolled students', screen: 'Students', color: COLORS.admin },
      { glyph: 'PA', label: 'Parents', description: 'Manage parent records', screen: 'Parents', color: COLORS.gold },
      { glyph: 'US', label: 'Users', description: 'Portal user accounts', screen: 'Users', color: '#7c3aed' },
      { glyph: 'BR', label: 'Bulk Register', description: 'Register students in batches', screen: 'BulkRegister', color: COLORS.info },
      { glyph: 'EN', label: 'Enrol Students', description: 'Assign learners to programmes', screen: 'EnrolStudents', color: COLORS.success },
      { glyph: 'ID', label: 'Card Builder', description: 'Generate student ID cards', screen: 'CardBuilder', color: COLORS.gold },
    ],
  },
  {
    title: 'Academics',
    items: [
      { glyph: 'PR', label: 'Programs', description: 'Learning programmes', screen: 'Programs', color: COLORS.primary },
      { glyph: 'CR', label: 'Courses', description: 'Courses and modules', screen: 'Courses', color: '#7c3aed' },
      { glyph: 'CL', label: 'Classes', description: 'Manage classes', screen: 'Classes', color: '#7c3aed' },
      { glyph: 'AS', label: 'Assignments', description: 'Grade and review work', screen: 'Assignments', color: COLORS.info },
      { glyph: 'CB', label: 'CBT Exams', description: 'Computer-based tests', screen: 'CBT', color: COLORS.admin },
      { glyph: 'AT', label: 'Attendance', description: 'Attendance records', screen: 'Attendance', color: COLORS.warning },
      { glyph: 'TT', label: 'Timetable', description: 'Scheduling and slots', screen: 'Timetable', color: COLORS.success },
      { glyph: 'GD', label: 'Grades', description: 'Results and scores', screen: 'Grades', color: COLORS.success },
    ],
  },
  {
    title: 'Platform',
    items: [
      { glyph: 'LB', label: 'Library', description: 'Educational resources', screen: 'Library', color: COLORS.info },
      { glyph: 'LG', label: 'Leaderboard', description: 'Student rankings and XP', screen: 'Leaderboard', color: COLORS.gold },
      { glyph: 'LS', label: 'Live Sessions', description: 'Scheduled live classes', screen: 'LiveSessions', color: COLORS.admin },
      { glyph: 'EG', label: 'Engage', description: 'Discussion hub', screen: 'Engage', color: COLORS.accent },
      { glyph: 'VT', label: 'Vault', description: 'Snippet storage', screen: 'Vault', color: '#7c3aed' },
      { glyph: 'MS', label: 'Missions', description: 'Daily coding challenges', screen: 'Missions', color: COLORS.success },
      { glyph: 'PT', label: 'Protocol', description: 'Structured learning path', screen: 'Protocol', color: COLORS.info },
      { glyph: 'AI', label: 'AI Hub', description: 'Tutor and generation tools', screen: 'AI', color: '#7c3aed' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { glyph: 'RB', label: 'Report Builder', description: 'Build report cards', screen: 'ReportBuilder', color: COLORS.accent },
      { glyph: 'RP', label: 'Progress Reports', description: 'Student reports', screen: 'Reports', color: COLORS.accent },
      { glyph: 'MC', label: 'Certificates', description: 'Issue and manage certificates', screen: 'ManageCertificates', color: COLORS.gold },
      { glyph: 'PM', label: 'Payments', description: 'Invoices and transactions', screen: 'Payments', color: COLORS.gold },
    ],
  },
  {
    title: 'System',
    items: [
      { glyph: 'MG', label: 'Messages', description: 'Internal communication', screen: 'Messages', color: COLORS.info },
      { glyph: 'NW', label: 'Newsletters', description: 'Create and send updates', screen: 'Newsletters', color: COLORS.accent },
      { glyph: 'ST', label: 'Settings', description: 'Preferences and account', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

const TEACHER_SECTIONS: PortalMenuSection[] = [
  {
    title: 'Teaching',
    items: [
      { glyph: 'CL', label: 'Classes', description: 'Assigned classes', screen: 'Classes', color: '#7c3aed', featured: true },
      { glyph: 'LS', label: 'Lessons', description: 'Lesson content', screen: 'Lessons', color: COLORS.info, featured: true },
      { glyph: 'AS', label: 'Assignments', description: 'Create and grade work', screen: 'Assignments', color: COLORS.accent, featured: true },
      { glyph: 'AT', label: 'Attendance', description: 'Mark attendance', screen: 'Attendance', color: COLORS.warning, featured: true },
      { glyph: 'CB', label: 'CBT Exams', description: 'Computer-based tests', screen: 'CBT', color: COLORS.admin },
      { glyph: 'TT', label: 'Timetable', description: 'Class schedule', screen: 'Timetable', color: COLORS.success },
    ],
  },
  {
    title: 'Students',
    items: [
      { glyph: 'ST', label: 'Students', description: 'Student roster', screen: 'Students', color: COLORS.admin },
      { glyph: 'BR', label: 'Bulk Register', description: 'Add students', screen: 'BulkRegister', color: COLORS.info },
      { glyph: 'GR', label: 'Grades', description: 'Student grades', screen: 'Grades', color: COLORS.success },
      { glyph: 'RB', label: 'Report Builder', description: 'Build report cards', screen: 'ReportBuilder', color: COLORS.accent },
      { glyph: 'MC', label: 'Certificates', description: 'Issue certificates', screen: 'ManageCertificates', color: COLORS.gold },
    ],
  },
  {
    title: 'Platform',
    items: [
      { glyph: 'LB', label: 'Library', description: 'Educational resources', screen: 'Library', color: COLORS.info },
      { glyph: 'AI', label: 'AI Hub', description: 'Tutor and code tools', screen: 'AI', color: '#7c3aed' },
      { glyph: 'LG', label: 'Leaderboard', description: 'Student rankings', screen: 'Leaderboard', color: COLORS.gold },
      { glyph: 'LS', label: 'Live Sessions', description: 'Scheduled sessions', screen: 'LiveSessions', color: COLORS.admin },
      { glyph: 'EG', label: 'Engage', description: 'Discussion hub', screen: 'Engage', color: COLORS.accent },
      { glyph: 'VT', label: 'Vault', description: 'Personal snippets', screen: 'Vault', color: '#7c3aed' },
      { glyph: 'MS', label: 'Missions', description: 'Coding challenges', screen: 'Missions', color: COLORS.success },
      { glyph: 'PT', label: 'Protocol', description: 'Learning pathway', screen: 'Protocol', color: COLORS.info },
      { glyph: 'MG', label: 'Messages', description: 'Team communication', screen: 'Messages', color: COLORS.info },
      { glyph: 'NW', label: 'Newsletters', description: 'School communication', screen: 'Newsletters', color: COLORS.accent },
      { glyph: 'ST', label: 'Settings', description: 'Preferences', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

const SCHOOL_SECTIONS: PortalMenuSection[] = [
  {
    title: 'Overview',
    items: [
      { glyph: 'OV', label: 'School Overview', description: 'Dashboard and statistics', screen: 'SchoolOverview', color: COLORS.primary, featured: true },
      { glyph: 'ST', label: 'Students', description: 'Enrolled students', screen: 'Students', color: COLORS.admin, featured: true },
      { glyph: 'CL', label: 'Classes', description: 'School classes', screen: 'Classes', color: '#7c3aed', featured: true },
      { glyph: 'AN', label: 'Analytics', description: 'School performance', screen: 'Analytics', color: COLORS.info, featured: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { glyph: 'AT', label: 'Attendance', description: 'Attendance records', screen: 'Attendance', color: COLORS.warning },
      { glyph: 'TT', label: 'Timetable', description: 'Schedules', screen: 'Timetable', color: COLORS.success },
      { glyph: 'LS', label: 'Live Sessions', description: 'Scheduled live classes', screen: 'LiveSessions', color: COLORS.admin },
      { glyph: 'RP', label: 'Reports', description: 'Student reports', screen: 'Reports', color: COLORS.accent },
      { glyph: 'GR', label: 'Grades', description: 'Student scores', screen: 'Grades', color: COLORS.success },
      { glyph: 'PM', label: 'Payments', description: 'Invoices and transactions', screen: 'Payments', color: COLORS.gold },
      { glyph: 'MG', label: 'Messages', description: 'Chat with staff', screen: 'Messages', color: COLORS.info },
      { glyph: 'ST', label: 'Settings', description: 'Preferences', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

const STUDENT_SECTIONS: PortalMenuSection[] = [
  {
    title: 'Learning',
    items: [
      { glyph: 'CR', label: 'Courses', description: 'Enrolled courses', screen: 'Courses', color: '#7c3aed', featured: true },
      { glyph: 'AS', label: 'Assignments', description: 'Tasks and submissions', screen: 'Assignments', color: COLORS.info, featured: true },
      { glyph: 'CB', label: 'CBT Exams', description: 'Practice and exams', screen: 'CBT', color: COLORS.admin, featured: true },
      { glyph: 'GR', label: 'Grades', description: 'Scores and marks', screen: 'Grades', color: COLORS.success, featured: true },
      { glyph: 'AT', label: 'Attendance', description: 'Attendance record', screen: 'Attendance', color: COLORS.warning },
      { glyph: 'TT', label: 'Timetable', description: 'Class schedule', screen: 'Timetable', color: COLORS.success },
      { glyph: 'RP', label: 'Reports', description: 'Progress report', screen: 'Reports', color: COLORS.accent },
      { glyph: 'CT', label: 'Certificates', description: 'Earned certificates', screen: 'Certificates', color: COLORS.gold },
    ],
  },
  {
    title: 'Community',
    items: [
      { glyph: 'PJ', label: 'Projects', description: 'Lab and portfolio work', screen: 'Projects', color: COLORS.accent },
      { glyph: 'LG', label: 'Leaderboard', description: 'Rankings and XP', screen: 'Leaderboard', color: COLORS.gold },
      { glyph: 'EG', label: 'Engage', description: 'Discussion hub', screen: 'Engage', color: COLORS.accent },
      { glyph: 'VT', label: 'Vault', description: 'Code snippets', screen: 'Vault', color: '#7c3aed' },
      { glyph: 'MS', label: 'Missions', description: 'Coding challenges', screen: 'Missions', color: COLORS.success },
      { glyph: 'PT', label: 'Protocol', description: 'Learning pathway', screen: 'Protocol', color: COLORS.info },
      { glyph: 'AI', label: 'AI Tutor', description: 'Study with AI', screen: 'AI', color: '#7c3aed' },
      { glyph: 'LB', label: 'Library', description: 'Educational resources', screen: 'Library', color: COLORS.info },
      { glyph: 'LS', label: 'Live Sessions', description: 'Join live classes', screen: 'LiveSessions', color: COLORS.admin },
      { glyph: 'MG', label: 'Messages', description: 'Chat with teachers', screen: 'Messages', color: COLORS.info },
      { glyph: 'ST', label: 'Settings', description: 'Preferences', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

const PARENT_SECTIONS: PortalMenuSection[] = [
  {
    title: 'Parent Portal',
    items: [
      { glyph: 'CH', label: 'My Children', description: 'Children and profiles', screen: 'MyChildren', color: COLORS.accent, featured: true },
      { glyph: 'RS', label: 'Results', description: 'Report cards and results', screen: 'ParentResults', color: COLORS.primary, featured: true },
      { glyph: 'GD', label: 'Grades', description: 'Child grades', screen: 'ParentGrades', color: COLORS.success, featured: true },
      { glyph: 'IV', label: 'Invoices', description: 'Fees and invoices', screen: 'ParentInvoices', color: COLORS.warning, featured: true },
      { glyph: 'AT', label: 'Attendance', description: 'Child attendance', screen: 'ParentAttendance', color: COLORS.warning },
      { glyph: 'CT', label: 'Certificates', description: 'Child certificates', screen: 'ParentCertificates', color: COLORS.gold },
      { glyph: 'MG', label: 'Messages', description: 'Chat with school', screen: 'Messages', color: COLORS.info },
      { glyph: 'ST', label: 'Settings', description: 'Preferences', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

export function getPortalSectionsForRole(role: string): PortalMenuSection[] {
  switch (role) {
    case 'admin':
      return ADMIN_SECTIONS;
    case 'teacher':
      return TEACHER_SECTIONS;
    case 'school':
      return SCHOOL_SECTIONS;
    case 'parent':
      return PARENT_SECTIONS;
    default:
      return STUDENT_SECTIONS;
  }
}

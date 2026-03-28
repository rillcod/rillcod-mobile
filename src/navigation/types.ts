export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  // Detail screens (accessible from tabs)
  CourseDetail: { programId: string; title: string };
  AssignmentDetail: { assignmentId: string; title: string };
  MessageThread: { userId: string; name: string };
  ChildDetail: { studentId: string; name: string };
  // Parent portal detail screens
  ParentResults: { studentId: string; studentName?: string };
  ParentAttendance: { studentId: string; studentName?: string };
  ParentGrades: { studentId: string; studentName?: string };
  ParentInvoices: { studentId: string; studentName?: string };
  ParentCertificates: { studentId: string; studentName?: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Learn: undefined;
  Notifications: undefined;
  Profile: undefined;
  More: undefined;
};

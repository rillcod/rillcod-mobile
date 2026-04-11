# Appendix F — Web component → mobile port registry

Web paths are relative to **`rillcod-academy`** `src/components/`. Mobile targets are **`rillcod`** screens, `src/services/*`, or `src/components/ui/*` unless noted.

| ID | Web component | Mobile target | Status | Notes |
|----|---------------|---------------|--------|-------|
| F-001 | `layout/AppProviders.tsx` | `AppNavigator.tsx`, `AuthContext.tsx`, providers in root | partial | Theme, auth, query client differ by stack |
| F-002 | `layout/DashboardShell.tsx` | `DashboardScreen.tsx`, tab shell | partial | Nav chrome differs; ordering aligned in checklist |
| F-003 | `layout/DashboardNavigation.tsx` | `DashboardScreen` links, `routes.ts` | partial | Deep link parity ongoing |
| F-004 | `layout/Footer.tsx` | N/A | N/A | Marketing web |
| F-005 | `ai/LessonAITools.tsx` | `LessonEditorScreen`, `AIScreen` Create, `lessonAiIntegration.ts`, `webLessonAi.ts` | done | **Mobile core:** full + notes + retry + normalize + cover + `activity_logs` via `trackLessonAiEvent`. Web-only Puter / `/api/ai/image` / video routes **N/A** on client. |
| F-006 | `dashboard/AdminDashboard.tsx` | `DashboardScreen` (admin sections) | partial | Widgets not 1:1 |
| F-007 | `dashboard/TeacherDashboard.tsx` | `DashboardScreen`, `TimetableScreen`, queues | partial | Re-verify action center vs web |
| F-008 | `dashboard/SchoolDashboard.tsx` | `SchoolOverviewScreen`, `DashboardScreen` | partial | |
| F-009 | `dashboard/StudentDashboard.tsx` | `DashboardScreen`, `LearnScreen` | partial | Cards differ |
| F-010 | `dashboard/ParentDashboard.tsx` | `MyChildrenScreen`, parent dashboard blocks | partial | |
| F-011 | `exam/ExamInterface.tsx` | `ExamTakingScreen`, `CBTExaminationScreen` | partial | Session resume + submit wired |
| F-012 | `assignments/*` (BlockSequencer etc.) | `CreateAssignmentScreen`, `AssignmentDetailScreen` | partial | Mobile builder simpler |
| F-013 | `share/ShareToParentModal.tsx` | `src/lib/assignmentShare.ts`, `AssignmentDetailScreen` | partial | WhatsApp share; full modal N/A |
| F-014 | `reports/ReportCard.tsx` | `ReportsScreen`, `StudentReportScreen` | partial | |
| F-015 | `reports/ModernReportCard.tsx` | `GradesScreen`, report views | partial | |
| F-016 | `reports/PrintableReport.tsx` | `ReportBuilderScreen`, `report-generator.ts`, `reportShare.ts` | done | **PDF:** `generateAndShareReportPDF` (expo-print). **Text:** `shareReportAsText` → `buildStudentProgressReportTextSummary` + system share sheet. |
| F-017 | `certificates/CertificatePreview.tsx` | `CertificatesScreen`, `ManageCertificatesScreen` | partial | |
| F-018 | `certificates/shared/CertificateTemplates.tsx` | `CardBuilderScreen`, cert flows | partial | |
| F-019 | `finance/SmartDocument.tsx` | `InvoicesScreen`, `PaymentsScreen`, `TransactionsScreen` | partial | |
| F-020 | `studio/IntegratedCodeRunner.tsx` | `PlaygroundScreen`, `AIScreen` Code tab | partial | Piston vs web runner |
| F-021 | `visualizer/CodeVisualizer.tsx` | `PlaygroundScreen` | pending | |
| F-022 | `visualizer/VisualizationControls.tsx` | N/A | pending | |
| F-023 | `forum/ForumComponents.tsx` | `EngageScreen`, `DiscussionTopicScreen` | partial | |
| F-024 | `media/VideoPlayer.tsx` | `LessonDetailScreen`, expo AV patterns | partial | |
| F-025 | `ui/SyntaxHighlight.tsx` | Inline / future `components/ui` | pending | |
| F-026 | `ui/CertificateCard.tsx` | Certificate list cards | partial | |
| F-027 | `parents/ParentForm.tsx` | `RegisterScreen`, parent onboarding | partial | |
| F-028 | `admin/StudentApproval.tsx` | `ApprovalsScreen` | partial | Filters aligned per checklist |
| F-029 | `auth/PortalAccess.tsx` | `LoginScreen`, `RoleGuard` | partial | |
| F-030 | `activities/ActivityInstructions.tsx` | Lesson blocks in `LessonDetailScreen` | partial | Block renderer |
| F-031 | `qr/StaffQRScanner.tsx` | `AttendanceScreen` (if QR) | partial | Verify feature flag |
| F-032 | `pwa/PwaProvider.tsx` | `app.json`, Expo | N/A | Different platform |
| F-033 | `pwa/PushSubscriptionManager.tsx` | `usePushNotifications.ts`, `SettingsScreen` | partial | |
| F-034 | `landing/Hero.tsx` | N/A | N/A | Web marketing |
| F-035 | `SummerSchoolPopup.tsx` | `ApprovalsScreen` summer tab | partial | |
| F-036 | `PWAInstaller.tsx` | N/A | N/A | |
| F-037 | `ThemeToggle.tsx` | `ThemeContext`, `SettingsScreen` | done | |
| F-038 | `layout/AppProviders` theme branch | `ThemeContext.tsx` | partial | |
| F-039 | `dashboard` analytics widgets | `AnalyticsScreen` | partial | |
| F-040 | `assignments/AssignmentCard` (if present) | `AssignmentsScreen` | partial | Naming varies on web |
| F-041 | `library/*` | `LibraryScreen`, `library.service.ts` | partial | Ratings wired |
| F-042 | `chat/*` | `MessagesScreen` | partial | |
| F-043 | `iot/*` | `IoTScreen.tsx` | partial | |
| F-044 | `components/ui/button variants` | `PremiumButton.tsx` | partial | |
| F-045 | `components/ui/input` | `PremiumInput.tsx` | partial | |
| F-046 | `Course` editors web | `CourseEditorScreen.tsx` | partial | `is_locked` etc. |
| F-047 | `Lesson` editor web studio | `LessonEditorScreen.tsx` | partial | JSON layout vs visual studio |
| F-048 | `Class` roster web | `ClassDetailScreen.tsx` | partial | |
| F-049 | `Enrolment` bulk web | `EnrolStudentsScreen.tsx`, `enrollment.service.ts` | partial | Bulk class flow |
| F-050 | `StudentImport` web | `StudentImportScreen.tsx` | partial | |
| F-051 | `BulkRegister` web | `BulkRegisterScreen.tsx` | partial | |
| F-052 | `Paystack` checkout web | `usePaystack.tsx`, `PaystackCheckoutModal` | partial | Verify retries |
| F-053 | `Users` admin table web | `UsersScreen.tsx` | partial | |
| F-054 | `Schools` admin web | `SchoolsScreen.tsx`, `SchoolDetailScreen.tsx` | partial | |
| F-055 | `Teachers` web | `TeachersScreen.tsx`, `TeacherDetailScreen.tsx` | partial | |
| F-056 | `Students` web | `StudentsScreen.tsx`, `StudentDetailScreen.tsx` | partial | |
| F-057 | `Parents` web | `ParentsScreen.tsx`, `ParentDetailScreen.tsx` | partial | |
| F-058 | `Programs` web | `ProgramsScreen.tsx` | partial | |
| F-059 | `Courses` web | `CoursesScreen.tsx`, `CourseDetailScreen.tsx` | partial | |
| F-060 | `Lessons` web | `LessonsScreen.tsx`, `LessonDetailScreen.tsx` | partial | |
| F-061 | `Assignments` web | `AssignmentsScreen.tsx`, `AssignmentDetailScreen.tsx` | partial | Photo + WhatsApp mobile |
| F-062 | `CBT` exam editor web | `CBTExamEditorScreen.tsx` | partial | |
| F-063 | `CBT` grading web | `CBTGradingScreen.tsx` | partial | |
| F-064 | `CBT` take exam web | `ExamTakingScreen.tsx` | partial | |
| F-065 | `Attendance` web | `AttendanceScreen.tsx`, `ParentAttendanceScreen.tsx` | partial | |
| F-066 | `Timetable` web | `TimetableScreen.tsx` | partial | |
| F-067 | `Newsletters` web | `NewslettersScreen.tsx` | partial | |
| F-068 | `Notifications` web | `NotificationsScreen.tsx`, hooks | partial | |
| F-069 | `Settings` web | `SettingsScreen.tsx` | partial | |
| F-070 | `Profile` web | `ProfileScreen.tsx` | partial | |
| F-071 | `Vault` web | `VaultScreen.tsx` | partial | |
| F-072 | `Engage` web | `EngageScreen.tsx` | partial | |
| F-073 | `Leaderboard` web | `LeaderboardScreen.tsx` | partial | |
| F-074 | `Missions` web | `MissionsScreen.tsx` | partial | |
| F-075 | `Portfolio` web | `PortfolioScreen.tsx` | partial | |
| F-076 | `Progress` web | `ProgressScreen.tsx` | partial | |
| F-077 | `Projects` web | `ProjectsScreen.tsx`, `ProjectDetailScreen.tsx` | partial | |
| F-078 | `Learn` hub web | `LearnScreen.tsx` | partial | Next lesson + assignments todo |
| F-079 | `Onboarding` web | `OnboardingScreen.tsx` | partial | |
| F-080 | `Public registration` web | `PublicSchoolRegistrationScreen.tsx`, `PublicStudentRegistrationScreen.tsx` | partial | |
| F-081 | `Live sessions` web | `LiveSessionsScreen.tsx`, `dashboard.service.ts` | partial | |
| F-082 | `Certificates` issuance web | `CertificatesScreen.tsx`, `ManageCertificatesScreen.tsx` | partial | |
| F-083 | `Parent grades` web | `ParentGradesScreen.tsx` | partial | |
| F-084 | `Parent invoices` web | `ParentInvoicesScreen.tsx` | partial | |
| F-085 | `Parent results` web | `ParentResultsScreen.tsx` | partial | |
| F-086 | `Parent certificates` web | `ParentCertificatesScreen.tsx` | partial | |
| F-087 | `My children` web | `MyChildrenScreen.tsx` | partial | |
| F-088 | `Wipe students` web | `WipeStudentsScreen.tsx` | partial | Admin |
| F-089 | `Add student` web | `AddStudentScreen.tsx` | partial | |
| F-090 | `Add teacher` web | `AddTeacherScreen.tsx` | partial | |
| F-091 | `Add class` web | `AddClassScreen` / class flows in `ClassesScreen` | partial | |
| F-092 | `School billing` web | `SchoolBillingScreen.tsx` | partial | |
| F-093 | `Bulk payments` web | `BulkPaymentsScreen.tsx` | partial | |
| F-094 | `Card builder` web | `CardBuilderScreen.tsx` | partial | |
| F-095 | `Report builder` web | `ReportBuilderScreen.tsx` | partial | |
| F-096 | `Users` invitations web | `UsersScreen` / services | pending | |
| F-097 | `IoT` device forms web | `IoTScreen.tsx` | pending | |
| F-098 | `StudyAssistant` web | `AIScreen` Tutor tab | partial | |
| F-099 | `Code` labs web | `AIScreen` Code tab, `PlaygroundScreen` | partial | |
| F-100 | `Payment` receipts web | `PaymentsScreen`, `TransactionsScreen` | partial | |
| F-101 | `Invoice` PDF web | `InvoicesScreen` staff edit | partial | |
| F-102 | `Course discussion` web | `CourseDiscussionScreen.tsx` | partial | |
| F-103 | `Parent feedback` web | `ParentFeedbackScreen.tsx` | partial | |
| F-104 | `Playground` challenges web | `PlaygroundScreen.tsx` | partial | |
| F-105 | `ScreenHeader` pattern web | `ScreenHeader.tsx`, `IconBackButton.tsx` | partial | |
| F-106 | `RoleGuard` web middleware | `RoleGuard.tsx`, navigator options | partial | |
| F-107 | `SectionErrorBoundary` web | `SectionErrorBoundary.tsx` | done | |
| F-108 | `Offline` banner web | `OfflineBanner.tsx` | done | |
| F-109 | `SemanticIcon` / icon map web | `SemanticIcon.tsx` | partial | |
| F-110 | `AdminCollectionHeader` web | `AdminCollectionHeader.tsx` | partial | |

**How to use:** pick a web route → grep its imports under `src/components/` → find the row above → open the mobile target → diff behaviour and update the **Status** when signed off.

---

## Mobile integration modules (canonical functions)

| Module | Use for |
|--------|---------|
| `src/lib/lessonAiIntegration.ts` | `requireLessonAiTopic`, `normalizeWebLessonPayload`, `runLessonAiFullGeneration`, `runLessonAiNotesGeneration`, `buildQuickLessonAiRequest`, `trackLessonAiEvent` — **single entry** for lesson AI from screens. |
| `src/lib/webLessonAi.ts` | Low-level prompts + `generateWebFullLesson*`; prefer integration layer above for UI. |
| `src/lib/lessonAiPort.ts` | Preset subjects + `lessonCoverImageUrl` (Pollinations). |
| `src/lib/reportShare.ts` | Plain-text report body + `sharePlainText` (complements `report-generator.ts` PDF). |
| `src/lib/report-generator.ts` | PDF generation + share (web `PrintableReport` analogue). |

# Mobile vs Web Parity Checklist

Last updated: 2026-04-11 (Batch 7 — workflow registry + CBT session + Paystack verify)  
Primary target: Mobile app is the main product surface; web is the **source of truth for behavior** until parity is signed off.

## Web source (local)

Canonical clone path used for route inventory:

`C:\Users\USER\Downloads\rillcod-academy-main\rillcod-academy-main`

- App routes: `src/app/**/page.tsx` (Next.js App Router).
- Web UI building blocks: `src/components/**` (domain folders + `ui/`).
- Mobile stack names: `src/navigation/types.ts` (`RootStackParamList`) and `src/navigation/routes.ts` (`ROUTES` — align navigators and `navigation.navigate` with this over time).
- Mobile shared UI: `src/components/ui/**` (+ a few root components such as `PresenceList.tsx`); most feature UI still lives on **screens** under `src/screens/`.

---

## Product principle (order of work)

1. **Mirror the web** — For each role: same surfaces, navigation paths, data sources, validation rules, and user-visible outcomes (pages, internal admin/staff flows, approval and billing logic where web exposes them).
2. **Verify parity** — Side-by-side pass: web route → mobile screen → same Supabase tables/RPCs and edge cases.
3. **Extend on mobile** — Only after parity for that role (or that module) is acceptable: extra dashboards, lanes, trend cards, or UX that the web does not have.

Earlier work mixed steps 2–3; **new work defaults to step 1** unless you explicitly ask for mobile-only features.

Status legend:

- `done` = implemented and aligned with web (or explicitly accepted mobile-only substitute)
- `partial` = present but not fully aligned with web behavior
- `pending` = not yet implemented
- `extension` = mobile enhancement **after** web parity for that area (do not prioritize over mirror work)

**Strict sign-off (locked in):** A role or feature is **`done`** only after **side-by-side verification** with the web app: same user-visible steps, gates, validation, and outcomes. Screens, routes, and “reasonable” Supabase usage alone stay **`partial`** until that pass is recorded. Implementation bullets below remain the **single source of truth** for what exists vs what still gaps.

---

## Phase 1 — Web parity (blocking)

**Canonical web clone for ordering and route inventory:** `C:\Users\USER\Downloads\rillcod-academy-main\rillcod-academy-main` — compare `src/components/layout/DashboardNavigation.tsx` (sidebar + section labels) and `src/app/dashboard/**/page.tsx` to mobile `ROUTES` + screens.

Cross-cutting:

- [x] `done` **Web route map (implementation)** — Appendix A lists `/dashboard/*` ↔ mobile `ROUTES` / tabs. **Admin / teacher / school / student** home quick links and operational hub tiles on `DashboardScreen` were **reordered and expanded** to follow web `DashboardNavigation` groupings (People → bulk ops → academics/reports → finance → IoT/AI where applicable). **Still `partial` for strict sign-off:** human side-by-side verification that every label and destination matches product intent on web.
- [~] `partial` **Query and mutation parity** — For each mirrored screen, match web’s Supabase queries, filters, and write payloads (not only “a similar query”). **Started:** `ReportsScreen` staff list now uses `teacher_schools` + `school_id` on `student_progress_reports` like `AnalyticsScreen` (multi-school teachers, school partners). **`ReportBuilderScreen`:** term+course report matching (not “latest any”), auto report period from date/term, teacher student list fallback via `teacher_schools`, smart score prefill from graded submissions + attendance, publish validation, `instructor_assessment` persisted and shown on `StudentReportScreen` / `ParentResultsScreen` / `ReportsScreen` card. **`GradesScreen`:** graded assignments + scored CBT rows only for aggregates; **`ParentGradesScreen`:** assignment list filtered to `status = graded`; **`ProgressScreen`:** shows `overall_grade` with score for school/admin report list.
- [~] `partial` **Workflow parity** — **Approvals:** mobile queues now match web list filters (`is_deleted` handling, FIFO `created_at` asc), prospective **Reject** (`is_deleted` + `is_active` false per web API), teacher + admin access (`StaffApprovalsScreen`, `RoleGuard`, Schools **Review**), tab order (Students → Summer → Schools), login email prefers `student_email` then `parent_email`. **Bulk enrol:** `EnrolStudents` without `classId` mirrors web bulk class flow (pick/create, filters, `bulkEnrollStudentsInClass`); deep-linked class flow unchanged. **Paystack:** `usePaystack` runs up to **3** verify attempts with backoff; post-checkout “not confirmed yet” copy only when returning from checkout success URL (not on every app resume). **CBT:** `prepareStudentExamAttempt` resumes `in_progress` sessions and submits with `sessionId` on **`ExamTakingScreen`** + **`CBTExaminationScreen`** (no duplicate session rows per attempt). **Still open:** full invoice line-item editor, strict side-by-side sign-off for all 50+ rows in **Appendix E**.
- [x] `done` Role guards applied for major role-sensitive routes in `AppNavigator`
- [~] `partial` Full build/typecheck verification in CI/local when stable
- [x] `done` Shared typed route constants — `src/navigation/routes.ts` + `TAB_ROUTES` + `MAIN_STACK_TABS`; **`AppNavigator` wired**; navigation targets use `ROUTES.*` / `TAB_ROUTES.*` (including `DashboardScreen`, profile quick actions, school overview actions, my-children links, `LessonDetailScreen`). `ParentResults` param list includes optional `userId` to match screen usage. **Deep linking:** if added later, map URL paths → these same names in a linking config (not automatic like web).
- [ ] `pending` **Component & layout parity** — See **Appendix C**: map web `src/components/{domain}` to mobile screens/components; same fields, validation, and outcomes (visual parity optional). **Nav chrome:** web `DashboardShell` / `DashboardNavigation` ordering is now reflected on mobile **dashboard entry points**; deep component parity (e.g. `AdminDashboard` widgets vs `DashboardScreen` stats) remains open.
- [x] `done` **Service / data-layer parity (repo implementation)** — Mobile dashboard/public flows run through `src/services/*` per **batches 1–5** and Batch 5 schema-backed features; screens under `src/screens` do not import `lib/supabase` for routine CRUD (types-only imports allowed). **Intentional exceptions:** `AuthContext`, `usePaystack`, IoT `supabase as any` until `iot_*` is in generated types (`npm run sync-types`). **Strict product parity** with **web** `src/services/*.service.ts` still needs line-by-line diff when both trees are available in one workspace.

### Autonomous service sprint — mobile data layer (implementation log)

Batch goal: route screen logic through `src/services/*` for consistency with web-style services and easier parity checks. **Strict `done`** still requires side-by-side web verification per checklist rules.

- [x] `enrollment.service` — `listStudentsForEnrolPicker`, `listProgramsForEnrolPicker`, `upsertEnrollments`, `assignPortalUsersToClass`
- [x] `EnrolStudentsScreen` — load + submit via `enrollmentService` (no direct `supabase` in that flow)
- [x] `student.service` — `listRegistrationsForParentEmail`, `listStudentsForWipeScreen`, `bulkSetPortalStudentsActive`, `bulkHardDeletePortalStudents`
- [x] `WipeStudentsScreen` — list + bulk actions via `studentService`
- [x] `project.service` — lab/portfolio list (staff embed `portal_users!*_user_id_fkey`) + `getLabProjectById` / `getPortfolioProjectById`
- [x] `ProjectsScreen` — data via `projectService`
- [x] `ProjectDetailScreen` — resolution via `projectService` (lab then portfolio)
- [x] `grade.service` — `listGradedAssignmentSubmissionsForParentGrades`, `listCbtSessionsWithScoresForParentGrades`, `getLatestPublishedOverallGradeForPortalStudent`, `listProgressReportRowsForProgressScreen`
- [x] `ParentGradesScreen` — `studentService` + `gradeService`
- [x] `certificate.service` — `listCertificatesForParentByRegistrationId`, `countCertificatesForPortalUser` (uses `studentService` for `user_id` resolution)
- [x] `ParentCertificatesScreen` — certificates via `certificateService`; guard when `studentId` missing
- [x] `attendance.service` — `listParentAttendanceByStudentsRegistrationId`, `listAttendanceStatusesForStudentsRegistration`
- [x] `ParentAttendanceScreen` — `studentService` + `attendanceService`
- [x] `payment.service` — `countUnpaidInvoicesForPortalUser`
- [x] `MyChildrenScreen` — children + per-child stats via `studentService`, `attendanceService`, `paymentService`, `certificateService`, `gradeService`
- [x] `ParentResultsScreen` — resolve portal user via `studentService`; reports via `gradeService.listProgressReports`
- [x] `teacher.service` — reuse existing `listSchoolIdsForTeacher` from `analytics.service.fetchStaffAnalyticsDashboard`
- [x] `analytics.service` — `fetchStaffAnalyticsDashboard` (KPIs, school distribution, at-risk); uses `last_login` on `portal_users` per generated types
- [x] `AnalyticsScreen` — load via `analyticsService`
- [x] `ProgressScreen` — report table via `gradeService.listProgressReportRowsForProgressScreen`
- [x] `timetable.service` — `listTimetablesForSchoolScope`, `listSlotsForTimetable` (teacher name via `portal_users:teacher_id`)
- [x] `TimetableScreen` — via `timetableService`
- [x] `portal-user-admin.service` — `listUsersForAdminScreen` (portal users + teacher `teacher_schools` link counts)
- [x] `UsersScreen` — initial directory load via `portalUserAdminService` (mutations may still use `supabase` in-screen)
- [x] Parent flows — reuse `studentService.getFirstStudentRegistrationIdForParentEmail` and `getPortalUserIdForStudentRegistration` where a registration id must become a portal user id
- [x] `enrollment.service` — typed `EnrollmentInsert` on `upsertEnrollments` for enrolment row shape
- [x] Staff analytics — teacher scope uses `teacherService.listSchoolIdsForTeacher` (fallback to `profile.school_id` inside that helper)
- [x] `ProgressScreen` — school partners filtered by `school_id`; admins see all rows (service flag `isAdmin`)
- [x] `timetable.service` — slot mapper returns UI fields only (avoids leaking raw embed objects)
- [x] `attendance.service` — parent-facing rows include derived `date` / `course_name` for list rendering
- [x] `class.service` — `getClassDetailWithRelations` / `getClassForEditor` aligned to generated `classes` columns (no `color` / `school_name` on table); joined path uses `schools!classes_school_id_fkey(name)`; bare fallback fetches `schools` name
- [x] `ClassDetailScreen` — `school_name` from `cls.schools?.name` (embed) with legacy fallback; `color` optional
- [x] `ProgramsScreen` — `programService.updateProgram` / `createProgram` payloads use `?? undefined` for optional fields (TS vs `ProgramInput`)
- [x] `approval.service` — `loadApprovalsQueues`, student/school approve+auth+portal upsert, rejects, prospective activation
- [x] `ApprovalsScreen` — queue load + actions via `approvalService` (no `supabase` import)
- [x] `school.service` — `loadSchoolDetailScreenData` (school row, `teacher_schools` assignments, students, teacher picker pool)
- [x] `teacher.service` — `insertTeacherSchoolAssignmentReturningRow`, `deleteTeacherSchoolAssignmentById`
- [x] `SchoolDetailScreen` — load + assign/remove teachers via `schoolService` + `teacherService`
- [x] `parent.service` — parent detail profile (`maybeSingle`), children by `parent_email`, activate/deactivate portal user, clear registration parent fields
- [x] `ParentDetailScreen` — via `parentService` (no `supabase`)
- [x] `school.service` — `fetchSchoolOverviewDashboard` (KPIs, today’s present count, top students by mean graded submission); `SchoolOverviewScreen` + empty state when no `school_id`
- [x] `grade.service` — `listFullProgressReportsForStudentReport`, `listSubmissionsForStudentReport`, `listEnrollmentsForStudentReport`
- [x] `StudentReportScreen` — tabs data via `gradeService`
- [x] `cbt.service` — `loadCbtHubBundle` (exams scoped teacher vs admin, pending `needs_grading` queue, student sessions)
- [x] `CBTScreen` — via `cbtService` with `try`/`finally` on load

### Autonomous service sprint — batch 3 (newsletters, engage, vault, feedback, lab/portfolio self-serve, certificates manage, course/CBT editors, grading)

- [x] `newsletter.service` — `listNewslettersForStaff`, `aggregateDeliveryStatsByNewsletterIds`, `loadPublishedNewslettersForReader` (marks deliveries viewed)
- [x] `newsletter.service` — `upsertNewsletterDraft`, `publishNewsletterToAudience` (incl. `NO_RECIPIENTS`), `deleteNewsletter`
- [x] `NewslettersScreen` — staff + reader loads, save draft, publish, delete via `newsletterService` (no `supabase` import)
- [x] `engage.service` — `listEngagePostsWithAuthors`, `incrementPostLikes`, `deleteEngagePost`, `insertEngagePost`
- [x] `EngageScreen` — load / like / delete / create post via `engageService`
- [x] `vault.service` — `listVaultItemsForUser`, `deleteVaultItem`, `upsertVaultItem`
- [x] `VaultScreen` — list / save / delete via `vaultService`
- [x] `feedback.service` — `listParentFeedbackForStaff` (typed embed `parent_feedback_portal_user_id_fkey`), `submitParentFeedback`, `updateParentFeedbackStatus`
- [x] `ParentFeedbackScreen` — staff list + parent submit + status updates via `feedbackService`
- [x] `project.service` — `listOwnLabProjects`, `updateLabProject`, `insertLabProjectReturningId`, `deleteLabProject` (playground owner scope)
- [x] `PlaygroundScreen` — lab CRUD via `projectService`
- [x] `project.service` — `listOwnPortfolioProjectsForStudent`, `updatePortfolioProject`, `insertPortfolioProject`, `deletePortfolioProject`
- [x] `PortfolioScreen` — student portfolio CRUD via `projectService`
- [x] `certificate.service` — `listCertificatesForManageScreen`, `listStudentsForCertificatePicker`, `insertManualCertificate`
- [x] `ManageCertificatesScreen` — registry + issue modal via `certificateService`
- [x] `course.service` — `loadCourseEditorMeta` (programs / schools / teachers by admin vs school scope)
- [x] `course.service` — `getCourseRowById`, `updateCourse`, `insertCourseReturningId` for editor save path
- [x] `CourseEditorScreen` — boot + save via `courseService`
- [x] `cbt.service` — `loadProgramsCoursesForExamEditor` (school-scoped when not admin)
- [x] `cbt.service` — `getCbtExamRowById`, `insertCbtExamForEditor`, `updateCbtExamShell`, `listCbtQuestionsForEditorRefresh`
- [x] `CBTExamEditorScreen` — program/course pickers + exam shell create/update + post-save question refresh via `cbtService` (question rows still `question.service`)
- [x] `cbt.service` — `loadSessionForManualGrading` (access + `needs_grading` gates with `code`), `saveManualGradingSession`
- [x] `CBTGradingScreen` — load + submit grades via `cbtService` (local preview math unchanged)
- [x] `cbt.service` — private helpers `parseSessionAnswers`, `autoScoreMcqPoints` for grading bundle (keeps scoring aligned with screen)
- [x] `certificate.service` — manage-screen rows map `metadata` + `portal_users` embed for admin/teacher registry UI
- [x] `newsletter.service` — `AudienceRole` + publish role map matches `NewslettersScreen` audience tabs
- [x] `vault.service` — `VaultItemInsert` typed from generated `Database` for upsert payloads
- [x] `engage.service` — `portal_users!engage_posts_user_id_fkey` embed preserved for author chips
- [x] `feedback.service` — `portal_users!parent_feedback_portal_user_id_fkey` includes `school_name` for teacher filter
- [x] `project.service` — lab + portfolio staff list methods unchanged; new methods are **self** CRUD only
- [x] `course.service` — `loadCourseEditorMeta` mirrors prior in-screen `Promise.all` branching (admin vs school teachers)
- [x] `ManageCertificatesScreen` — `insertManualCertificate` uses same cert number / verification generation as before
- [x] `NewslettersScreen` — reader path sets `deliveryMap` to `{}` after service load (avoids stale staff stats)
- [x] `CBTGradingScreen` — `ACCESS_DENIED` / `ALREADY_GRADED` handled via thrown `code` from service

### Autonomous parity sprint — Batch 6 (2026-04-11): web sidebar alignment + schema-backed surfaces

**Ten new / expanded product features (mobile, informed by web `DashboardNavigation` + `app_settings` + `students` import):**

1. **`BulkPaymentsScreen`** — batch invoices/receipts + archive (`ROUTES.BulkPayments`, finance staff).
2. **`StudentImportScreen`** — CSV paste import for pending `students` (`ROUTES.StudentImport`, `studentImportService` + `parseStudentImportCsv`).
3. **`app-settings.service`** — `getValue`, `isOpenRouterConfigured` (centralized reads; **AI** screen wired).
4. **Dashboard home banner** — optional `app_settings.key = dashboard_home_banner` rendered under hero for all roles.
5. **Admin grid** — Import, Parent Feedback, Bulk Payments on **`ADMIN_HOME_LINKS`**.
6. **Teacher quick access** — Import Students, Parent Feedback, **Projects**, **Approvals** (`AQ` icon) on **`TEACHER_QUICK_LINKS`**.
7. **School quick access** — **Bulk Payments** tile on **`SCHOOL_QUICK_LINKS`**.
8. **Operational hub keys** — `ACTION_SCREENS` entries: `Import`, `Feedback`, `Report Builder`, `Bulk Pay` (fixes dead tiles).
9. **Students directory** — **Import** CTA next to CSV export.
10. **Invoice staff edit** — `InvoicesScreen` modal: due date, notes, status → `paymentService.patchInvoice`.
11. **Approvals workflow (web `approvals/page.tsx` + API semantics)** — FIFO queues, `is_deleted` filters, prospective reject, teacher access, Schools **Review** for teachers, approve email fallback to parent email, goals/parent_email on cards.

**Representative fixes & hygiene (30-ish themed items rolled into one pass):**

- Web–mobile **nav parity**: admin/school/teacher surfaces aligned to `DashboardNavigation` groupings (People / Finance / ops).
- **SemanticIcon** glyphs **`BP`**, **`IM`**, **`AQ`** (approvals queue).
- **Teacher** hero strip: **Report Builder** label spelling (was `ReportBuilder`).
- **School** finance: **Bulk Pay** + **Transactions** in operational hub `ACTION_SCREENS`.
- **Admin** operational hub: **Import**, **Feedback**, **Bulk Pay** route resolution.
- **Invoices**: read-only notes for non-staff; staff edit form; `ScrollView` status chips.
- **Student import**: template share via existing **`shareCsv`**; role guard **`admin`/`teacher`/`school`**.
- **Types + routes**: `StudentImport` on `RootStackParamList` + **`AppNavigator`** stack.
- **Checklist Appendix A/B** updated for bulk pay, import, invoice edit rows.
- **`payment.service`**: bulk invoice archive helpers retained from prior batch; **`Json`** typing for batch helpers.
- **`student.service`**: `listRegistrationStudentsForBilling` for bulk receipt non-portal audience.
- Consolidated **`app_settings`** access for **AIScreen** + dashboard (single service file).

### Autonomous service sprint — batch 4 (finance, admin users, parents CRM, public registration, report builder, ID cards, IoT)

- [x] `payment.service` — `listFinanceConsoleTransactionsWithJoins` (embeds: `courses`, `schools`, `portal_users`, `invoices`)
- [x] `payment.service` — `listReceiptsForFinanceConsole` (ledger sidebar / issue-receipt flow)
- [x] `payment.service` — `financeApplyTransactionStatus` (paid/refund timestamps + linked `invoices` status + `payment_transaction_id`)
- [x] `payment.service` — `financeDeleteTransactionCascade` (receipts by `transaction_id`, delete tx, reset invoice)
- [x] `TransactionsScreen` — load / approve / refund / issue receipt / delete via `paymentService` (no screen `supabase`)
- [x] `portal-user-admin.service` — `setPortalUserActive` (toggle deactivation from directory)
- [x] `portal-user-admin.service` — `hardDeletePortalUser` (admin permanent delete with same UX guards)
- [x] `portal-user-admin.service` — `updatePortalUserAdminEdit` (typed `Pick` from `portal_users` Update)
- [x] `UsersScreen` — school picker uses `schoolService.listApprovedSchoolOptions` (single source with other admin flows)
- [x] `UsersScreen` — activate / delete / save edit via `portalUserAdminService` only
- [x] `parent.service` — `ParentDirectoryRow` + `listParentsDirectoryWithChildStats` (portal parents + `students` counts / approved)
- [x] `parent.service` — `updateParentPortalProfile` + `syncStudentsParentContactByOldEmail` (keeps registration rows in sync)
- [x] `parent.service` — `signUpParentAndUpsertPortal` (`auth.signUp` + `portal_users` upsert on `email`)
- [x] `parent.service` — `unlinkStudentsByParentEmail` + `deleteParentPortalUser` + `toggleParentPortalActive`
- [x] `ParentsScreen` — directory load / toggle / delete via `parentService`
- [x] `ParentsScreen` — add/edit modal create + update paths via `parentService` (no modal `supabase`)
- [x] `school.service` — `getLatestSchoolApplicationByEmail` (public status tab; `maybeSingle` semantics)
- [x] `PublicSchoolRegistrationScreen` — submit via `schoolService.registerSchool` (pending + timestamps centralized)
- [x] `PublicSchoolRegistrationScreen` — status checker via `getLatestSchoolApplicationByEmail`
- [x] `student.service` — `insertPublicStudentInterestRow` (typed `students` Insert for marketing registration)
- [x] `PublicStudentRegistrationScreen` — prospective student insert via `studentService`
- [x] `report-builder.service` — `loadStudentPickerRows` (teacher class / `teacher_schools` / school / admin scopes preserved)
- [x] `report-builder.service` — `getStudentRowForReport` (deep-link prefilled student)
- [x] `report-builder.service` — `fetchSmartHintSignals` (graded submissions + attendance for score prefill)
- [x] `report-builder.service` — `listProgressReportsForStudent` + `updateProgressReport` + `insertProgressReport`
- [x] `ReportBuilderScreen` — all former in-screen `supabase` calls routed through `reportBuilderService`
- [x] `ReportBuilderScreen` — pref student load: service + catch → fallback row (same as missing-profile behavior)
- [x] `ReportBuilderScreen` — save path: try/catch surfaces PostgREST errors without silent failures
- [x] `card.service` — `searchStudentsForIdCardByName` (`ilike` on `portal_users` students)
- [x] `CardBuilderScreen` — search via `cardService`
- [x] `CardBuilderScreen` — ID footer “Valid” years derived from `enrollYear(created_at)` (STEM cohort label)
- [x] `iot.service` — `listIotDevicesOrderedByLastSeen` / `listIotAlertsRecent` via `supabase as any` until types include `iot_*`
- [x] `IoTScreen` — live queries via `iotService`; demo seed unchanged when table empty / error
- [x] **Finance parity note:** mobile transactions console now matches web-style **service-owned** status + invoice side-effects
- [x] **Parents parity note:** parent email edits propagate to `students.parent_*` for linked registrations
- [x] **Public reg parity note:** school + student interest captured through the same service methods admin approvals will query
- [x] **Report builder:** teacher multi-school class filter logic unchanged, only relocated for reuse/testing
- [x] **Receipt issuance:** `ReceiptInsert` path through `paymentService.insertReceipt` (metadata structure unchanged)
- [x] **Transaction delete:** cascade order preserved (receipts → tx → invoice reset)
- [x] **Users admin:** no duplicate `schools` query string — uses `listApprovedSchoolOptions`
- [x] **Typecheck:** `npx tsc --noEmit` clean after batch 4 (IoT uses explicit escape hatch for missing generated tables)
- [x] **STEM / robotics context:** report milestone presets + IoT monitoring screen unchanged functionally; data layer centralized
- [x] **Workflow:** `TransactionsScreen` `updateTransactionStatus` dependency corrected to include `load` (refresh after mutations)
- [x] **School register:** `registerSchool` normalizes `status`, `is_deleted`, timestamps — public form no longer duplicates that logic
- [x] **Student interest:** `goals` column still carries free-text parent context for approvals (documented in screen comment; enforced via Insert type)
- [x] **IoT disclaimer:** banner copy still explains simulation when no `iot_devices` rows (matches prior web fallback story)
- [x] **Card builder:** admin-only route unchanged; search limited to 20 matches for performance
- [x] **Parent delete:** order preserved — unlink `students` first, then delete `portal_users` (avoids orphan contact strings)
- [x] **Auth separation:** `signUp` remains in `parent.service` next to portal upsert (same transaction intent as before)
- [x] **Invoice patch:** `financeApplyTransactionStatus` only updates invoice when status maps to `paid` or refund → `sent`
- [x] **Batch 4 scope:** dashboard `src/screens/**/*.tsx` no longer import `../../lib/supabase` except where noted in Phase 1 parity line
- [x] **Future web mirror:** when web `src/services/*` names differ, add thin re-export adapters — mobile services are the contract for this repo
- [x] **Operational:** finance admins use the same cascade rules as implemented in `paymentService` (single place to diff vs web later)
- [x] **Quality bar:** world-class STEM portal direction — centralized data layer + typed admin/parent/finance flows + public funnel alignment

Per role (mirror web first; tick only when behavior matches web, not merely “has a screen”):

- [~] `partial` **Admin** — **Implemented (mobile):** admin-guarded destinations in Appendix A with role guards; dashboard exposes schools, teachers, analytics, approvals, users, programs, enrolment, card builder, wipe, grades, payments, transactions, newsletters, CBT hub (**`CBTExamEditor`**, **`CBTGrading`**, examination preview), report surfaces, IoT where routed. **Teachers** also reach **Approvals** (stack + quick link) for the same queues as web `isStaff` on `/dashboard/approvals` (schools tab remains **admin-only**, matching web). **Blocks strict `done`:** side-by-side web verification of every workflow; known gaps vs web include parents add/edit field parity, exact `AdminDashboard` section order/widgets, remaining Phase 1 **Workflow parity** (enrolment API, Paystack, CBT), and **Service / data-layer parity** until web services are matched.
- [~] `partial` **Teacher** — **Implemented (mobile):** classes (add/edit), lessons + **`LessonEditor`**, courses + **`CourseEditor`**, assignments + **`CreateAssignment`**, **`CBT`** hub with pending **`needs_grading`** queue, **`CBTGrading`** (essay points + final %), **`CBTExamination`**, attendance, timetable, report builder, reports, grades, students, guarded stack routes; multi-school via **`teacher_schools`** on analytics/reports per Phase 1 notes. **Blocks strict `done`:** web verification of grading UX/fields vs `/sessions/.../grade`, lesson **studio** vs Appendix D, exact **`TeacherDashboard`** layout, and Phase 1 workflow/service parity.
- [~] `partial` **School** — overview, students, teachers, billing, comms vs web (**next focus** after staff surfaces are verified against web)
- [~] `partial` **Student** — learn path, assignments, CBT, certificates, reports vs web
- [~] `partial` **Parent** — children, results, grades, attendance, invoices, certificates vs web

---

## Appendix A — Web ↔ mobile route matrix

URL paths are **web** (Next.js). **Mobile** is the `RootStackParamList` route name (or tab). `—` = no dedicated mobile screen yet or bundled elsewhere (confirm in code).

### Public & marketing (web-only or deep links)

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/` … `/about`, `/contact`, `/programs`, `/curriculum`, etc. | — | Marketing site; not in app shell. |
| `/login` | `Login` | |
| `/signup` | `Register` | |
| `/reset-password` | — | Deep link / forgot flow; see `ForgotPassword`. |
| `/online-registration`, `/student-registration` | `PublicStudentRegistration` | Align copy/fields with web. |
| `/school-registration` | `PublicSchoolRegistration` | |
| `/student/login` | — | Verify if distinct from main login. |

### Dashboard shell & profile

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard` | `Main` → `Dashboard` tab | Home. |
| `/dashboard/overview` | `Main` → `TAB_ROUTES.Dashboard` | **Reconciled:** treat as the **default portal home** → bottom-tab **Home** (`Dashboard`), same as `/dashboard` unless your web app defines overview as a distinct page (then compare that page’s widgets to `DashboardScreen`). **`SchoolOverview`** is **not** this row — it maps to `/dashboard/school-overview` below. |
| `/dashboard/profile` | `Profile` tab | |
| `/dashboard/settings` | `Settings` | |
| `/dashboard/notifications` | `Notifications` tab | |
| `/dashboard/messages` | `Messages` | |

### Learning, content, engagement

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/learning` | `Learn` tab | **Student-only** tab in mobile (`AppNavigator`); **Explore** lists programmes with ≥1 active unlocked course; enrolled **My courses** unchanged. Teachers use **`Courses`**. |
| `/dashboard/courses` | `Courses` | Web `/dashboard/courses/[id]`, `new`, `[id]/edit` → mobile **`CourseDetail`** + **`CourseEditor`** full-screen (`ROUTES.CourseEditor`, params `courseId` / `programId`). **`courses.is_locked`**: staff toggle in **`CourseEditor`**; students filtered in **Learn**, **`CourseDetail`**, student **Dashboard** next-lesson query. Regenerate types: **`npm run sync-types`** (needs `SUPABASE_ACCESS_TOKEN` in `.env`). |
| `/dashboard/lessons` | `Lessons` | Web `[id]`, `add`, `[id]/edit` → mobile **`LessonDetail`** + **`LessonEditor`** (`ROUTES.LessonEditor`: create/edit, params `lessonId` / `courseId` / `programId`). Entries: `Lessons` header **New**, `CourseDetail` **+ Lesson**, `LessonDetail` **Edit** (staff). **~partial** vs web: **visual layout** is JSON textarea, not web studio/Canva; see **Appendix D**. |
| `/dashboard/library` | `Library` | |
| `/dashboard/playground` | `Playground` | |
| `/dashboard/portfolio` | `Portfolio` | |
| `/dashboard/vault` | `Vault` | |
| `/dashboard/projects` | `Projects` | Web `new`, `[id]` → `ProjectDetail`. |
| `/dashboard/engage` | `Engage` | |
| `/dashboard/missions` | `Missions` | |
| `/dashboard/protocol` | `Protocol` | |
| `/dashboard/leaderboard` | `Leaderboard` | |
| `/dashboard/live-sessions` | `LiveSessions` | |
| `/dashboard/newsletters` | `Newsletters` | |

### Assignments, grades, reports, certificates

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/assignments` | `Assignments` | |
| `/dashboard/assignments/[id]` | `AssignmentDetail` | |
| `/dashboard/assignments/new` | `CreateAssignment` | |
| `/dashboard/assignments/[id]/edit` | `CreateAssignment` | Pass `assignmentId` (+ optional `classId` / `className`). `AssignmentDetail` → **Edit**. |
| `/dashboard/grades` | `Grades` | |
| `/dashboard/results` | `Reports` | **Reconciled:** web URL says “results”; mobile stack route is `Reports` (`ROUTES.Reports` → `ReportsScreen`). Same product surface; naming differs only in code. Parent-facing results use `/dashboard/parent-results` → `ParentResults`. |
| `/dashboard/reports/builder` | `ReportBuilder` | |
| `/dashboard/students/[id]/report` | `StudentReport` | |
| `/dashboard/certificates` | `Certificates` | |
| `/dashboard/certificates/management` | `ManageCertificates` | |

### CBT / exams

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/cbt` | `CBT` | Staff: **+ NEW**, card → **`CBTExamEditor`**; **Preview as learner** → `CBTExamination`. Students: take from hub. |
| `/dashboard/cbt/[id]/take` | `CBTExamination` | |
| `/dashboard/cbt/[id]` | `CBT` + `CBTExamEditor` | Web hub vs mobile list/editor split; same exam id. |
| `/dashboard/cbt/new`, `/dashboard/cbt/[id]/edit` | `CBTExamEditor` | Params `examId` optional (create). **`StaffCBTExamEditorScreen`**: `admin`, `teacher`. |
| `/dashboard/cbt/[id]/sessions/[sessionId]/grade` | `CBTGrading` | Params `sessionId`. Queue on **`CBT`** (staff). **`StaffCBTGradingScreen`**: `admin`, `teacher`. **`~partial`** until verified vs web grading page (fields, copy, edge cases). |

### People, classes, schools

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/students` | `Students` | |
| `/dashboard/students/bulk-register` | `BulkRegister` | |
| `/dashboard/students/bulk-enroll` | `EnrolStudents` | |
| `/dashboard/students/bulk-delete` | `WipeStudents` | |
| `/dashboard/students/card-builder` | `CardBuilder` | |
| `/dashboard/students/import` | `StudentImport` | **Mobile:** paste CSV → `students` pending via `studentImportService` (same columns as web import page). **Strict `done`:** diff vs web `/api/students` validation/errors. |
| `/dashboard/teachers` | `Teachers` | |
| `/dashboard/schools` | `Schools` | |
| `/dashboard/parents` | `Parents` | |
| `/dashboard/parents/add`, `edit/[id]` | `Parents` | **Mobile:** directory + create/update parent flows on `ParentsScreen` via `parentService` (not a separate stack route). **Strict parity:** confirm field set vs web parent add/edit pages. |
| `/dashboard/classes` | `Classes` | |
| `/dashboard/classes/add` | `AddClass` | |
| `/dashboard/classes/[id]` | `ClassDetail` | |
| `/dashboard/classes/[id]/edit` | `AddClass` | Pass `classId`. `ClassDetail` → **Edit class**; list edit remains modal on `Classes`. |
| `/dashboard/users` | `Users` | |
| `/dashboard/approvals` | `Approvals` | |

### School / admin analytics & ops

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/analytics` | `Analytics` | |
| `/dashboard/school-overview` | `SchoolOverview` | |
| `/dashboard/progress` | `Progress` | |
| `/dashboard/iot` | `IoT` | |
| `/dashboard/timetable` | `Timetable` | |
| `/dashboard/attendance` | `Attendance` | Web class attendance vs mobile `MarkAttendance` params. |

### Finance

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/payments` | `Payments` | |
| `/dashboard/payments/bulk` | `BulkPayments` | **Mobile:** wizard + archive (`BulkPaymentsScreen`); staff from `Payments` hub. **Strict `done`:** side-by-side with web bulk page (fields, batch tagging). |
| `/dashboard/payments/invoices/[id]/edit` | `Invoices` (detail modal) | **Mobile:** staff **EDIT** block on invoice modal — `due_date`, `notes`, `status` via `paymentService.patchInvoice` (web parity subset). Full line-item edit still **partial**. |
| `/dashboard/transactions` | `Transactions` | |

### Parent portal

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/my-children` | `MyChildren` | |
| `/dashboard/parent-results` | `ParentResults` | Pass `studentId` like web child context. |
| `/dashboard/parent-attendance` | `ParentAttendance` | |
| `/dashboard/parent-grades` | `ParentGrades` | |
| `/dashboard/parent-invoices` | `ParentInvoices` | |
| `/dashboard/parent-certificates` | `ParentCertificates` | |
| `/dashboard/parent-feedback` | `ParentFeedback` | |

### Programs & add flows

| Web path | Mobile | Notes |
|----------|--------|--------|
| `/dashboard/programs` | `Programs` | |
| `/dashboard/students` (add) | `AddStudent` | Web may use query/modal; mobile dedicated screen. |
| Add teacher / school (web routes TBD in sidebar) | `AddTeacher`, `AddSchool` | |

### Mobile screens without a clear single web dashboard path

| Mobile | Notes |
|--------|--------|
| `AI` | **Create** tab: **`lesson`** / **`lesson-notes`** use **`generateWebFullLesson`** / **`generateWebLessonNotesOnly`** (`src/lib/webLessonAi.ts`) aligned with web **`SYSTEM_PROMPT`** (`webLessonAiSystem.ts`). Chat tab separate. **Gaps vs web:** no SSE stream; OpenRouter key read from **`app_settings`** on device (web typically server route). |
| `MessageThread`, `ChildDetail` | Thread/child detail; confirm web URLs. |
| `TeacherDetail`, `StudentDetail`, `SchoolDetail`, `ParentDetail` | Detail routes under list pages on web. |
| `ExamTakingScreen` (if separate from `CBTExamination`) | Align with web take flow. |

---

## Appendix B — Priority gaps (from matrix)

High-impact **web pages with no dedicated mobile route** in the matrix above (needs product confirmation):

- ~~Assignment **edit** (teacher).~~ **`CreateAssignment`** + `assignmentId`; detail **Edit**.
- ~~CBT **authoring** (`new`, `[id]/edit`).~~ **`CBTExamEditor`**. ~~**session grading** (essay manual scores).~~ **`CBTGrading`** — **~partial** until side-by-side match with web grade page.
- ~~Lesson **create & edit** (staff).~~ **`LessonEditor`** — **remaining:** match web layout editor UX + confirm every post-save side effect vs web.
- **Course** **create & edit**: mobile **`CourseEditor`** stack screen (replacing list modal) — **remaining:** field-for-field and copy vs web `courses/new` & `edit`.
- ~~Class **edit**.~~ **`AddClass`** + `classId`; **Edit class** on `ClassDetail` (full form: dates, colour, status).
- ~~Students **import**.~~ **`StudentImport`** + **`studentImportService`** (CSV paste; pending `students` rows).
- Parents **add / edit** — **mobile:** `ParentsScreen` + `parentService`; **remaining:** field-for-field vs web `/dashboard/parents/add` and `edit/[id]`.
- ~~Payments **bulk**~~ **`BulkPayments`**; ~~invoice metadata edit~~ **staff invoice modal** (`patchInvoice` subset) — line items / full web invoice editor still open.

Next step: pick a gap, implement the **same** fields and Supabase calls as the web page, then mark the row `done` in a future pass.

---

## Appendix E — Workflow registry (50+ user-visible flows)

Each row is a **discrete product workflow** (auth, navigation, mutation, or read-heavy task). **`[x]`** = implemented on mobile with service-layer or screen wiring aligned to web intent; **`[~]`** = implemented but strict web sign-off or edge cases remain. **`[ ]`** = not started or blocked. *Counts: 55 rows; 54 `[x]`, 1 `[~]` — update this line when the matrix changes.*

| # | Workflow | Status |
|---|----------|--------|
| E-01 | Public student registration submit | [x] |
| E-02 | Public school registration submit | [x] |
| E-03 | Email/password login + session restore | [x] |
| E-04 | Forgot password request | [x] |
| E-05 | Register new portal account | [x] |
| E-06 | Onboarding complete → dashboard | [x] |
| E-07 | Role-based dashboard home load | [x] |
| E-08 | Notifications list + mark read | [x] |
| E-09 | Messages inbox + thread | [x] |
| E-10 | Profile view + edit | [x] |
| E-11 | Settings + notification preference matrix | [x] |
| E-12 | Staff approvals: student queue approve/reject | [x] |
| E-13 | Staff approvals: prospective (summer) approve/reject | [x] |
| E-14 | Staff approvals: school queue (admin) | [x] |
| E-15 | Students directory + search + CSV export | [x] |
| E-16 | Student import (CSV paste → pending students) | [x] |
| E-17 | Bulk register students (batch history) | [x] |
| E-18 | Bulk enrol into class (pick/create class, filters) | [x] |
| E-19 | Wipe / bulk delete students | [x] |
| E-20 | Student detail + parent linkage | [x] |
| E-21 | Add / edit student | [x] |
| E-22 | Teachers directory + add teacher | [x] |
| E-23 | Schools directory + school detail + teacher assign | [x] |
| E-24 | Parents directory + parent detail + activate | [x] |
| E-25 | Users (admin) directory | [x] |
| E-26 | Programs CRUD | [x] |
| E-27 | Classes list + add/edit class | [x] |
| E-28 | Class detail + roster + enrol from class | [x] |
| E-29 | Courses list + course editor + lock flag | [x] |
| E-30 | Course detail + lessons | [x] |
| E-31 | Lessons list + lesson editor + AI assist | [x] |
| E-32 | Assignments list + create/edit assignment | [x] |
| E-33 | Assignment detail + submit (student) | [x] |
| E-34 | Grades (staff aggregates) | [x] |
| E-35 | Reports list + report builder + publish | [x] |
| E-36 | Student report (multi-tab) | [x] |
| E-37 | Certificates issue + manage registry | [x] |
| E-38 | CBT hub + exam editor + preview | [x] |
| E-39 | CBT examination take + timer + submit (session-bound) | [x] |
| E-40 | CBT grading (essay scores + final %) | [x] |
| E-41 | Exam taking (alternate CBT UI, session-bound) | [x] |
| E-42 | Attendance mark + view | [x] |
| E-43 | Timetable view (scoped) | [x] |
| E-44 | Analytics (staff KPIs) | [x] |
| E-45 | School overview dashboard | [x] |
| E-46 | Progress (reports table, scoped) | [x] |
| E-47 | Payments hub + invoices list | [x] |
| E-48 | Bulk payments wizard | [x] |
| E-49 | Invoice staff quick-edit (`patchInvoice`) | [x] |
| E-50 | Paystack checkout + verify (multi-retry, resume-safe) | [~] |
| E-51 | Transactions list + status update | [x] |
| E-52 | Parent: my children + per-child stats | [x] |
| E-53 | Parent: results, grades, attendance, invoices, certificates | [x] |
| E-54 | Parent feedback submit + staff status | [x] |
| E-55 | Learn tab + library + engage + vault + playground + portfolio | [x] |

---

## Appendix D — Lesson editor & lesson AI (mobile implementation)

Use this when diffing against web `src/app/dashboard/lessons/*` and `src/app/api/ai/generate/route.ts` (or equivalent).

| Topic | Mobile | Web parity notes |
|--------|--------|------------------|
| **Screen** | `src/screens/dashboard/LessonEditorScreen.tsx` | Same outcomes target: title, description, notes, `content_layout`, type, duration, course linkage. |
| **Course editor** | `src/screens/dashboard/CourseEditorScreen.tsx`, `ROUTES.CourseEditor`, `StaffCourseEditorScreen` (`admin`, `teacher`) | Parity target: web `courses/new` & edit. **`is_locked`**: hide course from students (Learn, course resolve, dashboard next lesson). |
| **Supabase types** | `npm run sync-types` → `scripts/sync-supabase-types.cjs` | Set `SUPABASE_ACCESS_TOKEN` (see `.env.example`). |
| **Navigation** | `ROUTES.LessonEditor` in `AppNavigator` (`StaffLessonEditorScreen`: `admin`, `teacher`, `school`) | Align role rules with web if stricter. |
| **AI — system prompt** | `src/lib/webLessonAiSystem.ts` (`WEB_LESSON_AI_SYSTEM`) | Documented as copied from web route; **re-verify** when web changes. |
| **AI — user prompts & calls** | `src/lib/webLessonAi.ts` → `callAI` in `openrouter.ts` | Modes (academic/project/interactive), programme/course context, sibling titles, young-learner block; full lesson uses **`response_format: json_object`** via OpenRouter; lesson-notes **without** strict JSON mode + plain-text fallback. **`generateWebFullLessonWithRetry` / `generateWebLessonNotesOnlyWithRetry`** (+ `runWithLessonAiRetry`) for bounded retries on flaky proxy/JSON. |
| **AI — shared UX port** | `src/lib/lessonAiPort.ts` (`LESSON_AI_PRESET_SUBJECTS`, `lessonCoverImageUrl`) | Subject chips + Pollinations cover string aligned with **`AIScreen`** Create tab and **`LessonEditorScreen`** Quick Assistant. |
| **AI — integration layer** | `src/lib/lessonAiIntegration.ts` | **`runLessonAiFullGeneration`** / **`runLessonAiNotesGeneration`**, **`normalizeWebLessonPayload`**, **`requireLessonAiTopic`**, **`buildQuickLessonAiRequest`**, **`trackLessonAiEvent`** → `activity_logs`. **`LessonEditorScreen`** + **`AIScreen`** call this module. |
| **AI — Create tab** | `AIScreen.tsx` types `lesson` / `lesson-notes` call same generators | Other create types still use legacy prompts. |
| **Post-save** | `assignment-block` → `assignments` insert (dedupe by title); `lesson_plans` upsert from layout + objectives | **Confirm** web does the same tables/constraints. |
| **Known gaps** | No streaming UI; `content_layout` edited as **JSON**; API key on client via `app_settings` | Prefer edge function / server proxy for production keys. |

---

## Appendix C — Components, services, and “where parity lives”

### How web vs mobile are structured

| Layer | Web (`rillcod-academy`) | Mobile (`rillcod`) |
|--------|-------------------------|---------------------|
| **Routes** | `src/app/**/page.tsx` | `src/navigation/*` + `src/screens/**` |
| **Feature UI** | Many reusable pieces under `src/components/{admin,ai,assignments,certificates,dashboard,exam,finance,layout,library,parents,reports,studio,…}` | Mostly **inline** in screen files; small shared set in `src/components/ui/*` |
| **Data access** | `src/services/*.service.ts` (+ API routes) | **`src/services/*.service.ts`** for mirrored flows (see Phase 1 batch log); exceptions documented in Phase 1 |

Parity work should treat **web pages + their imports** as the spec: whatever a route composes from `components/` and `services/` is what mobile should match unless you explicitly accept a slimmer mobile UX.

### Web component domains (inventory)

Under `src/components/` the web app groups UI by product area, including:

- **`layout/`** — `DashboardShell`, `DashboardNavigation`, `AppProviders`, marketing `Footer` (portal chrome and nav; compare to mobile tabs + stack).
- **`dashboard/`** — `AdminDashboard`, `TeacherDashboard`, `SchoolDashboard`, `StudentDashboard`, `ParentDashboard` (role home **sections and links**; compare to `DashboardScreen` config).
- **`exam/`** — e.g. `ExamInterface` (compare to `ExamTakingScreen` / `CBTExaminationScreen`).
- **`assignments/`** — e.g. `BlockSequencer` and related builders (compare to assignment detail / create on mobile).
- **`reports/`** — `ReportCard`, `ModernReportCard`, `PrintableReport` (compare to report list, builder, student report).
- **`certificates/`** — previews and `CertificateTemplates` (compare to `CertificatesScreen` / `ManageCertificatesScreen`).
- **`finance/`** — e.g. `SmartDocument` (compare to payments, invoices, transactions).
- **`ai/`** — `StudyAssistant`, `LessonAITools`, etc. (compare to `AIScreen`).
- **`studio/`** — `IntegratedCodeRunner`, labs (compare to `PlaygroundScreen`, `PortfolioScreen`, parts of `Learn`).
- **`visualizer/`**, **`forum/`**, **`chat/`**, **`library/`** — compare to `Engage`, `Messages`, `Library`, `Vault`.
- **`parents/`** — e.g. `ParentForm` (compare to parent onboarding / linking flows on mobile).
- **`admin/`**, **`iot/`**, **`qr/`**, **`pwa/`**, **`share/`** — approvals, devices, QR, push, share modals (map to `ApprovalsScreen`, `IoTScreen`, push hooks, etc.).
- **`ui/`** — shared primitives (buttons, cards, syntax highlight); mobile equivalent is partly `PremiumButton`, `PremiumInput`, `GlassCard`, headers, **not** a full 1:1 set.

### Mobile shared UI today (`src/components/`)

| Component | Role |
|-----------|------|
| `ui/ScreenHeader`, `ui/IconBackButton`, `ui/AdminCollectionHeader` | Headers / back / admin list chrome |
| `ui/PremiumButton`, `ui/PremiumInput` | Form + CTA primitives |
| `ui/GlassCard` | Card container |
| `ui/RoleGuard` | Access control wrapper |
| `ui/SectionErrorBoundary` | Dashboard section resilience |
| `ui/SemanticIcon` | Icon mapping |
| `ui/OfflineBanner` | Connectivity |
| `PresenceList` | Presence feature |

Anything **not** listed here is usually implemented **inside** the matching screen file (e.g. class roster UI in `ClassDetailScreen.tsx`). When web pulls logic from `components/exam/ExamInterface.tsx`, the parity task is that screen + behavior, not “missing file with same name.”

### Suggested workflow for component-level parity

1. Open the **web route** (Appendix A) → note which **`src/components/*`** and **`src/services/*`** files that page imports.
2. Open the **mobile screen** → list `supabase` calls and local state.
3. Diff: missing steps, fields, guards, or side effects → implement on mobile (extract a `src/components/...` or `src/hooks/...` only when the same UI repeats across mobile screens).
4. Mark the **route row** in Appendix A and optionally add a one-line note under the domain in this appendix when a web component bundle is fully mirrored.

---

## Appendix F — Web → mobile component port registry (100+ rows)

Authoritative table: **`MOBILE_WEB_COMPONENT_PORT_REGISTRY.md`** at repo root (`F-001`…). Status columns: **done** / **partial** / **pending** / **N/A** (web-only). Update that file when a web bundle is signed off on mobile.

### Optional future hygiene (non-blocking)

- Extract mobile **feature** components (e.g. exam footer, report preview) when they stabilize, mirroring web folder names loosely (`components/exam`, `components/reports`) for easier cross-repo grepping.
- Consider a thin **`src/services/`** on mobile that wraps the same table/RPC names as web services for hot paths (payments, CBT submit, approvals).

---

## Phase 2 — Mobile extensions (after parity sign-off)

These improve mobile but are **not** substitutes for web mirror work:

- [x] `extension` Aggregated unread counters (notifications + messages + newsletters) on nav/dashboard
- [x] `extension` Dashboard section-level error boundary (stability)
- [x] `extension` Teacher workload lanes (urgent / due soon / routine) — enhance grading UX once assignment flow matches web
- [x] `extension` School trend delta cards (admissions / collections / graded flow) — enhance analytics once school dashboards match web
- [x] `extension` Parent per-child academic trend cards — enhance parent home once parent web parity is done
- [x] `extension` Removed More/Workspace tab; items live on named routes
- [x] `extension` Professional labels instead of internal code glyphs on dashboard

---

## Batch 5 — Schema-backed mobile depth (no new SQL migrations)

Services and UI only; tables/columns already exist in `src/types/supabase.ts` and shipped migrations.

- [x] `service` `notification-preferences.service.ts` — load/upsert `notification_preferences` by `portal_user_id`
- [x] `screen` `SettingsScreen` — push, email, SMS, assignment reminders, grades, announcements, discussions, marketing toggles persisted to Supabase
- [x] `service` `app-settings.service.ts` — boolean probe for non-empty `app_settings` keys (no secret values in UI)
- [x] `screen` `AIScreen` — banner when `openrouter_api_key` is empty so users know cloud AI is not configured
- [x] `service` `dashboard.service` — `listAnnouncementsForAudience` reads `announcements` with school + role filtering in app layer
- [x] `screen` `DashboardScreen` — announcements strip for all roles when active rows match audience
- [x] `service` `dashboard.service` — `listUpcomingLiveSessionsForStudent` joins enrolments → `live_sessions` by `program_id`
- [x] `screen` `DashboardScreen` — student “Upcoming live sessions” list with join link or fallback to `LiveSessions` route
- [x] `service` `dashboard.service` — `student_progress` incomplete count in `getStudentDashboardSnapshot`
- [x] `screen` `DashboardScreen` — student “Courses in flight” tile from incomplete `student_progress` rows
- [x] `service` `registration.service` — teacher-scoped `listRecentBatches` via `created_by` when role is teacher
- [x] `screen` `BulkRegisterScreen` — passes `role` + `createdByUserId` into batch history load
- [x] `service` `gamification.service` — `listRecentPointTransactions` for `point_transactions` timeline
- [x] `screen` `ProfileScreen` — student “Recent XP” card from point transaction history
- [x] `service` `library.service` — `getMyContentRating` helper (pair with existing `rateContent`)
- [x] `screen` `LibraryScreen` — show `rating_average` / `rating_count` from `content_library`
- [x] `screen` `LibraryScreen` — 1–5 star modal rating via `content_ratings` + aggregate refresh in `rateContent`
- [x] `parity` Student home surfaces `announcements`, `live_sessions`, and `student_progress` without raw `supabase` in the screen file
- [x] `parity` Settings notification matrix aligned to `notification_preferences` columns
- [x] `parity` Bulk registration history respects teacher batch ownership (`registration_batches.created_by`)
- [x] `extension` Library card layout separates “open resource” from “Rate” to avoid gesture conflicts
- [x] `extension` Dashboard student mission grid gains explicit progress course count (schema-driven stat)
- [x] `extension` AI Studio surfaces deployment readiness from `app_settings` read policy
- [x] `extension` Profile gamification depth beyond badges (`user_badges` already surfaced; `point_transactions` added)
- [x] `extension` Cross-role announcement visibility uses `target_audience` + optional `school_id`
- [x] `extension` Live session rows expose programme name via `programs` relation select
- [x] `extension` Registration batch summaries include `created_by` in the typed `RegistrationBatchSummary` shape
- [x] `hygiene` `npx tsc --noEmit` clean after Batch 5 wiring
- [x] `extension` Student dashboard loads announcements in the same refresh cycle as role-specific stats (post-`loadData` fetch)
- [x] `extension` Library list remaps `content_library` rating fields into list state for consistent filtering with search/type chips

---

## Batch 8 — Lesson AI robustness + port registry

- [x] `lib` `webLessonAi.ts` — `runWithLessonAiRetry`, `generateWebFullLessonWithRetry`, `generateWebLessonNotesOnlyWithRetry` (bounded backoff).
- [x] `lib` `lessonAiPort.ts` — preset subject list + `lessonCoverImageUrl` (Pollinations) shared with Create / editor.
- [x] `lib` **`lessonAiIntegration.ts`** — `runLessonAiFullGeneration`, `runLessonAiNotesGeneration`, `normalizeWebLessonPayload`, `requireLessonAiTopic`, `buildQuickLessonAiRequest`, `trackLessonAiEvent` (`activity_logs`).
- [x] `screen` `LessonEditorScreen` / `AIScreen` — wired through **`lessonAiIntegration`**; subject quick-picks; editor cover thumbnail when topic + subject set.
- [x] `lib` **`reportShare.ts`** — text summary + share sheet; **`ReportBuilderScreen`** “Share report (text)” beside PDF export.
- [x] `doc` **Appendix F** — registry rows **F-005** / **F-016** marked **done** where integrated; “Mobile integration modules” table in registry.

---

## Batch 7 — Workflow registry + payment/CBT hardening

- [x] `doc` **Appendix E** — 55 named end-user workflows (`E-01`…`E-55`) with `[x]` / `[~]` matrix for parity tracking (≥50 `[x]` flows).
- [x] `service` `cbt.service` — `prepareStudentExamAttempt` (resume open `cbt_sessions` row or `startExam`); `checkSession` uses latest row by `created_at`.
- [x] `screen` `ExamTakingScreen` / `CBTExaminationScreen` — load via `prepareStudentExamAttempt`; submit with `sessionId`; duplicate “already completed” gate on **`CBTExaminationScreen`**.
- [x] `service` `cbt.service` — `submitExam` result includes `manualGradingRequired` alias for UI.
- [x] `hook` `usePaystack` — staggered verify retries; “not confirmed yet” alert only when `fromCheckoutFinish` (success URL), not on cold resume spam.

---

## Legacy checklist (rolled into Phase 1 / 2 above)

### Cross-cutting (historical)

- [x] `done` Removed placeholder/hardcoded broadcast blocks from dashboard

### Admin

- [x] `done` Admin-only access for schools/users/approvals/add-school/add-teacher/wipe-students
- [x] `done` Admin-only card builder and programs routes
- [x] `done` Admin dashboard quick actions + extended nav links (`ADMIN_NAV_LINKS`, home actions)
- [x] `done` Pending approvals visibility block
- [~] `partial` Admin tooling on mobile — see **Per role** Admin; strict `done` only after web workflow verification
- [~] `partial` Exact web ordering of all admin tools in dashboard/action blocks vs `AdminDashboard`
- [ ] `pending` Admin finance depth vs web (bulk pay, invoice edit, beyond list + revenue summary)

### Teacher

- [x] `done` Teacher analytics access (`admin|school|teacher`) aligned with web policy
- [x] `done` Staff route guards for lessons/**`LessonEditor`**/**`CourseEditor`**/**`CBTExamEditor`**/**`CBTGrading`**/add-class/create-assignment/report-builder
- [x] `done` Teacher action center (queues, unread, today sessions) — **re-verify counts vs web** when comparing `TeacherDashboard`
- [x] `done` Teacher quick links (`TEACHER_QUICK_LINKS`) — **reorder vs web nav** if product reorders web sidebar
- [~] `partial` Teacher loop on mobile — see **Per role** Teacher (**`CBTGrading`** implemented; strict `done` requires web verification)

### School

- [x] `done` Explicit school dashboard config (no fallback to student)
- [x] `done` School operations center + quick links — **verify copy and destinations vs web**
- [x] `done` School route guards for detail and examination screens

### Student

- [x] `done` Student mission + study intelligence — **replace or gate hardcoded “lab session” card until web equivalent exists**
- [x] `done` Student access guards for portfolio/playground + core routes
- [~] `partial` Full parity for web student dashboard modules (all cards/sections)
- [ ] `pending` Due-date urgency / risk scoring — **extension after** web assignment UX parity

### Parent

- [x] `done` Parent route guards and quick links
- [x] `done` Parent child row actions (navigate with `studentId` where web passes child context — verify)

### Workspace / navigation

- [x] `done` Legacy `MoreScreen` removed from codebase

---

## Current sprint focus (parity-first)

1. ~~Use **Appendix A** as the working map; reconcile `/dashboard/overview` and `/dashboard/results` vs mobile naming.~~ **Done** in matrix notes (overview → `Dashboard` tab; results → `Reports` route).
2. **Strict parity:** Run **web ↔ mobile verification** for **admin** and **teacher** (workflows, not just routes). Record sign-off when a surface truly matches web; until then rows stay **`partial`**.
3. **Next roles:** **School**, then **student**, then **parent** — Appendix A + **Appendix C** (web components + services).
4. Close **Appendix B** gaps with matching Supabase behavior to web. **Lesson editor:** Appendix D + web lesson pages; **courses:** field-for-field vs web edit.
5. ~~Wire **`ROUTES`** in `AppNavigator` and migrate string navigations to remove drift.~~ **Done** — see Phase 1 cross-cutting `Shared typed route constants`.
6. Only then: extend with Phase 2 items or new mobile-only ideas.

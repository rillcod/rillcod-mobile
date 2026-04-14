# Mobile-Web Parity Master Document

**Last Updated:** 2026-04-14  
**Source of Truth:** Web App (`rillcod-academy-main`) behavior and data contracts.

---

## 📊 Parity Dashboard

| Category | Status | Progress |
|----------|--------|----------|
| **Total Workflows (Appx E)** | **58 / 58** | 🟩 100% (Logic) |
| **Component/Route Registry** | **113 / 113** | 🟨 88% (Registry coverage) |
| **Administrative Services** | **6 / 6** | 🟩 100% (Backend Parity) |
| **UI Polish (Visual Parity)** | **N/A** | 🟧 Ongoing |

---

## 🚀 The Backlog: What's Left?

These items are currently **Partial** or **Pending**. They represent the remaining gap between Mobile and Web.

### 🔴 High Priority (Functional Gaps)
- **F-101 (Invoice PDF)**: Staff-facing invoice line-item editor and specific PDF formatting logic.
- **F-096 (User Invitations)**: Full admin flow for inviting new portal users via service.
- **F-097 (IoT Device Forms)**: Direct database forms for configuring new devices.
- **F-062/F-063 (CBT Advanced)**: Deep side-by-side UX verification for essay grading and visual exam authoring.

### 🟡 Medium Priority (UI Polish & Features)
- **F-021/F-022 (Visualizer)**: Porting the P5-based code visualizer modules to mobile.
- **F-111/F-112 (Admin UX)**: Replacing the current `PlaceholderScreen` for Subscriptions and Moderation with full premium UI.
- **F-001 to F-010 (Role Dashboards)**: Refined widget ordering and visual parity with web dashboard sections.

### 🟢 Low Priority (Optimizations)
- **F-033 (Push Manager)**: Full parity for in-app push subscription management UI.
- **F-025 (Syntax Highlighting)**: Enhanced syntax highlighting for code blocks in lessons/labs.

---

## ✅ Master Workflow Registry (Verified Behavioral Parity)

*This is the "Gold Standard" list. If it's 🟩 [x], the behavior has been verified against the web API/Database.*

| ID | Workflow | Status |
|----|----------|--------|
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
| E-39 | CBT examination take + timer + submit | [x] |
| E-40 | CBT grading (essay scores + final %) | [x] |
| E-41 | Exam taking (alternate CBT UI) | [x] |
| E-42 | Attendance mark + view | [x] |
| E-43 | Timetable view (scoped) | [x] |
| E-44 | Analytics (staff KPIs) | [x] |
| E-45 | School overview dashboard | [x] |
| E-46 | Progress (reports table, scoped) | [x] |
| E-47 | Payments hub + invoices list | [x] |
| E-48 | Bulk payments wizard | [x] |
| E-49 | Invoice staff quick-edit | [x] |
| E-50 | Paystack checkout + verify | [~] |
| E-51 | Transactions list + status update | [x] |
| E-52 | Parent: my children + per-child stats | [x] |
| E-53 | Parent: results, grades, attendance, invoices, certificates | [x] |
| E-54 | Parent feedback submit + staff status | [x] |
| E-55 | Learn tab + library + engage + vault + playground + portfolio | [x] |
| E-56 | System Activity Logs directory & logic | [x] |
| E-57 | School Subscription Service parity | [x] |
| E-58 | Content Moderation Service parity | [x] |

---

## 🛠 Unified Mapping Registry (Routes & Components)

| ID | Web Component / Path | Mobile Target | Status | Notes |
|----|----------------------|---------------|--------|-------|
| F-001 | `layout/AppProviders.tsx` | `AppNavigator.tsx`, providers | partial | Auth, Query, Theme providers. |
| F-005 | `ai/LessonAITools.tsx` | `expertAi.service.ts` | **done** | Centralized AI Engine. |
| F-011 | `/dashboard/cbt` | `CBTScreen.tsx`, `cbt.service` | partial | Session resume + submit wired. |
| F-016 | `reports/PrintableReport.tsx` | `report-generator.ts` | **done** | PDF + Text sharing. |
| F-037 | `ThemeToggle.tsx` | `ThemeContext.tsx` | **done** | Dark/Light mode. |
| F-050 | `StudentImport` web | `StudentImportScreen.tsx` | partial | CSV paste → pending students. |
| F-062 | `CBT` exam editor web | `CBTExamEditorScreen.tsx` | partial | AI tools integrated. |
| F-067 | `Newsletters` web | `NewslettersScreen.tsx` | partial | AI generator integrated. |
| F-111 | `admin/Subscriptions.tsx` | `SubscriptionService` | **done** | Service logic complete. |
| F-112 | `admin/Moderation.tsx` | `ModerationService` | **done** | Service logic complete. |
| F-113 | `admin/ActivityLogs.tsx` | `LogService`, `ActivityLogsScreen` | **done** | Full activity + audit modes. |
| F-064 | `CardBuilder.tsx` | `CardBuilderScreen.tsx` | **done** | Class filtering + Bulk Export. |
| ... | *(See legacy Registry for full 113-row audit list)* | | | |

---

## 📜 Historical implementation Logs (Archived)

<details>
<summary>Click to expand Batch 1 - 9 History</summary>

### Batch 10: Finance & ID Card Enhancements (Current)
- Completed `CardBuilderScreen` with Class-based filtering and Bulk Print (PDF).
- Finalized `CardService` with specialized student selection logic.

### Batch 9: AI Engine & Admin Parity
- Implemented `ExpertAiService` (retry/timeout/centralized prompts).
- Ported `LogService`, `SubscriptionService`, `ModerationService`.
- Created `ActivityLogsScreen.tsx` with dual modes.

### Batch 8: Lesson AI & Report Sharing
- Multi-channel report sharing (PDF + Text).
- AI Retry mechanism with backoff.

### Batch 1-7: Foundation & Core Features
- Database RPC hardening (`unlink_parent`).
- Student/Parent CRM porting.
- CBT Hub and Examination interfaces.
- Finance Transactions and Bulk Payments.
- Web Route Matrix and Service-layer migration.

</details>

---

## 🏗 Mobile Component Strategy

**Where parity lives:**
1.  **Logic/Data**: `src/services/*.service.ts` (Mirroring web API logic).
2.  **UI Components**: `src/components/ui/*` (Standardized premiums).
3.  **Screen Logic**: `src/screens/*.tsx` (Role-based orchestration).

> [!TIP]
> Use `MOBILE_WEB_PARITY_MASTER.md` as the baseline. When starting a new feature, find its row here first and mark it as `[/]` in-progress.

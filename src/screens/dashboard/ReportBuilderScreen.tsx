import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { generateAndShareReportPDF } from '../../lib/report-generator';
import { buildStudentProgressReportTextSummary, sharePlainText } from '../../lib/reportShare';
import { useAuth } from '../../contexts/AuthContext';
import {
  reportBuilderService,
  type StudentProgressReportInsert,
} from '../../services/report-builder.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'session' | 'pick' | 'edit';

interface SessionConfig {
  instructor_name: string;
  report_date: string;
  report_term: string;
  report_period: string;
  course_name: string;
  school_name: string;
  section_class: string;
  current_module: string;
  next_module: string;
  course_duration: string;
  learning_milestones: string[];
  school_section: string;
  fee_label: string;
  fee_amount: string;
  show_payment_notice: boolean;
}

interface StudentForm {
  theory_score: string;
  practical_score: string;
  attendance_score: string;
  participation_score: string;
  participation_grade: string;
  projects_grade: string;
  homework_grade: string;
  proficiency_level: string;
  key_strengths: string;
  areas_for_growth: string;
  instructor_assessment: string;
  is_published: boolean;
}

interface StudentRow { id: string; full_name: string; email: string; school_name: string | null; section_class: string | null; school_id?: string | null }

// ── Constants ─────────────────────────────────────────────────────────────────
const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term', 'Mid-Term', 'Annual', 'Termly'];
const PERIOD_PRESETS = [
  '2024/2025 First Term', '2024/2025 Second Term', '2024/2025 Third Term',
  '2025/2026 First Term', '2025/2026 Second Term', '2025/2026 Third Term',
  '2026/2027 First Term', '2026/2027 Second Term', '2026/2027 Third Term',
];
const DURATION_OPTIONS = ['Termly', '4 weeks', '6 weeks', '8 weeks', '10 weeks', '12 weeks', '3 months', '6 months', 'Full Year'];
const GRADE_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'];
const PROFICIENCY_OPTIONS = ['beginner', 'intermediate', 'advanced'];

const MILESTONE_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Completed all assigned coursework for the term',
    'Demonstrated strong problem-solving skills',
    'Successfully built and submitted a project',
    'Showed consistent attendance and participation',
    'Improved coding speed and accuracy significantly',
    'Passed all assessments above the pass mark',
  ],
  python: [
    'Mastered Python syntax: variables, loops, and functions',
    'Built a working Python project (calculator / quiz / game)',
    'Understood object-oriented programming concepts',
    'Successfully used Python libraries (math, random)',
    'Debugged and fixed at least 3 real code errors',
  ],
  web: [
    'Built a fully styled HTML/CSS webpage from scratch',
    'Applied responsive design using Flexbox or Grid',
    'Added interactivity to a page using JavaScript',
    'Deployed a live website (GitHub Pages or Netlify)',
    'Understood DOM manipulation and event handling',
  ],
  ai: [
    'Understood core concepts of Artificial Intelligence',
    'Trained a basic classification model using real data',
    'Explored AI tools and their real-world applications',
    'Completed a machine learning project end-to-end',
    'Understood bias, fairness, and ethics in AI',
  ],
  robotics: [
    'Assembled and programmed an Arduino-based circuit',
    'Controlled LEDs, motors, and sensors using code',
    'Built a functional robot prototype for a real task',
    'Understood basic electronics: voltage, current, resistance',
  ],
  scratch: [
    'Created an interactive Scratch animation story',
    'Built a working game using Scratch sprites and blocks',
    'Used loops, conditions, and events in Scratch',
    'Demonstrated computational thinking through block logic',
  ],
};

function getMileSuggestions(course: string): string[] {
  const l = course.toLowerCase();
  if (l.includes('python')) return MILESTONE_SUGGESTIONS.python;
  if (l.includes('web') || l.includes('html')) return MILESTONE_SUGGESTIONS.web;
  if (l.includes('ai') || l.includes('machine')) return MILESTONE_SUGGESTIONS.ai;
  if (l.includes('robot') || l.includes('arduino')) return MILESTONE_SUGGESTIONS.robotics;
  if (l.includes('scratch')) return MILESTONE_SUGGESTIONS.scratch;
  return MILESTONE_SUGGESTIONS.default;
}

function calcOverall(theory: string, practical: string, attendance: string, participation: string) {
  // Web-parity formula: always fixed 40/20/20/20 weights, unset scores are treated as 0.
  const th = parseFloat(theory);
  const pr = parseFloat(practical);
  const at = parseFloat(attendance);
  const pa = parseFloat(participation);
  const weighted =
    (isNaN(th) ? 0 : th) * 0.4 +
    (isNaN(pr) ? 0 : pr) * 0.2 +
    (isNaN(at) ? 0 : at) * 0.2 +
    (isNaN(pa) ? 0 : pa) * 0.2;
  return Math.round(weighted);
}

function calcGrade(score: number | null): string {
  if (score == null) return '—';
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/** Academic year label (Sept–Aug) + term — aligns with period presets. */
function buildDefaultReportPeriod(reportDate: string, reportTerm: string): string {
  const d = new Date(`${reportDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth();
  const startYear = m >= 8 ? y : y - 1;
  const endYear = startYear + 1;
  return `${startYear}/${endYear} ${reportTerm.trim()}`;
}

function pickReportForSession(
  rows: any[] | null | undefined,
  reportTerm: string,
  courseName: string,
): any | null {
  if (!rows?.length) return null;
  const term = reportTerm.trim();
  const courseKey = courseName.trim().toLowerCase();
  const termRows = rows.filter((r) => (r.report_term ?? '').trim() === term);
  if (!termRows.length) return null;
  if (courseKey) {
    return termRows.find((r) => (r.course_name ?? '').trim().toLowerCase() === courseKey) ?? null;
  }
  // Same term, multiple courses — require course name so we don't open the wrong report.
  if (termRows.length > 1) return null;
  return termRows[0];
}

const GRADE_COLOR: Record<string, string> = {
  'A+': COLORS.success, A: COLORS.success,
  B: '#10b981', C: COLORS.warning, D: '#f97316', F: COLORS.error, '—': COLORS.textMuted,
};

// ── Helper components ─────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: any) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.multi]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCapitalize="sentences"
      />
    </View>
  );
}

function Picker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TouchableOpacity style={f.picker} onPress={() => setOpen(v => !v)}>
        <Text style={[f.pickerText, !value && { color: COLORS.textMuted }]}>{value || 'Select…'}</Text>
        <Text style={f.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={f.drop}>
          {options.map(o => (
            <TouchableOpacity key={o} onPress={() => { onChange(o); setOpen(false); }} style={[f.dropItem, value === o && f.dropActive]}>
              <Text style={[f.dropText, value === o && f.dropActiveText]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function ScoreInput({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: string }) {
  const num = parseFloat(value);
  const pct = isNaN(num) ? 0 : Math.min(num, 100);
  return (
    <View style={si.wrap}>
      <View style={si.top}>
        <Text style={si.label}>{label}</Text>
        <TextInput
          style={[si.input, { borderColor: color + '60' }]}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.textMuted}
          maxLength={5}
        />
      </View>
      <View style={si.track}>
        <MotiView
          animate={{ width: `${pct}%` }}
          transition={{ type: 'timing', duration: 300 }}
          style={[si.fill, { backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReportBuilderScreen({ navigation, route }: any) {
  const { studentId: prefStudentId, studentName: prefStudentName } = (route.params ?? {}) as { studentId?: string; studentName?: string };
  const { profile } = useAuth();
  const isBuilder = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';
  const isSchoolScoped = profile?.role === 'teacher' || profile?.role === 'school';

  const [step, setStep] = useState<Step>(prefStudentId ? 'edit' : 'session');
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    instructor_name: profile?.full_name ?? '',
    report_date: new Date().toISOString().slice(0, 10),
    report_term: 'First Term',
    report_period: '',
    course_name: '',
    school_name: profile?.school_name ?? '',
    section_class: '',
    current_module: '',
    next_module: '',
    course_duration: 'Termly',
    learning_milestones: [],
    school_section: '',
    fee_label: '',
    fee_amount: '',
    show_payment_notice: false,
  });

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionCollapsed, setSessionCollapsed] = useState(false);
  const [signalsBanner, setSignalsBanner] = useState<string | null>(null);

  const [form, setForm] = useState<StudentForm>({
    theory_score: '0',
    practical_score: '0',
    attendance_score: '0',
    participation_score: '0',
    participation_grade: 'Good',
    projects_grade: 'Good',
    homework_grade: 'Good',
    proficiency_level: 'intermediate',
    key_strengths: '',
    areas_for_growth: '',
    instructor_assessment: '',
    is_published: false,
  });

  const setSession = (key: keyof SessionConfig) => (val: any) =>
    setSessionConfig(s => ({ ...s, [key]: val }));
  const setF = (key: keyof StudentForm) => (val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  // Auto-fill report period when empty (clear the field to regenerate after changing date/term).
  useEffect(() => {
    if (sessionConfig.report_period.trim()) return;
    const next = buildDefaultReportPeriod(sessionConfig.report_date, sessionConfig.report_term);
    if (!next) return;
    setSessionConfig((s) => (s.report_period.trim() ? s : { ...s, report_period: next }));
  }, [sessionConfig.report_date, sessionConfig.report_term, sessionConfig.report_period]);

  // Load students scoped by role
  useEffect(() => {
    if (step !== 'pick' && !prefStudentId) return;
    setLoadingStudents(true);

    const isTeacher = profile?.role === 'teacher';
    const isSchool = profile?.role === 'school';

    (async () => {
      try {
        const data = await reportBuilderService.loadStudentPickerRows({
          role: profile?.role,
          userId: profile?.id,
          schoolId: profile?.school_id,
        });
        setStudents(data as StudentRow[]);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [step, profile, prefStudentId]);

  // Prefill if navigated with studentId
  useEffect(() => {
    if (!prefStudentId) return;
    reportBuilderService
      .getStudentRowForReport(prefStudentId)
      .then((data) => {
        const row: StudentRow = data
          ? (data as StudentRow)
          : { id: prefStudentId, full_name: prefStudentName ?? '', email: '', school_name: null, section_class: null, school_id: null };
        selectStudent(row);
      })
      .catch(() => {
        const row: StudentRow = {
          id: prefStudentId,
          full_name: prefStudentName ?? '',
          email: '',
          school_name: null,
          section_class: null,
          school_id: null,
        };
        selectStudent(row);
      });
  }, [prefStudentId, prefStudentName]);

  const applySmartHints = useCallback(async (portalUserId: string) => {
    try {
      const {
        submissions: subs,
        attendance: att,
        cbtSessions,
        projectCount,
        courseAssignmentTotal,
        courseGradedSubmissionCount,
        courseSubmissionGrades,
      } = await reportBuilderService.fetchSmartHintSignals(portalUserId, sessionConfig.course_name);
      const raw = (subs ?? []).map((r: any) => Number(r.grade)).filter((g) => !Number.isNaN(g));
      let practical = 0;
      let theory = 0;
      const examSessions = (cbtSessions ?? []).filter((r: any) => {
        const examType = r?.cbt_exams?.metadata?.exam_type;
        return !examType || examType === 'examination';
      });
      const evalSessions = (cbtSessions ?? []).filter((r: any) => r?.cbt_exams?.metadata?.exam_type === 'evaluation');
      const cbtExamScore = Number(examSessions?.[0]?.score ?? 0);
      const cbtEvalScore = Number(evalSessions?.[0]?.score ?? 0);
      const normalizeGradesToPercent = (grades: number[]) => {
        if (!grades.length) return null;
        const max = Math.max(...grades);
        const scaled = grades.map((g) => (max <= 10 ? g * 10 : max <= 20 ? g * 5 : g));
        const avg = scaled.reduce((a, b) => a + b, 0) / scaled.length;
        return Math.min(100, Math.max(0, Math.round(avg)));
      };
      const scopedAssignmentAvg = normalizeGradesToPercent(courseSubmissionGrades ?? []);
      const globalAssignmentAvg = normalizeGradesToPercent(raw);
      if (globalAssignmentAvg != null) {
        practical = globalAssignmentAvg;
        theory = Math.min(100, Math.max(0, practical - 3));
      }
      if (!Number.isNaN(cbtExamScore) && cbtExamScore > 0) {
        theory = Math.min(100, Math.max(0, Math.round(cbtExamScore)));
      }
      if (!Number.isNaN(cbtEvalScore) && cbtEvalScore > 0) {
        practical = Math.min(100, Math.max(0, Math.round(cbtEvalScore)));
      } else if (scopedAssignmentAvg != null) {
        // Web parity: Practical/Evaluation falls back to assignment average when no CBT evaluation score exists.
        practical = scopedAssignmentAvg;
      }
      const rows = att ?? [];
      const present = rows.filter((r: any) => r.status === 'present').length;
      const attPct = rows.length ? Math.round((present / rows.length) * 100) : null;
      const assignmentPct =
        courseAssignmentTotal != null && courseAssignmentTotal > 0 && courseGradedSubmissionCount != null
          ? Math.round((courseGradedSubmissionCount / courseAssignmentTotal) * 100)
          : null;
      const projectPct = Math.min(100, Math.round((Number(projectCount ?? 0) / 3) * 100));
      const partPct = projectPct > 0 ? projectPct : (attPct != null ? Math.min(100, Math.max(0, Math.round(attPct * 0.95))) : null);

      setForm((f) => ({
        ...f,
        practical_score: ((raw.length || cbtEvalScore > 0 || scopedAssignmentAvg != null) && practical > 0) ? String(practical) : f.practical_score,
        theory_score: (raw.length || cbtExamScore > 0) ? String(theory) : f.theory_score,
        // Web parity maps the Assignment component to assignment completion percentage.
        attendance_score: assignmentPct != null ? String(Math.min(100, Math.max(0, assignmentPct))) : f.attendance_score,
        participation_score: partPct != null ? String(partPct) : f.participation_score,
      }));
      if (raw.length || rows.length || cbtExamScore > 0 || cbtEvalScore > 0 || projectPct > 0) {
        setSignalsBanner('Scores prefilled from CBT, graded assignments, attendance, and project engagement signals (adjust as needed).');
      }
    } catch {
      /* non-blocking */
    }
  }, [sessionConfig.course_name]);

  const selectStudent = useCallback(async (student: StudentRow) => {
    setSelectedStudent(student);
    setStep('edit');
    setLoadingReport(true);
    setSignalsBanner(null);

    const rows = await reportBuilderService.listProgressReportsForStudent(student.id, 25);

    const data = pickReportForSession(rows, sessionConfig.report_term, sessionConfig.course_name);

    if (data) {
      setExistingReport(data);
      setSessionConfig((s) => ({
        ...s,
        instructor_name: data.instructor_name ?? s.instructor_name,
        report_date: data.report_date?.slice(0, 10) ?? s.report_date,
        report_term: data.report_term ?? s.report_term,
        report_period: data.report_period ?? s.report_period,
        course_name: data.course_name ?? s.course_name,
        school_name: data.school_name ?? s.school_name,
        section_class: data.section_class ?? s.section_class,
        current_module: data.current_module ?? s.current_module,
        next_module: data.next_module ?? s.next_module,
        course_duration: data.course_duration ?? s.course_duration,
        learning_milestones: Array.isArray(data.learning_milestones) ? data.learning_milestones : s.learning_milestones,
        school_section: data.school_section ?? s.school_section,
        fee_label: data.fee_label ?? s.fee_label,
        fee_amount: data.fee_amount != null ? String(data.fee_amount) : s.fee_amount,
        show_payment_notice: data.show_payment_notice ?? s.show_payment_notice,
      }));
      setForm({
        theory_score: String(data.theory_score ?? '0'),
        practical_score: String(data.practical_score ?? '0'),
        attendance_score: String(data.attendance_score ?? '0'),
        participation_score: String(data.participation_score ?? '0'),
        participation_grade: data.participation_grade ?? 'Good',
        projects_grade: data.projects_grade ?? 'Good',
        homework_grade: data.homework_grade ?? 'Good',
        proficiency_level: data.proficiency_level ?? 'intermediate',
        key_strengths: data.key_strengths ?? '',
        areas_for_growth: data.areas_for_growth ?? '',
        instructor_assessment: data.instructor_assessment ?? '',
        is_published: data.is_published ?? false,
      });
    } else {
      setExistingReport(null);
      setSessionConfig((s) => ({
        ...s,
        school_name: s.school_name || student.school_name || profile?.school_name || '',
        section_class: s.section_class || student.section_class || '',
      }));
      setForm({
        theory_score: '0',
        practical_score: '0',
        attendance_score: '0',
        participation_score: '0',
        participation_grade: 'Good',
        projects_grade: 'Good',
        homework_grade: 'Good',
        proficiency_level: 'intermediate',
        key_strengths: '',
        areas_for_growth: '',
        instructor_assessment: '',
        is_published: false,
      });
      await applySmartHints(student.id);
    }
    setLoadingReport(false);
  }, [sessionConfig.report_term, sessionConfig.course_name, profile?.school_name, applySmartHints]);

  const addMilestone = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (sessionConfig.learning_milestones.includes(t)) return;
    setSessionConfig(s => ({ ...s, learning_milestones: [...s.learning_milestones, t] }));
    setMilestoneInput('');
  };

  const removeMilestone = (m: string) => {
    setSessionConfig(s => ({ ...s, learning_milestones: s.learning_milestones.filter(x => x !== m) }));
  };

  const overallScore = calcOverall(form.theory_score, form.practical_score, form.attendance_score, form.participation_score);
  const overallGrade = calcGrade(overallScore);
  const gradeCol = GRADE_COLOR[overallGrade] ?? COLORS.textMuted;

  const exportReportPDF = async () => {
    if (!selectedStudent) return;
    try {
      setExporting(true);

      const payload = {
        id: existingReport?.id ?? 'PREVIEW',
        student_name: selectedStudent.full_name,
        instructor_name: sessionConfig.instructor_name,
        report_date: sessionConfig.report_date,
        report_term: sessionConfig.report_term,
        report_period: sessionConfig.report_period,
        course_name: sessionConfig.course_name,
        school_name: sessionConfig.school_name,
        section_class: sessionConfig.section_class,
        current_module: sessionConfig.current_module,
        next_module: sessionConfig.next_module,
        course_duration: sessionConfig.course_duration,
        learning_milestones: sessionConfig.learning_milestones,
        school_section: sessionConfig.school_section,
        fee_label: sessionConfig.fee_label,
        fee_amount: sessionConfig.fee_amount,
        show_payment_notice: sessionConfig.show_payment_notice,
        theory_score: parseFloat(form.theory_score) || 0,
        practical_score: parseFloat(form.practical_score) || 0,
        attendance_score: parseFloat(form.attendance_score) || 0,
        participation_score: parseFloat(form.participation_score) || 0,
        participation_grade: form.participation_grade,
        projects_grade: form.projects_grade,
        homework_grade: form.homework_grade,
        proficiency_level: form.proficiency_level,
        key_strengths: form.key_strengths,
        areas_for_growth: form.areas_for_growth,
        instructor_assessment: form.instructor_assessment,
        overall_score: overallScore,
        overall_grade: overallGrade,
        template_id: 'industrial'
      };

      const orgSettings = {
        org_name: 'Rillcod Technologies',
        org_tagline: 'Excellence in Educational Technology',
        logo_url: 'https://rillcod.com/logo.png',
      };

      await generateAndShareReportPDF(payload, orgSettings, true); // True defaults to ModernReportCard
    } catch (err: any) {
      Alert.alert('Export Failed', err.message ?? 'Unable to export report PDF.');
    } finally {
      setExporting(false);
    }
  };

  const shareReportAsText = async () => {
    if (!selectedStudent) return;
    const safeScore = overallScore != null && Number.isFinite(overallScore) ? overallScore : 0;
    const message = buildStudentProgressReportTextSummary({
      studentName: selectedStudent.full_name,
      courseName: sessionConfig.course_name,
      term: sessionConfig.report_term,
      period: sessionConfig.report_period,
      overallGrade,
      overallScore: safeScore,
      strengths: form.key_strengths,
      growth: form.areas_for_growth,
      assessment: form.instructor_assessment,
    });
    await sharePlainText(`Report — ${selectedStudent.full_name}`, message);
  };

  const save = async (publish: boolean) => {
    if (!selectedStudent) return;
    if (!isBuilder) {
      Alert.alert('Access denied', 'You do not have permission to build reports.');
      return;
    }
    if (publish) {
      if (!sessionConfig.course_name?.trim()) {
        Alert.alert('Missing course', 'Add a course / subject name before publishing.');
        return;
      }
      if (!sessionConfig.report_date?.trim()) {
        Alert.alert('Missing date', 'Set a report date before publishing.');
        return;
      }
      if (!sessionConfig.report_term?.trim()) {
        Alert.alert('Missing term', 'Select a term before publishing.');
        return;
      }
    }
    setSaving(true);
      const payload: StudentProgressReportInsert = {
        student_id: selectedStudent.id,
        student_name: selectedStudent.full_name,
        teacher_id: profile?.id ?? null,
        instructor_name: sessionConfig.instructor_name,
        report_date: sessionConfig.report_date,
        report_term: sessionConfig.report_term,
      report_period: sessionConfig.report_period,
      course_name: sessionConfig.course_name,
      school_id: selectedStudent.school_id ?? profile?.school_id ?? null,
      school_name: sessionConfig.school_name,
        section_class: sessionConfig.section_class || selectedStudent.section_class || null,
      current_module: sessionConfig.current_module,
      next_module: sessionConfig.next_module,
      course_duration: sessionConfig.course_duration,
      learning_milestones: sessionConfig.learning_milestones,
      school_section: sessionConfig.school_section,
      fee_label: sessionConfig.fee_label || null,
        fee_amount: sessionConfig.fee_amount ? String(parseFloat(sessionConfig.fee_amount) || 0) : null,
      show_payment_notice: sessionConfig.show_payment_notice,
      theory_score: parseFloat(form.theory_score) || 0,
      practical_score: parseFloat(form.practical_score) || 0,
      attendance_score: parseFloat(form.attendance_score) || 0,
      participation_score: parseFloat(form.participation_score) || 0,
      participation_grade: form.participation_grade,
      projects_grade: form.projects_grade,
      homework_grade: form.homework_grade,
      proficiency_level: form.proficiency_level,
      key_strengths: form.key_strengths,
      areas_for_growth: form.areas_for_growth,
      instructor_assessment: form.instructor_assessment.trim() || null,
      overall_score: overallScore,
      overall_grade: overallGrade === '—' ? null : overallGrade,
      is_published: publish,
    };

      let errMsg: string | null = null;
      try {
        if (existingReport?.id) {
          await reportBuilderService.updateProgressReport(existingReport.id, payload);
        } else {
          await reportBuilderService.insertProgressReport(payload);
        }
      } catch (e: any) {
        errMsg = e?.message ?? 'Save failed';
      }

    setSaving(false);
    if (errMsg) {
      Alert.alert('Error', errMsg);
    } else {
      Alert.alert(
        publish ? 'Report Published!' : 'Saved as Draft',
        `${selectedStudent.full_name}'s report has been ${publish ? 'published' : 'saved as draft'}.`,
        [
          { text: 'Grade Another', onPress: () => { setStep('pick'); setSelectedStudent(null); setExistingReport(null); } },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]
      );
    }
  };

  const filteredStudents = search.trim()
    ? students.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.school_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.section_class ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : students;

  if (!isBuilder) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Report Builder" subtitle="Restricted" onBack={() => navigation.goBack()} accentColor={COLORS.accent} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyText}>This tool is for staff only.</Text>
          <Text style={styles.hintText}>Admins, teachers, and school accounts can create and publish reports.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── STEP: Session config ───────────────────────────────────────────────────
  if (step === 'session') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Report Builder" subtitle="Step 1: Session Setup" onBack={() => navigation.goBack()} accentColor={COLORS.accent} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>

            <SectionBox icon="📋" title="Session Info">
              <Field label="Instructor Name" value={sessionConfig.instructor_name} onChangeText={setSession('instructor_name')} placeholder="Your full name" />
              <Field label="Report Date (YYYY-MM-DD)" value={sessionConfig.report_date} onChangeText={setSession('report_date')} placeholder={new Date().toISOString().slice(0, 10)} />
              <Picker label="Term" options={TERM_OPTIONS} value={sessionConfig.report_term} onChange={setSession('report_term')} />
              <View style={f.wrap}>
                <Text style={f.label}>Report Period</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                  {PERIOD_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setSession('report_period')(p)}
                      style={[styles.preset, sessionConfig.report_period === p && styles.presetActive]}
                    >
                      <Text style={[styles.presetText, sessionConfig.report_period === p && styles.presetTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={f.input} value={sessionConfig.report_period} onChangeText={setSession('report_period')} placeholder="Or type custom period…" placeholderTextColor={COLORS.textMuted} />
                <Text style={styles.hintText}>Tip: clear this field to auto-fill from report date + term above.</Text>
              </View>
            </SectionBox>

            <SectionBox icon="📚" title="Course">
              <Field label="Course / Subject Name" value={sessionConfig.course_name} onChangeText={setSession('course_name')} placeholder="e.g. Python Programming, Web Design…" />
              <Text style={styles.hintText}>If a learner has more than one report in the same term, set this exactly before picking them so the right record opens (or a new one is created).</Text>
              <Picker label="Duration" options={DURATION_OPTIONS} value={sessionConfig.course_duration} onChange={setSession('course_duration')} />
              <Field label="School" value={sessionConfig.school_name} onChangeText={setSession('school_name')} placeholder="Partner school name" />
              <Field label="Class / Section" value={sessionConfig.section_class} onChangeText={setSession('section_class')} placeholder="e.g. JSS 2A, Basic 5" />
              <Field label="Current Module" value={sessionConfig.current_module} onChangeText={setSession('current_module')} placeholder="Topic covered this term" />
              <Field label="Next Module" value={sessionConfig.next_module} onChangeText={setSession('next_module')} placeholder="Next term's topic" />
            </SectionBox>

            <SectionBox icon="🏫" title="School & Payment (Optional)">
              <Picker label="School Section" options={['', 'Primary', 'Secondary', 'Unified']} value={sessionConfig.school_section} onChange={setSession('school_section')} />
              <Field label="Fee Label" value={sessionConfig.fee_label} onChangeText={setSession('fee_label')} placeholder="e.g. Coding Club Fee, Extra-Curricular Fee" />
              <Field label="Fee Amount" value={sessionConfig.fee_amount} onChangeText={setSession('fee_amount')} placeholder="e.g. 5000 (leave blank to omit)" keyboardType="numeric" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={f.label}>Payment Notice</Text>
                  <Text style={[f.label, { fontSize: 10, textTransform: 'none', letterSpacing: 0 }]}>Print Rillcod payment details on the report</Text>
                </View>
                <Switch
                  value={sessionConfig.show_payment_notice}
                  onValueChange={setSession('show_payment_notice')}
                  trackColor={{ false: COLORS.border, true: COLORS.accent + '60' }}
                  thumbColor={sessionConfig.show_payment_notice ? COLORS.accent : COLORS.textMuted}
                />
              </View>
            </SectionBox>

            <SectionBox icon="🏆" title="Learning Milestones">
              <Text style={styles.hintText}>Add milestones students have achieved this term. These appear on the report card.</Text>

              {/* Milestone chips */}
              <View style={styles.mileChips}>
                {sessionConfig.learning_milestones.map(m => (
                  <TouchableOpacity key={m} style={styles.mileChip} onPress={() => removeMilestone(m)}>
                    <Text style={styles.mileChipText} numberOfLines={1}>{m}</Text>
                    <Text style={styles.mileChipX}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Input */}
              <View style={styles.mileInputRow}>
                <TextInput
                  style={[f.input, { flex: 1 }]}
                  value={milestoneInput}
                  onChangeText={setMilestoneInput}
                  placeholder="Type milestone and tap +"
                  placeholderTextColor={COLORS.textMuted}
                  onSubmitEditing={() => addMilestone(milestoneInput)}
                />
                <TouchableOpacity onPress={() => addMilestone(milestoneInput)} style={styles.mileAddBtn}>
                  <Text style={styles.mileAddText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Suggestions */}
              <TouchableOpacity
                onPress={() => setShowSuggestions(v => !v)}
                style={styles.suggToggle}
              >
                <Text style={styles.suggToggleText}>
                  {showSuggestions ? '▲ Hide suggestions' : '💡 Show suggestions for "' + (sessionConfig.course_name || 'course') + '"'}
                </Text>
              </TouchableOpacity>
              {showSuggestions && (
                <View style={styles.suggList}>
                  {getMileSuggestions(sessionConfig.course_name).map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => addMilestone(s)}
                      style={[styles.suggItem, sessionConfig.learning_milestones.includes(s) && styles.suggItemDone]}
                    >
                      <Text style={styles.suggCheck}>{sessionConfig.learning_milestones.includes(s) ? '✓' : '+'}</Text>
                      <Text style={styles.suggText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </SectionBox>

            <TouchableOpacity onPress={() => setStep('pick')} style={styles.nextBtn}>
              <LinearGradient colors={[COLORS.accent, COLORS.accent + 'cc']} style={styles.nextGrad}>
                <Text style={styles.nextText}>Select Student →</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP: Student picker ───────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Select Student"
          subtitle={`Step 2 · ${filteredStudents.length} students`}
          onBack={() => setStep('session')}
          accentColor={COLORS.accent}
        />

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, school or class…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {loadingStudents ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
          ) : filteredStudents.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>No students found.</Text>
            </View>
          ) : (
            filteredStudents.map((s, i) => (
              <MotiView key={s.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 20 }}>
                <TouchableOpacity style={styles.studentCard} activeOpacity={0.8} onPress={() => selectStudent(s)}>
                  <LinearGradient colors={[COLORS.accent + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.sAvatar}>
                    <Text style={styles.sAvatarText}>{s.full_name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sName}>{s.full_name}</Text>
                    <Text style={styles.sEmail}>{s.email}</Text>
                    <View style={styles.sMeta}>
                      {s.school_name ? <Text style={styles.sMetaText}>🏫 {s.school_name}</Text> : null}
                      {s.section_class ? <Text style={styles.sMetaText}>📚 {s.section_class}</Text> : null}
                    </View>
                  </View>
                  <Text style={[styles.sArrow, { color: COLORS.accent }]}>›</Text>
                </TouchableOpacity>
              </MotiView>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STEP: Edit / grade form ────────────────────────────────────────────────
  if (!selectedStudent) return null;
  if (loadingReport) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={styles.loadText}>Loading existing report…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={selectedStudent.full_name}
        subtitle={`Step 3 · ${existingReport ? 'Edit' : 'New'} Report`}
        onBack={() => setStep('pick')}
        accentColor={gradeCol}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {!!signalsBanner && (
            <View style={styles.signalsBanner}>
              <Text style={styles.signalsBannerText}>💡 {signalsBanner}</Text>
            </View>
          )}

          {/* Live grade preview */}
          <MotiView
            animate={{ borderColor: gradeCol + '60' }}
            style={styles.gradePreview}
          >
            <LinearGradient colors={[gradeCol + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={[styles.gradeCircle, { backgroundColor: gradeCol + '22' }]}>
              <Text style={[styles.gradeCircleVal, { color: gradeCol }]}>{overallGrade}</Text>
              <Text style={[styles.gradeCirclePct, { color: gradeCol }]}>{overallScore ?? '—'}%</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.previewName}>{selectedStudent.full_name}</Text>
              <Text style={styles.previewCourse}>{sessionConfig.course_name || 'No course set'}</Text>
              <Text style={styles.previewTerm}>{sessionConfig.report_term} · {sessionConfig.report_period}</Text>
              <View style={[styles.previewPub, { backgroundColor: form.is_published ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                <Text style={[styles.previewPubText, { color: form.is_published ? COLORS.success : COLORS.warning }]}>
                  {form.is_published ? '✓ Published' : '⏳ Draft'}
                </Text>
              </View>
            </View>
          </MotiView>

          {/* Session summary (collapsible) */}
          <TouchableOpacity style={styles.sessionToggle} onPress={() => setSessionCollapsed(v => !v)}>
            <Text style={styles.sessionToggleText}>📋 Session Config — {sessionConfig.course_name || 'Set session'}</Text>
            <Text style={styles.sessionToggleChevron}>{sessionCollapsed ? '▼' : '▲'}</Text>
          </TouchableOpacity>
          {!sessionCollapsed && (
            <View style={styles.sessionSummary}>
              <Text style={styles.sessionSummaryText}>Instructor: {sessionConfig.instructor_name || '—'}</Text>
              <Text style={styles.sessionSummaryText}>Term: {sessionConfig.report_term} · {sessionConfig.report_period}</Text>
              <Text style={styles.sessionSummaryText}>School: {sessionConfig.school_name || '—'}</Text>
              <Text style={styles.sessionSummaryText}>Milestones: {sessionConfig.learning_milestones.length} added</Text>
              <TouchableOpacity onPress={() => setStep('session')} style={styles.editSessionBtn}>
                <Text style={styles.editSessionText}>✏️ Edit Session</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scores */}
          <SectionBox icon="📊" title="Scores (0–100)">
            <ScoreInput label="Theory / Written" value={form.theory_score} onChange={setF('theory_score')} color={COLORS.info} />
            <ScoreInput label="Practical / Coding" value={form.practical_score} onChange={setF('practical_score')} color="#7c3aed" />
            <ScoreInput label="Attendance" value={form.attendance_score} onChange={setF('attendance_score')} color={COLORS.success} />
            <ScoreInput label="Participation" value={form.participation_score} onChange={setF('participation_score')} color={COLORS.warning} />
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Overall Score (auto)</Text>
              <View style={[styles.overallBadge, { backgroundColor: gradeCol + '20' }]}>
                <Text style={[styles.overallVal, { color: gradeCol }]}>
                  {overallScore != null ? `${overallScore}% · ${overallGrade}` : '—'}
                </Text>
              </View>
            </View>
          </SectionBox>

          {/* Performance ratings */}
          <SectionBox icon="⭐" title="Performance Ratings">
            <Picker label="Participation" options={GRADE_OPTIONS} value={form.participation_grade} onChange={setF('participation_grade')} />
            <Picker label="Projects" options={GRADE_OPTIONS} value={form.projects_grade} onChange={setF('projects_grade')} />
            <Picker label="Homework" options={GRADE_OPTIONS} value={form.homework_grade} onChange={setF('homework_grade')} />
            <Picker label="Proficiency Level" options={PROFICIENCY_OPTIONS} value={form.proficiency_level} onChange={setF('proficiency_level')} />
          </SectionBox>

          {/* Teacher notes */}
          <SectionBox icon="📝" title="Teacher's Notes">
            <Field label="Key Strengths" value={form.key_strengths} onChangeText={setF('key_strengths')} placeholder="What the student did well…" multiline />
            <Field label="Areas for Growth" value={form.areas_for_growth} onChangeText={setF('areas_for_growth')} placeholder="What can be improved next term…" multiline />
            <Field label="Instructor Assessment" value={form.instructor_assessment} onChangeText={setF('instructor_assessment')} placeholder="Formal assessment summary for the report card…" multiline />
          </SectionBox>

          {/* Publish toggle */}
          <View style={styles.publishRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.publishLabel}>Publish Report</Text>
              <Text style={styles.publishHint}>Students can only see published reports</Text>
            </View>
            <Switch
              value={form.is_published}
              onValueChange={setF('is_published')}
              trackColor={{ false: COLORS.border, true: COLORS.success + '60' }}
              thumbColor={form.is_published ? COLORS.success : COLORS.textMuted}
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => save(false)}
              disabled={saving}
              style={[styles.draftBtn, saving && styles.btnDisabled]}
            >
              <Text style={styles.draftBtnText}>{saving ? '…' : '💾 Save Draft'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => save(true)}
              disabled={saving}
              style={[styles.publishBtn, saving && styles.btnDisabled]}
            >
              <LinearGradient colors={[COLORS.success, '#16a34a']} style={styles.publishGrad}>
                {saving
                  ? <ActivityIndicator color={COLORS.white100} size="small" />
                  : <Text style={styles.publishBtnText}>✓ Publish Report</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={exportReportPDF}
              disabled={exporting}
              style={[styles.exportBtn, exporting && styles.btnDisabled]}
            >
              <Text style={styles.exportBtnText}>{exporting ? 'Preparing PDF...' : 'Export Report PDF'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={shareReportAsText} style={styles.exportBtnSecondary}>
              <Text style={styles.exportBtnSecondaryText}>Share report (text)</Text>
            </TouchableOpacity>

            {/* Report Card Preview */}
            <View style={styles.previewCard}>
            <LinearGradient colors={[COLORS.accent + '18', COLORS.bgCard]} style={StyleSheet.absoluteFill} />
            <View style={styles.previewCardHeader}>
              <Text style={styles.previewCardTitle}>📄 Report Preview</Text>
              <View style={[styles.previewCardBadge, { backgroundColor: gradeCol + '25' }]}>
                <Text style={[styles.previewCardGrade, { color: gradeCol }]}>{overallGrade} · {overallScore ?? '—'}%</Text>
              </View>
            </View>
            <View style={styles.previewDivider} />
            <Text style={styles.previewStudentName}>{selectedStudent.full_name}</Text>
            <Text style={styles.previewMeta}>{sessionConfig.course_name || '—'} · {sessionConfig.report_term}</Text>
            {sessionConfig.report_period ? <Text style={styles.previewMeta}>{sessionConfig.report_period}</Text> : null}
            {sessionConfig.school_name ? <Text style={styles.previewMeta}>🏫 {sessionConfig.school_name}{sessionConfig.section_class ? ` · ${sessionConfig.section_class}` : ''}</Text> : null}
            {sessionConfig.instructor_name ? <Text style={styles.previewMeta}>👩‍🏫 {sessionConfig.instructor_name}</Text> : null}
            <View style={styles.previewDivider} />
            {/* Score summary */}
            {[
              { label: 'Theory', val: form.theory_score, color: COLORS.info },
              { label: 'Practical', val: form.practical_score, color: '#7c3aed' },
              { label: 'Attendance', val: form.attendance_score, color: COLORS.success },
              { label: 'Participation', val: form.participation_score, color: COLORS.warning },
            ].map(s => {
              const n = parseFloat(s.val);
              if (isNaN(n)) return null;
              return (
                <View key={s.label} style={styles.previewScoreRow}>
                  <Text style={styles.previewScoreLabel}>{s.label}</Text>
                  <View style={styles.previewScoreTrack}>
                    <View style={[styles.previewScoreFill, { width: `${Math.min(n, 100)}%` as any, backgroundColor: s.color }]} />
                  </View>
                  <Text style={[styles.previewScoreVal, { color: s.color }]}>{n}%</Text>
                </View>
              );
            })}
            <View style={styles.previewDivider} />
            {/* Ratings */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {form.participation_grade ? <View style={styles.previewChip}><Text style={styles.previewChipText}>💬 {form.participation_grade}</Text></View> : null}
              {form.projects_grade ? <View style={styles.previewChip}><Text style={styles.previewChipText}>🔨 {form.projects_grade}</Text></View> : null}
              {form.homework_grade ? <View style={styles.previewChip}><Text style={styles.previewChipText}>📖 {form.homework_grade}</Text></View> : null}
              {form.proficiency_level ? <View style={[styles.previewChip, { backgroundColor: COLORS.accent + '18' }]}><Text style={[styles.previewChipText, { color: COLORS.accent }]}>⚡ {form.proficiency_level}</Text></View> : null}
            </View>
            {/* Notes */}
            {form.key_strengths ? (
              <View style={styles.previewNotes}>
                <Text style={styles.previewNotesLabel}>💪 Key Strengths</Text>
                <Text style={styles.previewNotesText}>{form.key_strengths}</Text>
              </View>
            ) : null}
            {form.areas_for_growth ? (
              <View style={styles.previewNotes}>
                <Text style={styles.previewNotesLabel}>🎯 Areas for Growth</Text>
                <Text style={styles.previewNotesText}>{form.areas_for_growth}</Text>
              </View>
            ) : null}
            {form.instructor_assessment ? (
              <View style={styles.previewNotes}>
                <Text style={styles.previewNotesLabel}>📋 Instructor Assessment</Text>
                <Text style={styles.previewNotesText}>{form.instructor_assessment}</Text>
              </View>
            ) : null}
            {/* Milestones */}
            {sessionConfig.learning_milestones.length > 0 && (
              <View style={styles.previewNotes}>
                <Text style={styles.previewNotesLabel}>🏆 Learning Milestones</Text>
                {sessionConfig.learning_milestones.map((m, i) => (
                  <Text key={i} style={styles.previewNotesText}>• {m}</Text>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 60 }} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── SectionBox ─────────────────────────────────────────────────────────────
function SectionBox({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={sb.wrap}>
      <View style={sb.header}>
        <Text style={sb.icon}>{icon}</Text>
        <Text style={sb.title}>{title}</Text>
      </View>
      <View style={sb.body}>{children}</View>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.bgCard + 'cc', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icon: { fontSize: 16 },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
  body: { padding: SPACING.md, gap: 0 },
});

const f = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
  },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  picker: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  chevron: { fontSize: 11, color: COLORS.textMuted },
  drop: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropActive: { backgroundColor: COLORS.accent + '15' },
  dropText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  dropActiveText: { color: COLORS.accent, fontFamily: FONT_FAMILY.bodySemi },
});

const si = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, flex: 1 },
  input: {
    width: 70, backgroundColor: COLORS.bgCard, borderWidth: 1,
    borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 7,
    fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, textAlign: 'center',
  },
  track: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  signalsBanner: {
    backgroundColor: COLORS.info + '18',
    borderWidth: 1,
    borderColor: COLORS.info + '40',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  signalsBannerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  list: { paddingHorizontal: SPACING.xl },

  presetRow: { gap: SPACING.xs, paddingBottom: SPACING.xs, paddingTop: 2 },
  preset: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  presetActive: { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent },
  presetText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  presetTextActive: { color: COLORS.accent },

  hintText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, lineHeight: 18 },
  mileChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  mileChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.accent + '18', borderWidth: 1, borderColor: COLORS.accent + '40', maxWidth: '100%' },
  mileChipText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.accent, flexShrink: 1 },
  mileChipX: { fontSize: 10, color: COLORS.accent },
  mileInputRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  mileAddBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  mileAddText: { fontSize: 22, color: COLORS.white100 },
  suggToggle: { marginBottom: SPACING.xs },
  suggToggleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.accent },
  suggList: { gap: 4 },
  suggItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggItemDone: { opacity: 0.4 },
  suggCheck: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 14, color: COLORS.accent, width: 16 },
  suggText: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },

  nextBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  nextGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },

  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  sAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.accent },
  sName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  sEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  sMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  sMetaText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  sArrow: { fontSize: 22 },

  gradePreview: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, overflow: 'hidden' },
  gradeCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 },
  gradeCircleVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  gradeCirclePct: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  previewName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  previewCourse: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  previewTerm: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  previewPub: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  previewPubText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },

  sessionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  sessionToggleText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  sessionToggleChevron: { fontSize: 11, color: COLORS.textMuted },
  sessionSummary: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, gap: 4 },
  sessionSummaryText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  editSessionBtn: { marginTop: SPACING.xs, alignSelf: 'flex-start' },
  editSessionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.accent },

  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm },
  overallLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  overallBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full },
  overallVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },

  publishRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard },
  publishLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  publishHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: SPACING.md },
  draftBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.bgCard },
  draftBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  publishBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  publishGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  publishBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.5 },
  exportBtn: { marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.accent + '45', borderRadius: RADIUS.lg, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.accent + '10' },
  exportBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.accent },
  exportBtnSecondary: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
  },
  exportBtnSecondaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  previewCard: {
    borderWidth: 1, borderColor: COLORS.accent + '30', borderRadius: RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, overflow: 'hidden', gap: SPACING.sm,
  },
  previewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewCardTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  previewCardBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  previewCardGrade: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  previewDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  previewStudentName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  previewMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  previewScoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  previewScoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 80 },
  previewScoreTrack: { flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  previewScoreFill: { height: 5, borderRadius: 3 },
  previewScoreVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, width: 36, textAlign: 'right' },
  previewChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  previewChipText: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.textSecondary },
  previewNotes: { gap: 3 },
  previewNotesLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  previewNotesText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
});

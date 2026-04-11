
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { assignmentService } from '../../services/assignment.service';
import { attendanceService } from '../../services/attendance.service';
import { cbtService } from '../../services/cbt.service';
import { classService } from '../../services/class.service';
import { courseService } from '../../services/course.service';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';
import { ROUTES } from '../../navigation/routes';

type Tab = 'overview' | 'students' | 'lessons' | 'assignments' | 'cbt' | 'attendance' | 'grades';

interface ClassInfo {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  max_students: number | null;
  current_students: number | null;
  color: string | null;
  status: string | null;
  created_at: string | null;
  start_date: string | null;
  end_date: string | null;
  program_id: string | null;
  school_id: string | null;
  school_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  program_name: string | null;
}

interface EnrolledStudent {
  id: string;
  full_name: string;
  email: string;
  section_class: string | null;
}

interface AssignmentItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number | null;
  assignment_type: string | null;
  created_at: string | null;
  submission_count: number;
}

interface GradeRow {
  student_id: string;
  full_name: string;
  avg_grade: number | null;
  submissions: number;
}

interface ClassSession {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
}

interface AttendanceSummary {
  session_id: string;
  records: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

interface LessonItem {
  id: string;
  title: string;
  lesson_type: string | null;
  status: string | null;
  course_title: string | null;
}

interface CBTExam {
  id: string;
  title: string;
  duration_minutes: number;
  total_questions: number;
  is_active: boolean | null;
}

interface ClassEditorState {
  name: string;
  description: string;
  schedule: string;
  max_students: string;
  status: string;
}

/** Matches register statuses from `MarkAttendance` (present / late / absent / excused). */
function sessionAttendanceSummaryText(sessionId: string, summary: Record<string, AttendanceSummary>): string {
  const s = summary[sessionId];
  if (!s) return 'No attendance recorded yet';
  return `${s.present} present · ${s.late} late · ${s.absent} absent · ${s.excused} excused`;
}

export default function ClassDetailScreen({ navigation, route }: any) {
  const params = (route?.params ?? {}) as { classId?: string; id?: string };
  const classId =
    typeof params.classId === 'string' && params.classId.trim()
      ? params.classId.trim()
      : typeof params.id === 'string' && params.id.trim()
        ? params.id.trim()
        : '';
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { light, success: hapticSuccess, error: hapticError } = useHaptics();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, AttendanceSummary>>({});
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [cbtExams, setCbtExams] = useState<CBTExam[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [showEnrollSearch, setShowEnrollSearch] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState<EnrolledStudent[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    topic: '',
    session_date: new Date().toISOString().slice(0, 10),
    start_time: '',
    end_time: '',
    description: '',
  });
  const [classEditor, setClassEditor] = useState<ClassEditorState>({
    name: '',
    description: '',
    schedule: '',
    max_students: '',
    status: 'active',
  });

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';
  const canManageClass = profile?.role === 'admin' || profile?.role === 'teacher';
  const focusPassRef = useRef(0);

  useEffect(() => {
    focusPassRef.current = 0;
  }, [classId]);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = !!opts?.quiet;
    if (!quiet) setLoading(true);

    if (!classId) {
      setClassInfo(null);
      setStudents([]);
      setAssignments([]);
      setGrades([]);
      setSessions([]);
      setLessons([]);
      setCbtExams([]);
      if (!quiet) setLoading(false);
      return;
    }

    let cls: any;
    try {
      cls = await classService.getClassDetailWithRelations(classId);
    } catch {
      setClassInfo(null);
      setStudents([]);
      setAssignments([]);
      setGrades([]);
      setSessions([]);
      setLessons([]);
      setCbtExams([]);
      if (!quiet) setLoading(false);
      return;
    }
    const nextClassInfo: ClassInfo = {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      schedule: cls.schedule,
      max_students: cls.max_students,
      current_students: cls.current_students,
      color: cls.color ?? null,
      status: cls.status,
      created_at: cls.created_at,
      start_date: cls.start_date,
      end_date: cls.end_date,
      program_id: cls.program_id,
      school_id: cls.school_id,
      school_name: cls.schools?.name ?? cls.school_name ?? null,
      teacher_id: cls.teacher_id,
      teacher_name: cls.portal_users?.full_name ?? null,
      teacher_email: cls.portal_users?.email ?? null,
      program_name: cls.programs?.name ?? null,
    };
    setClassInfo(nextClassInfo);

    let nextStudents: EnrolledStudent[] = [];
    let rawAssignments: any[] = [];
    let nextSessions: ClassSession[] = [];
    try {
      const [sRows, aRows, sessRows] = await Promise.all([
        classService.listActiveStudentsInClass(classId),
        classService.listAssignmentsForClass(classId),
        classService.listClassSessionsForDetail(classId),
      ]);
      nextStudents = sRows as EnrolledStudent[];
      rawAssignments = aRows as any[];
      nextSessions = sessRows as ClassSession[];
    } catch {
      /* keep empty — same as ignoring per-query errors in legacy client */
    }
    setStudents(nextStudents);
    setSessions(nextSessions);

    const assignmentIds = rawAssignments.map((item) => item.id);
    const assignmentMap: Record<string, number | null> = {};
    rawAssignments.forEach((item) => {
      assignmentMap[item.id] = item.max_points ?? null;
    });

    let submissionRows: any[] = [];
    if (assignmentIds.length > 0) {
      try {
        submissionRows = (await assignmentService.listSubmissionsForGradeAggregation(assignmentIds)) as any[];
      } catch {
        submissionRows = [];
      }
    }
    const submissionCountMap: Record<string, number> = {};
    const gradeMap: Record<string, number[]> = {};

    submissionRows.forEach((row) => {
      if (!row.assignment_id) return;
      submissionCountMap[row.assignment_id] = (submissionCountMap[row.assignment_id] ?? 0) + 1;
      if (row.portal_user_id && row.grade != null) {
        const maxPoints = assignmentMap[row.assignment_id];
        const normalized = maxPoints && maxPoints > 0 ? Math.round((row.grade / maxPoints) * 100) : row.grade;
        if (!gradeMap[row.portal_user_id]) gradeMap[row.portal_user_id] = [];
        gradeMap[row.portal_user_id].push(normalized);
      }
    });

    setAssignments(
      rawAssignments.map((item) => ({
        ...item,
        submission_count: submissionCountMap[item.id] ?? 0,
      })) as AssignmentItem[]
    );

    if (nextSessions.length > 0) {
      let attendanceRows: { session_id: string | null; status: string | null }[] = [];
      try {
        attendanceRows = await attendanceService.listAttendanceStatusBySessionIds(
          nextSessions.map((session) => session.id)
        );
      } catch {
        attendanceRows = [];
      }

      const summaryMap: Record<string, AttendanceSummary> = {};
      attendanceRows.forEach((row: any) => {
        if (!row.session_id) return;
        if (!summaryMap[row.session_id]) {
          summaryMap[row.session_id] = {
            session_id: row.session_id,
            records: 0,
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
          };
        }
        const bucket = summaryMap[row.session_id];
        bucket.records += 1;
        if (row.status === 'present') bucket.present += 1;
        else if (row.status === 'late') bucket.late += 1;
        else if (row.status === 'absent') bucket.absent += 1;
        else if (row.status === 'excused') bucket.excused += 1;
      });
      setAttendanceSummary(summaryMap);
    } else {
      setAttendanceSummary({});
    }

    setGrades(
      nextStudents.map((student) => {
        const gradeList = gradeMap[student.id] ?? [];
        return {
          student_id: student.id,
          full_name: student.full_name,
          avg_grade: gradeList.length > 0 ? Math.round(gradeList.reduce((sum, value) => sum + value, 0) / gradeList.length) : null,
          submissions: gradeList.length,
        };
      })
    );

    if (nextClassInfo.program_id) {
      try {
        const courses = await courseService.listCourseIdsTitlesForProgram(nextClassInfo.program_id);
        const courseIds = courses.map((course) => course.id);
        const courseTitleMap = courses.reduce<Record<string, string>>((acc, course) => {
          acc[course.id] = course.title;
          return acc;
        }, {});

        const [lessonRows, cbtRows] = await Promise.all([
          courseIds.length > 0 ? courseService.listLessonsForCourseIds(courseIds) : Promise.resolve([]),
          cbtService.listExamsForProgram(nextClassInfo.program_id),
        ]);

        setLessons(
          (lessonRows as any[]).map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            lesson_type: lesson.lesson_type,
            status: lesson.status,
            course_title: lesson.course_id ? courseTitleMap[lesson.course_id] ?? null : null,
          }))
        );
        setCbtExams(cbtRows as CBTExam[]);
      } catch {
        setLessons([]);
        setCbtExams([]);
      }
    } else {
      setLessons([]);
      setCbtExams([]);
    }

    if (!quiet) setLoading(false);
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      focusPassRef.current += 1;
      const quiet = focusPassRef.current > 1;
      void load(quiet ? { quiet: true } : undefined);
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ quiet: true });
    setRefreshing(false);
  };

  const exportGradesPDF = async () => {
    if (!classInfo || grades.length === 0) return;
    setExportingPDF(true);
    await light();

    try {
      const today = new Date().toLocaleDateString('en-GB');
      const rowsHtml = [...grades]
        .sort((a, b) => (b.avg_grade ?? -1) - (a.avg_grade ?? -1))
        .map(
          (grade, index) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${index + 1}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${grade.full_name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${grade.submissions}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; color: ${
                grade.avg_grade != null && grade.avg_grade >= 70 ? '#10b981' : '#f97316'
              }">${grade.avg_grade != null ? `${grade.avg_grade}%` : '--'}</td>
            </tr>
          `
        )
        .join('');

      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a;">
            <h1 style="margin-bottom: 16px;">Class Performance Report</h1>
            <p><strong>Class:</strong> ${classInfo.name}</p>
            <p><strong>Teacher:</strong> ${classInfo.teacher_name ?? 'Unassigned'}</p>
            <p><strong>Date:</strong> ${today}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Rank</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Student</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Graded Work</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Average</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Export Ready', uri);
      }
      await hapticSuccess();
    } catch (error: any) {
      await hapticError();
      Alert.alert('Export Failed', error.message || 'Could not export report.');
    } finally {
      setExportingPDF(false);
    }
  };

  const exportRosterPDF = async () => {
    if (!classInfo || students.length === 0) {
      Alert.alert('No roster', 'There are no students in this class yet.');
      return;
    }

    setExportingPDF(true);
    await light();

    try {
      const today = new Date().toLocaleDateString('en-GB');
      const rowsHtml = students
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(
          (student, index) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${index + 1}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${student.full_name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${student.email}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${student.section_class ?? classInfo.name}</td>
            </tr>
          `
        )
        .join('');

      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a;">
            <h1 style="margin-bottom: 16px;">Class Roster</h1>
            <p><strong>Class:</strong> ${classInfo.name}</p>
            <p><strong>Teacher:</strong> ${classInfo.teacher_name ?? 'Unassigned'}</p>
            <p><strong>Programme:</strong> ${classInfo.program_name ?? 'Not linked'}</p>
            <p><strong>Date:</strong> ${today}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">#</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Student</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Email</th>
                  <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left;">Section</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Export Ready', uri);
      }
      await hapticSuccess();
    } catch (error: any) {
      await hapticError();
      Alert.alert('Export Failed', error.message || 'Could not export roster.');
    } finally {
      setExportingPDF(false);
    }
  };

  const saveSession = async () => {
    if (!sessionForm.topic.trim()) {
      Alert.alert('Topic required', 'Enter a topic before saving this class session.');
      return;
    }

    setSavingSession(true);
    try {
      await classService.insertClassSession({
        class_id: classId,
        topic: sessionForm.topic.trim(),
        title: sessionForm.topic.trim(),
        session_date: sessionForm.session_date,
        start_time: sessionForm.start_time || null,
        description: sessionForm.description.trim() || null,
        status: 'scheduled',
        is_active: true,
      });
    } catch (error: any) {
      setSavingSession(false);
      Alert.alert('Error', error?.message ?? 'Could not save session.');
      return;
    }
    setSavingSession(false);

    setShowAddSession(false);
    setSessionForm({
      topic: '',
      session_date: new Date().toISOString().slice(0, 10),
      start_time: '',
      end_time: '',
      description: '',
    });
    await load();
  };

  const searchEnroll = async (query: string) => {
    setEnrollSearch(query);
    if (query.trim().length < 2 || !classInfo) {
      setEnrollResults([]);
      return;
    }

    let data: EnrolledStudent[] = [];
    try {
      data = (await classService.searchStudentsForEnrollment({
        query: query.trim(),
        schoolId: classInfo.school_id,
        limit: 12,
      })) as EnrolledStudent[];
    } catch {
      setEnrollResults([]);
      return;
    }

    const existing = new Set(students.map((student) => student.id));
    setEnrollResults(data.filter((student) => !existing.has(student.id)));
  };
  const enrollStudent = async (student: EnrolledStudent) => {
    if (!classInfo) return;
    setEnrolling(true);

    try {
      await classService.assignStudentToClass(student.id, classId, classInfo.name);
    } catch (error: any) {
      setEnrolling(false);
      Alert.alert('Error', error?.message ?? 'Could not enrol student.');
      return;
    }

    setEnrolling(false);

    setStudents((prev) => [...prev, { ...student, section_class: classInfo.name }].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setEnrollSearch('');
    setEnrollResults([]);
    setShowEnrollSearch(false);
  };

  const removeStudent = (studentId: string) => {
    Alert.alert('Remove student', 'Remove this student from the class roster?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await classService.removeStudentFromClass(studentId, classId);
          } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not remove student.');
            return;
          }

          setStudents((prev) => prev.filter((student) => student.id !== studentId));
        },
      },
    ]);
  };

  const filteredStudents = useMemo(() => {
    const query = searchStudent.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
      (student.section_class ?? '').toLowerCase().includes(query)
    );
  }, [searchStudent, students]);

  const attendanceTotals = useMemo(
    () =>
      Object.values(attendanceSummary).reduce(
        (acc, item) => ({
          records: acc.records + item.records,
          present: acc.present + item.present,
          late: acc.late + item.late,
          absent: acc.absent + item.absent,
          excused: acc.excused + item.excused,
        }),
        { records: 0, present: 0, late: 0, absent: 0, excused: 0 }
      ),
    [attendanceSummary]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!classInfo) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Class" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {!classId ? 'Missing class link. Open the class again from Classes.' : 'Class not found or you may not have access.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = classInfo.color || colors.primary;
  const fillRate = classInfo.max_students ? Math.min(100, Math.round((students.length / classInfo.max_students) * 100)) : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Home' },
    { key: 'students', label: 'Students' },
    { key: 'lessons', label: 'Lessons' },
    { key: 'assignments', label: 'Work' },
    { key: 'cbt', label: 'CBT' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'grades', label: 'Grades' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader
        title={classInfo.name}
        onBack={() => navigation.goBack()}
        accentColor={accentColor}
        rightAction={
          isTeacher && activeTab === 'assignments'
            ? { label: '+ New', onPress: () => navigation.navigate(ROUTES.CreateAssignment, { classId, className: classInfo.name }) }
            : isTeacher && activeTab === 'students'
              ? { label: '+ Enrol', onPress: () => navigation.navigate(ROUTES.EnrolStudents, { classId, className: classInfo.name, programId: classInfo.program_id }) }
            : undefined
        }
      />

      <View style={{ backgroundColor: colors.bg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabBar, { borderBottomColor: colors.border }]}> 
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                light();
              }}
              style={[styles.tabBtn, activeTab === tab.key && { borderBottomColor: accentColor }]}
            >
              <Text style={[styles.tabLabel, { color: activeTab === tab.key ? accentColor : colors.textMuted }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'overview' && (
          <View style={styles.pad}>
            <View style={[styles.heroCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              <View style={[styles.heroBadge, { backgroundColor: `${accentColor}15` }]}> 
                <Text style={[styles.heroBadgeText, { color: accentColor }]}>CLASS</Text>
              </View>
              <Text style={[styles.heroName, { color: colors.textPrimary }]}>{classInfo.name}</Text>
              {classInfo.description ? <Text style={[styles.heroDesc, { color: colors.textMuted }]}>{classInfo.description}</Text> : null}

              <View style={styles.statsRow}>
                {[
                  { label: 'Students', value: students.length },
                  { label: 'Lessons', value: lessons.length },
                  { label: 'Work', value: assignments.length },
                ].map((item) => (
                  <View key={item.label} style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              {[
                { label: 'Teacher', value: classInfo.teacher_name ?? 'Unassigned' },
                { label: 'Program', value: classInfo.program_name ?? 'Not linked' },
                { label: 'School', value: classInfo.school_name ?? 'Global' },
                { label: 'Schedule', value: classInfo.schedule ?? 'Not set' },
                { label: 'Status', value: (classInfo.status ?? 'draft').toUpperCase() },
              ].map((item, index) => (
                <View key={item.label} style={[styles.infoLine, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}> 
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Capacity</Text>
                <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{classInfo.max_students ?? 'Open'}</Text>
              </View>
              <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Fill Rate</Text>
                <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{fillRate != null ? `${fillRate}%` : '--'}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {canManageClass ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate(ROUTES.AddClass, { classId })}
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Edit class</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.EnrolStudents, { classId, className: classInfo.name, programId: classInfo.program_id })}
                style={[styles.secondaryBtn, { borderColor: colors.primary }]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Manage Roster</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate(ROUTES.CreateAssignment, { classId, className: classInfo.name })}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>New Assignment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('attendance')}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('grades')}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Gradebook</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Sessions</Text>
              {isTeacher && (
                <TouchableOpacity onPress={() => setShowAddSession((value) => !value)}>
                  <Text style={[styles.linkText, { color: colors.primary }]}>{showAddSession ? 'Cancel' : '+ Add Session'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {showAddSession && isTeacher && (
              <View style={[styles.formCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={sessionForm.topic}
                  onChangeText={(value) => setSessionForm((prev) => ({ ...prev, topic: value }))}
                  placeholder="Session topic"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={sessionForm.session_date}
                  onChangeText={(value) => setSessionForm((prev) => ({ ...prev, session_date: value }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={sessionForm.start_time}
                  onChangeText={(value) => setSessionForm((prev) => ({ ...prev, start_time: value }))}
                  placeholder="Start time e.g. 09:00"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={sessionForm.description}
                  onChangeText={(value) => setSessionForm((prev) => ({ ...prev, description: value }))}
                  placeholder="Optional session notes"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <TouchableOpacity onPress={saveSession} disabled={savingSession} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}> 
                  {savingSession ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Save Session</Text>}
                </TouchableOpacity>
              </View>
            )}
            {sessions.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sessions have been scheduled for this class yet.</Text>
              </View>
            ) : (
              sessions.map((session) => (
                <View key={session.id} style={[styles.sessionCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <Text style={[styles.sessionTitle, { color: colors.textPrimary }]}>{session.topic || session.title || 'Class session'}</Text>
                  <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>
                    {new Date(session.session_date).toLocaleDateString()} {session.start_time ? `- ${session.start_time}` : ''}
                  </Text>
                  <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                    {sessionAttendanceSummaryText(session.id, attendanceSummary)}
                  </Text>
                  {session.description ? <Text style={[styles.sessionDesc, { color: colors.textSecondary }]}>{session.description}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'students' && (
          <View style={styles.pad}>
            {students.length > 0 && (
              <TouchableOpacity
                onPress={exportRosterPDF}
                disabled={exportingPDF}
                style={[styles.exportBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}14` }]}
              >
                {exportingPDF ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export Class Roster</Text>}
              </TouchableOpacity>
            )}
            <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search students"
                placeholderTextColor={colors.textMuted}
                value={searchStudent}
                onChangeText={setSearchStudent}
              />
            </View>

            {isTeacher && (
              <View style={[styles.inlineCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <TouchableOpacity onPress={() => setShowEnrollSearch((value) => !value)} style={styles.inlineHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Roster Control</Text>
                  <Text style={[styles.linkText, { color: colors.primary }]}>{showEnrollSearch ? 'Hide' : '+ Enrol Student'}</Text>
                </TouchableOpacity>

                {showEnrollSearch && (
                  <>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                      value={enrollSearch}
                      onChangeText={searchEnroll}
                      placeholder="Search by student name"
                      placeholderTextColor={colors.textMuted}
                    />
                    {enrollResults.map((student) => (
                      <TouchableOpacity
                        key={student.id}
                        disabled={enrolling}
                        onPress={() => enrollStudent(student)}
                        style={[styles.resultCard, { borderColor: colors.border }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.studentName, { color: colors.textPrimary }]}>{student.full_name}</Text>
                          <Text style={[styles.studentMeta, { color: colors.textMuted }]}>{student.email}</Text>
                        </View>
                        <Text style={[styles.linkText, { color: colors.primary }]}>{enrolling ? 'Saving...' : 'Add'}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}

            {filteredStudents.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No students are currently linked to this class.</Text>
              </View>
            ) : (
              filteredStudents.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.studentCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  onPress={() => navigation.navigate(ROUTES.StudentDetail, { studentId: student.id })}
                >
                  <View style={[styles.avatar, { backgroundColor: `${accentColor}18` }]}> 
                    <Text style={[styles.avatarText, { color: accentColor }]}>{student.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: colors.textPrimary }]}>{student.full_name}</Text>
                    <Text style={[styles.studentMeta, { color: colors.textMuted }]}>{student.email}</Text>
                    {student.section_class ? <Text style={[styles.studentMeta, { color: colors.textSecondary }]}>{student.section_class}</Text> : null}
                  </View>
                  {isTeacher && (
                    <TouchableOpacity onPress={() => removeStudent(student.id)}>
                      <Text style={[styles.removeText, { color: colors.error }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'lessons' && (
          <View style={styles.pad}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Lesson Pipeline</Text>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>{lessons.length} linked lessons</Text>
            </View>
            {lessons.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>This class is not yet linked to any course lessons.</Text>
              </View>
            ) : (
              lessons.map((lesson) => (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.contentCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  onPress={() => navigation.navigate(ROUTES.LessonDetail, { lessonId: lesson.id })}
                >
                  <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>{lesson.title}</Text>
                  <Text style={[styles.contentMeta, { color: colors.textMuted }]}>
                    {(lesson.course_title ?? 'Course') + (lesson.lesson_type ? ` - ${lesson.lesson_type}` : '')}
                  </Text>
                  <Text style={[styles.badge, { color: colors.primary, backgroundColor: `${colors.primary}12` }]}>{lesson.status ?? 'draft'}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'assignments' && (
          <View style={styles.pad}>
            {assignments.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No assignments created for this class yet.</Text>
              </View>
            ) : (
              assignments.map((assignment) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={[styles.contentCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  onPress={() => navigation.navigate(ROUTES.AssignmentDetail, { assignmentId: assignment.id, title: assignment.title })}
                >
                  <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>{assignment.title}</Text>
                  <Text style={[styles.contentMeta, { color: colors.textMuted }]}> 
                    {(assignment.assignment_type ?? 'assignment').toUpperCase()} {assignment.max_points ? `- ${assignment.max_points} pts` : ''}
                  </Text>
                  <Text style={[styles.contentMeta, { color: colors.textSecondary }]}> 
                    {assignment.submission_count} submissions {assignment.due_date ? `- due ${new Date(assignment.due_date).toLocaleDateString()}` : ''}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate(ROUTES.AssignmentDetail, { assignmentId: assignment.id, title: assignment.title })}
                      style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Open</Text>
                    </TouchableOpacity>
                    {isTeacher && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate(ROUTES.Grades)}
                        style={[styles.secondaryBtn, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Grade Hub</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'cbt' && (
          <View style={styles.pad}>
            {cbtExams.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No CBT exams are linked to this class program yet.</Text>
              </View>
            ) : (
              cbtExams.map((exam) => (
                <View key={exam.id} style={[styles.contentCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                  <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>{exam.title}</Text>
                  <Text style={[styles.contentMeta, { color: colors.textMuted }]}> 
                    {exam.total_questions} questions - {exam.duration_minutes} mins
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      {
                        color: exam.is_active ? colors.success : colors.warning,
                        backgroundColor: `${exam.is_active ? colors.success : colors.warning}15`,
                      },
                    ]}
                  >
                    {exam.is_active ? 'active' : 'draft'}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate(ROUTES.CBTExamination, { examId: exam.id })}
                      style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Open CBT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate(ROUTES.CBT)}
                      style={[styles.secondaryBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>CBT Hub</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        {activeTab === 'attendance' && (
          <View style={styles.pad}>
            <View style={[styles.kpiRow, styles.kpiRowWrap]}>
              <View style={[styles.attendanceKpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Recorded</Text>
                <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{attendanceTotals.records}</Text>
              </View>
              <View style={[styles.attendanceKpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Present</Text>
                <Text style={[styles.kpiValue, { color: colors.success }]}>{attendanceTotals.present}</Text>
              </View>
              <View style={[styles.attendanceKpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Late</Text>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>{attendanceTotals.late}</Text>
              </View>
              <View style={[styles.attendanceKpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Absent</Text>
                <Text style={[styles.kpiValue, { color: colors.error }]}>{attendanceTotals.absent}</Text>
              </View>
              <View style={[styles.attendanceKpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Excused</Text>
                <Text style={[styles.kpiValue, { color: colors.info }]}>{attendanceTotals.excused}</Text>
              </View>
            </View>
            <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
              <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>Attendance workspace</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Use the session-based register here, then jump into the wider attendance hub when you need school-wide tracking.</Text>
              <View style={styles.actionRow}>
                {isTeacher && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate(ROUTES.MarkAttendance, { classId, className: classInfo.name })}
                    style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Take Register</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => navigation.navigate(ROUTES.Attendance)} style={[styles.secondaryBtn, { borderColor: colors.border }]}> 
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Open Attendance Hub</Text>
                </TouchableOpacity>
              </View>
            </View>

            {sessions.map((session) => (
              <View key={session.id} style={[styles.contentCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>{session.topic || session.title || 'Class session'}</Text>
                <Text style={[styles.contentMeta, { color: colors.textMuted }]}>{new Date(session.session_date).toLocaleDateString()}</Text>
                <Text style={[styles.contentMeta, { color: colors.textSecondary }]}>
                  {sessionAttendanceSummaryText(session.id, attendanceSummary)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'grades' && (
          <View style={styles.pad}>
            {grades.length > 0 && (
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Top Score</Text>
                  <Text style={[styles.kpiValue, { color: colors.success }]}>
                    {Math.max(...grades.map((grade) => grade.avg_grade ?? 0))}%
                  </Text>
                </View>
                <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Class Avg</Text>
                  <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                    {Math.round(
                      grades.reduce((sum, grade) => sum + (grade.avg_grade ?? 0), 0) / Math.max(grades.filter((grade) => grade.avg_grade != null).length, 1)
                    )}
                    %
                  </Text>
                </View>
                <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Graded</Text>
                  <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                    {grades.filter((grade) => grade.submissions > 0).length}
                  </Text>
                </View>
              </View>
            )}
            {isTeacher && grades.length > 0 && (
              <TouchableOpacity
                onPress={exportGradesPDF}
                disabled={exportingPDF}
                style={[styles.exportBtn, { borderColor: colors.success, backgroundColor: `${colors.success}14` }]}
              >
                {exportingPDF ? <ActivityIndicator size="small" color={colors.success} /> : <Text style={[styles.exportBtnText, { color: colors.success }]}>Export Performance Report</Text>}
              </TouchableOpacity>
            )}

            {grades.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No graded submissions yet for this class.</Text>
              </View>
            ) : (
              <View style={[styles.tableCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                <View style={[styles.tableRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                  <Text style={[styles.tableHead, { flex: 2, color: colors.textMuted }]}>Student</Text>
                  <Text style={[styles.tableHead, { color: colors.textMuted }]}>Subs</Text>
                  <Text style={[styles.tableHead, { color: colors.textMuted }]}>Avg</Text>
                </View>
                {[...grades]
                  .sort((a, b) => (b.avg_grade ?? -1) - (a.avg_grade ?? -1))
                  .map((grade, index, list) => {
                    const gradeColor =
                      grade.avg_grade == null ? colors.textMuted : grade.avg_grade >= 70 ? colors.success : grade.avg_grade >= 50 ? colors.warning : colors.error;

                    return (
                      <TouchableOpacity
                        key={grade.student_id}
                        style={[styles.tableRow, index < list.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                        onPress={() => navigation.navigate(ROUTES.StudentReport, { studentId: grade.student_id, studentName: grade.full_name })}
                      >
                        <Text style={[styles.tableValue, { flex: 2, color: colors.textPrimary }]}>{grade.full_name}</Text>
                        <Text style={[styles.tableValue, { color: colors.textSecondary }]}>{grade.submissions}</Text>
                        <Text style={[styles.tableValue, { color: gradeColor }]}>{grade.avg_grade != null ? `${grade.avg_grade}%` : '--'}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pad: { padding: SPACING.xl },
    tabBar: { paddingHorizontal: SPACING.lg, gap: 4, height: 52, borderBottomWidth: 1 },
    tabBtn: { paddingHorizontal: SPACING.md, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

    heroCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.xl, marginBottom: SPACING.lg, gap: SPACING.sm },
    heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
    heroBadgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
    heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    heroDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    statsRow: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.sm },
    statItem: { flex: 1 },
    statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    statLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

    infoCard: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.lg },
    infoLine: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 4 },
    infoLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
    infoValue: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm },

    kpiRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
    kpiRowWrap: { flexWrap: 'wrap', rowGap: SPACING.sm },
    attendanceKpiCard: {
      flexGrow: 1,
      flexBasis: '47%',
      minWidth: 132,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    kpiCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.lg },
    kpiLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
    kpiValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginTop: 6 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    inlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2 },
    helperText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    linkText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs },

    formCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.md },
    input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    textArea: { minHeight: 90, textAlignVertical: 'top' },
    primaryBtn: { height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff', letterSpacing: 0.8 },

    sessionCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm },
    sessionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    sessionMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 4 },
    sessionDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, marginTop: 8 },

    searchBox: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, height: 50, justifyContent: 'center', marginBottom: SPACING.md },
    searchInput: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    inlineCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md },
    resultCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },

    studentCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.md, marginBottom: SPACING.sm },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
    studentName: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
    studentMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 2 },
    removeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs },

    contentCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm },
    contentTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    contentMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 4 },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, marginTop: 10, textTransform: 'uppercase' },

    emptyCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.xl },
    emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.lg, flexWrap: 'wrap' },
    secondaryBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs },

    exportBtn: { borderWidth: 1, borderRadius: RADIUS.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
    exportBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: 0.8 },
    tableCard: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.md },
    tableHead: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', flex: 1 },
    tableValue: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, textAlign: 'center', flex: 1 },
  });

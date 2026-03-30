import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type Tab = 'overview' | 'students' | 'lessons' | 'assignments' | 'cbt' | 'attendance' | 'grades';

interface ClassInfo {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  max_students: number | null;
  color: string | null;
  status: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  program_id: string | null;
  school_name: string | null;
  teacher_id: string | null;
  portal_users: { full_name: string; email: string } | null;
}

interface EnrolledStudent {
  id: string;
  full_name: string;
  email: string;
  section_class: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_score: number;
  type: string;
  created_at: string;
  submission_count?: number;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  student: { full_name: string } | null;
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
  notes: string | null;
}

interface Lesson {
  id: string;
  title: string;
  lesson_type: string | null;
  status: string | null;
}

interface CBTExam {
  id: string;
  title: string;
  duration_minutes: number | null;
  total_questions: number | null;
  is_active: boolean;
}

export default function ClassDetailScreen({ navigation, route }: any) {
  const { classId } = route.params as { classId: string };
  const { profile } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [savedAttendance, setSavedAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cbtExams, setCbtExams] = useState<CBTExam[]>([]);
  const [sessionForm, setSessionForm] = useState({ topic: '', session_date: new Date().toISOString().slice(0, 10), start_time: '', notes: '' });
  const [showAddSession, setShowAddSession] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState<EnrolledStudent[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [showEnrollSearch, setShowEnrollSearch] = useState(false);

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const load = useCallback(async () => {
    const [clsRes, stuRes, asnRes, attRes, sessRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, description, schedule, max_students, color, status, created_at, start_date, end_date, program_id, school_name, teacher_id, portal_users:teacher_id(full_name, email)')
        .eq('id', classId)
        .single(),
      supabase
        .from('class_enrollments')
        .select('portal_users:student_id(id, full_name, email, section_class)')
        .eq('class_id', classId)
        .limit(200),
      supabase
        .from('assignments')
        .select('id, title, description, due_date, max_score, type, created_at')
        .eq('class_id', classId)
        .order('due_date', { ascending: true }),
      supabase
        .from('attendance_records')
        .select('id, student_id, date, status, student:student_id(full_name)')
        .eq('class_id', classId)
        .eq('date', attendanceDate),
      supabase
        .from('class_sessions')
        .select('id, session_date, start_time, end_time, topic, notes')
        .eq('class_id', classId)
        .order('session_date', { ascending: false })
        .limit(10),
    ]);

    if (clsRes.data) setClassInfo(clsRes.data as unknown as ClassInfo);

    if (sessRes.data) setSessions(sessRes.data as ClassSession[]);

    if (stuRes.data) {
      const flat = (stuRes.data as any[]).map(r => r.portal_users).filter(Boolean);
      setStudents(flat);

      // Build grade rows
      if (flat.length > 0) {
        const { data: subs } = await supabase
          .from('assignment_submissions')
          .select('portal_user_id, grade')
          .in('assignment_id', asnRes.data?.map((a: any) => a.id) ?? []);

        const gradeMap: Record<string, number[]> = {};
        (subs ?? []).forEach((s: any) => {
          if (s.grade != null) {
            if (!gradeMap[s.portal_user_id]) gradeMap[s.portal_user_id] = [];
            gradeMap[s.portal_user_id].push(s.grade);
          }
        });
        setGrades(flat.map(st => ({
          student_id: st.id,
          full_name: st.full_name,
          avg_grade: gradeMap[st.id]?.length
            ? Math.round(gradeMap[st.id].reduce((a, b) => a + b, 0) / gradeMap[st.id].length)
            : null,
          submissions: gradeMap[st.id]?.length ?? 0,
        })));
      }
    }

    if (asnRes.data) {
      // Add submission counts
      const aIds = asnRes.data.map((a: any) => a.id);
      if (aIds.length > 0) {
        const { data: counts } = await supabase
          .from('assignment_submissions')
          .select('assignment_id')
          .in('assignment_id', aIds);
        const countMap: Record<string, number> = {};
        (counts ?? []).forEach((c: any) => { countMap[c.assignment_id] = (countMap[c.assignment_id] ?? 0) + 1; });
        setAssignments(asnRes.data.map((a: any) => ({ ...a, submission_count: countMap[a.id] ?? 0 })));
      } else {
        setAssignments(asnRes.data);
      }
    }

    if (attRes.data) {
      setSavedAttendance(attRes.data as unknown as AttendanceRecord[]);
      const map: Record<string, 'present' | 'absent' | 'late'> = {};
      (attRes.data as any[]).forEach(r => { map[r.student_id] = r.status; });
      setAttendance(map);
    }

    // Fetch lessons and CBT if we have a program_id
    const programId = (clsRes.data as any)?.program_id;
    if (programId) {
      const [lesRes, cbtRes] = await Promise.all([
        supabase
          .from('lessons')
          .select('id, title, lesson_type, status')
          .eq('program_id', programId)
          .order('created_at', { ascending: false }),
        supabase
          .from('cbt_exams')
          .select('id, title, duration_minutes, total_questions, is_active')
          .eq('program_id', programId)
          .order('created_at', { ascending: false }),
      ]);
      if (lesRes.data) setLessons(lesRes.data as Lesson[]);
      if (cbtRes.data) setCbtExams(cbtRes.data as CBTExam[]);
    }

    setLoading(false);
  }, [classId, attendanceDate]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Session ────────────────────────────────────────────────────────────────
  const saveSession = async () => {
    if (!sessionForm.topic.trim()) { Alert.alert('Topic required'); return; }
    setSavingSession(true);
    const { error } = await supabase.from('class_sessions').insert({
      class_id: classId,
      topic: sessionForm.topic.trim(),
      session_date: sessionForm.session_date,
      start_time: sessionForm.start_time || null,
      notes: sessionForm.notes || null,
    });
    setSavingSession(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowAddSession(false);
    setSessionForm({ topic: '', session_date: new Date().toISOString().slice(0, 10), start_time: '', notes: '' });
    load();
  };

  // ── Attendance ─────────────────────────────────────────────────────────────
  const markAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    setSavingAttendance(true);
    const records = students.map(s => ({
      class_id: classId,
      student_id: s.id,
      date: attendanceDate,
      status: attendance[s.id] ?? 'absent',
      recorded_by: profile?.id,
    }));

    const { error } = await supabase
      .from('attendance_records')
      .upsert(records, { onConflict: 'class_id,student_id,date' });

    setSavingAttendance(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved', `Attendance for ${attendanceDate} has been saved.`);
    }
  };

  // ── Enroll student search ──────────────────────────────────────────────────
  const searchEnroll = async (q: string) => {
    setEnrollSearch(q);
    if (q.length < 2) { setEnrollResults([]); return; }
    const { data } = await supabase
      .from('portal_users')
      .select('id, full_name, email, section_class')
      .eq('role', 'student')
      .ilike('full_name', `%${q}%`)
      .limit(10);
    const existing = new Set(students.map(s => s.id));
    setEnrollResults((data ?? []).filter((s: any) => !existing.has(s.id)) as EnrolledStudent[]);
  };

  const enrollStudent = async (student: EnrolledStudent) => {
    setEnrolling(true);
    const { error } = await supabase.from('class_enrollments').insert({
      class_id: classId,
      student_id: student.id,
      enrolled_by: profile?.id,
      status: 'active',
    });
    if (!error) {
      setStudents(prev => [...prev, student]);
      setEnrollSearch('');
      setEnrollResults([]);
      setShowEnrollSearch(false);
    } else {
      Alert.alert('Error', error.message);
    }
    setEnrolling(false);
  };

  const removeStudent = (studentId: string) => {
    Alert.alert('Remove Student', 'Remove this student from the class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('class_enrollments').delete()
            .eq('class_id', classId).eq('student_id', studentId);
          setStudents(prev => prev.filter(s => s.id !== studentId));
        },
      },
    ]);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={classInfo?.color ?? COLORS.primary} size="large" />
      </View>
    );
  }

  if (!classInfo) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Class" onBack={() => navigation.goBack()} />
        <View style={styles.loader}><Text style={styles.emptyText}>Class not found.</Text></View>
      </SafeAreaView>
    );
  }

  const accentColor = classInfo.color ?? COLORS.primary;
  const filteredStudents = searchStudent.trim()
    ? students.filter(s => s.full_name.toLowerCase().includes(searchStudent.toLowerCase()))
    : students;

  const presentCount = Object.values(attendance).filter(v => v === 'present').length;
  const absentCount = Object.values(attendance).filter(v => v === 'absent').length;
  const lateCount = Object.values(attendance).filter(v => v === 'late').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={classInfo.name}
        onBack={() => navigation.goBack()}
        accentColor={accentColor}
        rightAction={isTeacher && activeTab === 'assignments'
          ? { label: '+ New', onPress: () => navigation.navigate('CreateAssignment', { classId, className: classInfo.name }) }
          : undefined}
      />

      {/* Tab bar — horizontal scroll for 7 tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {([
          { key: 'overview', emoji: '📋', label: 'Home' },
          { key: 'students', emoji: '👥', label: 'Students' },
          { key: 'lessons', emoji: '📖', label: 'Lessons' },
          { key: 'assignments', emoji: '📝', label: 'Work' },
          { key: 'cbt', emoji: '🎯', label: 'CBT' },
          { key: 'attendance', emoji: '📅', label: 'Attend' },
          { key: 'grades', emoji: '📊', label: 'Grades' },
        ] as { key: Tab; emoji: string; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.tabBtn, activeTab === t.key && { borderBottomColor: accentColor }]}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, activeTab === t.key && { color: accentColor }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {/* Hero */}
            <View style={[styles.heroCard, { borderColor: accentColor + '40' }]}>
              <LinearGradient colors={[accentColor + '15', 'transparent']} style={StyleSheet.absoluteFill} />
              <View style={[styles.classIcon, { backgroundColor: accentColor + '20' }]}>
                <Text style={{ fontSize: 32 }}>📚</Text>
              </View>
              <Text style={styles.heroName}>{classInfo.name}</Text>
              {classInfo.description ? <Text style={styles.heroDesc}>{classInfo.description}</Text> : null}

              <View style={styles.statsRow}>
                {[
                  { label: 'Students', value: students.length, color: COLORS.info },
                  { label: 'Assignments', value: assignments.length, color: COLORS.warning },
                  { label: 'Capacity', value: classInfo.max_students ?? '∞', color: COLORS.success },
                ].map(s => (
                  <View key={s.label} style={styles.statItem}>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Info rows */}
            <View style={styles.infoCard}>
              {classInfo.portal_users?.full_name ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>👩‍🏫</Text>
                  <Text style={styles.infoLabel}>Teacher</Text>
                  <Text style={styles.infoValue}>{classInfo.portal_users.full_name}</Text>
                </View>
              ) : null}
              {classInfo.schedule ? (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <Text style={styles.infoEmoji}>📅</Text>
                  <Text style={styles.infoLabel}>Schedule</Text>
                  <Text style={styles.infoValue}>{classInfo.schedule}</Text>
                </View>
              ) : null}
              {classInfo.start_date ? (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <Text style={styles.infoEmoji}>🗓</Text>
                  <Text style={styles.infoLabel}>Start Date</Text>
                  <Text style={styles.infoValue}>{new Date(classInfo.start_date).toLocaleDateString('en-GB')}</Text>
                </View>
              ) : null}
              {classInfo.end_date ? (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <Text style={styles.infoEmoji}>🏁</Text>
                  <Text style={styles.infoLabel}>End Date</Text>
                  <Text style={styles.infoValue}>{new Date(classInfo.end_date).toLocaleDateString('en-GB')}</Text>
                </View>
              ) : null}
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoEmoji}>🔖</Text>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: classInfo.status === 'active' ? COLORS.success : COLORS.textMuted }]}>
                  {classInfo.status}
                </Text>
              </View>
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoEmoji}>📆</Text>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{new Date(classInfo.created_at).toLocaleDateString('en-GB')}</Text>
              </View>
            </View>

            {/* Sessions section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Sessions</Text>
              {isTeacher && (
                <TouchableOpacity onPress={() => setShowAddSession(v => !v)} style={styles.addSessionBtn}>
                  <Text style={styles.addSessionBtnText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Add session form (collapsible) */}
            {showAddSession && isTeacher && (
              <View style={styles.sessionForm}>
                <TextInput
                  style={styles.sessionInput}
                  value={sessionForm.topic}
                  onChangeText={v => setSessionForm(f => ({ ...f, topic: v }))}
                  placeholder="Session topic *"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TextInput
                  style={styles.sessionInput}
                  value={sessionForm.session_date}
                  onChangeText={v => setSessionForm(f => ({ ...f, session_date: v }))}
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TextInput
                  style={styles.sessionInput}
                  value={sessionForm.start_time}
                  onChangeText={v => setSessionForm(f => ({ ...f, start_time: v }))}
                  placeholder="Start time e.g. 10:00"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TextInput
                  style={[styles.sessionInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={sessionForm.notes}
                  onChangeText={v => setSessionForm(f => ({ ...f, notes: v }))}
                  placeholder="Notes (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
                <TouchableOpacity onPress={saveSession} disabled={savingSession} style={[styles.saveSessionBtn, savingSession && { opacity: 0.5 }]}>
                  {savingSession ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveSessionBtnText}>Save Session</Text>}
                </TouchableOpacity>
              </View>
            )}

            {sessions.length === 0 ? (
              <Text style={styles.noSessionText}>No sessions recorded yet.</Text>
            ) : (
              sessions.slice(0, 5).map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionDot} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sessionTopic}>{s.topic || 'Session'}</Text>
                    <Text style={styles.sessionDate}>
                      {s.session_date}{s.start_time ? ` · ${s.start_time}` : ''}
                    </Text>
                    {s.notes ? <Text style={styles.sessionNotes} numberOfLines={2}>{s.notes}</Text> : null}
                  </View>
                </View>
              ))
            )}

            {/* Quick actions */}
            {isTeacher && (
              <View style={[styles.quickRow, { marginTop: SPACING.md }]}>
                <TouchableOpacity style={[styles.quickBtn, { borderColor: accentColor + '50' }]}
                  onPress={() => { setActiveTab('assignments'); navigation.navigate('CreateAssignment', { classId, className: classInfo.name }); }}>
                  <Text style={styles.quickEmoji}>📝</Text>
                  <Text style={styles.quickLabel}>New Assignment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickBtn, { borderColor: accentColor + '50' }]}
                  onPress={() => setActiveTab('attendance')}>
                  <Text style={styles.quickEmoji}>✅</Text>
                  <Text style={styles.quickLabel}>Take Attendance</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickBtn, { borderColor: accentColor + '50' }]}
                  onPress={() => setActiveTab('grades')}>
                  <Text style={styles.quickEmoji}>📊</Text>
                  <Text style={styles.quickLabel}>View Grades</Text>
                </TouchableOpacity>
              </View>
            )}
          </MotiView>
        )}

        {/* ── STUDENTS ──────────────────────────────────────────────────────── */}
        {activeTab === 'students' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {/* Search enrolled */}
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search enrolled students…"
                placeholderTextColor={COLORS.textMuted}
                value={searchStudent}
                onChangeText={setSearchStudent}
              />
            </View>

            {/* Enroll new */}
            {isTeacher && (
              <TouchableOpacity
                style={[styles.enrollToggle, { borderColor: accentColor + '60' }]}
                onPress={() => setShowEnrollSearch(v => !v)}
              >
                <Text style={[styles.enrollToggleText, { color: accentColor }]}>
                  {showEnrollSearch ? '✕ Cancel' : '+ Enroll Student'}
                </Text>
              </TouchableOpacity>
            )}

            {showEnrollSearch && (
              <View style={styles.enrollSearchBox}>
                <TextInput
                  style={styles.enrollInput}
                  placeholder="Search students to enroll…"
                  placeholderTextColor={COLORS.textMuted}
                  value={enrollSearch}
                  onChangeText={searchEnroll}
                  autoFocus
                />
                {enrollResults.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.enrollResult}
                    onPress={() => enrollStudent(s)}
                    disabled={enrolling}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.enrollResultName}>{s.full_name}</Text>
                      <Text style={styles.enrollResultEmail}>{s.email}</Text>
                    </View>
                    <Text style={[styles.enrollBtn, { color: accentColor }]}>+ Add</Text>
                  </TouchableOpacity>
                ))}
                {enrollSearch.length > 1 && enrollResults.length === 0 && (
                  <Text style={styles.enrollEmpty}>No students found</Text>
                )}
              </View>
            )}

            {filteredStudents.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyText}>{searchStudent ? 'No match.' : 'No students enrolled yet.'}</Text>
              </View>
            ) : (
              filteredStudents.map((s, i) => (
                <MotiView key={s.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 30 }}>
                  <TouchableOpacity
                    style={styles.studentCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })}
                  >
                    <LinearGradient colors={[accentColor + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.sAvatar, { backgroundColor: accentColor + '25' }]}>
                      <Text style={[styles.sAvatarText, { color: accentColor }]}>{s.full_name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.sName}>{s.full_name}</Text>
                      <Text style={styles.sEmail}>{s.email}</Text>
                      {s.section_class ? <Text style={styles.sMeta}>{s.section_class}</Text> : null}
                    </View>
                    {isTeacher && (
                      <TouchableOpacity onPress={() => removeStudent(s.id)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </MotiView>
        )}

        {/* ── LESSONS ───────────────────────────────────────────────────────── */}
        {activeTab === 'lessons' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {lessons.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyText}>No lessons linked to this class program.</Text>
                {isTeacher && (
                  <TouchableOpacity onPress={() => navigation.navigate('Lessons')} style={styles.emptyBtn}>
                    <Text style={styles.emptyBtnText}>Manage Lessons →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              lessons.map((lesson, i) => (
                <MotiView key={lesson.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 30 }}>
                  <View style={styles.lessonCard}>
                    <View style={styles.lessonIcon}>
                      <Text style={{ fontSize: 18 }}>
                        {lesson.lesson_type === 'video' ? '🎥' : lesson.lesson_type === 'quiz' ? '📝' : lesson.lesson_type === 'project' ? '🔨' : '📖'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.lessonTitle}>{lesson.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {lesson.lesson_type && (
                          <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{lesson.lesson_type}</Text></View>
                        )}
                        {lesson.status && (
                          <View style={[styles.statusBadge, { backgroundColor: lesson.status === 'published' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                            <Text style={[styles.statusBadgeText, { color: lesson.status === 'published' ? COLORS.success : COLORS.warning }]}>{lesson.status}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </MotiView>
              ))
            )}
          </MotiView>
        )}

        {/* ── ASSIGNMENTS ───────────────────────────────────────────────────── */}
        {activeTab === 'assignments' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {isTeacher && (
              <TouchableOpacity
                style={[styles.newAsnBtn, { borderColor: accentColor + '60', backgroundColor: accentColor + '10' }]}
                onPress={() => navigation.navigate('CreateAssignment', { classId, className: classInfo.name })}
              >
                <Text style={[styles.newAsnText, { color: accentColor }]}>+ Create New Assignment</Text>
              </TouchableOpacity>
            )}

            {assignments.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyText}>No assignments yet.</Text>
              </View>
            ) : (
              assignments.map((a, i) => {
                const isOverdue = a.due_date && new Date(a.due_date) < new Date();
                const typeColor: Record<string, string> = { theory: COLORS.info, practical: COLORS.success, quiz: COLORS.warning, project: '#7c3aed' };
                const color = typeColor[a.type] ?? accentColor;
                return (
                  <MotiView key={a.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                    <TouchableOpacity
                      style={styles.asnCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: a.id })}
                    >
                      <LinearGradient colors={[color + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                      <View style={[styles.asnTypeDot, { backgroundColor: color }]} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.asnTitle}>{a.title}</Text>
                        {a.description ? <Text style={styles.asnDesc} numberOfLines={2}>{a.description}</Text> : null}
                        <View style={styles.asnMeta}>
                          <Text style={[styles.asnType, { color }]}>{a.type}</Text>
                          {a.due_date ? (
                            <Text style={[styles.asnDue, isOverdue && { color: COLORS.error }]}>
                              📅 {new Date(a.due_date).toLocaleDateString('en-GB')}
                              {isOverdue ? ' (overdue)' : ''}
                            </Text>
                          ) : null}
                          <Text style={styles.asnSubs}>💬 {a.submission_count ?? 0}/{students.length}</Text>
                        </View>
                      </View>
                      <View style={styles.asnScore}>
                        <Text style={[styles.asnScoreVal, { color }]}>{a.max_score}</Text>
                        <Text style={styles.asnScoreLabel}>pts</Text>
                      </View>
                    </TouchableOpacity>
                  </MotiView>
                );
              })
            )}
          </MotiView>
        )}

        {/* ── CBT ───────────────────────────────────────────────────────────── */}
        {activeTab === 'cbt' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {cbtExams.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyText}>No CBT exams linked to this class program.</Text>
                {isTeacher && (
                  <TouchableOpacity onPress={() => navigation.navigate('CBT')} style={styles.emptyBtn}>
                    <Text style={styles.emptyBtnText}>Go to CBT Centre →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              cbtExams.map((exam, i) => (
                <MotiView key={exam.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 30 }}>
                  <TouchableOpacity style={styles.cbtCard} activeOpacity={0.8} onPress={() => navigation.navigate('CBT')}>
                    <LinearGradient colors={[exam.is_active ? COLORS.success + '08' : COLORS.border + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.cbtTitle}>{exam.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {exam.total_questions != null && (
                          <Text style={styles.cbtMeta}>📋 {exam.total_questions} questions</Text>
                        )}
                        {exam.duration_minutes != null && (
                          <Text style={styles.cbtMeta}>⏱ {exam.duration_minutes} min</Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.activeBadge, { backgroundColor: exam.is_active ? COLORS.success + '20' : COLORS.border }]}>
                      <Text style={[styles.activeBadgeText, { color: exam.is_active ? COLORS.success : COLORS.textMuted }]}>
                        {exam.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </MotiView>
        )}

        {/* ── ATTENDANCE ────────────────────────────────────────────────────── */}
        {activeTab === 'attendance' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {/* Date selector */}
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Date</Text>
              <TextInput
                style={styles.dateInput}
                value={attendanceDate}
                onChangeText={setAttendanceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Summary */}
            <View style={styles.attSummary}>
              {[
                { label: 'Present', value: presentCount, color: COLORS.success },
                { label: 'Absent', value: absentCount, color: COLORS.error },
                { label: 'Late', value: lateCount, color: COLORS.warning },
              ].map(s => (
                <View key={s.label} style={[styles.attStat, { borderColor: s.color + '40' }]}>
                  <Text style={[styles.attStatVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.attStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {students.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.emptyText}>No students enrolled.</Text>
              </View>
            ) : (
              <>
                {students.map((s) => {
                  const status = attendance[s.id] ?? 'absent';
                  return (
                    <View key={s.id} style={styles.attRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.attName}>{s.full_name}</Text>
                        <Text style={styles.attEmail}>{s.email}</Text>
                      </View>
                      <View style={styles.attBtns}>
                        {(['present', 'late', 'absent'] as const).map(st => {
                          const colors = { present: COLORS.success, late: COLORS.warning, absent: COLORS.error };
                          const labels = { present: '✓', late: '⏰', absent: '✗' };
                          return (
                            <TouchableOpacity
                              key={st}
                              onPress={() => markAttendance(s.id, st)}
                              style={[styles.attMark, {
                                backgroundColor: status === st ? colors[st] + '25' : 'transparent',
                                borderColor: status === st ? colors[st] : COLORS.border,
                              }]}
                            >
                              <Text style={[styles.attMarkText, { color: status === st ? colors[st] : COLORS.textMuted }]}>
                                {labels[st]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {isTeacher && (
                  <TouchableOpacity
                    onPress={saveAttendance}
                    disabled={savingAttendance}
                    style={[styles.saveAttBtn, { backgroundColor: accentColor }, savingAttendance && styles.btnDisabled]}
                  >
                    {savingAttendance
                      ? <ActivityIndicator color={COLORS.white100} />
                      : <Text style={styles.saveAttText}>Save Attendance for {attendanceDate}</Text>}
                  </TouchableOpacity>
                )}
              </>
            )}
          </MotiView>
        )}

        {/* ── GRADES ────────────────────────────────────────────────────────── */}
        {activeTab === 'grades' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.pad}>
            {grades.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📊</Text>
                <Text style={styles.emptyText}>No grade data yet.</Text>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={styles.gradeHeader}>
                  <Text style={[styles.gradeHeaderCell, { flex: 2 }]}>Student</Text>
                  <Text style={styles.gradeHeaderCell}>Submissions</Text>
                  <Text style={styles.gradeHeaderCell}>Avg Grade</Text>
                </View>
                {grades
                  .sort((a, b) => (b.avg_grade ?? -1) - (a.avg_grade ?? -1))
                  .map((g, i) => {
                    const gc = g.avg_grade == null ? COLORS.textMuted
                      : g.avg_grade >= 70 ? COLORS.success
                      : g.avg_grade >= 50 ? COLORS.warning
                      : COLORS.error;
                    return (
                      <MotiView key={g.student_id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 30 }}>
                        <TouchableOpacity
                          style={styles.gradeRow}
                          onPress={() => navigation.navigate('StudentReport', { studentId: g.student_id, studentName: g.full_name })}
                          activeOpacity={0.8}
                        >
                          <LinearGradient colors={[gc + '06', 'transparent']} style={StyleSheet.absoluteFill} />
                          <View style={[styles.rankBadge, { backgroundColor: i < 3 ? COLORS.gold + '25' : COLORS.border }]}>
                            <Text style={[styles.rankText, { color: i < 3 ? COLORS.gold : COLORS.textMuted }]}>{i + 1}</Text>
                          </View>
                          <Text style={[styles.gradeCell, { flex: 2 }]}>{g.full_name}</Text>
                          <Text style={styles.gradeCell}>{g.submissions}</Text>
                          <Text style={[styles.gradeCell, { color: gc, fontFamily: FONT_FAMILY.display }]}>
                            {g.avg_grade != null ? `${g.avg_grade}%` : '—'}
                          </Text>
                        </TouchableOpacity>
                      </MotiView>
                    );
                  })}
              </>
            )}
          </MotiView>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pad: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  tabBar: { paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 4 },
  tabBtn: { paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center', gap: 2 },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  heroCard: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, overflow: 'hidden', marginBottom: SPACING.md },
  classIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, textAlign: 'center' },
  heroDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.sm },
  statItem: { alignItems: 'center', gap: 3 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoEmoji: { fontSize: 16, width: 24 },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  quickRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  quickBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center', gap: 4, backgroundColor: COLORS.bgCard },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: SPACING.sm,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  enrollToggle: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', marginBottom: SPACING.sm },
  enrollToggleText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  enrollSearchBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACING.md, overflow: 'hidden' },
  enrollInput: { paddingHorizontal: SPACING.md, paddingVertical: 10, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  enrollResult: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  enrollResultName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  enrollResultEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  enrollBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  enrollEmpty: { padding: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },

  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  sAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  sName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  sMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error + '15', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 12, color: COLORS.error },

  // Lessons
  lessonCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  lessonIcon: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lessonTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  typeBadgeText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  statusBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },

  // CBT
  cbtCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  cbtTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  cbtMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.md },
  activeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  // Sessions
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm, marginTop: SPACING.xs },
  sectionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  addSessionBtn: { paddingHorizontal: SPACING.md, paddingVertical: 5, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '20', borderWidth: 1, borderColor: COLORS.primary + '40' },
  addSessionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  sessionForm: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard },
  sessionInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 9,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
  },
  saveSessionBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center', marginTop: 4 },
  saveSessionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },
  sessionRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 5, flexShrink: 0 },
  sessionTopic: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sessionDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  sessionNotes: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 16 },
  noSessionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },

  newAsnBtn: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginBottom: SPACING.md },
  newAsnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },

  asnCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  asnTypeDot: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginTop: 2, marginRight: 4 },
  asnTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  asnDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 16 },
  asnMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: 4 },
  asnType: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },
  asnDue: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  asnSubs: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  asnScore: { alignItems: 'center', minWidth: 36 },
  asnScoreVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  asnScoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  dateLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  dateInput: {
    flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 9,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
  },

  attSummary: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  attStat: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', gap: 2 },
  attStatVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  attStatLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  attRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10, gap: SPACING.sm },
  attName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  attEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  attBtns: { flexDirection: 'row', gap: 6 },
  attMark: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  attMarkText: { fontSize: 14 },

  saveAttBtn: { paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.lg },
  saveAttText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  btnDisabled: { opacity: 0.5 },

  gradeHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  gradeHeaderCell: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, flex: 1, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12, overflow: 'hidden', gap: SPACING.sm },
  rankBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11 },
  gradeCell: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textAlign: 'center' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  emptyBtn: { paddingHorizontal: SPACING.lg, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '20', borderWidth: 1, borderColor: COLORS.primary + '40' },
  emptyBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primary },
});

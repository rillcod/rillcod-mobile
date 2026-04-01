import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Types ──────────────────────────────────────────────────────────────────────
interface StudentProfile {
  id: string; full_name: string; email: string; phone: string | null;
  school_name: string | null; section_class: string | null;
  date_of_birth: string | null; is_active: boolean; created_at: string;
  parent_email?: string | null; parent_name?: string | null; grade_level?: string | null;
}
interface Report {
  id: string; course_name: string | null; report_term: string | null;
  overall_grade: string | null; overall_score: number | null;
  report_date: string | null; is_published: boolean;
  theory_score: number | null; practical_score: number | null;
  attendance_score: number | null;
}
interface AttendanceRow {
  id: string; status: string; created_at: string;
  class_sessions: { session_date: string | null; classes: { name: string } | null } | null;
}
interface Submission {
  id: string; status: string; grade: number | null; feedback: string | null;
  submitted_at: string | null;
  assignments: { title: string; max_score: number | null; type: string | null } | null;
}

type Tab = 'overview' | 'grades' | 'attendance' | 'work';

const STATUS_COLOR: Record<string, string> = {
  present: COLORS.success, absent: COLORS.error,
  late: COLORS.warning, excused: COLORS.info,
};
const gradeColor = (g: string | null) => {
  if (!g) return COLORS.textMuted;
  if (g.startsWith('A')) return COLORS.success;
  if (g.startsWith('B')) return COLORS.info;
  if (g.startsWith('C')) return COLORS.warning;
  return COLORS.error;
};

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function StudentDetailScreen({ route, navigation }: any) {
  const { studentId } = route.params ?? {};
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState({ enrollments: 0, submissions: 0, present: 0, total: 0, avgScore: 0 });
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    try {
      const [profileRes, academicRes, subsRes, enrRes, reportsRes, attRes] = await Promise.all([
        supabase.from('portal_users')
          .select('id, full_name, email, phone, school_name, section_class, date_of_birth, is_active, created_at')
          .eq('id', studentId).single(),
        supabase.from('students')
          .select('parent_email, parent_name, grade_level')
          .eq('user_id', studentId).maybeSingle(),
        supabase.from('assignment_submissions')
          .select('id, status, grade, feedback, submitted_at, assignments(title, max_score, type)')
          .eq('portal_user_id', studentId)
          .order('submitted_at', { ascending: false }).limit(40),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', studentId),
        supabase.from('student_progress_reports')
          .select('id, course_name, report_term, overall_grade, overall_score, report_date, is_published, theory_score, practical_score, attendance_score')
          .eq('student_id', studentId)
          .order('report_date', { ascending: false }).limit(20),
        supabase.from('attendance')
          .select('id, status, created_at, class_sessions(session_date, classes(name))')
          .eq('user_id', studentId)
          .order('created_at', { ascending: false }).limit(60),
      ]);

      if (profileRes.data) {
        setStudent({
          ...(profileRes.data as StudentProfile),
          parent_email: academicRes.data?.parent_email,
          parent_name: academicRes.data?.parent_name,
          grade_level: academicRes.data?.grade_level,
        });
      }
      const subs = (subsRes.data ?? []) as unknown as Submission[];
      setSubmissions(subs);
      const rpts = (reportsRes.data ?? []) as Report[];
      setReports(rpts);
      const att = (attRes.data ?? []) as unknown as AttendanceRow[];
      setAttendance(att);

      const presentCount = att.filter(a => a.status === 'present').length;
      const scores = rpts.filter(r => r.overall_score != null).map(r => r.overall_score!);
      setStats({
        enrollments: enrRes.count ?? 0,
        submissions: subs.length,
        present: presentCount,
        total: att.length,
        avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  if (loading) return (
    <View style={s.loadWrap}><ActivityIndicator color={COLORS.admin} size="large" /></View>
  );

  if (!student) return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader title="Student" onBack={() => navigation.goBack()} />
      <View style={s.emptyWrap}><Text style={s.emptyText}>Student not found.</Text></View>
    </SafeAreaView>
  );

  const attendancePct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : null;
  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: 'overview', label: 'Overview', emoji: '👤' },
    { key: 'grades', label: 'Grades', emoji: '📊' },
    { key: 'attendance', label: 'Attendance', emoji: '📋' },
    { key: 'work', label: 'Work', emoji: '📝' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScreenHeader title="Student Profile" onBack={() => navigation.goBack()} accentColor={COLORS.admin} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.admin} />}>

        {/* Hero */}
        <MotiView from={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
          <View style={s.heroCard}>
            <LinearGradient colors={[COLORS.admin + '12', 'transparent']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={COLORS.gradPrimary as [string, string, ...string[]]} style={s.avatar}>
              <Text style={s.avatarInitial}>{student.full_name[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={s.heroName}>{student.full_name}</Text>
            <Text style={s.heroEmail}>{student.email}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {student.school_name ? <Text style={s.schoolTag}>🏫 {student.school_name}</Text> : null}
              {student.grade_level ? <Text style={s.schoolTag}>📚 {student.grade_level}</Text> : null}
            </View>
            <View style={[s.statusPill, { backgroundColor: student.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
              <View style={[s.statusDot, { backgroundColor: student.is_active ? COLORS.success : COLORS.error }]} />
              <Text style={[s.statusText, { color: student.is_active ? COLORS.success : COLORS.error }]}>
                {student.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Stats strip */}
        <View style={s.statsRow}>
          {[
            { label: 'Courses', value: stats.enrollments, color: COLORS.info, emoji: '📚' },
            { label: 'Attendance', value: attendancePct != null ? `${attendancePct}%` : '—', color: attendancePct != null && attendancePct >= 70 ? COLORS.success : COLORS.warning, emoji: '📋' },
            { label: 'Avg Score', value: stats.avgScore > 0 ? `${stats.avgScore}%` : '—', color: COLORS.accent, emoji: '🎯' },
            { label: 'Submitted', value: stats.submissions, color: '#7c3aed', emoji: '📝' },
          ].map((st, i) => (
            <MotiView key={st.label} from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: i * 60 }} style={s.statCard}>
              <LinearGradient colors={[st.color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: 18 }}>{st.emoji}</Text>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </MotiView>
          ))}
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <Text style={s.tabEmoji}>{t.emoji}</Text>
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <View style={s.card}>
              <LinearGradient colors={[COLORS.white05, 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={s.cardTitle}>Details</Text>
              {[
                { label: 'Class', value: student.section_class, emoji: '🎒' },
                { label: 'Phone', value: student.phone, emoji: '📞' },
                { label: 'Date of Birth', value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : null, emoji: '🎂' },
                { label: 'Joined', value: new Date(student.created_at).toLocaleDateString('en-GB'), emoji: '📅' },
              ].filter(f => f.value).map((f, i) => (
                <View key={f.label} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.infoEmoji}>{f.emoji}</Text>
                  <Text style={s.infoLabel}>{f.label}</Text>
                  <Text style={s.infoValue}>{f.value}</Text>
                </View>
              ))}
            </View>
            <View style={s.card}>
              <LinearGradient colors={[COLORS.white05, 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={s.cardTitle}>Parent / Guardian</Text>
              {student.parent_email ? (
                <>
                  <View style={s.infoRow}>
                    <Text style={s.infoEmoji}>👪</Text>
                    <Text style={s.infoLabel}>Name</Text>
                    <Text style={s.infoValue}>{student.parent_name || 'Linked'}</Text>
                  </View>
                  <View style={[s.infoRow, s.infoRowBorder]}>
                    <Text style={s.infoEmoji}>📧</Text>
                    <Text style={s.infoLabel}>Email</Text>
                    <Text style={s.infoValue}>{student.parent_email}</Text>
                  </View>
                </>
              ) : (
                <View style={s.infoRow}>
                  <Text style={s.infoEmoji}>⚠️</Text>
                  <Text style={s.infoLabel}>No parent linked</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={s.actionBtn} activeOpacity={0.8}
              onPress={() => navigation.navigate('StudentReport', { studentId, studentName: student.full_name })}>
              <LinearGradient colors={[COLORS.accent + '18', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={s.actionBtnText}>📋  View Full Report</Text>
            </TouchableOpacity>
          </MotiView>
        )}

        {/* ── GRADES ── */}
        {tab === 'grades' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {reports.length === 0 ? <EmptyState emoji="📊" title="No Reports Yet" sub="Progress reports will appear here once published." /> : (
              reports.map((r, i) => (
                <MotiView key={r.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                  <View style={s.reportCard}>
                    <LinearGradient colors={[COLORS.white05, 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={s.reportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reportCourse}>{r.course_name ?? 'General'}</Text>
                        <Text style={s.reportMeta}>
                          {r.report_term ?? '—'} · {r.report_date ? new Date(r.report_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : '—'}
                        </Text>
                      </View>
                      <View style={[s.gradeChip, { borderColor: gradeColor(r.overall_grade) + '55' }]}>
                        <Text style={[s.gradeText, { color: gradeColor(r.overall_grade) }]}>{r.overall_grade ?? '—'}</Text>
                      </View>
                    </View>
                    {[
                      { label: 'Theory', value: r.theory_score },
                      { label: 'Practical', value: r.practical_score },
                      { label: 'Attendance', value: r.attendance_score },
                    ].filter(sc => sc.value != null).map(sc => (
                      <View key={sc.label} style={s.scoreRow}>
                        <Text style={s.scoreLabel}>{sc.label}</Text>
                        <View style={s.scoreBarBg}>
                          <MotiView from={{ width: '0%' as any }} animate={{ width: `${Math.min(sc.value!, 100)}%` as any }}
                            transition={{ type: 'timing', duration: 600, delay: i * 50 }}
                            style={[s.scoreBarFill, { backgroundColor: sc.value! >= 70 ? COLORS.success : sc.value! >= 50 ? COLORS.warning : COLORS.error }]} />
                        </View>
                        <Text style={s.scoreNum}>{sc.value}%</Text>
                      </View>
                    ))}
                    {!r.is_published && <View style={s.draftBadge}><Text style={s.draftText}>DRAFT</Text></View>}
                  </View>
                </MotiView>
              ))
            )}
          </MotiView>
        )}

        {/* ── ATTENDANCE ── */}
        {tab === 'attendance' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {attendance.length > 0 && (
              <View style={s.attSummary}>
                {(['present', 'absent', 'late', 'excused'] as const).map(status => (
                  <View key={status} style={s.attSummaryItem}>
                    <Text style={[s.attSummaryCount, { color: STATUS_COLOR[status] }]}>
                      {attendance.filter(a => a.status === status).length}
                    </Text>
                    <Text style={s.attSummaryLabel}>{status}</Text>
                  </View>
                ))}
              </View>
            )}
            {attendance.length === 0 ? <EmptyState emoji="📋" title="No Attendance Records" sub="Attendance will appear here once classes are marked." /> : (
              attendance.map((a, i) => {
                const color = STATUS_COLOR[a.status] ?? COLORS.textMuted;
                const dateStr = a.class_sessions?.session_date
                  ? new Date(a.class_sessions.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
                  : new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
                return (
                  <MotiView key={a.id} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 25 }}>
                    <View style={[s.attRow, i > 0 && s.attRowBorder]}>
                      <View style={[s.attDot, { backgroundColor: color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.attClass}>{a.class_sessions?.classes?.name ?? 'Class'}</Text>
                        <Text style={s.attDate}>{dateStr}</Text>
                      </View>
                      <View style={[s.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                        <Text style={[s.pillText, { color }]}>{a.status}</Text>
                      </View>
                    </View>
                  </MotiView>
                );
              })
            )}
          </MotiView>
        )}

        {/* ── WORK ── */}
        {tab === 'work' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {submissions.length === 0 ? <EmptyState emoji="📝" title="No Submissions" sub="Assignment submissions will appear here." /> : (
              submissions.map((sub, i) => {
                const max = sub.assignments?.max_score ?? 100;
                const pct = sub.grade != null ? Math.round((sub.grade / max) * 100) : null;
                const gc = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                const sc = sub.status === 'graded' ? COLORS.success : sub.status === 'submitted' ? COLORS.info : COLORS.warning;
                return (
                  <MotiView key={sub.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                    <View style={s.workCard}>
                      <LinearGradient colors={[COLORS.white05, 'transparent']} style={StyleSheet.absoluteFill} />
                      <View style={s.workHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.workTitle}>{sub.assignments?.title ?? 'Assignment'}</Text>
                          <Text style={s.workMeta}>
                            {sub.assignments?.type ?? 'Assignment'} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Pending'}
                          </Text>
                        </View>
                        {sub.grade != null && (
                          <View style={[s.gradeChip, { borderColor: gc + '55' }]}>
                            <Text style={[s.gradeText, { color: gc }]}>{sub.grade}/{max}</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.workStatusRow}>
                        <View style={[s.pill, { backgroundColor: sc + '22', borderColor: sc + '55' }]}>
                          <Text style={[s.pillText, { color: sc }]}>{sub.status}</Text>
                        </View>
                        {pct != null && (
                          <View style={[s.scoreBarBg, { flex: 1 }]}>
                            <MotiView from={{ width: '0%' as any }} animate={{ width: `${pct}%` as any }}
                              transition={{ type: 'timing', duration: 500, delay: i * 40 }}
                              style={[s.scoreBarFill, { backgroundColor: gc }]} />
                          </View>
                        )}
                      </View>
                      {sub.feedback ? <Text style={s.feedbackText}>💬 {sub.feedback}</Text> : null}
                    </View>
                  </MotiView>
                );
              })
            )}
          </MotiView>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Empty state helper ─────────────────────────────────────────────────────────
function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <View style={s.emptyCard}>
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
      <Text style={s.emptyCardTitle}>{title}</Text>
      <Text style={s.emptyCardSub}>{sub}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  heroCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md, overflow: 'hidden'
  },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.white100 },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, textAlign: 'center' },
  heroEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  schoolTag: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  statsRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  statCard: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, alignItems: 'center', gap: 3, overflow: 'hidden'
  },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 8, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  tabBar: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: RADIUS.md, gap: 2
  },
  tabBtnActive: { borderColor: COLORS.admin, backgroundColor: COLORS.admin + '14' },
  tabEmoji: { fontSize: 15 },
  tabLabel: { fontFamily: FONT_FAMILY.body, fontSize: 8, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabLabelActive: { color: COLORS.admin, fontFamily: FONT_FAMILY.bodySemi },

  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  cardTitle: {
    fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2, padding: SPACING.md, paddingBottom: SPACING.xs
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 11, gap: SPACING.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoEmoji: { fontSize: 16, width: 24 },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  actionBtn: {
    paddingVertical: 13, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.accent + '44', alignItems: 'center', overflow: 'hidden', marginBottom: SPACING.md
  },
  actionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.accent },

  reportCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.xs
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  reportCourse: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  reportMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  gradeChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  gradeText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 72 },
  scoreBarBg: { flex: 1, height: 5, backgroundColor: COLORS.white08, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 5, borderRadius: 3 },
  scoreNum: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, width: 34, textAlign: 'right' },
  draftBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.warning + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xs, paddingVertical: 2 },
  draftText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 8, color: COLORS.warning, letterSpacing: 1 },

  attSummary: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  attSummaryItem: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', gap: 2 },
  attSummaryCount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  attSummaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: 8, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 11, paddingHorizontal: SPACING.sm },
  attRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  attDot: { width: 8, height: 8, borderRadius: 4 },
  attClass: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  attDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  pillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },

  workCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.xs },
  workHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  workTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  workMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  workStatusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feedbackText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 2 },

  emptyCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING['2xl'], alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  emptyCardTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  emptyCardSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
});

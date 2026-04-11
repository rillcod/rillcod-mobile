import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { schoolService } from '../../services/school.service';
import { gradeService } from '../../services/grade.service';
import { teacherService } from '../../services/teacher.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  section_class: string | null;
  report?: ReportSummary;
}

interface ReportSummary {
  id: string;
  overall_grade: string | null;
  overall_score: number | null;
  is_published: boolean;
  course_name: string;
  report_term: string;
  report_date: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#22c55e', A: '#22c55e',
  'B+': '#10b981', B: '#10b981',
  'C+': '#f59e0b', C: '#f59e0b',
  D: '#f97316', F: '#ef4444',
};

function gradeColor(g: string | null | undefined) {
  return GRADE_COLOR[g ?? ''] ?? COLORS.textMuted;
}

function GradeBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  const grades = ['A', 'B', 'C', 'D', 'F'];
  const colors = [COLORS.success, '#10b981', COLORS.warning, '#f97316', COLORS.error];
  const max = Math.max(...grades.map(g => counts[g] ?? 0), 1);
  return (
    <View style={dist.wrap}>
      {grades.map((g, i) => {
        const count = counts[g] ?? 0;
        const height = max > 0 ? Math.max((count / max) * 56, count > 0 ? 4 : 0) : 0;
        return (
          <View key={g} style={dist.col}>
            <Text style={dist.count}>{count > 0 ? count : ''}</Text>
            <View style={dist.barWrap}>
              <MotiView
                from={{ height: 0 }}
                animate={{ height }}
                transition={{ type: 'timing', duration: 700, delay: i * 80 }}
                style={[dist.bar, { backgroundColor: colors[i] }]}
              />
            </View>
            <Text style={[dist.label, { color: colors[i] }]}>{g}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ReportsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [filtered, setFiltered] = useState<StudentRow[]>([]);
  const [ownReport, setOwnReport] = useState<any>(null);
  const [childReports, setChildReports] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'none'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gradeCounts, setGradeCounts] = useState<Record<string, number>>({});

  const isStudent = profile?.role === 'student';
  const isParent = profile?.role === 'parent';
  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';
  const isEditor = isStaff;

  const load = useCallback(async () => {
    if (isStudent) {
      const latest = await gradeService.getLatestPublishedReportForStudent(profile!.id);
      setOwnReport(latest);
      setLoading(false);
      return;
    }

    if (isParent) {
      const childIds = await schoolService.getParentStudentIds();
      const ids = ((childIds ?? []) as string[]).filter(Boolean);
      if (!ids.length) {
        setChildReports([]);
        setFiltered([]);
        setLoading(false);
        return;
      }

      const [children, reports] = await Promise.all([
        gradeService.listPortalStudentsByIds(ids),
        gradeService.listPublishedReportSummariesForStudentIds(ids),
      ]);

      const repMap: Record<string, ReportSummary> = {};
      (reports ?? []).forEach((r: any) => {
        if (!repMap[r.student_id]) repMap[r.student_id] = r as ReportSummary;
      });

      const rows: StudentRow[] = (children ?? []).map((student: any) => ({
        ...student,
        report: repMap[student.id],
      }));
      setChildReports(rows);
      setFiltered(rows);
      setLoading(false);
      return;
    }

    // Staff: load students + latest report per student (scope aligned with AnalyticsScreen)
    const isTeacherRole = profile?.role === 'teacher';
    const isSchoolRole = profile?.role === 'school';

    let teacherSchoolIds: string[] = [];
    if (isTeacherRole && profile) {
      teacherSchoolIds = await teacherService.listSchoolIdsForTeacher(profile.id, profile.school_id);
    }

    const stuData = await gradeService.listStudentsForReportDirectory({
      schoolId: isSchoolRole ? profile?.school_id ?? undefined : undefined,
      teacherSchoolIds: isTeacherRole && teacherSchoolIds.length > 0 ? teacherSchoolIds : undefined,
      limit: 200,
    });
    if (!stuData?.length) {
      setStudents([]);
      setFiltered([]);
      setGradeCounts({});
      setLoading(false);
      return;
    }

    const studentIds = stuData.map(s => s.id);

    const repData = await gradeService.listPublishedReportSummariesForStudentsScoped(
      studentIds,
      isTeacherRole && teacherSchoolIds.length > 0
        ? { schoolIds: teacherSchoolIds }
        : isSchoolRole && profile?.school_id
          ? { schoolId: profile.school_id }
          : undefined,
    );

    // Map: student_id → latest report
    const repMap: Record<string, ReportSummary> = {};
    (repData ?? []).forEach((r: any) => {
      if (!repMap[r.student_id]) repMap[r.student_id] = r as ReportSummary;
    });

    const rows: StudentRow[] = stuData.map(s => ({
      ...s,
      report: repMap[s.id],
    }));
    setStudents(rows);
    setFiltered(rows);

    // Grade distribution
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      if (r.report?.overall_grade) {
        const g = r.report.overall_grade[0].toUpperCase();
        counts[g] = (counts[g] ?? 0) + 1;
      }
    });
    setGradeCounts(counts);
    setLoading(false);
  }, [profile, isStudent, isParent]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isStudent) return;
    let list = isParent ? childReports : students;
    if (statusFilter === 'published') list = list.filter(s => s.report?.is_published === true);
    else if (statusFilter === 'draft') list = list.filter(s => s.report && !s.report.is_published);
    else if (statusFilter === 'none') list = list.filter(s => !s.report);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.school_name ?? '').toLowerCase().includes(q) ||
        (s.section_class ?? '').toLowerCase().includes(q) ||
        (s.report?.course_name ?? '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, statusFilter, students, childReports, isStudent, isParent]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={styles.loadText}>Loading reports…</Text>
      </View>
    );
  }

  // ── STUDENT VIEW ────────────────────────────────────────────────────────────
  if (isStudent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <Text style={styles.title}>My Report Card</Text>
        </View>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {!ownReport ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No published report yet.</Text>
              <Text style={styles.emptyHint}>Your teacher will publish your report card when it's ready.</Text>
            </View>
          ) : (
            <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <ReportDetailCard report={ownReport} studentName={profile?.full_name ?? ''} />
            </MotiView>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isParent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Children's Reports</Text>
            <Text style={styles.subtitle}>{filtered.length} linked learners</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search child, class, course…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No linked reports yet.</Text>
              <Text style={styles.emptyHint}>Published reports for your children will appear here.</Text>
            </View>
          ) : (
            filtered.map((student, index) => {
              const gc = gradeColor(student.report?.overall_grade);
              return (
                <MotiView key={student.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 25 }}>
                  <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate(ROUTES.StudentReport, { studentId: student.id, studentName: student.full_name })}
                  >
                    <LinearGradient colors={[gc + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.avatar, { backgroundColor: gc + '22' }]}>
                      <Text style={[styles.avatarText, { color: gc }]}>{student.full_name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.studentName}>{student.full_name}</Text>
                      <View style={styles.metaRow}>
                        {student.school_name ? <Text style={styles.metaText} numberOfLines={1}>🏫 {student.school_name}</Text> : null}
                        {student.section_class ? <Text style={styles.metaText}>📚 {student.section_class}</Text> : null}
                      </View>
                      {student.report ? (
                        <Text style={styles.courseMeta}>{student.report.course_name} · {student.report.report_term}</Text>
                      ) : (
                        <Text style={styles.courseMeta}>No published report yet</Text>
                      )}
                    </View>
                    {student.report ? (
                      <View style={styles.gradeBlock}>
                        <Text style={[styles.gradeMain, { color: gc }]}>{student.report.overall_grade ?? '—'}</Text>
                        <Text style={styles.gradeSub}>{student.report.overall_score ?? 0}%</Text>
                      </View>
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </TouchableOpacity>
                </MotiView>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STAFF VIEW ──────────────────────────────────────────────────────────────
  const withReport = students.filter(s => s.report).length;
  const published = students.filter(s => s.report?.is_published).length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Progress Reports</Text>
          <Text style={styles.subtitle}>{published} published · {withReport} total reports</Text>
        </View>
        {isEditor && (
          <TouchableOpacity
            style={styles.buildBtn}
            onPress={() => navigation.navigate(ROUTES.ReportBuilder)}
          >
            <Text style={styles.buildBtnText}>+ Build</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grade distribution */}
      {Object.keys(gradeCounts).length > 0 && (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.distCard}>
          <LinearGradient colors={[COLORS.accent + '10', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.distTitle}>Grade Distribution</Text>
          <GradeBar counts={gradeCounts} total={students.length} />
          <Text style={styles.distMeta}>{students.length - withReport} students without report</Text>
        </MotiView>
      )}

      {/* Search + filter */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search student, class, course…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all', 'published', 'draft', 'none'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            style={[styles.filterPill, statusFilter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
              {f === 'none' ? 'No Report' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No students match this filter.</Text>
          </View>
        ) : (
          filtered.map((s, i) => {
            const gc = gradeColor(s.report?.overall_grade);
            const status = !s.report ? 'none' : s.report.is_published ? 'published' : 'draft';
            const statusColors = { published: COLORS.success, draft: COLORS.warning, none: COLORS.textMuted };
            const statusLabels = { published: '✓ Published', draft: '⏳ Draft', none: 'No Report' };

            return (
              <MotiView key={s.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 25 }}>
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate(ROUTES.ReportBuilder, { studentId: s.id, studentName: s.full_name })}
                >
                  <LinearGradient colors={[gc + '08', 'transparent']} style={StyleSheet.absoluteFill} />

                  {/* Avatar */}
                  <View style={[styles.avatar, { backgroundColor: gc + '22' }]}>
                    <Text style={[styles.avatarText, { color: gc }]}>{s.full_name[0].toUpperCase()}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.studentName}>{s.full_name}</Text>
                    <View style={styles.metaRow}>
                      {s.school_name ? <Text style={styles.metaText} numberOfLines={1}>🏫 {s.school_name}</Text> : null}
                      {s.section_class ? <Text style={styles.metaText}>📚 {s.section_class}</Text> : null}
                    </View>
                    {s.report ? (
                      <Text style={styles.courseMeta}>{s.report.course_name} · {s.report.report_term}</Text>
                    ) : null}
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[status] + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColors[status] }]}>{statusLabels[status]}</Text>
                    </View>
                  </View>

                  {/* Grade */}
                  {s.report ? (
                    <View style={styles.gradeBlock}>
                      <Text style={[styles.gradeText, { color: gc }]}>{s.report.overall_grade ?? '—'}</Text>
                      {s.report.overall_score != null && (
                        <Text style={[styles.scoreText, { color: gc }]}>{s.report.overall_score}%</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noReportIcon}>›</Text>
                  )}
                </TouchableOpacity>
              </MotiView>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Full report detail card (student view) ────────────────────────────────────
function ReportDetailCard({ report, studentName }: { report: any; studentName: string }) {
  const gc = gradeColor(report.overall_grade);

  function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
    return (
      <View style={rdc.scoreWrap}>
        <Text style={rdc.scoreLabel}>{label}</Text>
        <View style={rdc.barTrack}>
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${Math.min(value ?? 0, 100)}%` }}
            transition={{ type: 'timing', duration: 800 }}
            style={[rdc.barFill, { backgroundColor: color }]}
          />
        </View>
        <Text style={[rdc.scoreVal, { color }]}>{value ?? '—'}{value != null ? '%' : ''}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Grade hero */}
      <View style={[rdc.hero, { borderColor: gc + '40' }]}>
        <LinearGradient colors={[gc + '15', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={[rdc.gradeBadge, { backgroundColor: gc + '20' }]}>
          <Text style={[rdc.gradeMain, { color: gc }]}>{report.overall_grade ?? '—'}</Text>
          <Text style={[rdc.gradeScore, { color: gc }]}>{report.overall_score ?? '—'}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rdc.heroName}>{studentName}</Text>
          <Text style={rdc.heroCourse}>{report.course_name}</Text>
          <Text style={rdc.heroTerm}>{report.report_term}</Text>
          {report.instructor_name ? <Text style={rdc.heroInstructor}>👩‍🏫 {report.instructor_name}</Text> : null}
        </View>
      </View>

      {/* Score breakdown */}
      <View style={rdc.section}>
        <Text style={rdc.sectionTitle}>Score Breakdown</Text>
        <View style={rdc.scoresCard}>
          <ScoreBar label="Theory" value={report.theory_score} color={COLORS.info} />
          <ScoreBar label="Practical" value={report.practical_score} color="#7c3aed" />
          <ScoreBar label="Attendance" value={report.attendance_score} color={COLORS.success} />
          {report.participation_score != null && (
            <ScoreBar label="Participation" value={report.participation_score} color={COLORS.warning} />
          )}
        </View>
      </View>

      {/* Grades grid */}
      {(report.participation_grade || report.projects_grade || report.homework_grade) && (
        <View style={rdc.section}>
          <Text style={rdc.sectionTitle}>Performance Ratings</Text>
          <View style={rdc.gradesGrid}>
            {[
              { label: 'Participation', value: report.participation_grade },
              { label: 'Projects', value: report.projects_grade },
              { label: 'Homework', value: report.homework_grade },
            ].filter(g => g.value).map(g => (
              <View key={g.label} style={rdc.gradeItem}>
                <Text style={rdc.gradeItemVal}>{g.value}</Text>
                <Text style={rdc.gradeItemLabel}>{g.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Milestones */}
      {report.learning_milestones && (
        <View style={rdc.section}>
          <Text style={rdc.sectionTitle}>Learning Milestones</Text>
          <View style={rdc.milestonesCard}>
            {(Array.isArray(report.learning_milestones)
              ? report.learning_milestones
              : typeof report.learning_milestones === 'string'
                ? report.learning_milestones.split('\n').filter(Boolean)
                : []
            ).map((m: string, i: number) => (
              <View key={i} style={rdc.milestone}>
                <Text style={rdc.milestoneCheck}>✓</Text>
                <Text style={rdc.milestoneText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Key strengths / areas for growth / assessment */}
      {(report.key_strengths || report.areas_for_growth || report.instructor_assessment) && (
        <View style={rdc.section}>
          <Text style={rdc.sectionTitle}>Teacher's Notes</Text>
          {report.key_strengths ? (
            <View style={[rdc.notesCard, { borderLeftColor: COLORS.success }]}>
              <Text style={rdc.notesHeading}>💪 Key Strengths</Text>
              <Text style={rdc.notesText}>{report.key_strengths}</Text>
            </View>
          ) : null}
          {report.areas_for_growth ? (
            <View style={[rdc.notesCard, { borderLeftColor: COLORS.warning, marginTop: SPACING.sm }]}>
              <Text style={rdc.notesHeading}>🌱 Areas for Growth</Text>
              <Text style={rdc.notesText}>{report.areas_for_growth}</Text>
            </View>
          ) : null}
          {report.instructor_assessment ? (
            <View style={[rdc.notesCard, { borderLeftColor: COLORS.info, marginTop: SPACING.sm }]}>
              <Text style={rdc.notesHeading}>📋 Instructor Assessment</Text>
              <Text style={rdc.notesText}>{report.instructor_assessment}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Footer info */}
      <View style={rdc.footer}>
        {report.report_date ? <Text style={rdc.footerText}>📅 {new Date(report.report_date).toLocaleDateString('en-GB')}</Text> : null}
        {report.current_module ? <Text style={rdc.footerText}>📖 Current: {report.current_module}</Text> : null}
        {report.next_module ? <Text style={rdc.footerText}>🚀 Next: {report.next_module}</Text> : null}
      </View>
    </View>
  );
}

const rdc = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, overflow: 'hidden' },
  gradeBadge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 },
  gradeMain: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  gradeScore: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  heroCourse: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  heroTerm: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  heroInstructor: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 3 },
  section: { marginBottom: SPACING.md },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.sm },
  scoresCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.md, backgroundColor: COLORS.bgCard },
  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 78 },
  barTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  scoreVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, width: 36, textAlign: 'right' },
  gradesGrid: { flexDirection: 'row', gap: SPACING.sm },
  gradeItem: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', gap: 3, backgroundColor: COLORS.bgCard },
  gradeItemVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  gradeItemLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  milestonesCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  milestone: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  milestoneCheck: { color: COLORS.success, fontSize: 14, marginTop: 1 },
  milestoneText: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  notesCard: { borderLeftWidth: 3, borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  notesHeading: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 6 },
  notesText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  footer: { gap: 5, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  footerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
});

const dist = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.md, height: 80 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  count: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, height: 14 },
  barWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  buildBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.accent, alignItems: 'center' },
  buildBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },

  distCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, overflow: 'hidden' },
  distTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  distMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.xs, textAlign: 'right' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },

  filters: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterActive: { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.accent },

  list: { paddingHorizontal: SPACING.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  studentName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  courseMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  gradeBlock: { alignItems: 'center', gap: 2 },
  gradeText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  scoreText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  noReportIcon: { fontSize: 20, color: COLORS.textMuted },
  gradeMain: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  gradeSub: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  chevron: { fontSize: 20, color: COLORS.textMuted },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  emptyHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

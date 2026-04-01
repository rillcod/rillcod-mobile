import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Report {
  id: string;
  course_name: string | null;
  report_term: string | null;
  report_date: string | null;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  overall_score: number | null;
  overall_grade: string | null;
  is_published: boolean | null;
  instructor_name: string | null;
  learning_milestones: string[] | null;
  key_strengths: string | null;
  areas_for_growth: string | null;
}

interface SubmissionSummary {
  id: string;
  status: string | null;
  grade: number | null;
}

interface CbtSummary {
  id: string;
  status: string | null;
  score: number | null;
}

function gradeColor(grade: string | null): string {
  if (!grade) return COLORS.textMuted;
  if (grade.startsWith('A')) return COLORS.success;
  if (grade.startsWith('B')) return COLORS.info;
  if (grade.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

export default function GradesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [cbtSessions, setCbtSessions] = useState<CbtSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isParent = profile?.role === 'parent';

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      let targetIds: string[] = [];
      if (isParent) {
        const { data } = await supabase.rpc('get_parent_student_ids');
        targetIds = (data ?? []).filter(Boolean);
      } else {
        targetIds = [profile.id];
      }

      if (!targetIds.length) {
        setReports([]);
        setSubmissions([]);
        setCbtSessions([]);
        return;
      }

      const [reportRes, submissionRes, cbtRes] = await Promise.all([
        supabase
          .from('student_progress_reports')
          .select('id, course_name, report_term, report_date, theory_score, practical_score, attendance_score, overall_score, overall_grade, is_published, instructor_name, learning_milestones, key_strengths, areas_for_growth')
          .in('student_id', targetIds)
          .eq('is_published', true)
          .order('report_date', { ascending: false }),
        supabase
          .from('assignment_submissions')
          .select('id, status, grade')
          .in('portal_user_id', targetIds)
          .limit(200),
        supabase
          .from('cbt_sessions')
          .select('id, status, score')
          .in('user_id', targetIds)
          .limit(200),
      ]);

      setReports((reportRes.data ?? []) as Report[]);
      setSubmissions((submissionRes.data ?? []) as SubmissionSummary[]);
      setCbtSessions((cbtRes.data ?? []) as CbtSummary[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, isParent]);

  useEffect(() => { load(); }, [load]);

  const avgScore = useMemo(() => {
    const valid = reports.filter((report) => report.overall_score != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((sum, report) => sum + (report.overall_score ?? 0), 0) / valid.length);
  }, [reports]);

  const assignmentAvg = useMemo(() => {
    const valid = submissions.filter((submission) => submission.grade != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((sum, submission) => sum + (submission.grade ?? 0), 0) / valid.length);
  }, [submissions]);

  const cbtAvg = useMemo(() => {
    const valid = cbtSessions.filter((session) => session.score != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((sum, session) => sum + (session.score ?? 0), 0) / valid.length);
  }, [cbtSessions]);

  const latestGrade = reports[0]?.overall_grade ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isParent ? "Children's Grades" : 'My Grades'}</Text>
            <Text style={styles.subtitle}>Reports, assignment marks, and CBT performance</Text>
          </View>
        </View>

        {!loading && (
          <View style={styles.summaryGrid}>
            {[
              { label: 'Reports', value: reports.length, color: COLORS.primary },
              { label: 'Report Avg', value: avgScore != null ? `${avgScore}%` : '—', color: COLORS.success },
              { label: 'Assignments', value: assignmentAvg != null ? `${assignmentAvg}%` : '—', color: COLORS.info },
              { label: 'CBT Avg', value: cbtAvg != null ? `${cbtAvg}%` : '—', color: COLORS.warning },
            ].map((item) => (
              <View key={item.label} style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {!loading && latestGrade && (
          <View style={styles.latestBanner}>
            <Text style={styles.latestLabel}>Latest Grade</Text>
            <Text style={[styles.latestValue, { color: gradeColor(latestGrade) }]}>{latestGrade}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No published grades yet</Text>
            <Text style={styles.emptyText}>
              Published report cards will appear here once your academic record is ready.
            </Text>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {reports.map((report, index) => {
              const isOpen = expanded === report.id;
              const gc = gradeColor(report.overall_grade);
              return (
                <MotiView
                  key={report.id}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: index * 50 }}
                >
                  <TouchableOpacity
                    style={[styles.reportCard, isOpen && { borderColor: COLORS.primary + '55' }]}
                    onPress={() => setExpanded(isOpen ? null : report.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.reportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseName}>{report.course_name ?? 'Progress Report'}</Text>
                        <Text style={styles.termText}>
                          {(report.report_term ?? 'Report') + (report.report_date ? ` · ${new Date(report.report_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : '')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.grade, { color: gc }]}>{report.overall_grade ?? '—'}</Text>
                        <Text style={[styles.scoreText, { color: gc }]}>{report.overall_score ?? 0}%</Text>
                      </View>
                    </View>

                    <View style={styles.scoreBars}>
                      {[
                        { label: 'Theory', val: report.theory_score },
                        { label: 'Practical', val: report.practical_score },
                        { label: 'Attendance', val: report.attendance_score },
                      ].map(({ label, val }) => (
                        <View key={label} style={styles.scoreRow}>
                          <Text style={styles.scoreLabel}>{label}</Text>
                          <View style={styles.barBg}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${val ?? 0}%`,
                                  backgroundColor: (val ?? 0) >= 70 ? COLORS.success : (val ?? 0) >= 50 ? COLORS.warning : COLORS.error,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.scoreNum}>{val ?? 0}</Text>
                        </View>
                      ))}
                    </View>

                    {isOpen && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' as any }}
                        style={styles.expandedContent}
                      >
                        {report.instructor_name ? (
                          <Text style={styles.instructor}>Instructor: {report.instructor_name}</Text>
                        ) : null}
                        {report.key_strengths ? (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.success }]}>Key Strengths</Text>
                            <Text style={styles.infoBoxText}>{report.key_strengths}</Text>
                          </View>
                        ) : null}
                        {report.areas_for_growth ? (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.warning }]}>Areas for Growth</Text>
                            <Text style={styles.infoBoxText}>{report.areas_for_growth}</Text>
                          </View>
                        ) : null}
                        {report.learning_milestones && report.learning_milestones.length > 0 ? (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.info }]}>Milestones</Text>
                            {report.learning_milestones.map((milestone, milestoneIndex) => (
                              <Text key={milestoneIndex} style={[styles.infoBoxText, { marginTop: 2 }]}>• {milestone}</Text>
                            ))}
                          </View>
                        ) : null}
                      </MotiView>
                    )}

                    <Text style={styles.expandHint}>{isOpen ? '▲ Less' : '▼ Details'}</Text>
                  </TouchableOpacity>
                </MotiView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.base, marginBottom: SPACING.md },
  summaryCard: {
    width: '48%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  latestBanner: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  latestLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  latestValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  center: { paddingTop: 80, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm, paddingHorizontal: SPACING['2xl'] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted, textAlign: 'center' },
  reportsList: { padding: SPACING.base, gap: SPACING.md },
  reportCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
  },
  reportHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  courseName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  termText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  grade: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  scoreText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  scoreBars: { gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 70 },
  barBg: { flex: 1, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: RADIUS.full },
  scoreNum: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 26, textAlign: 'right' },
  expandedContent: { gap: SPACING.sm, overflow: 'hidden' },
  instructor: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  infoBox: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 4 },
  infoBoxLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoBoxText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.5 },
  expandHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
});

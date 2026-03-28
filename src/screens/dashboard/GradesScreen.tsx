import React, { useEffect, useState, useCallback } from 'react';
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
  course_name: string;
  report_term: string;
  report_date: string;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  overall_score: number | null;
  overall_grade: string | null;
  is_published: boolean;
  instructor_name: string | null;
  learning_milestones: string[] | null;
  key_strengths: string | null;
  areas_for_growth: string | null;
}

function gradeColor(grade: string | null): string {
  if (!grade) return COLORS.textMuted;
  if (grade.startsWith('A')) return COLORS.success;
  if (grade.startsWith('B')) return COLORS.info;
  if (grade.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

function scoreBar(score: number | null, max = 100): string {
  if (score == null) return '—';
  const pct = Math.round((score / max) * 100);
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
}

export default function GradesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      // Find student record
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!student) {
        setReports([]);
        return;
      }

      const { data } = await supabase
        .from('student_progress_reports')
        .select('id, course_name, report_term, report_date, theory_score, practical_score, attendance_score, overall_score, overall_grade, is_published, instructor_name, learning_milestones, key_strengths, areas_for_growth')
        .eq('student_id', student.id)
        .eq('is_published', true)
        .order('report_date', { ascending: false });

      setReports(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + (r.overall_score ?? 0), 0) / reports.length)
    : null;

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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Grades</Text>
        </View>

        {/* Summary */}
        {!loading && avgScore != null && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{reports.length}</Text>
              <Text style={styles.summaryLabel}>Reports</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>{avgScore}%</Text>
              <Text style={styles.summaryLabel}>Avg Score</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: gradeColor(reports[0]?.overall_grade ?? null) }]}>
                {reports[0]?.overall_grade ?? '—'}
              </Text>
              <Text style={styles.summaryLabel}>Latest Grade</Text>
            </View>
          </MotiView>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>
              Your teacher hasn't published any report cards yet.
            </Text>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {reports.map((r, i) => {
              const isOpen = expanded === r.id;
              const gc = gradeColor(r.overall_grade);
              return (
                <MotiView
                  key={r.id}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: i * 50 }}
                >
                  <TouchableOpacity
                    style={[styles.reportCard, isOpen && { borderColor: COLORS.primary + '55' }]}
                    onPress={() => setExpanded(isOpen ? null : r.id)}
                    activeOpacity={0.85}
                  >
                    {/* Card header */}
                    <View style={styles.reportHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseName}>{r.course_name}</Text>
                        <Text style={styles.termText}>{r.report_term} · {new Date(r.report_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</Text>
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.grade, { color: gc }]}>{r.overall_grade ?? '—'}</Text>
                        <Text style={[styles.scoreText, { color: gc }]}>{r.overall_score ?? 0}%</Text>
                      </View>
                    </View>

                    {/* Score bars */}
                    <View style={styles.scoreBars}>
                      {[
                        { label: 'Theory', val: r.theory_score },
                        { label: 'Practical', val: r.practical_score },
                        { label: 'Attendance', val: r.attendance_score },
                      ].map(({ label, val }) => (
                        <View key={label} style={styles.scoreRow}>
                          <Text style={styles.scoreLabel}>{label}</Text>
                          <View style={styles.barBg}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${val ?? 0}%` as any,
                                  backgroundColor: (val ?? 0) >= 70 ? COLORS.success : (val ?? 0) >= 50 ? COLORS.warning : COLORS.error,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.scoreNum}>{val ?? 0}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Expanded details */}
                    {isOpen && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' as any }}
                        style={styles.expandedContent}
                      >
                        {r.instructor_name && (
                          <Text style={styles.instructor}>👨‍🏫 {r.instructor_name}</Text>
                        )}
                        {r.key_strengths && (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.success }]}>💪 Key Strengths</Text>
                            <Text style={styles.infoBoxText}>{r.key_strengths}</Text>
                          </View>
                        )}
                        {r.areas_for_growth && (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.warning }]}>🌱 Areas for Growth</Text>
                            <Text style={styles.infoBoxText}>{r.areas_for_growth}</Text>
                          </View>
                        )}
                        {r.learning_milestones && r.learning_milestones.length > 0 && (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.info }]}>🏆 Milestones</Text>
                            {r.learning_milestones.map((m, mi) => (
                              <Text key={mi} style={[styles.infoBoxText, { marginTop: 2 }]}>• {m}</Text>
                            ))}
                          </View>
                        )}
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
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { width: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
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
  infoBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: 4,
  },
  infoBoxLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoBoxText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.5 },
  expandHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
});

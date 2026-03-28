import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Report {
  id: string;
  course_name: string;
  report_term: string;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  overall_score: number | null;
  overall_grade: string | null;
  is_published: boolean;
  report_date: string | null;
  instructor_name: string | null;
  learning_milestones: string[] | null;
  key_strengths: string | null;
  areas_for_growth: string | null;
}

function gradeColor(g: string | null): string {
  if (!g) return COLORS.textMuted;
  if (g.startsWith('A')) return COLORS.success;
  if (g.startsWith('B')) return COLORS.info;
  if (g.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

function scoreColor(score: number | null): string {
  if (score == null) return COLORS.textMuted;
  if (score >= 70) return COLORS.success;
  if (score >= 55) return COLORS.warning;
  return COLORS.error;
}

export default function ParentResultsScreen({ navigation, route }: any) {
  // studentId = students.id; userId = portal_users.id (student_progress_reports.student_id → portal_users)
  const { studentId, studentName, userId } = route.params ?? {};
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noPortalAccount, setNoPortalAccount] = useState(false);

  const load = async () => {
    try {
      // Resolve the portal_users.id: prefer passed userId, otherwise fetch from students table
      let portalUserId: string | null = userId ?? null;
      if (!portalUserId) {
        const { data: student } = await supabase
          .from('students').select('user_id').eq('id', studentId).maybeSingle();
        portalUserId = student?.user_id ?? null;
      }

      if (!portalUserId) {
        setNoPortalAccount(true);
        setReports([]);
        return;
      }

      setNoPortalAccount(false);
      const { data } = await supabase
        .from('student_progress_reports')
        .select('id, course_name, report_term, theory_score, practical_score, attendance_score, overall_score, overall_grade, is_published, report_date, instructor_name, learning_milestones, key_strengths, areas_for_growth')
        .eq('student_id', portalUserId)
        .eq('is_published', true)
        .order('report_date', { ascending: false });
      setReports((data ?? []) as Report[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [studentId, userId]);

  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + (r.overall_score ?? 0), 0) / reports.length)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Report Cards</Text>
          {studentName && <Text style={styles.subtitle}>{studentName}</Text>}
        </View>
        {avgScore != null && (
          <View style={styles.avgBadge}>
            <Text style={styles.avgLabel}>Avg</Text>
            <Text style={[styles.avgValue, { color: scoreColor(avgScore) }]}>{avgScore}%</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {noPortalAccount ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No portal account</Text>
              <Text style={styles.emptyText}>This child has no linked portal account. Reports appear once they register.</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No published reports</Text>
              <Text style={styles.emptyText}>Reports appear here once published by the teacher.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {reports.map((report, i) => {
                const isOpen = expandedId === report.id;
                return (
                  <MotiView
                    key={report.id}
                    from={{ opacity: 0, translateY: 12 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: i * 60 }}
                    style={styles.card}
                  >
                    {/* Summary row */}
                    <TouchableOpacity
                      onPress={() => setExpandedId(isOpen ? null : report.id)}
                      style={styles.cardRow}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseName}>{report.course_name}</Text>
                        <Text style={styles.termText}>
                          {report.report_term}
                          {report.report_date ? ` · ${new Date(report.report_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : ''}
                        </Text>
                      </View>
                      <View style={styles.gradeBadge}>
                        <Text style={[styles.gradeText, { color: gradeColor(report.overall_grade) }]}>
                          {report.overall_grade ?? '—'}
                        </Text>
                        {report.overall_score != null && (
                          <Text style={styles.scoreSmall}>{report.overall_score}%</Text>
                        )}
                      </View>
                      <Text style={[styles.chevron, { transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }]}>▾</Text>
                    </TouchableOpacity>

                    {/* Expanded detail */}
                    {isOpen && (
                      <View style={styles.expandedSection}>
                        {/* Score bars */}
                        {[
                          { label: 'Theory', value: report.theory_score },
                          { label: 'Practical', value: report.practical_score },
                          { label: 'Attendance', value: report.attendance_score },
                        ].map(({ label, value }) => (
                          <View key={label} style={styles.scoreBarWrap}>
                            <View style={styles.scoreBarHeader}>
                              <Text style={styles.scoreBarLabel}>{label}</Text>
                              <Text style={[styles.scoreBarValue, { color: scoreColor(value) }]}>
                                {value != null ? `${value}%` : '—'}
                              </Text>
                            </View>
                            <View style={styles.scoreBarBg}>
                              <View style={[
                                styles.scoreBarFill,
                                { width: `${Math.min(value ?? 0, 100)}%` as any, backgroundColor: scoreColor(value) },
                              ]} />
                            </View>
                          </View>
                        ))}

                        {/* Strengths */}
                        {report.key_strengths ? (
                          <View style={styles.infoBox}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.success }]}>Key Strengths</Text>
                            <Text style={styles.infoBoxText}>{report.key_strengths}</Text>
                          </View>
                        ) : null}

                        {/* Growth */}
                        {report.areas_for_growth ? (
                          <View style={[styles.infoBox, styles.infoBoxWarning]}>
                            <Text style={[styles.infoBoxLabel, { color: COLORS.warning }]}>Areas for Growth</Text>
                            <Text style={styles.infoBoxText}>{report.areas_for_growth}</Text>
                          </View>
                        ) : null}

                        {/* Milestones */}
                        {report.learning_milestones && report.learning_milestones.length > 0 && (
                          <View style={styles.milestonesBox}>
                            <Text style={styles.infoBoxLabel}>Learning Milestones</Text>
                            {report.learning_milestones.map((m, idx) => (
                              <View key={idx} style={styles.milestoneRow}>
                                <Text style={styles.milestoneCheck}>✓</Text>
                                <Text style={styles.milestoneText}>{m}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Footer */}
                        {report.instructor_name && (
                          <Text style={styles.instructorText}>Instructor: {report.instructor_name}</Text>
                        )}
                      </View>
                    )}
                  </MotiView>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
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
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  avgBadge: { alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  avgLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  avgValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  scroll: { padding: SPACING.base, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  list: { gap: SPACING.md },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.base, gap: SPACING.md },
  courseName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  termText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  gradeBadge: { alignItems: 'center' },
  gradeText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  scoreSmall: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  chevron: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  expandedSection: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.base, gap: SPACING.md },
  scoreBarWrap: { gap: 4 },
  scoreBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreBarLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreBarValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  scoreBarBg: { height: 6, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: RADIUS.full },
  infoBox: { padding: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.success + '33', borderRadius: RADIUS.sm },
  infoBoxWarning: { borderColor: COLORS.warning + '33' },
  infoBoxLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoBoxText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: FONT_SIZE.sm * 1.6 },
  milestonesBox: { padding: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, gap: 6 },
  milestoneRow: { flexDirection: 'row', gap: SPACING.sm },
  milestoneCheck: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.success },
  milestoneText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1, lineHeight: FONT_SIZE.sm * 1.5 },
  instructorText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'right' },
});

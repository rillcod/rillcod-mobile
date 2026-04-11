import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { gradeService } from '../../services/grade.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type ReportRow = {
  id: string;
  student_name: string | null;
  school_name: string | null;
  section_class: string | null;
  course_name: string | null;
  overall_score: number | null;
  overall_grade: string | null;
  theory_score: number | null;
  practical_score: number | null;
  report_term: string | null;
  report_date: string | null;
  is_published: boolean | null;
};

export default function ProgressScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const canView = profile?.role === 'school' || profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!profile || !canView) {
      setReports([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await gradeService.listProgressReportRowsForProgressScreen({
        isAdmin: profile.role === 'admin',
        schoolId: profile.school_id ?? null,
      });
      setReports(data as ReportRow[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredReports = useMemo(() => {
    const search = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (!search) return true;
      return (
        (report.student_name ?? '').toLowerCase().includes(search) ||
        (report.course_name ?? '').toLowerCase().includes(search) ||
        (report.section_class ?? '').toLowerCase().includes(search) ||
        (report.school_name ?? '').toLowerCase().includes(search)
      );
    });
  }, [query, reports]);

  const stats = useMemo(() => {
    const scored = reports.filter((report) => typeof report.overall_score === 'number');
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, report) => sum + (report.overall_score ?? 0), 0) / scored.length)
      : 0;
    return {
      total: reports.length,
      published: reports.filter((report) => report.is_published).length,
      avgScore,
      highPerformers: reports.filter((report) => (report.overall_score ?? 0) >= 70).length,
    };
  }, [reports]);

  if (!canView) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Progress" subtitle="Performance analytics" onBack={() => navigation.goBack()} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>This screen is available to school and admin accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Progress" subtitle="Performance trends and report coverage" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statRow}>
          <StatCard label="Reports" value={String(stats.total)} styles={styles} />
          <StatCard label="Published" value={String(stats.published)} styles={styles} />
          <StatCard label="Avg Score" value={`${stats.avgScore}%`} styles={styles} />
          <StatCard label="70% +" value={String(stats.highPerformers)} styles={styles} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student, class, course"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No progress reports found</Text>
            <Text style={styles.emptyText}>Published and draft reports will appear here once they are created.</Text>
          </View>
        ) : (
          filteredReports.map((report) => (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{report.student_name ?? 'Unnamed student'}</Text>
                  <Text style={styles.cardMeta}>
                    {report.course_name ?? 'Course not set'} · {report.section_class ?? 'No class'} · {report.report_term ?? 'No term'}
                  </Text>
                  <Text style={styles.cardSub}>{report.school_name ?? 'School not set'} · {report.report_date ? new Date(report.report_date).toLocaleDateString('en-GB') : 'No date'}</Text>
                </View>
                <View style={[styles.badge, report.is_published ? styles.badgeLive : styles.badgeDraft]}>
                  <Text style={[styles.badgeText, { color: report.is_published ? colors.success : colors.warning }]}>
                    {report.is_published ? 'PUBLISHED' : 'DRAFT'}
                  </Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <MetricItem
                  label="Overall"
                  value={
                    report.overall_grade
                      ? `${report.overall_grade}${report.overall_score != null ? ` · ${Math.round(report.overall_score)}%` : ''}`
                      : report.overall_score != null
                        ? `${Math.round(report.overall_score)}%`
                        : 'N/A'
                  }
                  styles={styles}
                />
                <MetricItem label="Theory" value={report.theory_score != null ? `${Math.round(report.theory_score)}%` : 'N/A'} styles={styles} />
                <MetricItem label="Practical" value={report.practical_score != null ? `${Math.round(report.practical_score)}%` : 'N/A'} styles={styles} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetricItem({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statCard: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  statLabel: { marginTop: 6, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchWrap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md },
  searchInput: { minHeight: 50, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  loaderWrap: { paddingVertical: SPACING['3xl'], alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  cardMeta: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  cardSub: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeLive: { borderColor: colors.success + '40', backgroundColor: colors.success + '14' },
  badgeDraft: { borderColor: colors.warning + '40', backgroundColor: colors.warning + '14' },
  badgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wider },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metricItem: { flexGrow: 1, minWidth: '30%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, padding: SPACING.md },
  metricLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  metricValue: { marginTop: 6, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: colors.textPrimary },
});

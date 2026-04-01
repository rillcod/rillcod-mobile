import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';

interface Stats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalSchools: number;
  pendingApprovals: number;
  publishedReports: number;
  avgProgress: number;
  totalRevenue: number;
  pendingRevenue: number;
}

interface SchoolEnrollment {
  name: string;
  count: number;
}

interface AtRisk {
  id: string;
  name: string;
  lastLogin: string | null;
}

interface MetricBar {
  label: string;
  value: number;
  color: string;
}

function daysSince(date: string | null) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export default function AnalyticsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [schoolEnrollments, setSchoolEnrollments] = useState<SchoolEnrollment[]>([]);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    try {
      const isAdmin = profile.role === 'admin';

      let studentsQuery = supabase.from('portal_users').select('id, last_sign_in_at', { count: 'exact' }).eq('role', 'student');
      let teachersQuery = supabase.from('portal_users').select('id', { count: 'exact' }).eq('role', 'teacher').eq('is_active', true);
      let schoolsQuery = supabase.from('schools').select('id, name', { count: 'exact' }).eq('status', 'approved');
      let pendingQuery = supabase.from('students').select('id', { count: 'exact' }).eq('status', 'pending');
      let reportsQuery = supabase.from('student_progress_reports').select('id', { count: 'exact' }).eq('is_published', true);
      let invoicesQuery = supabase.from('invoices').select('amount, status');

      if (!isAdmin && (profile.school_id || profile.school_name)) {
        const sid = profile.school_id;
        if (sid) {
          studentsQuery = studentsQuery.eq('school_id', sid) as any;
          teachersQuery = teachersQuery.eq('school_id', sid) as any;
          schoolsQuery = schoolsQuery.eq('id', sid);
          pendingQuery = pendingQuery.eq('school_id', sid) as any;
          reportsQuery = reportsQuery.eq('school_id', sid) as any;
          invoicesQuery = invoicesQuery.eq('school_id', sid);
        }
      }

      const [studentsRes, teachersRes, schoolsRes, pendingRes, reportsRes, invoicesRes] = await Promise.all([
        studentsQuery,
        teachersQuery,
        schoolsQuery,
        pendingQuery,
        reportsQuery,
        invoicesQuery,
      ]);

      // Calculate Revenue
      const invoices = (invoicesRes.data ?? []) as any[];
      const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
      const pendingRevenue = invoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0);

      const totalStudents = studentsRes.count ?? 0;
      const activeThreshold = 7 * 24 * 60 * 60 * 1000;
      const activeStudents = ((studentsRes.data ?? []) as any[]).filter((s) => {
        if (!s.last_sign_in_at) return false;
        return Date.now() - new Date(s.last_sign_in_at).getTime() < activeThreshold;
      }).length;

      setStats({
        totalStudents,
        activeStudents,
        totalTeachers: teachersRes.count ?? 0,
        totalSchools: isAdmin ? (schoolsRes.count ?? 0) : 1,
        pendingApprovals: pendingRes.count ?? 0,
        publishedReports: reportsRes.count ?? 0,
        avgProgress: totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0,
        totalRevenue,
        pendingRevenue,
      });

      // Enrollment Distribution (Admin Only)
      if (isAdmin) {
        const { data: dist } = await supabase.from('portal_users').select('school_id, schools(name)').eq('role', 'student');
        const counts: Record<string, number> = {};
        dist?.forEach((d: any) => {
           const name = d.schools?.name || 'Individual';
           counts[name] = (counts[name] || 0) + 1;
        });
        const sortedDist = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setSchoolEnrollments(sortedDist);
      }

      const { data: riskStudents } = await supabase
        .from('portal_users')
        .select('id, full_name, last_sign_in_at')
        .eq('role', 'student')
        .eq('is_active', true)
        .order('last_sign_in_at', { ascending: true })
        .limit(8);

      setAtRisk(
        ((riskStudents ?? []) as any[])
          .filter((student) => {
            if (!student.last_sign_in_at) return true;
            return Date.now() - new Date(student.last_sign_in_at).getTime() > 7 * 24 * 60 * 60 * 1000;
          })
          .slice(0, 5)
          .map((student) => ({
            id: student.id,
            name: student.full_name ?? 'Unknown Student',
            lastLogin: student.last_sign_in_at,
          }))
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const allowed = ['admin', 'teacher', 'school'].includes(profile?.role ?? '');

  const kpis = useMemo(
    () =>
      stats
        ? [
            { label: 'Students', value: stats.totalStudents, color: COLORS.info, code: 'ST' },
            { label: 'Active 7d', value: stats.activeStudents, color: COLORS.success, code: 'AC' },
            { label: 'Teachers', value: stats.totalTeachers, color: COLORS.primary, code: 'TC' },
            { label: 'Schools', value: stats.totalSchools, color: COLORS.warning, code: 'SC' },
            { label: 'Revenue (P)', value: (stats.totalRevenue / 1000).toFixed(1) + 'k', color: COLORS.success, code: 'RV' },
            { label: 'Pending', value: (stats.pendingRevenue / 1000).toFixed(1) + 'k', color: COLORS.error, code: 'PN' },
          ]
        : [],
    [stats]
  );

  const metricBars: MetricBar[] = stats
    ? [
        { label: 'Active engagement', value: stats.avgProgress, color: COLORS.success },
        {
          label: 'Approval flow health',
          value: stats.pendingApprovals > 0 ? Math.max(0, 100 - Math.round((stats.pendingApprovals / Math.max(stats.totalStudents, 1)) * 100)) : 100,
          color: COLORS.info,
        },
        {
          label: 'Report coverage',
          value: stats.totalStudents > 0 ? Math.round((stats.publishedReports / stats.totalStudents) * 100) : 0,
          color: COLORS.primary,
        },
      ]
    : [];

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessWrap}>
          <Text style={styles.accessCode}>NA</Text>
          <Text style={styles.accessText}>Analytics is restricted to staff roles.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Analytics"
        subtitle="Platform performance and engagement overview"
        onBack={() => navigation.goBack()}
        colors={COLORS}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              {kpis.map((kpi, index) => (
                <MotiView
                  key={kpi.label}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: index * 40 }}
                  style={styles.kpiCard}
                >
                  <Text style={[styles.kpiCode, { color: kpi.color }]}>{kpi.code}</Text>
                  <Text style={styles.kpiValue}>{kpi.value}</Text>
                  <Text style={styles.kpiLabel}>{kpi.label}</Text>
                </MotiView>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Metrics</Text>
              <View style={styles.panel}>
                {metricBars.map((bar, index) => (
                  <View key={bar.label} style={[styles.metricRow, index > 0 && styles.metricRowGap]}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricLabel}>{bar.label}</Text>
                      <Text style={[styles.metricValue, { color: bar.color }]}>{bar.value}%</Text>
                    </View>
                    <View style={styles.track}>
                      <MotiView
                        from={{ width: '0%' as any }}
                        animate={{ width: `${bar.value}%` as any }}
                        transition={{ type: 'timing', duration: 700, delay: index * 120 }}
                        style={[styles.fill, { backgroundColor: bar.color }]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {schoolEnrollments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Schools by Enrollment</Text>
                <View style={styles.panel}>
                  {schoolEnrollments.map((school, index) => {
                    const percent = Math.round((school.count / (stats?.totalStudents || 1)) * 100);
                    return (
                      <View key={school.name} style={[styles.metricRow, index > 0 && styles.metricRowGap]}>
                        <View style={styles.metricHeader}>
                          <Text style={styles.metricLabel} numberOfLines={1}>{school.name.toUpperCase()}</Text>
                          <Text style={[styles.metricValue, { color: COLORS.textMuted }]}>{school.count} Students</Text>
                        </View>
                        <View style={styles.track}>
                          <MotiView
                            from={{ width: '0%' as any }}
                            animate={{ width: `${percent}%` as any }}
                            transition={{ type: 'timing', duration: 700, delay: index * 100 }}
                            style={[styles.fill, { backgroundColor: COLORS.primary }]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>At-Risk Students</Text>
              <View style={styles.panel}>
                {atRisk.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyCode}>OK</Text>
                    <Text style={styles.emptyText}>No inactive students detected in the watchlist.</Text>
                  </View>
                ) : (
                  atRisk.map((student, index) => {
                    const days = daysSince(student.lastLogin);
                    const highRisk = days != null && days > 14;
                    return (
                      <View key={student.id} style={[styles.riskRow, index < atRisk.length - 1 && styles.riskBorder]}>
                        <View style={[styles.riskCodeBox, { backgroundColor: (highRisk ? COLORS.error : COLORS.warning) + '18' }]}>
                          <Text style={[styles.riskCode, { color: highRisk ? COLORS.error : COLORS.warning }]}>{highRisk ? 'HR' : 'AR'}</Text>
                        </View>
                        <View style={styles.riskBody}>
                          <Text style={styles.riskName}>{student.name}</Text>
                          <Text style={styles.riskMeta}>
                            {days != null ? `${days} days inactive` : 'Never logged in'}
                          </Text>
                        </View>
                        <View style={[styles.riskBadge, { backgroundColor: (highRisk ? COLORS.error : COLORS.warning) + '18' }]}>
                          <Text style={[styles.riskBadgeText, { color: highRisk ? COLORS.error : COLORS.warning }]}>
                            {highRisk ? 'HIGH RISK' : 'WATCH'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  accessWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.bg },
  accessCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textMuted },
  accessText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    width: '31%',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  kpiCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, letterSpacing: LETTER_SPACING.wider },
  kpiValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  kpiLabel: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  section: { marginHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  sectionTitle: {
    marginBottom: SPACING.sm,
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.widest,
  },
  panel: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  metricRow: {},
  metricRowGap: { marginTop: SPACING.md },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  metricLabel: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  metricValue: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  track: { height: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  riskBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  riskCodeBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, letterSpacing: LETTER_SPACING.wider },
  riskBody: { flex: 1 },
  riskName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  riskMeta: { marginTop: 2, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  riskBadgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.success },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
});

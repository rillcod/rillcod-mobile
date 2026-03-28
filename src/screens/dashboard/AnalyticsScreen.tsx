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

interface Stats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalSchools: number;
  pendingApprovals: number;
  publishedReports: number;
  avgProgress: number;
}

interface AtRisk {
  id: string;
  name: string;
  lastLogin: string | null;
  avgGrade: number | null;
}

interface ProgBar {
  label: string;
  value: number;
  max: number;
  color: string;
}

export default function AnalyticsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const isAdmin = profile.role === 'admin';

      let studentsQ = supabase.from('portal_users').select('id, last_sign_in_at', { count: 'exact' }).eq('role', 'student');
      let teachersQ = supabase.from('portal_users').select('id', { count: 'exact' }).eq('role', 'teacher').eq('is_active', true);
      let schoolsQ = supabase.from('schools').select('id', { count: 'exact' }).eq('status', 'approved');
      let pendingQ = supabase.from('students').select('id', { count: 'exact' }).eq('status', 'pending');
      let reportsQ = supabase.from('student_progress_reports').select('id', { count: 'exact' }).eq('is_published', true);

      if (!isAdmin && profile.school_id) {
        studentsQ = studentsQ.eq('school_id', profile.school_id) as any;
      }

      const [stuRes, tchRes, schRes, pendRes, repRes] = await Promise.all([
        studentsQ,
        teachersQ,
        schoolsQ,
        pendingQ,
        reportsQ,
      ]);

      const total = stuRes.count ?? 0;
      const now = Date.now();
      const active = ((stuRes.data ?? []) as any[]).filter(s => {
        if (!s.last_sign_in_at) return false;
        const diff = now - new Date(s.last_sign_in_at).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000; // active in last 7 days
      }).length;

      setStats({
        totalStudents: total,
        activeStudents: active,
        totalTeachers: tchRes.count ?? 0,
        totalSchools: schRes.count ?? 0,
        pendingApprovals: pendRes.count ?? 0,
        publishedReports: repRes.count ?? 0,
        avgProgress: total > 0 ? Math.round((active / total) * 100) : 0,
      });

      // At-risk: students not signed in for 7+ days
      const { data: riskStudents } = await supabase
        .from('portal_users')
        .select('id, full_name, last_sign_in_at')
        .eq('role', 'student')
        .eq('is_active', true)
        .order('last_sign_in_at', { ascending: true })
        .limit(8);

      setAtRisk(
        ((riskStudents ?? []) as any[])
          .filter(s => {
            if (!s.last_sign_in_at) return true;
            const diff = now - new Date(s.last_sign_in_at).getTime();
            return diff > 7 * 24 * 60 * 60 * 1000;
          })
          .slice(0, 5)
          .map(s => ({
            id: s.id,
            name: s.full_name ?? 'Unknown',
            lastLogin: s.last_sign_in_at,
            avgGrade: null,
          }))
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  if (!['admin', 'teacher', 'school'].includes(profile?.role ?? '')) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.noAccess}>Access restricted to staff</Text>
        </View>
      </SafeAreaView>
    );
  }

  const kpiCards = stats ? [
    { label: 'Total Students', value: stats.totalStudents, emoji: '👥', color: COLORS.info },
    { label: 'Active (7d)', value: stats.activeStudents, emoji: '🟢', color: COLORS.success },
    { label: 'Teachers', value: stats.totalTeachers, emoji: '👨‍🏫', color: COLORS.teacher },
    { label: 'Schools', value: stats.totalSchools, emoji: '🏫', color: COLORS.school },
    { label: 'Pending', value: stats.pendingApprovals, emoji: '⏳', color: COLORS.warning },
    { label: 'Reports', value: stats.publishedReports, emoji: '📊', color: COLORS.primary },
  ] : [];

  const progBars: ProgBar[] = stats ? [
    { label: 'Active Engagement Rate', value: stats.avgProgress, max: 100, color: COLORS.success },
    { label: 'Approval Rate', value: stats.pendingApprovals > 0 ? Math.max(0, 100 - Math.round((stats.pendingApprovals / (stats.totalStudents || 1)) * 100)) : 100, max: 100, color: COLORS.info },
    { label: 'Report Coverage', value: stats.totalStudents > 0 ? Math.round((stats.publishedReports / stats.totalStudents) * 100) : 0, max: 100, color: COLORS.primary },
  ] : [];

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
          <View>
            <Text style={styles.title}>Analytics</Text>
            <Text style={styles.subtitle}>Platform performance overview</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        ) : (
          <>
            {/* KPI Grid */}
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              style={styles.kpiGrid}
            >
              {kpiCards.map((card, i) => (
                <View key={card.label} style={styles.kpiCard}>
                  <Text style={styles.kpiEmoji}>{card.emoji}</Text>
                  <Text style={[styles.kpiValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.kpiLabel}>{card.label}</Text>
                </View>
              ))}
            </MotiView>

            {/* Progress bars */}
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 100 }}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Key Metrics</Text>
              <View style={styles.card}>
                {progBars.map((bar, i) => (
                  <View key={bar.label} style={[styles.progRow, i > 0 && { marginTop: SPACING.md }]}>
                    <View style={styles.progLabelRow}>
                      <Text style={styles.progLabel}>{bar.label}</Text>
                      <Text style={[styles.progValue, { color: bar.color }]}>{bar.value}%</Text>
                    </View>
                    <View style={styles.barBg}>
                      <MotiView
                        from={{ width: '0%' as any }}
                        animate={{ width: `${bar.value}%` as any }}
                        transition={{ type: 'timing', duration: 800, delay: 200 + i * 100 }}
                        style={[styles.barFill, { backgroundColor: bar.color }]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </MotiView>

            {/* At-risk students */}
            {atRisk.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 200 }}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>⚠️ At-Risk Students</Text>
                <View style={styles.card}>
                  {atRisk.map((s, i) => {
                    const daysSince = s.lastLogin
                      ? Math.floor((Date.now() - new Date(s.lastLogin).getTime()) / 86400000)
                      : null;
                    return (
                      <View
                        key={s.id}
                        style={[styles.riskRow, i < atRisk.length - 1 && styles.riskRowBorder]}
                      >
                        <View style={[styles.riskAvatar, { backgroundColor: daysSince && daysSince > 14 ? COLORS.error + '22' : COLORS.warning + '22' }]}>
                          <Text style={{ fontSize: 18 }}>⚠️</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.riskName}>{s.name}</Text>
                          <Text style={styles.riskSub}>
                            {daysSince != null ? `${daysSince} days inactive` : 'Never logged in'}
                          </Text>
                        </View>
                        <View style={[
                          styles.riskBadge,
                          {
                            backgroundColor: daysSince && daysSince > 14 ? COLORS.error + '22' : COLORS.warning + '22',
                            borderColor: daysSince && daysSince > 14 ? COLORS.error : COLORS.warning,
                          },
                        ]}>
                          <Text style={[
                            styles.riskBadgeText,
                            { color: daysSince && daysSince > 14 ? COLORS.error : COLORS.warning },
                          ]}>
                            {daysSince && daysSince > 14 ? 'High Risk' : 'At Risk'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </MotiView>
            )}

            {atRisk.length === 0 && stats && (
              <View style={styles.allGood}>
                <Text style={{ fontSize: 40 }}>✅</Text>
                <Text style={styles.allGoodText}>All students are active!</Text>
              </View>
            )}
          </>
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
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  noAccess: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.base,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    width: '30.5%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  kpiEmoji: { fontSize: 22 },
  kpiValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  kpiLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted, textAlign: 'center' },
  section: { marginHorizontal: SPACING.base, marginBottom: SPACING.lg },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
  },
  progRow: {},
  progLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLabel: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  progValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  barBg: { height: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: RADIUS.full },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  riskRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  riskAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskName: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  riskSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  riskBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  riskBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  allGood: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  allGoodText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.success },
});

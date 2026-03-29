import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  attendance_today: number;
  active_students: number;
  pending_approvals: number;
}

interface TopStudent { id: string; full_name: string; total_grade: number; }
interface RecentActivity { id: string; full_name: string; type: string; time: string; }

export default function SchoolOverviewScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ students: 0, teachers: 0, classes: 0, attendance_today: 0, active_students: 0, pending_approvals: 0 });
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const schoolId = profile?.school_id;

  const load = useCallback(async () => {
    try {
      const [stuRes, teachRes, classRes, approvalRes] = await Promise.all([
        supabase.from('portal_users').select('id, is_active', { count: 'exact', head: false }).eq('role', 'student').eq('school_id', schoolId || ''),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', schoolId || ''),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId || ''),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId || '').eq('is_active', false),
      ]);

      const allStudents = stuRes.data || [];
      const activeCount = allStudents.filter((s: any) => s.is_active).length;

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { count: attCount } = await supabase
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'present');

      setStats({
        students: stuRes.count ?? allStudents.length,
        teachers: teachRes.count ?? 0,
        classes: classRes.count ?? 0,
        attendance_today: attCount ?? 0,
        active_students: activeCount,
        pending_approvals: approvalRes.count ?? 0,
      });

      // Top students by grades
      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('portal_user_id, grade, portal_users!assignment_submissions_portal_user_id_fkey(full_name, school_id)')
        .eq('status', 'graded')
        .not('grade', 'is', null)
        .limit(200);

      if (subData) {
        const grouped: Record<string, { name: string; total: number; count: number }> = {};
        (subData as any[]).forEach(s => {
          const u = s.portal_users;
          if (!u || u.school_id !== schoolId) return;
          if (!grouped[s.portal_user_id]) grouped[s.portal_user_id] = { name: u.full_name, total: 0, count: 0 };
          grouped[s.portal_user_id].total += s.grade;
          grouped[s.portal_user_id].count += 1;
        });
        const ranked = Object.entries(grouped)
          .map(([id, v]) => ({ id, full_name: v.name, total_grade: Math.round(v.total / v.count) }))
          .sort((a, b) => b.total_grade - a.total_grade)
          .slice(0, 5);
        setTopStudents(ranked);
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const STAT_CARDS = [
    { label: 'Total Students', value: stats.students, color: COLORS.info, emoji: '🎓' },
    { label: 'Active', value: stats.active_students, color: COLORS.success, emoji: '✅' },
    { label: 'Teachers', value: stats.teachers, color: '#7c3aed', emoji: '👩‍🏫' },
    { label: 'Classes', value: stats.classes, color: COLORS.accent, emoji: '📚' },
    { label: 'Present Today', value: stats.attendance_today, color: COLORS.gold, emoji: '📋' },
    { label: 'Pending', value: stats.pending_approvals, color: COLORS.warning, emoji: '⏳' },
  ];

  if (loading) return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>School Overview</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{profile?.school_name || 'Your School'}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero banner */}
        <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.heroBanner}>
          <LinearGradient colors={[COLORS.primary, '#5b0505']} style={StyleSheet.absoluteFill} />
          <Text style={styles.heroEmoji}>🏫</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{profile?.school_name || 'Partner School'}</Text>
            <Text style={styles.heroSub}>Rillcod Academy Partnership</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>✓ Active</Text>
          </View>
        </MotiView>

        {/* Stats grid */}
        <Text style={styles.sectionTitle}>At a Glance</Text>
        <View style={styles.statsGrid}>
          {STAT_CARDS.map((s, i) => (
            <MotiView key={s.label} from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 60 }}
              style={[styles.statCard, { borderColor: s.color + '44' }]}>
              <LinearGradient colors={[s.color + '15', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </MotiView>
          ))}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          {[
            { emoji: '👥', label: 'My Students', screen: 'Students' },
            { emoji: '📚', label: 'Classes', screen: 'Classes' },
            { emoji: '📋', label: 'Attendance', screen: 'Attendance' },
            { emoji: '📅', label: 'Timetable', screen: 'Timetable' },
            { emoji: '💳', label: 'Payments', screen: 'Payments' },
            { emoji: '📈', label: 'Reports', screen: 'Reports' },
          ].map(a => (
            <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.8}>
              <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top performers */}
        {topStudents.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            {topStudents.map((s, i) => (
              <MotiView key={s.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 60 }}>
                <TouchableOpacity style={styles.studentRow} onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })} activeOpacity={0.85}>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? COLORS.gold + '33' : i === 1 ? '#94a3b8' + '33' : '#cd7f32' + '33' }]}>
                    <Text style={styles.rankText}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{s.full_name}</Text>
                    <View style={styles.gradeBar}>
                      <MotiView animate={{ width: `${s.total_grade}%` }} transition={{ type: 'spring', delay: i * 100 }}
                        style={[styles.gradeBarFill, { backgroundColor: s.total_grade >= 70 ? COLORS.success : s.total_grade >= 50 ? COLORS.warning : COLORS.error }]} />
                    </View>
                  </View>
                  <Text style={styles.gradeNum}>{s.total_grade}%</Text>
                </TouchableOpacity>
              </MotiView>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  heroBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.xl, overflow: 'hidden', gap: SPACING.md },
  heroEmoji: { fontSize: 36 },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: '#fff' },
  heroSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  heroBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#fff' },
  sectionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: SPACING.sm, marginTop: SPACING.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { width: '30.5%', backgroundColor: COLORS.bgCard, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 4, overflow: 'hidden' },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  actionCard: { width: '30.5%', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6 },
  actionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 18 },
  studentName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 6 },
  gradeBar: { height: 5, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  gradeBarFill: { height: '100%', borderRadius: RADIUS.full },
  gradeNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, minWidth: 44, textAlign: 'right' },
});

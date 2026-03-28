import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView, MotiText } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';

const { width } = Dimensions.get('window');

interface StatCard { icon: string; label: string; value: string | number; color: string; glow: string }
interface Announcement { id: string; title: string; content: string; created_at: string }

const ROLE_CONFIG = {
  admin: {
    color: COLORS.admin,
    glow: 'rgba(192,57,43,0.25)',
    label: t('roles.admin'),
    actions: [
      { icon: '👥', label: 'Students', color: COLORS.admin },
      { icon: '🏫', label: 'Schools', color: '#5b21b6' },
      { icon: '📊', label: 'Analytics', color: COLORS.info },
      { icon: '💳', label: 'Payments', color: COLORS.gold },
      { icon: '📝', label: 'Approvals', color: COLORS.success },
      { icon: '🏆', label: 'Reports', color: COLORS.accent },
    ],
  },
  teacher: {
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.25)',
    label: t('roles.teacher'),
    actions: [
      { icon: '📚', label: 'Classes', color: '#7c3aed' },
      { icon: '📝', label: 'Assignments', color: COLORS.info },
      { icon: '📋', label: 'Attendance', color: COLORS.success },
      { icon: '🏆', label: 'Reports', color: COLORS.gold },
      { icon: '💬', label: 'Messages', color: COLORS.accent },
      { icon: '🎯', label: 'Progress', color: COLORS.admin },
    ],
  },
  student: {
    color: COLORS.success,
    glow: 'rgba(5,150,105,0.2)',
    label: t('roles.student'),
    actions: [
      { icon: '📚', label: 'Courses', color: COLORS.info },
      { icon: '📝', label: 'Assignments', color: '#7c3aed' },
      { icon: '🏆', label: 'My Report', color: COLORS.gold },
      { icon: '🎮', label: 'Playground', color: COLORS.accent },
      { icon: '🎖️', label: 'Certificates', color: COLORS.success },
      { icon: '💬', label: 'Messages', color: COLORS.admin },
    ],
  },
  school: {
    color: COLORS.info,
    glow: 'rgba(3,105,161,0.25)',
    label: t('roles.school'),
    actions: [
      { icon: '👥', label: 'Students', color: COLORS.info },
      { icon: '📊', label: 'Overview', color: '#7c3aed' },
      { icon: '🏆', label: 'Reports', color: COLORS.gold },
      { icon: '📅', label: 'Timetable', color: COLORS.success },
    ],
  },
};

// Map action labels to navigation screen names
const ACTION_SCREENS: Record<string, string> = {
  'Analytics': 'Analytics',
  'Assignments': 'Assignments',
  'My Report': 'Grades',
  'Certificates': 'Certificates',
  'Messages': 'Messages',
  'Invoices': 'Invoices',
  'Settings': 'Settings',
};

export default function DashboardScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { light } = useHaptics();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const role = profile?.role ?? 'student';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.student;

  const greetingKey = () => {
    const h = new Date().getHours();
    if (h < 12) return 'dashboard.greeting_morning';
    if (h < 17) return 'dashboard.greeting_afternoon';
    return 'dashboard.greeting_evening';
  };

  const loadData = useCallback(async () => {
    if (!profile) return;

    const annRes = await supabase
      .from('announcements')
      .select('id, title, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(4);

    if (annRes.data) setAnnouncements(annRes.data as Announcement[]);

    if (role === 'admin') {
      const [s, sc, e] = await Promise.all([
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('schools').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }),
      ]);
      setStats([
        { icon: '👥', label: t('stats.students'), value: s.count ?? 0, color: COLORS.admin, glow: 'rgba(192,57,43,0.2)' },
        { icon: '🏫', label: t('stats.schools'), value: sc.count ?? 0, color: '#7c3aed', glow: 'rgba(124,58,237,0.2)' },
        { icon: '📋', label: t('stats.enrollments'), value: e.count ?? 0, color: COLORS.info, glow: 'rgba(59,130,246,0.2)' },
      ]);
    } else if (role === 'teacher') {
      const [cl, st] = await Promise.all([
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', profile.id),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', profile.school_id ?? ''),
      ]);
      setStats([
        { icon: '📚', label: t('stats.classes'), value: cl.count ?? 0, color: '#7c3aed', glow: 'rgba(124,58,237,0.2)' },
        { icon: '👥', label: t('stats.students'), value: st.count ?? 0, color: COLORS.info, glow: 'rgba(59,130,246,0.2)' },
      ]);
    } else if (role === 'student') {
      const [en, su] = await Promise.all([
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('portal_user_id', profile.id),
      ]);
      setStats([
        { icon: '📚', label: t('stats.courses'), value: en.count ?? 0, color: COLORS.success, glow: 'rgba(16,185,129,0.2)' },
        { icon: '📝', label: t('stats.submissions'), value: su.count ?? 0, color: COLORS.info, glow: 'rgba(59,130,246,0.2)' },
      ]);
    } else {
      const [st] = await Promise.all([
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', profile.school_id ?? ''),
      ]);
      setStats([
        { icon: '👥', label: t('stats.students'), value: st.count ?? 0, color: COLORS.info, glow: 'rgba(59,130,246,0.2)' },
      ]);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={config.color} size="large" />
        <Text style={styles.loadingText}>Loading your portal…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.color} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO ─── */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={['#120005', '#1a0010', COLORS.bg]}
            style={StyleSheet.absoluteFill}
          />

          {/* Glow orb behind user */}
          <MotiView
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ type: 'timing', duration: 3000, loop: true }}
            style={[styles.heroGlow, { backgroundColor: config.glow }]}
          />

          <BlurView intensity={0} tint="dark" style={styles.heroBlur}>
            <View style={styles.heroContent}>
              {/* Greeting row */}
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting}>{t(greetingKey())} 👋</Text>
                  <MotiText
                    from={{ opacity: 0, translateX: -10 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'spring', delay: 100 }}
                    style={styles.userName}
                  >
                    {profile?.full_name?.split(' ')[0] ?? 'Welcome'}
                  </MotiText>

                  <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: 250 }}
                    style={[styles.rolePill, { borderColor: config.color + '50', backgroundColor: config.color + '18' }]}
                  >
                    <View style={[styles.roleDot, { backgroundColor: config.color }]} />
                    <Text style={[styles.roleText, { color: config.color }]}>{config.label}</Text>
                  </MotiView>
                </View>

                <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.85}>
                  {profile?.profile_image_url ? (
                    <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
                  ) : (
                    <LinearGradient colors={config.color === COLORS.admin ? COLORS.gradPrimary : [config.color, config.color + '80'] as [string, string]} style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(profile?.full_name ?? 'U')[0].toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                  <View style={[styles.onlineDot, { backgroundColor: COLORS.success }]} />
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                {stats.map((s, i) => (
                  <MotiView
                    key={i}
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 300 + i * 100 }}
                    style={[styles.statCard, { borderColor: s.color + '30', ...SHADOW.glow(s.glow) }]}
                  >
                    <LinearGradient colors={[s.glow, 'transparent']} style={StyleSheet.absoluteFill} />
                    <Text style={styles.statIcon}>{s.icon}</Text>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </MotiView>
                ))}
              </View>
            </View>
          </BlurView>
        </View>

        {/* ─── QUICK ACTIONS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
            <View style={[styles.sectionLine, { backgroundColor: config.color }]} />
          </View>

          <View style={styles.actionsGrid}>
            {config.actions.map((a, i) => (
              <MotiView
                key={i}
                from={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 100 + i * 60, damping: 18 }}
                style={{ width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3 }}
              >
                <TouchableOpacity
                  style={styles.actionCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    light();
                    const screen = ACTION_SCREENS[a.label];
                    if (screen && navigation) navigation.navigate(screen);
                  }}
                >
                  <LinearGradient
                    colors={[a.color + '18', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.actionIconWrap, { borderColor: a.color + '40', backgroundColor: a.color + '12' }]}>
                    <Text style={styles.actionIcon}>{a.icon}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              </MotiView>
            ))}
          </View>
        </View>

        {/* ─── ANNOUNCEMENTS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.announcements')}</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: config.color }]}>{t('dashboard.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {announcements.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📢</Text>
              <Text style={styles.emptyText}>{t('dashboard.noAnnouncements')}</Text>
            </GlassCard>
          ) : (
            announcements.map((a, i) => (
              <MotiView
                key={a.id}
                from={{ opacity: 0, translateX: -16 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', delay: i * 80 }}
              >
                <TouchableOpacity style={styles.announcementCard} activeOpacity={0.8} onPress={() => light()}>
                  <LinearGradient
                    colors={[config.color + '10', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.announcementBar, { backgroundColor: config.color }]} />
                  <View style={styles.announcementContent}>
                    <Text style={styles.announcementTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.announcementBody} numberOfLines={2}>{a.content}</Text>
                    <Text style={styles.announcementDate}>
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </MotiView>
            ))
          )}
        </View>

        {/* ─── RILLCOD BANNER ─── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', delay: 600 }}
          style={styles.banner}
        >
          <LinearGradient colors={COLORS.gradAccent} style={StyleSheet.absoluteFill} />
          <Text style={styles.bannerEmoji}>🌍</Text>
          <View>
            <Text style={styles.bannerTitle}>Africa's #1 STEM Platform</Text>
            <Text style={styles.bannerSub}>Nigeria · Africa · World Competitor</Text>
          </View>
        </MotiView>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  // Hero
  heroOuter: { overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  heroBlur: { flex: 1 },
  heroContent: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl },
  greeting: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: 2 },
  userName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['3xl'], color: COLORS.textPrimary, marginBottom: SPACING.sm },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
  avatarBtn: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.border },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.white100 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: COLORS.bg },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
  },
  statIcon: { fontSize: 20, marginBottom: 2 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },

  // Sections
  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING['2xl'] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.base },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  sectionLine: { height: 2, width: 24, borderRadius: 1 },
  seeAll: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  actionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.base,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  actionIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },

  // Announcements
  announcementCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  announcementBar: { width: 4 },
  announcementContent: { flex: 1, padding: SPACING.md, gap: 3 },
  announcementTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  announcementBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.5 },
  announcementDate: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  emptyCard: { padding: SPACING.xl, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 32 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  // Banner
  banner: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.white100 },
  bannerSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', letterSpacing: LETTER_SPACING.wide },
});

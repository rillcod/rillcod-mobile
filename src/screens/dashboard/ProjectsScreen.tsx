import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Project {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  studentName?: string;
  type: 'lab' | 'portfolio';
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function ProjectsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'lab' | 'portfolio'>('lab');
  const [labProjects, setLabProjects] = useState<Project[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      // Lab Projects
      let labQuery = supabase
        .from('lab_projects')
        .select(isStaff
          ? 'id, user_id, title, updated_at, portal_users(full_name)'
          : 'id, user_id, title, updated_at'
        )
        .order('updated_at', { ascending: false });
      if (!isStaff) labQuery = labQuery.eq('user_id', profile.id);

      // Portfolio Projects
      let portQuery = supabase
        .from('portfolio_projects')
        .select(isStaff
          ? 'id, user_id, title, updated_at, portal_users(full_name)'
          : 'id, user_id, title, updated_at'
        )
        .order('updated_at', { ascending: false });
      if (!isStaff) portQuery = portQuery.eq('user_id', profile.id);

      const [{ data: labs }, { data: ports }] = await Promise.all([labQuery, portQuery]);

      setLabProjects(
        (labs ?? []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          title: r.title,
          updated_at: r.updated_at,
          studentName: r.portal_users?.full_name ?? null,
          type: 'lab',
        }))
      );
      setPortfolioProjects(
        (ports ?? []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          title: r.title,
          updated_at: r.updated_at,
          studentName: r.portal_users?.full_name ?? null,
          type: 'portfolio',
        }))
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, isStaff]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const current = tab === 'lab' ? labProjects : portfolioProjects;
  const tabColor = tab === 'lab' ? COLORS.info : COLORS.accent;

  const renderItem = ({ item, index }: { item: Project; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 40, type: 'timing', duration: 280 }}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, projectTitle: item.title })}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { backgroundColor: tab === 'lab' ? 'rgba(59,130,246,0.15)' : 'rgba(232,82,26,0.15)' }]}>
            <Text style={[styles.avatarText, { color: tab === 'lab' ? COLORS.info : COLORS.accent }]}>
              {getInitial(item.studentName ?? item.title)}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.projectTitle} numberOfLines={2}>{item.title}</Text>
          {isStaff && item.studentName ? (
            <Text style={styles.studentName}>{item.studentName}</Text>
          ) : null}
          <Text style={styles.updatedAt}>Updated {formatDate(item.updated_at)}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.typeBadge, { backgroundColor: tab === 'lab' ? 'rgba(59,130,246,0.12)' : 'rgba(232,82,26,0.12)' }]}>
            <Text style={[styles.typeText, { color: tab === 'lab' ? COLORS.info : COLORS.accent }]}>
              {tab === 'lab' ? '🔬' : '🎨'}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projects</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{current.length}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['lab', 'portfolio'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && { color: tabColor }]}>
              {t === 'lab' ? '🔬 Lab Projects' : '🎨 Portfolio'}
            </Text>
            <Text style={[styles.tabCount, { color: tab === t ? tabColor : COLORS.textMuted }]}>
              {(t === 'lab' ? labProjects : portfolioProjects).length}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.tabIndicatorBar]}>
        <View style={[styles.tabIndicator, { backgroundColor: tabColor, marginLeft: tab === 'portfolio' ? '50%' : 0 }]} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : current.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{tab === 'lab' ? '🔬' : '🎨'}</Text>
          <Text style={styles.emptyTitle}>No {tab === 'lab' ? 'lab' : 'portfolio'} projects yet</Text>
          <Text style={styles.emptySubtitle}>Projects created in the web app appear here</Text>
        </View>
      ) : (
        <FlatList
          data={current}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40, paddingTop: SPACING.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  countBadge: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  countText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.base },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.md },
  tabActive: {},
  tabText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  tabCount: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body },
  tabIndicatorBar: { height: 2, backgroundColor: COLORS.border, marginHorizontal: SPACING.base, marginBottom: SPACING.md },
  tabIndicator: { height: 2, width: '50%', borderRadius: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  cardLeft: {},
  avatar: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.display },
  cardBody: { flex: 1 },
  projectTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 3 },
  studentName: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: 3 },
  updatedAt: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  cardRight: { alignItems: 'center', gap: SPACING.sm },
  typeBadge: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 16 },
  arrow: { fontSize: 18, color: COLORS.textMuted },
});

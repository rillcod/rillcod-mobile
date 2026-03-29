import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface RankedStudent {
  portal_user_id: string;
  full_name: string;
  school_name: string | null;
  xp: number;
  rank: number;
}

function getLevel(xp: number): { label: string; color: string } {
  if (xp >= 1000) return { label: 'Champion', color: COLORS.gold };
  if (xp >= 600)  return { label: 'Pro', color: COLORS.accent };
  if (xp >= 300)  return { label: 'Coder', color: COLORS.info };
  if (xp >= 100)  return { label: 'Learner', color: COLORS.success };
  return { label: 'Beginner', color: COLORS.textMuted };
}

const PODIUM_COLORS = [COLORS.gold, '#C0C0C0', '#CD7F32'];
const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<RankedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMySchool, setFilterMySchool] = useState(false);

  const isSchool = profile?.role === 'school';

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('portal_user_id, grade, status, portal_users!assignment_submissions_portal_user_id_fkey(full_name, school_name, section_class)')
        .eq('status', 'graded')
        .limit(500);
      if (error) throw error;

      const map: Record<string, { full_name: string; school_name: string | null; xp: number }> = {};
      (data ?? []).forEach((row: any) => {
        const uid = row.portal_user_id;
        if (!uid) return;
        if (!map[uid]) {
          map[uid] = {
            full_name: row.portal_users?.full_name ?? 'Unknown',
            school_name: row.portal_users?.school_name ?? null,
            xp: 0,
          };
        }
        map[uid].xp += row.grade ?? 0;
      });

      const ranked: RankedStudent[] = Object.entries(map)
        .map(([id, val]) => ({ portal_user_id: id, ...val, rank: 0 }))
        .sort((a, b) => b.xp - a.xp)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      setStudents(ranked);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = filterMySchool && profile?.school_name
    ? students.filter(s => s.school_name === profile.school_name)
    : students;

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const maxXP = filtered[0]?.xp ?? 1;

  const renderPodiumItem = (student: RankedStudent, podiumIdx: number) => {
    const color = PODIUM_COLORS[podiumIdx] ?? COLORS.textMuted;
    const order = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2;
    const height = podiumIdx === 0 ? 80 : podiumIdx === 1 ? 60 : 50;
    return (
      <MotiView
        key={student.portal_user_id}
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: podiumIdx * 150, type: 'timing', duration: 400 }}
        style={[styles.podiumItem, { order } as any]}
      >
        <Text style={styles.podiumEmoji}>{PODIUM_EMOJIS[podiumIdx]}</Text>
        <View style={[styles.podiumAvatar, { borderColor: color }]}>
          <Text style={[styles.podiumInitial, { color }]}>
            {student.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.podiumName} numberOfLines={1}>{student.full_name.split(' ')[0]}</Text>
        <Text style={[styles.podiumXP, { color }]}>{student.xp} XP</Text>
        <View style={[styles.podiumBase, { height, backgroundColor: color + '30', borderTopColor: color }]}>
          <Text style={[styles.podiumRank, { color }]}>#{student.rank}</Text>
        </View>
      </MotiView>
    );
  };

  const renderRow = ({ item, index }: { item: RankedStudent; index: number }) => {
    const level = getLevel(item.xp);
    const barWidth = maxXP > 0 ? (item.xp / maxXP) * 100 : 0;
    const isMe = item.portal_user_id === profile?.id;
    return (
      <MotiView
        from={{ opacity: 0, translateX: -10 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ delay: index * 30, type: 'timing', duration: 250 }}
      >
        <View style={[styles.row, isMe && styles.rowMe]}>
          <Text style={[styles.rowRank, isMe && { color: COLORS.gold }]}>#{item.rank}</Text>
          <View style={[styles.rowAvatar, isMe && { backgroundColor: COLORS.primaryPale }]}>
            <Text style={[styles.rowInitial, isMe && { color: COLORS.primaryLight }]}>
              {item.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>{item.full_name}</Text>
              <View style={[styles.levelBadge, { backgroundColor: level.color + '20' }]}>
                <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
              </View>
            </View>
            {item.school_name ? <Text style={styles.rowSchool} numberOfLines={1}>{item.school_name}</Text> : null}
            <View style={styles.xpBarTrack}>
              <View style={[styles.xpBarFill, { width: `${barWidth}%` as any, backgroundColor: level.color }]} />
            </View>
          </View>
          <Text style={[styles.rowXP, { color: level.color }]}>{item.xp}</Text>
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        {(isSchool || profile?.role === 'student') && (
          <TouchableOpacity
            style={[styles.filterToggle, filterMySchool && styles.filterToggleActive]}
            onPress={() => setFilterMySchool(!filterMySchool)}
          >
            <Text style={[styles.filterToggleText, filterMySchool && { color: COLORS.primary }]}>
              My School
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>Rankings appear once assignments are graded</Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={i => i.portal_user_id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Podium */}
              {top3.length > 0 && (
                <LinearGradient
                  colors={['rgba(245,158,11,0.08)', 'transparent']}
                  style={styles.podiumContainer}
                >
                  <Text style={styles.podiumTitle}>Top Students 🏆</Text>
                  <View style={styles.podiumRow}>
                    {top3.map((s, i) => renderPodiumItem(s, i))}
                  </View>
                </LinearGradient>
              )}
              <Text style={styles.rankingsLabel}>All Rankings</Text>
            </View>
          }
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
  filterToggle: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  filterToggleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  filterToggleText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  podiumContainer: { borderRadius: RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderColor: 'rgba(245,158,11,0.15)' },
  podiumTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.lg },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: SPACING.base },
  podiumItem: { alignItems: 'center', width: 90 },
  podiumEmoji: { fontSize: 28, marginBottom: 4 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  podiumInitial: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display },
  podiumName: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 2, textAlign: 'center' },
  podiumXP: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, marginBottom: 6 },
  podiumBase: { width: '100%', borderTopWidth: 2, borderTopLeftRadius: RADIUS.sm, borderTopRightRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  podiumRank: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.display, paddingTop: 4 },
  rankingsLabel: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  rowMe: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  rowRank: { width: 32, fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted, textAlign: 'center' },
  rowAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  rowInitial: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.display, color: COLORS.textSecondary },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { flex: 1, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  levelBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  levelText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  rowSchool: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginBottom: 4 },
  xpBarTrack: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  xpBarFill: { height: 4, borderRadius: 2 },
  rowXP: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, minWidth: 40, textAlign: 'right' },
});

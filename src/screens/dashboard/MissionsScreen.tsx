import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { gamificationService } from '../../services/gamification.service';
import { pathwaysProgressService } from '../../services/pathwaysProgress.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES, TAB_ROUTES } from '../../navigation/routes';
import {
  MISSIONS,
  MISSION_LANG_FILTERS,
  type Mission,
  type Difficulty,
  type LangFilter,
} from '../../constants/missions';

const XP_PER_LEVEL = 250;

type FilterType = 'All' | Difficulty | 'Completed';

const FILTERS: FilterType[] = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Completed'];

export default function MissionsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<any>(null);

  const loadDone = useCallback(async () => {
    try {
      const [merged, stats] = await Promise.all([
        pathwaysProgressService.loadMissionsDone(profile?.id),
        profile ? gamificationService.getUserStats(profile.id) : null,
      ]);
      setDoneIds(merged);
      if (stats) setUserStats(stats);
    } catch {}
    finally { setLoading(false); }
  }, [profile]);

  useEffect(() => { loadDone(); }, [loadDone]);

  const filteredMissions = useMemo(() => {
    return MISSIONS.filter((mission) => {
      const passLang = langFilter === 'all' || mission.language === langFilter;
      const passDifficulty = difficultyFilter === 'All'
        ? true
        : difficultyFilter === 'Completed'
          ? doneIds.includes(mission.id)
          : mission.difficulty === difficultyFilter;
      const passSearch = !search.trim() || `${mission.title} ${mission.description} ${mission.instructions} ${mission.tags.join(' ')}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      return passLang && passDifficulty && passSearch;
    });
  }, [difficultyFilter, doneIds, langFilter, search]);

  const totalXP = userStats?.total_points || 0;
  const achievementLevel = userStats?.achievement_level || 'Bronze';
  const progressToNext = totalXP % XP_PER_LEVEL;

  const saveDone = async (next: string[]) => {
    setDoneIds(next);
    await pathwaysProgressService.saveMissionsDone(profile?.id, next);
  };

  const toggleMission = async (mission: Mission) => {
    if (doneIds.includes(mission.id)) {
      await saveDone(doneIds.filter((id) => id !== mission.id));
      return;
    }
    const next = [...doneIds, mission.id];
    await saveDone(next);
    
    if (profile) {
      const result = await gamificationService.awardPoints(profile.id, 'mission_complete', mission.id, `Completed mission: ${mission.title}`);
      setUserStats((prev: any) => ({ ...prev, total_points: result.totalPoints, achievement_level: result.newLevel }));
      Alert.alert('Mission completed', `${mission.title} added ${result.points} XP! New level: ${result.newLevel}`);
    } else {
      Alert.alert('Mission completed', `${mission.title} completed locally.`);
    }
  };

  const openMissionTool = (mission: Mission) => {
    if (mission.language === 'robotics') {
      navigation.navigate(ROUTES.Projects);
      return;
    }
    if (mission.language === 'html') {
      navigation.navigate(TAB_ROUTES.Learn);
      return;
    }
    navigation.navigate(ROUTES.AI);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <Text style={styles.headerTitle}>Missions</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{achievementLevel}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['rgba(122,6,6,0.16)', 'rgba(122,6,6,0.04)']} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>TACTICAL EXERCISES</Text>
          <Text style={styles.heroTitle}>Real mission flow for mobile, not empty placeholders.</Text>
          <Text style={styles.heroText}>Filter by language, review the task briefing, inspect starter logic, and mark the mission after you actually complete it.</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{doneIds.length}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{totalXP}</Text>
              <Text style={styles.statLabel}>XP Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{MISSIONS.length - doneIds.length}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (progressToNext / XP_PER_LEVEL) * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressToNext}/{XP_PER_LEVEL} XP toward next level</Text>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>?</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search missions"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {MISSION_LANG_FILTERS.map((filter) => (
            <TouchableOpacity key={filter.key} style={[styles.filterChip, langFilter === filter.key && styles.filterChipActive]} onPress={() => setLangFilter(filter.key)}>
              <Text style={[styles.filterChipText, langFilter === filter.key && styles.filterChipTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRowSecondary}>
          {FILTERS.map((filter) => (
            <TouchableOpacity key={filter} style={[styles.filterChipSecondary, difficultyFilter === filter && styles.filterChipSecondaryActive]} onPress={() => setDifficultyFilter(filter)}>
              <Text style={[styles.filterChipSecondaryText, difficultyFilter === filter && styles.filterChipSecondaryTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredMissions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No missions found</Text>
            <Text style={styles.emptyText}>Try another filter or search term.</Text>
          </View>
        ) : filteredMissions.map((mission) => {
          const active = activeMissionId === mission.id;
          const done = doneIds.includes(mission.id);
          return (
            <View key={mission.id} style={styles.missionShell}>
              <TouchableOpacity style={styles.missionCard} activeOpacity={0.86} onPress={() => setActiveMissionId(active ? null : mission.id)}>
                <View style={styles.missionTop}>
                  <View style={[styles.statusBadge, done ? styles.statusDone : styles.statusOpen]}>
                    <Text style={styles.statusBadgeText}>{done ? 'DONE' : mission.difficulty.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.missionXP}>+{mission.xp} XP</Text>
                </View>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.missionDesc}>{mission.description}</Text>
                <View style={styles.tagsRow}>
                  {mission.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {active && (
                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Mission briefing</Text>
                  <Text style={styles.detailText}>{mission.instructions}</Text>
                  <Text style={styles.detailLabel}>Starter logic</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{mission.starterCode}</Text>
                  </View>
                  <View style={styles.detailActions}>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionGhost]} onPress={() => openMissionTool(mission)}>
                      <Text style={styles.actionGhostText}>Open Work Tool</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, done ? styles.actionMuted : styles.actionPrimary]} onPress={() => toggleMission(mission)}>
                      <Text style={done ? styles.actionMutedText : styles.actionPrimaryText}>{done ? 'Mark Incomplete' : 'Complete Mission'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  levelBadge: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.warning + '55', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.warning + '22' },
  levelText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.warning },
  scroll: { paddingHorizontal: SPACING.base, paddingBottom: 40 },
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.borderGlow, padding: SPACING.xl, marginBottom: SPACING.lg },
  heroEyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: 1.5, color: COLORS.primaryLight, marginBottom: 8 },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 8 },
  heroText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  statCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden', marginTop: SPACING.lg },
  progressFill: { height: 6, backgroundColor: COLORS.warning, borderRadius: 3 },
  progressText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  searchIcon: { fontSize: 14, color: COLORS.textMuted },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, paddingVertical: 12 },
  filtersRow: { gap: 8, paddingBottom: 6 },
  filtersRowSecondary: { gap: 8, paddingVertical: 10, marginBottom: SPACING.sm },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  filterChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  filterChipTextActive: { color: COLORS.primaryLight },
  filterChipSecondary: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipSecondaryActive: { borderColor: COLORS.warning, backgroundColor: COLORS.warning + '22' },
  filterChipSecondaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  filterChipSecondaryTextActive: { color: COLORS.warning },
  emptyCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.bgCard, padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.sm },
  emptyTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  missionShell: { marginBottom: SPACING.md },
  missionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.bgCard, padding: SPACING.md },
  missionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
  statusDone: { backgroundColor: COLORS.success + '22' },
  statusOpen: { backgroundColor: COLORS.primary + '22' },
  statusBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textPrimary, letterSpacing: 0.8 },
  missionXP: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.warning },
  missionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  missionDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 19 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  tagChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.white05 },
  tagText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  detailCard: { borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 0, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, backgroundColor: COLORS.bgCard, padding: SPACING.md, marginTop: -6 },
  detailLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 8, marginTop: 4 },
  detailText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  codeBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: '#0a0a14' },
  codeText: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.xs, color: '#b8ff9f', lineHeight: 18 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  actionBtn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionGhost: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionMuted: { backgroundColor: COLORS.success + '22', borderWidth: 1, borderColor: COLORS.success + '44' },
  actionGhostText: { color: COLORS.textPrimary, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  actionPrimaryText: { color: '#fff', fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  actionMutedText: { color: COLORS.success, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
});

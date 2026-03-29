import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const STORAGE_KEY = 'rillcod_missions_done';

interface Mission {
  id: number;
  title: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  xp: number;
  category: string;
  emoji: string;
}

const MISSIONS: Mission[] = [
  { id: 1,  title: 'Hello World',  desc: 'Print Hello World in Python',              difficulty: 'easy',   xp: 10,  category: 'Python', emoji: '🐍' },
  { id: 2,  title: 'Variables',    desc: 'Declare 3 different variable types',       difficulty: 'easy',   xp: 15,  category: 'Python', emoji: '📦' },
  { id: 3,  title: 'If/Else',      desc: 'Write a number comparison program',        difficulty: 'easy',   xp: 20,  category: 'Python', emoji: '🔀' },
  { id: 4,  title: 'For Loop',     desc: 'Print 1 to 10 using a loop',              difficulty: 'medium', xp: 25,  category: 'Python', emoji: '🔁' },
  { id: 5,  title: 'Functions',    desc: 'Create a function that calculates area',   difficulty: 'medium', xp: 30,  category: 'Python', emoji: '⚙️' },
  { id: 6,  title: 'Lists',        desc: 'Create and manipulate a list of 5 items', difficulty: 'medium', xp: 30,  category: 'Python', emoji: '📝' },
  { id: 7,  title: 'HTML Page',    desc: 'Build a simple HTML webpage',              difficulty: 'easy',   xp: 20,  category: 'Web',    emoji: '🌐' },
  { id: 8,  title: 'CSS Styling',  desc: 'Style a webpage with colours and fonts',  difficulty: 'medium', xp: 25,  category: 'Web',    emoji: '🎨' },
  { id: 9,  title: 'JS Alert',     desc: 'Create a button that shows an alert',     difficulty: 'medium', xp: 30,  category: 'Web',    emoji: '💡' },
  { id: 10, title: 'Calculator',   desc: 'Build a Python calculator',               difficulty: 'hard',   xp: 50,  category: 'Python', emoji: '🧮' },
  { id: 11, title: 'Quiz App',     desc: 'Create a 5-question quiz in Python',      difficulty: 'hard',   xp: 60,  category: 'Python', emoji: '🎯' },
  { id: 12, title: 'AI Chatbot',   desc: 'Build a rule-based chatbot',              difficulty: 'hard',   xp: 80,  category: 'AI',     emoji: '🤖' },
];

const TOTAL_XP = MISSIONS.reduce((sum, m) => sum + m.xp, 0);
const CATEGORIES = ['Python', 'Web', 'AI'];

const DIFF_COLORS: Record<string, string> = {
  easy: COLORS.success, medium: COLORS.warning, hard: COLORS.error,
};

export default function MissionsScreen({ navigation }: any) {
  const [doneMissions, setDoneMissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDone = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setDoneMissions(JSON.parse(stored));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDone(); }, [loadDone]);

  const markComplete = async (mission: Mission) => {
    if (doneMissions.includes(mission.id)) return;
    const newDone = [...doneMissions, mission.id];
    setDoneMissions(newDone);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDone));
    Alert.alert(
      `+${mission.xp} XP! 🎉`,
      `Mission "${mission.title}" completed!\nKeep going — you're on fire!`,
      [{ text: 'Awesome!' }]
    );
  };

  const earnedXP = MISSIONS.filter(m => doneMissions.includes(m.id)).reduce((s, m) => s + m.xp, 0);
  const completedCount = doneMissions.length;
  const progressPct = MISSIONS.length > 0 ? completedCount / MISSIONS.length : 0;

  // Streak: consecutive IDs from the end
  let streak = 0;
  for (let i = completedCount; i >= 1; i--) {
    if (doneMissions.includes(i)) streak++; else break;
  }

  const renderMission = (mission: Mission, idx: number) => {
    const done = doneMissions.includes(mission.id);
    const diffColor = DIFF_COLORS[mission.difficulty];
    return (
      <MotiView
        key={mission.id}
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: idx * 35, type: 'timing', duration: 260 }}
      >
        <View style={[styles.missionCard, done && styles.missionDone]}>
          <Text style={styles.missionEmoji}>{mission.emoji}</Text>
          <View style={styles.missionBody}>
            <View style={styles.missionTop}>
              <Text style={[styles.missionTitle, done && { color: COLORS.textMuted }]} numberOfLines={1}>{mission.title}</Text>
              <View style={styles.xpChip}>
                <Text style={styles.xpChipText}>+{mission.xp} XP</Text>
              </View>
            </View>
            <Text style={styles.missionDesc}>{mission.desc}</Text>
            <View style={styles.missionFooter}>
              <View style={[styles.diffBadge, { backgroundColor: `${diffColor}20` }]}>
                <Text style={[styles.diffText, { color: diffColor }]}>{mission.difficulty}</Text>
              </View>
              {done ? (
                <View style={styles.doneChip}>
                  <Text style={styles.doneText}>✓ Done</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.completeBtn} onPress={() => markComplete(mission)}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.completeBtnInner}>
                    <Text style={styles.completeBtnText}>Mark Complete</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </MotiView>
    );
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Missions</Text>
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 {streak}</Text>
        </View>
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={c => c}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            {/* XP + Progress */}
            <LinearGradient colors={['rgba(122,6,6,0.15)', 'rgba(122,6,6,0.03)']}
              style={styles.statsCard}>
              <View style={styles.statsTopRow}>
                <View>
                  <Text style={styles.xpLabel}>Total XP Earned</Text>
                  <Text style={styles.xpValue}>{earnedXP} <Text style={styles.xpMax}>/ {TOTAL_XP}</Text></Text>
                </View>
                <View style={styles.statRight}>
                  <Text style={styles.statRightNum}>{completedCount}</Text>
                  <Text style={styles.statRightLabel}>of {MISSIONS.length} done</Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${progressPct * 100}%` as any }}
                  transition={{ type: 'timing', duration: 800 }}
                  style={styles.progressFill}
                />
              </View>
              <Text style={styles.progressPct}>{Math.round(progressPct * 100)}% complete</Text>
            </LinearGradient>
          </View>
        }
        renderItem={({ item: category }) => {
          const catMissions = MISSIONS.filter(m => m.category === category);
          const catDone = catMissions.filter(m => doneMissions.includes(m.id)).length;
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {category === 'Python' ? '🐍' : category === 'Web' ? '🌐' : '🤖'} {category}
                </Text>
                <Text style={styles.sectionCount}>{catDone}/{catMissions.length}</Text>
              </View>
              {catMissions.map((m, i) => renderMission(m, i))}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  streakBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  streakText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.gold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsCard: { borderRadius: RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.borderGlow },
  statsTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  xpLabel: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginBottom: 4 },
  xpValue: { fontSize: FONT_SIZE['2xl'], fontFamily: FONT_FAMILY.display, color: COLORS.textPrimary },
  xpMax: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  statRight: { alignItems: 'flex-end' },
  statRightNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display, color: COLORS.primaryLight },
  statRightLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  progressTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: COLORS.primary, borderRadius: 4 },
  progressPct: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  section: { marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  sectionCount: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  missionCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.md },
  missionDone: { opacity: 0.65, borderColor: COLORS.success + '40' },
  missionEmoji: { fontSize: 28, marginTop: 2 },
  missionBody: { flex: 1 },
  missionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  missionTitle: { flex: 1, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  xpChip: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  xpChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.gold },
  missionDesc: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  missionFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  diffBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  diffText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  doneChip: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  doneText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.success },
  completeBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  completeBtnInner: { paddingHorizontal: 12, paddingVertical: 5 },
  completeBtnText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

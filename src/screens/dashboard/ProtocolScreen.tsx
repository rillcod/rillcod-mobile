import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const STORAGE_KEY = 'rillcod_protocol_done';

interface Phase {
  id: number;
  name: string;
  icon: string;
  color: string;
  modules: string[];
}

const PHASES: Phase[] = [
  {
    id: 1, name: 'Foundations', icon: '🏗️', color: COLORS.info,
    modules: ['Variables & Types', 'Control Flow', 'Functions', 'Data Structures'],
  },
  {
    id: 2, name: 'Web Basics', icon: '🌐', color: COLORS.success,
    modules: ['HTML Fundamentals', 'CSS Styling', 'JavaScript Basics', 'DOM Manipulation'],
  },
  {
    id: 3, name: 'Python Pro', icon: '🐍', color: COLORS.warning,
    modules: ['OOP Concepts', 'File Handling', 'APIs & Requests', 'Data Analysis'],
  },
  {
    id: 4, name: 'AI & Robotics', icon: '🤖', color: COLORS.accent,
    modules: ['Intro to AI', 'Machine Learning Basics', 'IoT & Arduino', 'Final Project'],
  },
];

const ALL_MODULES = PHASES.flatMap(p => p.modules);

export default function ProtocolScreen({ navigation }: any) {
  const [doneModules, setDoneModules] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<number[]>([1]);
  const [loading, setLoading] = useState(true);

  const loadDone = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setDoneModules(JSON.parse(stored));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDone(); }, [loadDone]);

  const toggleExpand = (phaseId: number) => {
    setExpanded(prev =>
      prev.includes(phaseId) ? prev.filter(id => id !== phaseId) : [...prev, phaseId]
    );
  };

  const isModuleLocked = (modIndex: number): boolean => {
    if (modIndex === 0) return false;
    return !doneModules.includes(ALL_MODULES[modIndex - 1]);
  };

  const handleStart = async (module: string, globalIdx: number) => {
    if (isModuleLocked(globalIdx)) {
      Alert.alert('Module Locked', 'Complete the previous module first.');
      return;
    }
    if (doneModules.includes(module)) return;

    Alert.alert(
      `Start: ${module}`,
      'Navigate to AI Hub → Code Lab to practise this module.\n\nMark as completed?',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Mark Done ✓',
          onPress: async () => {
            const newDone = [...doneModules, module];
            setDoneModules(newDone);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDone));
          },
        },
      ]
    );
  };

  const masteryPct = ALL_MODULES.length > 0
    ? Math.round((doneModules.length / ALL_MODULES.length) * 100)
    : 0;

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
        <Text style={styles.headerTitle}>Protocol</Text>
        <View style={styles.masteryBadge}>
          <Text style={styles.masteryText}>{masteryPct}% Mastery</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40 }}>
        {/* Circular progress card */}
        <LinearGradient colors={['rgba(122,6,6,0.15)', 'rgba(122,6,6,0.03)']}
          style={styles.masteryCard}>
          <View style={styles.masteryRow}>
            {/* Circular ring (SVG-less approximation using border) */}
            <View style={styles.circleOuter}>
              <View style={[styles.circleInner]}>
                <Text style={styles.circleNum}>{masteryPct}%</Text>
                <Text style={styles.circleLabel}>Mastery</Text>
              </View>
              <MotiView
                from={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ loop: false, type: 'timing', duration: 600 }}
                style={[styles.circleArc, {
                  borderColor: COLORS.primary,
                  borderTopColor: masteryPct > 25 ? COLORS.primary : COLORS.border,
                  borderRightColor: masteryPct > 50 ? COLORS.primary : COLORS.border,
                  borderBottomColor: masteryPct > 75 ? COLORS.primary : COLORS.border,
                }]}
              />
            </View>
            <View style={styles.masteryStats}>
              <Text style={styles.masteryStatsLabel}>Completed</Text>
              <Text style={styles.masteryStatsNum}>{doneModules.length}</Text>
              <Text style={styles.masteryStatsDivider}>of {ALL_MODULES.length} modules</Text>
              <View style={styles.phaseProgress}>
                {PHASES.map(p => {
                  const doneCnt = p.modules.filter(m => doneModules.includes(m)).length;
                  return (
                    <View key={p.id} style={styles.phaseProgressRow}>
                      <Text style={[styles.phaseProgressIcon]}>{p.icon}</Text>
                      <View style={styles.phaseProgressTrack}>
                        <View style={[styles.phaseProgressFill, { width: `${(doneCnt / p.modules.length) * 100}%` as any, backgroundColor: p.color }]} />
                      </View>
                      <Text style={[styles.phaseProgressCount, { color: p.color }]}>{doneCnt}/{p.modules.length}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Phases */}
        {PHASES.map(phase => {
          const isExpanded = expanded.includes(phase.id);
          const doneCnt = phase.modules.filter(m => doneModules.includes(m)).length;
          const phasePct = Math.round((doneCnt / phase.modules.length) * 100);
          // Global index offset for this phase
          const phaseOffset = PHASES.slice(0, phase.id - 1).reduce((s, p) => s + p.modules.length, 0);

          return (
            <View key={phase.id} style={styles.phaseCard}>
              <TouchableOpacity
                style={styles.phaseHeader}
                onPress={() => toggleExpand(phase.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.phaseIcon, { backgroundColor: `${phase.color}20` }]}>
                  <Text style={styles.phaseIconText}>{phase.icon}</Text>
                </View>
                <View style={styles.phaseHeaderBody}>
                  <Text style={styles.phaseName}>Phase {phase.id} — {phase.name}</Text>
                  <Text style={[styles.phaseSubtitle, { color: phase.color }]}>
                    {doneCnt}/{phase.modules.length} modules · {phasePct}%
                  </Text>
                  <View style={styles.phaseBar}>
                    <View style={[styles.phaseBarFill, { width: `${phasePct}%` as any, backgroundColor: phase.color }]} />
                  </View>
                </View>
                <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.modulesList}>
                  {phase.modules.map((mod, i) => {
                    const globalIdx = phaseOffset + i;
                    const done = doneModules.includes(mod);
                    const locked = isModuleLocked(globalIdx);

                    return (
                      <MotiView
                        key={mod}
                        from={{ opacity: 0, translateX: -8 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ delay: i * 60, type: 'timing', duration: 250 }}
                      >
                        <View style={[styles.moduleRow, locked && styles.moduleRowLocked]}>
                          <Text style={styles.moduleIcon}>
                            {done ? '✅' : locked ? '🔒' : '▶'}
                          </Text>
                          <Text style={[
                            styles.moduleName,
                            done && styles.moduleNameDone,
                            locked && styles.moduleNameLocked,
                          ]}>
                            {mod}
                          </Text>
                          {!done && !locked && (
                            <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(mod, globalIdx)}>
                              <LinearGradient colors={COLORS.gradPrimary} style={styles.startBtnInner}>
                                <Text style={styles.startBtnText}>Start</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}
                          {done && (
                            <View style={styles.doneChip}>
                              <Text style={styles.doneChipText}>Done</Text>
                            </View>
                          )}
                        </View>
                      </MotiView>
                    );
                  })}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  masteryBadge: { backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.borderGlow },
  masteryText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primaryLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  masteryCard: { borderRadius: RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.borderGlow },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xl },
  circleOuter: { width: 100, height: 100, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circleInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  circleArc: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 6, borderColor: COLORS.primary },
  circleNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display, color: COLORS.textPrimary },
  circleLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  masteryStats: { flex: 1 },
  masteryStatsLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  masteryStatsNum: { fontSize: FONT_SIZE['2xl'], fontFamily: FONT_FAMILY.display, color: COLORS.textPrimary },
  masteryStatsDivider: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginBottom: SPACING.sm },
  phaseProgress: { gap: 6 },
  phaseProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseProgressIcon: { fontSize: 12, width: 18 },
  phaseProgressTrack: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  phaseProgressFill: { height: 4, borderRadius: 2 },
  phaseProgressCount: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, width: 28, textAlign: 'right' },
  phaseCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden' },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  phaseIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  phaseIconText: { fontSize: 22 },
  phaseHeaderBody: { flex: 1 },
  phaseName: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: 2 },
  phaseSubtitle: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, marginBottom: 6 },
  phaseBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  phaseBarFill: { height: 4, borderRadius: 2 },
  chevron: { fontSize: 12, color: COLORS.textMuted },
  modulesList: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  moduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, gap: SPACING.sm },
  moduleRowLocked: { opacity: 0.5 },
  moduleIcon: { fontSize: 16, width: 22 },
  moduleName: { flex: 1, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  moduleNameDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  moduleNameLocked: { color: COLORS.textMuted },
  startBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  startBtnInner: { paddingHorizontal: 12, paddingVertical: 5 },
  startBtnText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
  doneChip: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  doneChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.success },
});

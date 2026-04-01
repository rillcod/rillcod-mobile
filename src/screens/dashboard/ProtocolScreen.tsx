import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const STORAGE_KEY = 'rillcod_protocol_done_v2';

interface ProtocolModule {
  id: string;
  title: string;
  description: string;
  language: 'javascript' | 'python' | 'html' | 'robotics';
  outcome: string;
  starterCode: string;
}

interface ProtocolPhase {
  id: number;
  name: string;
  icon: string;
  color: string;
  modules: ProtocolModule[];
}

const PROTOCOL_PHASES: ProtocolPhase[] = [
  {
    id: 1,
    name: 'Code Foundations',
    icon: 'CD',
    color: COLORS.primary,
    modules: [
      {
        id: 'p1-js-vars',
        title: 'Variables and output',
        description: 'Store values, print them, and understand the shape of simple code.',
        language: 'javascript',
        outcome: 'You should be able to declare values and explain what each line is doing.',
        starterCode: "const studentName = 'Ada';\nconst age = 13;\nconsole.log(`My name is ${studentName} and I am ${age}`);",
      },
      {
        id: 'p1-js-flow',
        title: 'Conditionals and loops',
        description: 'Control logic with if statements and repeated actions with loops.',
        language: 'javascript',
        outcome: 'You should be able to branch logic and repeat a task safely.',
        starterCode: "for (let i = 1; i <= 5; i++) {\n  if (i % 2 === 0) {\n    console.log('Even', i);\n  }\n}",
      },
      {
        id: 'p1-python-func',
        title: 'Python functions',
        description: 'Write reusable functions with parameters and return values.',
        language: 'python',
        outcome: 'You should be able to package logic into a named reusable block.',
        starterCode: "def calculate_area(width, height):\n    return width * height\n\nprint(calculate_area(5, 3))",
      },
    ],
  },
  {
    id: 2,
    name: 'Web Engine',
    icon: 'WB',
    color: COLORS.success,
    modules: [
      {
        id: 'p2-html-structure',
        title: 'HTML structure',
        description: 'Build semantic layout with headings, sections, lists, and buttons.',
        language: 'html',
        outcome: 'You should be able to create a clear page skeleton that a user can navigate.',
        starterCode: "<main>\n  <h1>STEM Dashboard</h1>\n  <section>\n    <p>Welcome to the lab.</p>\n    <button>Launch</button>\n  </section>\n</main>",
      },
      {
        id: 'p2-html-dom',
        title: 'DOM interactions',
        description: 'Connect buttons and page elements to user actions.',
        language: 'html',
        outcome: 'You should be able to update page content after a click.',
        starterCode: "<button onclick=\"launchMission()\">Launch</button>\n<p id=\"status\">Idle</p>\n<script>\nfunction launchMission() {\n  document.getElementById('status').textContent = 'Mission started';\n}\n</script>",
      },
      {
        id: 'p2-js-arrays',
        title: 'Arrays and mapping',
        description: 'Transform lists of values into useful UI or summaries.',
        language: 'javascript',
        outcome: 'You should be able to filter, map, and summarize a collection.',
        starterCode: "const scores = [45, 70, 88, 91];\nconst passing = scores.filter((score) => score >= 50);\nconst boosted = passing.map((score) => score + 5);\nconsole.log(boosted);",
      },
    ],
  },
  {
    id: 3,
    name: 'Applied Systems',
    icon: 'AI',
    color: COLORS.warning,
    modules: [
      {
        id: 'p3-python-data',
        title: 'Data and APIs',
        description: 'Work with dictionaries, arrays, and remote data responses.',
        language: 'python',
        outcome: 'You should be able to inspect structured data and extract key values.',
        starterCode: "student = {'name': 'Musa', 'score': 82}\nprint(student['name'])\nprint(student['score'])",
      },
      {
        id: 'p3-js-async',
        title: 'Async workflows',
        description: 'Handle loading, success, and error paths when calling remote services.',
        language: 'javascript',
        outcome: 'You should be able to explain the difference between waiting and failing gracefully.',
        starterCode: "async function loadData() {\n  try {\n    const response = await fetch('https://example.com/data');\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.log('Request failed');\n  }\n}",
      },
      {
        id: 'p3-robotics-signals',
        title: 'Sensors and signals',
        description: 'Read simple robot inputs and react with output behavior.',
        language: 'robotics',
        outcome: 'You should be able to describe an input-process-output loop for a robot.',
        starterCode: "Read ultrasonic distance\nIf distance < 10cm\n  Stop motors\nElse\n  Keep moving",
      },
    ],
  },
  {
    id: 4,
    name: 'Launch Track',
    icon: 'LX',
    color: COLORS.accent,
    modules: [
      {
        id: 'p4-ui-systems',
        title: 'UI composition',
        description: 'Combine cards, actions, and status into a coherent interface.',
        language: 'html',
        outcome: 'You should be able to assemble a working layout with meaningful states.',
        starterCode: "<section class=\"card\">\n  <h2>Mission Control</h2>\n  <p>3 tasks pending review</p>\n</section>",
      },
      {
        id: 'p4-project-logic',
        title: 'Project logic review',
        description: 'Connect features, data flow, and completion criteria across screens.',
        language: 'javascript',
        outcome: 'You should be able to break a feature into logic, UI, and data dependencies.',
        starterCode: "const feature = {\n  screen: 'Reports',\n  data: ['students', 'grades'],\n  action: 'publish',\n};",
      },
      {
        id: 'p4-capstone',
        title: 'Capstone readiness',
        description: 'Prepare for a final build by reviewing the whole sequence.',
        language: 'robotics',
        outcome: 'You should know what to build next and which module to revisit if stuck.',
        starterCode: "Capstone checklist:\n1. Inputs confirmed\n2. Logic reviewed\n3. Output tested\n4. Report prepared",
      },
    ],
  },
];

const LANGUAGE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'html', label: 'Web' },
  { key: 'robotics', label: 'Robotics' },
] as const;

export default function ProtocolScreen({ navigation }: any) {
  const [doneModules, setDoneModules] = useState<string[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<number[]>([1]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<typeof LANGUAGE_FILTERS[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const allModules = useMemo(() => PROTOCOL_PHASES.flatMap((phase) => phase.modules), []);

  const loadDone = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setDoneModules(JSON.parse(stored));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDone(); }, [loadDone]);

  const visiblePhases = useMemo(() => {
    return PROTOCOL_PHASES.map((phase) => {
      const modules = phase.modules.filter((module) => {
        const passLanguage = languageFilter === 'all' || module.language === languageFilter;
        const passSearch = !search.trim() || `${module.title} ${module.description} ${module.outcome}`.toLowerCase().includes(search.trim().toLowerCase());
        return passLanguage && passSearch;
      });
      return { ...phase, modules };
    }).filter((phase) => phase.modules.length > 0);
  }, [languageFilter, search]);

  const isLocked = (moduleId: string) => {
    const moduleIndex = allModules.findIndex((item) => item.id === moduleId);
    if (moduleIndex <= 0) return false;
    return !doneModules.includes(allModules[moduleIndex - 1].id);
  };

  const saveDoneModules = async (next: string[]) => {
    setDoneModules(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const togglePhase = (phaseId: number) => {
    setExpandedPhases((prev) => prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]);
  };

  const toggleComplete = async (module: ProtocolModule) => {
    if (isLocked(module.id)) {
      Alert.alert('Module locked', 'Finish the previous protocol step first so the learning flow stays in order.');
      return;
    }
    if (doneModules.includes(module.id)) {
      const next = doneModules.filter((id) => id !== module.id);
      await saveDoneModules(next);
      return;
    }
    const next = [...doneModules, module.id];
    await saveDoneModules(next);
  };

  const openPractice = (module: ProtocolModule) => {
    if (module.language === 'robotics') {
      navigation.navigate('Projects');
      return;
    }
    if (module.language === 'html') {
      navigation.navigate('Learn');
      return;
    }
    navigation.navigate('AI');
  };

  const masteryPct = allModules.length > 0 ? Math.round((doneModules.length / allModules.length) * 100) : 0;

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
          <Text style={styles.backArrow}>?</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Protocol</Text>
        <View style={styles.masteryBadge}>
          <Text style={styles.masteryText}>{masteryPct}%</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['rgba(122,6,6,0.16)', 'rgba(122,6,6,0.04)']} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>INDUSTRIAL LEARNING PATH</Text>
          <Text style={styles.heroTitle}>Structured progress, not empty checklists.</Text>
          <Text style={styles.heroText}>
            Work through the protocol in sequence, review the starter logic, and jump straight into the right mobile tool for practice.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{doneModules.length}</Text>
              <Text style={styles.heroStatLabel}>Completed</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{allModules.length}</Text>
              <Text style={styles.heroStatLabel}>Modules</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{visiblePhases.length}</Text>
              <Text style={styles.heroStatLabel}>Visible phases</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>?</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search protocol modules"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {LANGUAGE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, languageFilter === filter.key && styles.filterChipActive]}
              onPress={() => setLanguageFilter(filter.key)}
            >
              <Text style={[styles.filterChipText, languageFilter === filter.key && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {visiblePhases.map((phase) => {
          const expanded = expandedPhases.includes(phase.id);
          const completedCount = phase.modules.filter((module) => doneModules.includes(module.id)).length;
          const progress = phase.modules.length > 0 ? Math.round((completedCount / phase.modules.length) * 100) : 0;

          return (
            <View key={phase.id} style={styles.phaseCard}>
              <TouchableOpacity style={styles.phaseHeader} activeOpacity={0.85} onPress={() => togglePhase(phase.id)}>
                <View style={[styles.phaseIcon, { backgroundColor: phase.color + '18' }]}>
                  <Text style={[styles.phaseIconText, { color: phase.color }]}>{phase.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.phaseName}>Phase {phase.id} · {phase.name}</Text>
                  <Text style={[styles.phaseMeta, { color: phase.color }]}>{completedCount}/{phase.modules.length} completed · {progress}%</Text>
                  <View style={styles.phaseTrack}>
                    <View style={[styles.phaseTrackFill, { width: `${progress}%`, backgroundColor: phase.color }]} />
                  </View>
                </View>
                <Text style={styles.chevron}>{expanded ? '?' : '?'}</Text>
              </TouchableOpacity>

              {expanded && phase.modules.map((module) => {
                const done = doneModules.includes(module.id);
                const locked = isLocked(module.id);
                const active = activeModuleId === module.id;
                return (
                  <View key={module.id} style={styles.moduleWrap}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.moduleCard, locked && styles.moduleCardLocked]}
                      onPress={() => !locked && setActiveModuleId(active ? null : module.id)}
                    >
                      <View style={styles.moduleTop}>
                        <View style={[styles.moduleStatus, done ? styles.statusDone : locked ? styles.statusLocked : styles.statusReady]}>
                          <Text style={styles.moduleStatusText}>{done ? 'DONE' : locked ? 'LOCKED' : 'READY'}</Text>
                        </View>
                        <Text style={styles.moduleLanguage}>{module.language.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.moduleTitle}>{module.title}</Text>
                      <Text style={styles.moduleDesc}>{module.description}</Text>
                      <Text style={styles.moduleOutcome}>Outcome: {module.outcome}</Text>
                    </TouchableOpacity>

                    {active && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailTitle}>Starter logic</Text>
                        <View style={styles.codeBox}>
                          <Text style={styles.codeText}>{module.starterCode}</Text>
                        </View>
                        <View style={styles.detailActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnGhost]}
                            onPress={() => openPractice(module)}
                          >
                            <Text style={styles.actionBtnGhostText}>Open Practice Tool</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, done ? styles.actionBtnMuted : styles.actionBtnPrimary]}
                            onPress={() => toggleComplete(module)}
                          >
                            <Text style={done ? styles.actionBtnMutedText : styles.actionBtnPrimaryText}>
                              {done ? 'Mark Incomplete' : 'Mark Complete'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
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
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  masteryBadge: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderGlow, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.primaryPale },
  masteryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },
  scroll: { paddingHorizontal: SPACING.base, paddingBottom: 40 },
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.borderGlow, padding: SPACING.xl, marginBottom: SPACING.lg },
  heroEyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: 1.5, color: COLORS.primaryLight, marginBottom: 8 },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 8 },
  heroText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  heroStat: { flex: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  heroStatNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  heroStatLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, textTransform: 'uppercase' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  searchIcon: { fontSize: 14, color: COLORS.textMuted },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, paddingVertical: 12 },
  filtersRow: { gap: 8, paddingBottom: 4, marginBottom: SPACING.md },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.bgCard },
  filterChipActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textMuted, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  filterChipTextActive: { color: COLORS.primaryLight },
  phaseCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, marginBottom: SPACING.md, overflow: 'hidden' },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  phaseIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  phaseIconText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base },
  phaseName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 2 },
  phaseMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginBottom: 8 },
  phaseTrack: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  phaseTrackFill: { height: 4, borderRadius: 2 },
  chevron: { color: COLORS.textMuted, fontSize: 11 },
  moduleWrap: { borderTopWidth: 1, borderTopColor: COLORS.border },
  moduleCard: { padding: SPACING.md, gap: 6 },
  moduleCardLocked: { opacity: 0.55 },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moduleStatus: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusDone: { backgroundColor: COLORS.success + '22' },
  statusLocked: { backgroundColor: COLORS.warning + '22' },
  statusReady: { backgroundColor: COLORS.primary + '22' },
  moduleStatusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: 0.8, color: COLORS.textPrimary },
  moduleLanguage: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: 1, color: COLORS.textMuted },
  moduleTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  moduleDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 19 },
  moduleOutcome: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  detailCard: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  detailTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 8 },
  codeBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: '#0a0a14' },
  codeText: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.xs, color: '#b8ff9f', lineHeight: 18 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  actionBtn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnGhost: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnMuted: { backgroundColor: COLORS.success + '22', borderWidth: 1, borderColor: COLORS.success + '44' },
  actionBtnGhostText: { color: COLORS.textPrimary, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  actionBtnPrimaryText: { color: '#fff', fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  actionBtnMutedText: { color: COLORS.success, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
});

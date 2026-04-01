import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const STORAGE_KEY = 'rillcod_missions_done_v2';
const XP_PER_LEVEL = 250;

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type MissionLanguage = 'javascript' | 'python' | 'html' | 'robotics';
type FilterType = 'All' | Difficulty | 'Completed';
type LangFilter = 'all' | MissionLanguage;

interface Mission {
  id: string;
  title: string;
  description: string;
  instructions: string;
  difficulty: Difficulty;
  language: MissionLanguage;
  xp: number;
  starterCode: string;
  tags: string[];
}

const MISSIONS: Mission[] = [
  {
    id: 'm-js-1',
    title: 'Hello, Variables',
    description: 'Declare values and print a student intro sentence.',
    instructions: 'Create three variables for name, age, and favorite subject. Print them in one clear sentence.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 50,
    starterCode: "const name = '';\nconst age = 0;\nconst subject = '';\nconsole.log(`My name is ${name}, I am ${age}, and I love ${subject}.`);",
    tags: ['variables', 'strings', 'intro'],
  },
  {
    id: 'm-js-2',
    title: 'Loop the numbers',
    description: 'Print numbers and separate odd from even values.',
    instructions: 'Use a loop from 1 to 10 and label each number as odd or even.',
    difficulty: 'Beginner',
    language: 'javascript',
    xp: 60,
    starterCode: "for (let i = 1; i <= 10; i++) {\n  const label = i % 2 === 0 ? 'even' : 'odd';\n  console.log(i, label);\n}",
    tags: ['loops', 'control-flow'],
  },
  {
    id: 'm-py-1',
    title: 'Python classifier',
    description: 'Classify numbers as positive, negative, or zero.',
    instructions: 'Write a function classify_number and test it against a list of values.',
    difficulty: 'Beginner',
    language: 'python',
    xp: 65,
    starterCode: "def classify_number(n):\n    if n > 0:\n        return 'positive'\n    if n < 0:\n        return 'negative'\n    return 'zero'\n\nfor value in [10, -3, 0, 7]:\n    print(value, classify_number(value))",
    tags: ['python', 'functions'],
  },
  {
    id: 'm-html-1',
    title: 'DOM detective',
    description: 'Update page content after a click.',
    instructions: 'Connect a button to a heading and paragraph so the page changes state when launched.',
    difficulty: 'Intermediate',
    language: 'html',
    xp: 90,
    starterCode: "<h1 id=\"heading\">Welcome</h1>\n<p id=\"status\">Idle</p>\n<button onclick=\"launch()\">Launch</button>\n<script>\nfunction launch() {\n  document.getElementById('heading').textContent = 'Mission Started';\n  document.getElementById('status').textContent = 'System online';\n}\n</script>",
    tags: ['dom', 'events'],
  },
  {
    id: 'm-js-3',
    title: 'Sort and search',
    description: 'Use arrays to sort values and find a target efficiently.',
    instructions: 'Sort a score list and then implement a binary-search-style lookup.',
    difficulty: 'Intermediate',
    language: 'javascript',
    xp: 110,
    starterCode: "const scores = [72, 55, 91, 40, 88];\nconst sorted = [...scores].sort((a, b) => a - b);\nconsole.log(sorted);\n\nfunction hasScore(target) {\n  return sorted.includes(target);\n}\n\nconsole.log(hasScore(88));",
    tags: ['arrays', 'sorting'],
  },
  {
    id: 'm-robot-1',
    title: 'Obstacle response',
    description: 'Describe a robot reaction when distance gets too small.',
    instructions: 'Build the logic steps for reading ultrasonic distance and stopping a robot when needed.',
    difficulty: 'Intermediate',
    language: 'robotics',
    xp: 120,
    starterCode: "Read distance\nIf distance < 10cm\n  Stop motors\n  Turn right\nElse\n  Move forward",
    tags: ['robotics', 'sensors'],
  },
  {
    id: 'm-py-2',
    title: 'Student report objects',
    description: 'Model student records with structured data.',
    instructions: 'Create student dictionaries, calculate average score, and print a clean report card.',
    difficulty: 'Intermediate',
    language: 'python',
    xp: 105,
    starterCode: "students = [\n  {'name': 'Aisha', 'scores': [80, 70, 90]},\n  {'name': 'Tobi', 'scores': [65, 88, 75]},\n]\n\nfor student in students:\n    average = sum(student['scores']) / len(student['scores'])\n    print(student['name'], average)",
    tags: ['data', 'reports'],
  },
  {
    id: 'm-js-4',
    title: 'Async fetch flow',
    description: 'Handle loading, success, and failure when calling a remote service.',
    instructions: 'Create an async function that fetches JSON and handles errors gracefully.',
    difficulty: 'Advanced',
    language: 'javascript',
    xp: 150,
    starterCode: "async function loadProfile() {\n  try {\n    const response = await fetch('https://example.com/profile');\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.log('Failed to load');\n  }\n}",
    tags: ['async', 'api'],
  },
  {
    id: 'm-html-2',
    title: 'Registration form',
    description: 'Build a simple form with validation messaging.',
    instructions: 'Create a form for name and email and show an error if either field is empty.',
    difficulty: 'Advanced',
    language: 'html',
    xp: 145,
    starterCode: "<form id=\"reg\">\n  <input id=\"name\" placeholder=\"Name\" />\n  <input id=\"email\" placeholder=\"Email\" />\n  <button type=\"button\" onclick=\"submitForm()\">Submit</button>\n</form>\n<p id=\"error\"></p>\n<script>\nfunction submitForm() {\n  const name = document.getElementById('name').value;\n  const email = document.getElementById('email').value;\n  if (!name || !email) {\n    document.getElementById('error').textContent = 'All fields are required';\n  }\n}\n</script>",
    tags: ['form', 'validation'],
  },
  {
    id: 'm-robot-2',
    title: 'Capstone checklist',
    description: 'Prepare the final build flow like a real delivery sequence.',
    instructions: 'List and order the input, control, output, and report steps for a robot build.',
    difficulty: 'Advanced',
    language: 'robotics',
    xp: 170,
    starterCode: "1. Confirm sensor wiring\n2. Test motion logic\n3. Observe output\n4. Record faults\n5. Publish final notes",
    tags: ['capstone', 'workflow'],
  },
];

const LANG_FILTERS: { key: LangFilter; label: string }[] = [
  { key: 'all', label: 'All Languages' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'html', label: 'Web' },
  { key: 'robotics', label: 'Robotics' },
];

const FILTERS: FilterType[] = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Completed'];

export default function MissionsScreen({ navigation }: any) {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<FilterType>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDone = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setDoneIds(JSON.parse(stored));
    } catch {}
    finally { setLoading(false); }
  }, []);

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

  const totalXP = MISSIONS.filter((mission) => doneIds.includes(mission.id)).reduce((sum, mission) => sum + mission.xp, 0);
  const level = Math.max(1, Math.floor(totalXP / XP_PER_LEVEL) + 1);
  const progressToNext = totalXP % XP_PER_LEVEL;

  const saveDone = async (next: string[]) => {
    setDoneIds(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleMission = async (mission: Mission) => {
    if (doneIds.includes(mission.id)) {
      await saveDone(doneIds.filter((id) => id !== mission.id));
      return;
    }
    const next = [...doneIds, mission.id];
    await saveDone(next);
    Alert.alert('Mission completed', `${mission.title} added ${mission.xp} XP to your mobile progress track.`);
  };

  const openMissionTool = (mission: Mission) => {
    if (mission.language === 'robotics') {
      navigation.navigate('Projects');
      return;
    }
    if (mission.language === 'html') {
      navigation.navigate('Learn');
      return;
    }
    navigation.navigate('AI');
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
          <Text style={styles.backArrow}>?</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Missions</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>L{level}</Text>
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
          {LANG_FILTERS.map((filter) => (
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
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
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

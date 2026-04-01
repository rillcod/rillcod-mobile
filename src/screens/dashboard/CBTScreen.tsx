import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

interface CBTExam {
  id: string;
  title: string;
  description: string | null;
  exam_type: string;
  difficulty: string | null;
  duration_minutes: number | null;
  pass_mark: number | null;
  created_at: string | null;
}

interface MySession {
  id: string;
  exam_id: string;
  exam_title: string;
  score: number | null;
  status: string | null;
  completed_at: string | null;
}

const TYPE_CONFIG: Record<string, { color: string; emoji: string }> = {
  examination: { color: '#f59e0b', emoji: '📝' },
  evaluation: { color: '#7c3aed', emoji: '📊' },
  quiz: { color: '#0ea5e9', emoji: '❓' },
  practice: { color: '#10b981', emoji: '🎯' },
};

export default function CBTScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const [exams, setExams] = useState<CBTExam[]>([]);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [filtered, setFiltered] = useState<CBTExam[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'exams' | 'results'>('exams');
  const [typeFilter, setTypeFilter] = useState<'all' | 'examination' | 'evaluation' | 'quiz' | 'practice'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStudent = profile?.role === 'student';

  const load = useCallback(async () => {
    const { data: examData } = await supabase
      .from('cbt_exams')
      .select('id, title, description, duration_minutes, passing_score, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (examData) {
      const mappedExams = (examData as any[]).map((exam) => ({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        exam_type: exam.metadata?.exam_type ?? 'examination',
        difficulty: exam.metadata?.difficulty ?? null,
        duration_minutes: exam.duration_minutes ?? null,
        pass_mark: exam.passing_score ?? null,
        created_at: exam.created_at ?? null,
      })) as CBTExam[];
      setExams(mappedExams);
      setFiltered(mappedExams);
    }

    if (isStudent) {
      const { data: sessions } = await supabase
        .from('cbt_sessions')
        .select(`
          id, score, status, end_time, exam_id,
          cbt_exams:exam_id(title)
        `)
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (sessions) {
        setMySessions((sessions as any[]).map(s => ({
          id: s.id,
          exam_id: s.exam_id,
          score: s.score,
          status: s.status,
          completed_at: s.end_time,
          exam_title: s.cbt_exams?.title ?? 'Unknown Exam',
        })));
      }
    }

    setLoading(false);
  }, [profile, isStudent]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = exams.filter((exam) => {
      const matchesSearch =
        !normalizedSearch ||
        exam.title.toLowerCase().includes(normalizedSearch) ||
        (exam.description ?? '').toLowerCase().includes(normalizedSearch);
      const matchesType = typeFilter === 'all' || exam.exam_type === typeFilter;
      return matchesSearch && matchesType;
    });
    setFiltered(next);
  }, [search, exams, typeFilter]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getGradeColor = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 80) return colors.success;
    if (pct >= 60) return colors.warning;
    return colors.error;
  };

  const getDifficultyColor = (diff: string) => {
    const d = diff.toLowerCase();
    if (d.includes('hard') || d.includes('adv')) return colors.error;
    if (d.includes('med') || d.includes('int')) return colors.warning;
    return colors.success;
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadText, { color: colors.textMuted }]}>SECURE HUB ACCESSING...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.border }]}>
          <Text style={[styles.backArrow, { color: colors.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>CBT TERMINAL</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{exams.length} OPERATIONAL MODULES</Text>
        </View>
      </View>

      {/* Tabs for students */}
      {isStudent && (
        <View style={[styles.tabs, { borderColor: colors.border }]}>
          {(['exams', 'results'] as const).map(t => (
            <TouchableOpacity 
              key={t} 
              onPress={() => { setTab(t); light(); }} 
              style={[styles.tab, { backgroundColor: colors.bgCard }, tab === t && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, tab === t && { color: '#fff' }]}>
                {t === 'exams' ? 'AVAILABLE' : 'ARCHIVE'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      {tab === 'exams' && (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>TOTAL</Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{exams.length}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>EXAMS</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {exams.filter((exam) => exam.exam_type === 'examination').length}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>EVALS</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {exams.filter((exam) => exam.exam_type === 'evaluation').length}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{isStudent ? 'DONE' : 'QUIZ'}</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {isStudent ? mySessions.length : exams.filter((exam) => exam.exam_type === 'quiz').length}
              </Text>
            </View>
          </View>

          <View style={[styles.searchWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="FILTER MODULES..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            {([
              ['all', 'ALL'],
              ['examination', 'EXAMINATION'],
              ['evaluation', 'EVALUATION'],
              ['quiz', 'QUIZ'],
              ['practice', 'PRACTICE'],
            ] as const).map(([key, label]) => {
              const active = typeFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setTypeFilter(key); light(); }}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.bgCard, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? '#fff' : colors.textSecondary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {tab === 'exams' && (
          filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🌑</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO MODULES DETECTED</Text>
            </View>
          ) : (
            filtered.map((exam, i) => {
              const cfg = TYPE_CONFIG[exam.exam_type] ?? { color: colors.info, emoji: '📝' };
              const diffColor = getDifficultyColor(exam.difficulty || 'Easy');
              return (
                <MotiView key={exam.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                  <TouchableOpacity 
                    style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]} 
                    activeOpacity={0.8}
                    onPress={() => isStudent && navigation.navigate('CBTExamination', { examId: exam.id })}
                  >
                    <View style={styles.cardTop}>
                      <View style={[styles.examIcon, { backgroundColor: cfg.color + '15' }]}>
                        <Text style={{ fontSize: 24 }}>{cfg.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.examTitle, { color: colors.textPrimary }]}>{exam.title}</Text>
                        {exam.description ? (
                          <Text style={[styles.examDesc, { color: colors.textMuted }]} numberOfLines={2}>
                            {exam.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    
                    <View style={styles.cardMeta}>
                      <View style={[styles.metaChip, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={[styles.metaChipText, { color: cfg.color }]}>{exam.exam_type.toUpperCase()}</Text>
                      </View>
                      {exam.difficulty ? (
                        <View style={[styles.metaChip, { backgroundColor: diffColor + '20' }]}>
                          <Text style={[styles.metaChipText, { color: diffColor }]}>{exam.difficulty.toUpperCase()}</Text>
                        </View>
                      ) : null}
                      {exam.duration_minutes ? (
                        <View style={[styles.metaChip, { backgroundColor: colors.border }]}>
                          <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                            {exam.duration_minutes}M
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {isStudent && (
                      <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                        <Text style={styles.startBtnText}>INITIALIZE MODULE →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </MotiView>
              );
            })
          )
        )}

        {tab === 'results' && (
          mySessions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🗄️</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>ARCHIVE IS EMPTY</Text>
            </View>
          ) : (
            mySessions.map((s, i) => {
              const pct = s.score != null ? Math.round(s.score) : null;
              const color = pct != null ? (pct >= 80 ? colors.success : pct >= 60 ? colors.warning : colors.error) : colors.textMuted;
              return (
                <MotiView key={s.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 50 }}>
                  <View style={[styles.resultCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{s.exam_title}</Text>
                      {s.completed_at ? (
                        <Text style={[styles.resultDate, { color: colors.textMuted }]}>
                          {new Date(s.completed_at).toLocaleDateString()} · {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      ) : null}
                    </View>
                    {pct != null ? (
                      <View style={[styles.scoreBox, { borderColor: color }]}>
                        <Text style={[styles.scoreText, { color }]}>{pct}%</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20' }]}>
                        <Text style={[styles.statusTabText, { color: colors.warning }]}>{(s.status ?? 'pending').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </MotiView>
              );
            })
          )
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 2 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.lg, gap: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20 },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, letterSpacing: LETTER_SPACING.tight },
  subtitle: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  tabs: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderWidth: 1, borderRadius: RADIUS.sm, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, alignItems: 'center' },
  statLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1.4, marginBottom: 6 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.mono, fontSize: 12 },
  filterScroll: { marginBottom: SPACING.lg },
  filterRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  filterChip: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },

  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg, marginBottom: SPACING.lg, overflow: 'hidden', gap: SPACING.lg },
  cardTop: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'flex-start' },
  examIcon: { width: 56, height: 56, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  examTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, textTransform: 'uppercase' },
  examDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, marginTop: 4, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  metaChipText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  startBtn: { paddingVertical: 14, borderRadius: RADIUS.sm, alignItems: 'center', marginTop: 8 },
  startBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: '#fff', letterSpacing: 2 },

  resultCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg, marginBottom: SPACING.md },
  resultTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, textTransform: 'uppercase' },
  resultDate: { fontFamily: FONT_FAMILY.mono, fontSize: 10, marginTop: 4 },
  scoreBox: { width: 56, height: 56, borderRadius: RADIUS.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm },
  statusTabText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },

  emptyWrap: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 11, letterSpacing: 2 },
});

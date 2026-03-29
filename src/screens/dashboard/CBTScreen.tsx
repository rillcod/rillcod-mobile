import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface CBTExam {
  id: string;
  title: string;
  description: string | null;
  exam_type: string;
  difficulty: string | null;
  time_limit_minutes: number | null;
  pass_mark: number | null;
  created_at: string;
  session_count: number;
}

interface MySession {
  id: string;
  exam_title: string;
  score: number | null;
  total_marks: number | null;
  status: string;
  completed_at: string | null;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: COLORS.success,
  medium: COLORS.warning,
  hard: COLORS.error,
  beginner: COLORS.success,
  intermediate: COLORS.warning,
  advanced: COLORS.error,
};

const TYPE_CONFIG: Record<string, { color: string; emoji: string }> = {
  examination: { color: COLORS.admin, emoji: '📝' },
  evaluation: { color: '#7c3aed', emoji: '📊' },
  quiz: { color: COLORS.info, emoji: '❓' },
  practice: { color: COLORS.success, emoji: '🎯' },
};

export default function CBTScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [exams, setExams] = useState<CBTExam[]>([]);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [filtered, setFiltered] = useState<CBTExam[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'exams' | 'results'>('exams');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStudent = profile?.role === 'student';

  const load = useCallback(async () => {
    const { data: examData } = await supabase
      .from('cbt_exams')
      .select('id, title, description, exam_type, difficulty, time_limit_minutes, pass_mark, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (examData) {
      setExams(examData as CBTExam[]);
      setFiltered(examData as CBTExam[]);
    }

    if (isStudent) {
      const { data: sessions } = await supabase
        .from('cbt_sessions')
        .select('id, score, total_marks, status, completed_at, cbt_exams:exam_id(title)')
        .eq('student_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (sessions) {
        setMySessions((sessions as any[]).map(s => ({
          ...s,
          exam_title: s.cbt_exams?.title ?? 'Unknown Exam',
        })));
      }
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(exams); return; }
    const q = search.toLowerCase();
    setFiltered(exams.filter(e => e.title.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q)));
  }, [search, exams]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getGradeColor = (score: number, total: number) => {
    const pct = (score / total) * 100;
    if (pct >= 70) return COLORS.success;
    if (pct >= 50) return COLORS.warning;
    return COLORS.error;
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.admin} size="large" />
        <Text style={styles.loadText}>Loading exams…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CBT Exams</Text>
          <Text style={styles.subtitle}>{exams.length} available</Text>
        </View>
      </View>

      {/* Tabs for students */}
      {isStudent && (
        <View style={styles.tabs}>
          {(['exams', 'results'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'exams' ? '📝 Exams' : '📊 My Results'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      {tab === 'exams' && (
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exams…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.admin} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {tab === 'exams' && (
          filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No exams found.</Text>
            </View>
          ) : (
            filtered.map((exam, i) => {
              const cfg = TYPE_CONFIG[exam.exam_type] ?? { color: COLORS.info, emoji: '📝' };
              const diffColor = DIFFICULTY_COLOR[exam.difficulty ?? ''] ?? COLORS.textMuted;
              return (
                <MotiView key={exam.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                  <TouchableOpacity style={styles.card} activeOpacity={0.8}>
                    <LinearGradient colors={[cfg.color + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={styles.cardTop}>
                      <View style={[styles.examIcon, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={{ fontSize: 24 }}>{cfg.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.examTitle}>{exam.title}</Text>
                        {exam.description ? <Text style={styles.examDesc} numberOfLines={2}>{exam.description}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.cardMeta}>
                      <View style={[styles.metaChip, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={[styles.metaChipText, { color: cfg.color }]}>{exam.exam_type}</Text>
                      </View>
                      {exam.difficulty ? (
                        <View style={[styles.metaChip, { backgroundColor: diffColor + '20' }]}>
                          <Text style={[styles.metaChipText, { color: diffColor }]}>{exam.difficulty}</Text>
                        </View>
                      ) : null}
                      {exam.time_limit_minutes ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>⏱ {exam.time_limit_minutes}m</Text>
                        </View>
                      ) : null}
                      {exam.pass_mark ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>Pass: {exam.pass_mark}%</Text>
                        </View>
                      ) : null}
                    </View>
                    {isStudent && (
                      <TouchableOpacity style={styles.startBtn}>
                        <LinearGradient colors={[cfg.color, cfg.color + 'cc']} style={StyleSheet.absoluteFill} />
                        <Text style={styles.startBtnText}>Start Exam →</Text>
                      </TouchableOpacity>
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
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>No exam results yet.</Text>
            </View>
          ) : (
            mySessions.map((s, i) => {
              const pct = s.score != null && s.total_marks ? Math.round((s.score / s.total_marks) * 100) : null;
              const color = pct != null ? getGradeColor(s.score!, s.total_marks!) : COLORS.textMuted;
              return (
                <MotiView key={s.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 50 }}>
                  <View style={styles.resultCard}>
                    <LinearGradient colors={[color + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{s.exam_title}</Text>
                      {s.completed_at ? (
                        <Text style={styles.resultDate}>{new Date(s.completed_at).toLocaleDateString('en-GB')}</Text>
                      ) : null}
                    </View>
                    {pct != null ? (
                      <View style={[styles.scoreCircle, { borderColor: color }]}>
                        <Text style={[styles.scoreText, { color }]}>{pct}%</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: COLORS.warning + '20' }]}>
                        <Text style={[styles.statusText, { color: COLORS.warning }]}>{s.status}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.bgCard },
  tabActive: { backgroundColor: COLORS.admin },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white100 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },

  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', gap: SPACING.sm },
  cardTop: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  examIcon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  examTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  examDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 3, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: COLORS.border },
  metaChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textSecondary },
  startBtn: { paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', overflow: 'hidden' },
  startBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },

  resultCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  resultTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  resultDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  scoreCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

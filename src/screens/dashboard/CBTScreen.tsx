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
import { cbtService } from '../../services/cbt.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

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

interface PendingGradeSession {
  id: string;
  exam_title: string;
  student_name: string;
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
  const [pendingGrades, setPendingGrades] = useState<PendingGradeSession[]>([]);

  const isStudent = profile?.role === 'student';
  const isTeacherRole = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin';
  const canAuthorCbt = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      const { exams: mappedExams, pendingGrades: pend, mySessions: sessions } = await cbtService.loadCbtHubBundle({
        userId: profile.id,
        isStudent,
        isTeacherRole,
        isAdmin,
      });
      setExams(mappedExams as CBTExam[]);
      setFiltered(mappedExams as CBTExam[]);
      setPendingGrades(pend);
      setMySessions(isStudent ? (sessions as MySession[]) : []);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isStudent, isTeacherRole, isAdmin]);

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
        <IconBackButton
          onPress={() => navigation.goBack()}
          color={colors.textPrimary}
          size={22}
          style={[styles.backBtn, { borderColor: colors.border }]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>CBT TERMINAL</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{exams.length} OPERATIONAL MODULES</Text>
        </View>
        {canAuthorCbt ? (
          <TouchableOpacity
            onPress={() => { light(); navigation.navigate(ROUTES.CBTExamEditor, {}); }}
            style={[styles.newExamBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.newExamBtnText, { color: colors.primary }]}>+ NEW</Text>
          </TouchableOpacity>
        ) : null}
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
          <>
            {canAuthorCbt && pendingGrades.length > 0 ? (
              <View style={styles.pendingBlock}>
                <Text style={[styles.pendingHeading, { color: colors.warning }]}>AWAITING MANUAL GRADE</Text>
                <Text style={[styles.pendingHint, { color: colors.textMuted }]}>
                  Essay submissions — tap a row to score and finalize the session.
                </Text>
                {pendingGrades.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 40 }}>
                    <TouchableOpacity
                      style={[styles.pendingRow, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      onPress={() => { light(); navigation.navigate(ROUTES.CBTGrading, { sessionId: p.id }); }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pendingExamTitle, { color: colors.textPrimary }]} numberOfLines={1}>{p.exam_title}</Text>
                        <Text style={[styles.pendingMeta, { color: colors.textMuted }]}>{p.student_name}</Text>
                        {p.completed_at ? (
                          <Text style={[styles.pendingMeta, { color: colors.textMuted }]}>
                            {new Date(p.completed_at).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.pendingCta, { color: colors.primary }]}>GRADE</Text>
                    </TouchableOpacity>
                  </MotiView>
                ))}
              </View>
            ) : null}
            {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🌑</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO MODULES DETECTED</Text>
            </View>
          ) : (
            filtered.map((exam, i) => {
              const cfg = TYPE_CONFIG[exam.exam_type] ?? { color: colors.info, emoji: '📝' };
              const diffColor = getDifficultyColor(exam.difficulty || 'Easy');
              const cardInner = (
                <>
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

                  {isStudent ? (
                    <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                      <Text style={styles.startBtnText}>INITIALIZE MODULE →</Text>
                    </View>
                  ) : canAuthorCbt ? (
                    <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                      <Text style={styles.startBtnText}>OPEN EDITOR →</Text>
                    </View>
                  ) : null}
                </>
              );

              return (
                <MotiView key={exam.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                  {isStudent ? (
                    <TouchableOpacity
                      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate(ROUTES.CBTExamination, { examId: exam.id })}
                    >
                      {cardInner}
                    </TouchableOpacity>
                  ) : canAuthorCbt ? (
                    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate(ROUTES.CBTExamEditor, { examId: exam.id })}
                      >
                        {cardInner}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => navigation.navigate(ROUTES.CBTExamination, { examId: exam.id })}
                        style={[styles.staffPreviewBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.staffPreviewBtnText, { color: colors.textSecondary }]}>PREVIEW AS LEARNER</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                      {cardInner}
                    </View>
                  )}
                </MotiView>
              );
            })
          )}
          </>
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
  newExamBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1 },
  newExamBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
  pendingBlock: { marginBottom: SPACING.lg },
  pendingHeading: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 1.5, marginBottom: 6 },
  pendingHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, marginBottom: SPACING.md },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  pendingExamTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, textTransform: 'uppercase' },
  pendingMeta: { fontFamily: FONT_FAMILY.mono, fontSize: 10, marginTop: 4 },
  pendingCta: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
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
  staffPreviewBtn: { paddingVertical: 12, borderRadius: RADIUS.sm, alignItems: 'center', marginTop: 10, borderWidth: 1 },
  staffPreviewBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.5 },

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

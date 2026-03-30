import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  passing_score: number | null;
  pass_mark: number | null;
  is_active: boolean;
  program_id: string | null;
  metadata: any;
}

interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay' | 'coding_blocks';
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  metadata: any | null;
  order_index: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Coding Blocks answer component ───────────────────────────────────────────

function CodingBlocksInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  const sentence: string = question.metadata?.logic_sentence ?? '';
  const blocks: string[] = question.metadata?.logic_blocks ?? [];
  const parts = sentence.split('[BLANK]');
  const filled = value ? value.split(',') : [];

  const fillNext = (block: string) => {
    const blanksCount = parts.length - 1;
    if (filled.length >= blanksCount) return;
    onChange([...filled, block].join(','));
  };

  const clear = () => onChange('');

  return (
    <View style={cbStyles.wrap}>
      {/* Logic sentence with filled blanks */}
      <View style={cbStyles.sentenceWrap}>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <Text style={cbStyles.sentencePart}>{part}</Text>
            {i < parts.length - 1 && (
              <View style={[cbStyles.blank, filled[i] ? cbStyles.blankFilled : null]}>
                <Text style={[cbStyles.blankText, filled[i] ? cbStyles.blankTextFilled : null]}>
                  {filled[i] ?? '  ?  '}
                </Text>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Blocks */}
      <Text style={cbStyles.blocksLabel}>Tap a block to fill the next blank:</Text>
      <View style={cbStyles.blocksRow}>
        {blocks.map((b, i) => (
          <TouchableOpacity key={i} style={cbStyles.block} onPress={() => fillNext(b)} activeOpacity={0.7}>
            <Text style={cbStyles.blockText}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={cbStyles.clearBtn} onPress={clear} activeOpacity={0.7}>
        <Text style={cbStyles.clearBtnText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
}

const cbStyles = StyleSheet.create({
  wrap: { gap: SPACING.md },
  sentenceWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  sentencePart: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, lineHeight: 22 },
  blank: {
    minWidth: 60, paddingHorizontal: 8, paddingVertical: 4,
    borderBottomWidth: 2, borderColor: COLORS.textMuted,
    alignItems: 'center',
  },
  blankFilled: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '18' },
  blankText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  blankTextFilled: { color: COLORS.accent },
  blocksLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.sm },
  blocksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: COLORS.accent + '20', borderWidth: 1, borderColor: COLORS.accent + '40',
    borderRadius: RADIUS.md,
  },
  blockText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.accentLight },
  clearBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
  },
  clearBtnText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ExamTakingScreen({ navigation, route }: any) {
  const { examId, examTitle } = route.params as { examId: string; examTitle: string };
  const { profile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyAttempted, setAlreadyAttempted] = useState<{ score: number; status: string } | null>(null);

  const startTimeRef = useRef(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadExam();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExam = async () => {
    try {
      // Check already attempted
      const { data: existing } = await supabase
        .from('cbt_sessions')
        .select('id, score, status')
        .eq('exam_id', examId)
        .eq('user_id', profile!.id)
        .maybeSingle();

      if (existing) {
        setAlreadyAttempted({ score: existing.score ?? 0, status: existing.status });
        setLoading(false);
        return;
      }

      // Load exam + questions
      const { data, error } = await supabase
        .from('cbt_exams')
        .select('*, cbt_questions(*)')
        .eq('id', examId)
        .single();

      if (error || !data) throw error ?? new Error('Exam not found');

      const sortedQuestions: Question[] = ((data.cbt_questions ?? []) as Question[]).sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      );

      setExam(data as Exam);
      setQuestions(sortedQuestions);

      const totalSecs = (data.duration_minutes ?? 60) * 60;
      setTimeLeft(totalSecs);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to load exam');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // ── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!exam || submitted || alreadyAttempted || loading) return;
    if (timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!submittedRef.current) doSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, submitted, alreadyAttempted, loading]);

  // ── Submit logic ─────────────────────────────────────────────────────────────

  const handleSubmit = (auto = false) => {
    if (submitting || submitted) return;
    if (!auto) {
      Alert.alert(
        'Submit Exam?',
        'You cannot change your answers after submission.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: () => doSubmit() },
        ]
      );
      return;
    }
    doSubmit();
  };

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    try {
      let autoPoints = 0;
      let totalPoints = 0;
      let manualGradingRequired = false;

      questions.forEach(q => {
        totalPoints += q.points ?? 0;
        if (q.question_type === 'essay') {
          manualGradingRequired = true;
          return;
        }
        const userAns = (answers[q.id] ?? '').trim().toLowerCase();
        const correct = (q.correct_answer ?? '').trim().toLowerCase();
        if (userAns === correct) autoPoints += q.points ?? 0;
      });

      const score = totalPoints > 0 ? Math.round((autoPoints / totalPoints) * 100) : 0;
      const passingPct = exam?.passing_score ?? exam?.pass_mark ?? 70;
      const passed = score >= passingPct;
      const finalStatus = manualGradingRequired
        ? 'pending_grading'
        : passed
        ? 'passed'
        : 'failed';

      const { error } = await supabase.from('cbt_sessions').insert({
        exam_id: exam!.id,
        user_id: profile!.id,
        score,
        total_marks: totalPoints,
        status: finalStatus,
        answers,
        needs_grading: manualGradingRequired,
        start_time: startTimeRef.current.toISOString(),
        end_time: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      setResult({ score, passed, status: finalStatus });
      setSubmitted(true);
    } catch (err: any) {
      submittedRef.current = false;
      Alert.alert('Error', err.message ?? 'Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, answers, exam, profile]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const setAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={styles.loadText}>Loading exam…</Text>
      </View>
    );
  }

  // ── Already attempted ────────────────────────────────────────────────────────

  if (alreadyAttempted) {
    const scoreColor =
      alreadyAttempted.status === 'passed'
        ? COLORS.success
        : alreadyAttempted.status === 'pending_grading'
        ? COLORS.warning
        : COLORS.error;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredFlex}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.attemptedCard}
          >
            <Text style={styles.attemptedEmoji}>📋</Text>
            <Text style={styles.attemptedTitle}>Already Completed</Text>
            <Text style={styles.attemptedSub}>You have already completed this exam.</Text>
            <View style={[styles.scoreCircleLg, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreCircleLgText, { color: scoreColor }]}>
                {alreadyAttempted.score}%
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: scoreColor + '20' }]}>
              <Text style={[styles.statusPillText, { color: scoreColor }]}>
                {alreadyAttempted.status === 'pending_grading'
                  ? '⏳ Pending Review'
                  : alreadyAttempted.status === 'passed'
                  ? '✓ Passed'
                  : '✗ Failed'}
              </Text>
            </View>
            <TouchableOpacity style={styles.backBtnFull} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={styles.backBtnFullText}>← Back to CBT</Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────────

  if (submitted && result) {
    const isPending = result.status === 'pending_grading';
    const scoreColor = isPending ? COLORS.warning : result.passed ? COLORS.success : COLORS.error;
    const passingPct = exam?.passing_score ?? exam?.pass_mark ?? 70;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredFlex}>
          <MotiView
            from={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 16 }}
            style={styles.resultCard}
          >
            <LinearGradient colors={[scoreColor + '18', 'transparent']} style={StyleSheet.absoluteFill} />

            <Text style={styles.resultEmoji}>{isPending ? '⏳' : result.passed ? '🎉' : '😔'}</Text>

            {/* Score circle */}
            <MotiView
              from={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, delay: 150 }}
              style={[styles.resultCircle, { borderColor: scoreColor }]}
            >
              <Text style={[styles.resultCircleScore, { color: scoreColor }]}>{result.score}%</Text>
            </MotiView>

            {/* Status label */}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 }}
            >
              <Text style={[styles.resultStatus, { color: scoreColor }]}>
                {isPending ? 'Pending Review ⏳' : result.passed ? 'PASSED ✓' : 'FAILED ✗'}
              </Text>
            </MotiView>

            <Text style={styles.resultRequired}>Required: {passingPct}%</Text>

            {isPending && (
              <View style={styles.pendingNote}>
                <Text style={styles.pendingNoteText}>
                  Your essay answers will be reviewed by your teacher.
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.resultBtns}>
              <TouchableOpacity style={styles.resultBtnSecondary} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={styles.resultBtnSecondaryText}>← Back to CBT</Text>
              </TouchableOpacity>
              {result.passed && (
                <TouchableOpacity
                  style={[styles.resultBtnPrimary, { backgroundColor: COLORS.success }]}
                  onPress={() => navigation.navigate('Certificates')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={[COLORS.success, COLORS.success + 'cc']} style={StyleSheet.absoluteFill} />
                  <Text style={styles.resultBtnPrimaryText}>View Certificates →</Text>
                </TouchableOpacity>
              )}
            </View>
          </MotiView>
        </View>
      </SafeAreaView>
    );
  }

  // ── No questions ─────────────────────────────────────────────────────────────

  if (!exam || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredFlex}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No questions found for this exam.</Text>
          <TouchableOpacity style={styles.backBtnFull} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnFullText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Exam interface ───────────────────────────────────────────────────────────

  const timerIsRed = timeLeft < 60;
  const progress = questions.length > 0 ? (current + 1) / questions.length : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Alert.alert(
              'Leave Exam?',
              'Your progress will be lost if you leave without submitting.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerQ} numberOfLines={1}>
            Question {current + 1} / {questions.length}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{exam.title}</Text>
        </View>

        {/* Timer */}
        <MotiView
          animate={{ opacity: timerIsRed ? [1, 0.4, 1] : 1 }}
          transition={timerIsRed ? { loop: true, duration: 600, type: 'timing' } : { type: 'timing', duration: 200 }}
          style={[styles.timerWrap, timerIsRed && styles.timerWrapRed]}
        >
          <Text style={[styles.timerText, { color: timerIsRed ? COLORS.error : COLORS.textSecondary }]}>
            ⏱ {fmtTime(timeLeft)}
          </Text>
        </MotiView>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <MotiView
          animate={{ width: `${Math.round(progress * 100)}%` as any }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.progressFill]}
        />
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question card */}
        <View style={styles.questionCard}>
          {/* Question header */}
          <View style={styles.questionMeta}>
            <View style={styles.questionNumBadge}>
              <Text style={styles.questionNumText}>Q{current + 1}</Text>
            </View>
            <Text style={styles.pointsText}>{q.points} {q.points === 1 ? 'pt' : 'pts'}</Text>
          </View>

          {/* Question text */}
          <Text style={styles.questionText}>{q.question_text}</Text>

          {/* Essay note */}
          {q.question_type === 'essay' && (
            <View style={styles.essayNote}>
              <Text style={styles.essayNoteText}>
                ✏️ This question will be manually graded by your teacher.
              </Text>
            </View>
          )}

          {/* Answer area */}
          <View style={styles.answerArea}>
            {q.question_type === 'multiple_choice' && (
              <View style={styles.optionsWrap}>
                {(q.options ?? []).map((opt, oi) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                      onPress={() => setAnswer(q.id, opt)}
                      activeOpacity={0.75}
                    >
                      {selected && (
                        <LinearGradient
                          colors={[COLORS.accent + '25', COLORS.accent + '10']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <View style={[styles.optionDot, selected && styles.optionDotSelected]}>
                        {selected && <View style={styles.optionDotInner} />}
                      </View>
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.question_type === 'true_false' && (
              <View style={styles.tfWrap}>
                {(['True', 'False'] as const).map(val => {
                  const stored = val.toLowerCase();
                  const selected = answers[q.id] === stored;
                  const color = val === 'True' ? COLORS.success : COLORS.error;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.tfBtn, selected && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setAnswer(q.id, stored)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tfEmoji]}>{val === 'True' ? '✓' : '✗'}</Text>
                      <Text style={[styles.tfText, selected && { color }]}>{val}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.question_type === 'fill_blank' && (
              <TextInput
                style={styles.fillInput}
                placeholder="Type your answer here…"
                placeholderTextColor={COLORS.textMuted}
                value={answers[q.id] ?? ''}
                onChangeText={v => setAnswer(q.id, v)}
              />
            )}

            {q.question_type === 'essay' && (
              <TextInput
                style={styles.essayInput}
                placeholder="Write your answer here…"
                placeholderTextColor={COLORS.textMuted}
                value={answers[q.id] ?? ''}
                onChangeText={v => setAnswer(q.id, v)}
                multiline
                textAlignVertical="top"
              />
            )}

            {q.question_type === 'coding_blocks' && (
              <CodingBlocksInput
                question={q}
                value={answers[q.id] ?? ''}
                onChange={v => setAnswer(q.id, v)}
              />
            )}
          </View>
        </View>

        {/* Question navigation grid */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridRow}
        >
          {questions.map((qItem, idx) => {
            const isAnswered = !!answers[qItem.id];
            const isCurrent = idx === current;
            return (
              <TouchableOpacity
                key={qItem.id}
                style={[
                  styles.gridDot,
                  isAnswered && styles.gridDotAnswered,
                  isCurrent && styles.gridDotCurrent,
                ]}
                onPress={() => setCurrent(idx)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.gridDotText,
                  isAnswered && styles.gridDotTextAnswered,
                  isCurrent && styles.gridDotTextCurrent,
                ]}>
                  {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Footer nav */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
          onPress={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          activeOpacity={0.8}
        >
          <Text style={[styles.navBtnText, current === 0 && styles.navBtnTextDisabled]}>← Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => handleSubmit(false)}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={COLORS.gradPrimary} style={StyleSheet.absoluteFill} />
          {submitting ? (
            <ActivityIndicator color={COLORS.white100} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>
              Submit ({answeredCount}/{questions.length})
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, current === questions.length - 1 && styles.navBtnDisabled]}
          onPress={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
          disabled={current === questions.length - 1}
          activeOpacity={0.8}
        >
          <Text style={[styles.navBtnText, current === questions.length - 1 && styles.navBtnTextDisabled]}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  centeredFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerQ: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  headerTitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },
  timerWrap: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  timerWrapRed: { borderColor: COLORS.error + '60', backgroundColor: COLORS.error + '12' },
  timerText: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm },

  // Progress bar
  progressTrack: { height: 3, backgroundColor: COLORS.border, marginHorizontal: SPACING.base },
  progressFill: { height: 3, backgroundColor: COLORS.accent, borderRadius: 2 },

  // Scroll
  scrollContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md },

  // Question card
  questionCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.base, backgroundColor: COLORS.bgCard, gap: SPACING.md, marginBottom: SPACING.md,
  },
  questionMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  questionNumBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    backgroundColor: COLORS.accent + '20', borderRadius: RADIUS.full,
  },
  questionNumText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.accent },
  pointsText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  questionText: {
    fontFamily: FONT_FAMILY.heading, fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary, lineHeight: 26,
  },

  // Essay note
  essayNote: {
    backgroundColor: COLORS.info + '12', borderWidth: 1, borderColor: COLORS.info + '30',
    borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  essayNoteText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.info },

  // Answer area
  answerArea: { gap: SPACING.sm },

  // MCQ options
  optionsWrap: { gap: SPACING.sm },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, overflow: 'hidden',
  },
  optionBtnSelected: { borderColor: COLORS.accent },
  optionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  optionDotSelected: { borderColor: COLORS.accent },
  optionDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  optionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textSecondary, flex: 1 },
  optionTextSelected: { color: COLORS.textPrimary, fontFamily: FONT_FAMILY.bodySemi },

  // True/False
  tfWrap: { flexDirection: 'row', gap: SPACING.md },
  tfBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.base, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard,
  },
  tfEmoji: { fontSize: 20 },
  tfText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },

  // Fill blank
  fillInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.bgCard,
  },

  // Essay
  essayInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.bgCard, minHeight: 120,
  },

  // Question grid
  gridRow: {
    flexDirection: 'row', paddingVertical: SPACING.sm,
    gap: SPACING.sm, paddingHorizontal: 2,
  },
  gridDot: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  gridDotAnswered: { backgroundColor: COLORS.accent + '30', borderColor: COLORS.accent },
  gridDotCurrent: { borderColor: COLORS.white100, borderWidth: 2 },
  gridDotText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted },
  gridDotTextAnswered: { color: COLORS.accentLight },
  gridDotTextCurrent: { color: COLORS.textPrimary },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  navBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  navBtnTextDisabled: { color: COLORS.textMuted },
  submitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  submitBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },

  // Already attempted card
  attemptedCard: {
    width: '100%', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.xl, backgroundColor: COLORS.bgCard,
  },
  attemptedEmoji: { fontSize: 48 },
  attemptedTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  attemptedSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },

  // Shared large score circle
  scoreCircleLg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    marginVertical: SPACING.sm,
  },
  scoreCircleLgText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },

  statusPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full },
  statusPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },

  backBtnFull: {
    marginTop: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
  },
  backBtnFullText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  // Result card
  resultCard: {
    width: '100%', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.xl, overflow: 'hidden',
  },
  resultEmoji: { fontSize: 48 },
  resultCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
  },
  resultCircleScore: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['3xl'] },
  resultStatus: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, textAlign: 'center' },
  resultRequired: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  pendingNote: {
    backgroundColor: COLORS.warning + '12', borderWidth: 1, borderColor: COLORS.warning + '30',
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.xs,
  },
  pendingNoteText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.warning, textAlign: 'center' },
  resultBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm, justifyContent: 'center' },
  resultBtnSecondary: {
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
  },
  resultBtnSecondaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  resultBtnPrimary: {
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    borderRadius: RADIUS.lg, overflow: 'hidden', alignItems: 'center',
  },
  resultBtnPrimaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },

  // Empty
  emptyEmoji: { fontSize: 48, textAlign: 'center', marginBottom: SPACING.sm },
  emptyText: {
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.md,
  },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { StatusBar } from 'expo-status-bar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

const { width } = Dimensions.get('window');

interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay' | 'coding_blocks';
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  metadata: any;
}

export default function CBTExaminationScreen({ route, navigation }: any) {
  const { examId } = route.params;
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { success: hapticSuccess, error: hapticError, light } = useHaptics();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const startTimeRef = useRef(new Date());

  // Fetch Exam Data
  useEffect(() => {
    const fetchData = async () => {
      const { data: examData, error } = await supabase
        .from('cbt_exams')
        .select(`
          *,
          cbt_questions (*)
        `)
        .eq('id', examId)
        .single();

      if (error || !examData) {
        Alert.alert('Error', 'Could not load exam data.');
        navigation.goBack();
        return;
      }

      setExam(examData);
      setQuestions(
        ((examData.cbt_questions ?? []) as any[]).map((question) => ({
          id: question.id,
          question_text: question.question_text,
          question_type: (question.question_type ?? 'multiple_choice') as Question['question_type'],
          options: Array.isArray(question.options) ? question.options : Array.isArray(question.options?.options) ? question.options.options : null,
          correct_answer: question.correct_answer,
          points: question.points ?? 1,
          metadata: question.metadata ?? null,
        }))
      );
      setTimeLeft((examData.duration_minutes || 60) * 60);
      setLoading(false);
    };

    fetchData();
  }, [examId]);

  // Timer Logic
  useEffect(() => {
    if (loading || submitted || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitted, questions.length]);

  const handleSubmit = async (auto = false) => {
    if (submitting || submitted) return;
    if (!auto) {
      const confirmed = await confirmSubmit();
      if (!confirmed) return;
    }

    setSubmitting(true);
    await light();

    try {
      let score = 0;
      let totalPoints = 0;
      let manualGradingRequired = false;

      questions.forEach(q => {
        totalPoints += q.points || 0;
        if (q.question_type === 'essay') {
          manualGradingRequired = true;
        } else {
          const studentAns = (answers[q.id] || '').trim().toLowerCase();
          const correctAns = (q.correct_answer || '').trim().toLowerCase();
          if (studentAns === correctAns) {
            score += q.points || 0;
          }
        }
      });

      const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      const passed = percentage >= (exam?.passing_score || 70);

      const { data: session, error } = await supabase
        .from('cbt_sessions')
        .insert({
          exam_id: examId,
          user_id: profile!.id,
          start_time: startTimeRef.current.toISOString(),
          end_time: new Date().toISOString(),
          score: percentage,
          status: manualGradingRequired ? 'pending_grading' : (passed ? 'passed' : 'failed'),
          needs_grading: manualGradingRequired,
          answers,
          grading_notes: manualGradingRequired ? 'Awaiting manual review' : null,
          manual_scores: manualGradingRequired ? { raw_score: score, total_points: totalPoints } : null,
        })
        .select()
        .single();

      if (error) throw error;

      setResult({ score, totalPoints, percentage, passed, manualGradingRequired });
      setSubmitted(true);
      await hapticSuccess();
    } catch (err: any) {
      await hapticError();
      Alert.alert('Submission Failed', err.message || 'Could not submit exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    let msg = 'Are you sure you want to submit your exam?';
    if (unanswered > 0) {
      msg = `You have ${unanswered} unanswered questions. Submit anyway?`;
    }
    return new Promise(resolve => {
      Alert.alert('Submit Exam', msg, [
        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Submit', onPress: () => resolve(true) }
      ]);
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const exportResultPdf = async () => {
    if (!exam || !result) return;
    setExporting(true);
    try {
      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a;">
            <h1 style="margin-bottom: 8px;">CBT Result Slip</h1>
            <p><strong>Exam:</strong> ${exam.title}</p>
            <p><strong>Candidate:</strong> ${profile?.full_name ?? 'Student'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
            <hr style="margin: 20px 0;" />
            <p><strong>Status:</strong> ${result.manualGradingRequired ? 'Pending manual review' : result.passed ? 'Passed' : 'Completed'}</p>
            <p><strong>Score:</strong> ${result.percentage}%</p>
            <p><strong>Raw Score:</strong> ${result.score} / ${result.totalPoints}</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Export Ready', uri);
      }
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Could not export result.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Initializing Secure Environment…</Text>
      </View>
    );
  }

  if (submitted && result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.center, { padding: SPACING.xl }]}>
          <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.resultCard}>
            <Text style={styles.resultEmoji}>{result.passed ? '🏆' : '📝'}</Text>
            <Text style={[styles.resultStatus, { color: result.passed ? colors.success : colors.textPrimary }]}>
              {result.manualGradingRequired ? 'EXAM SUBMITTED' : (result.passed ? 'CONGRATULATIONS!' : 'EXAM COMPLETED')}
            </Text>
            
            {result.manualGradingRequired ? (
              <Text style={[styles.resultDetailed, { color: colors.textSecondary }]}>
                Your exam contains subjective questions that require manual grading by an instructor.
              </Text>
            ) : (
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreBig, { color: result.passed ? colors.success : colors.error }]}>
                  {result.percentage}%
                </Text>
                <Text style={[styles.scoreSmall, { color: colors.textMuted }]}>
                  Score: {result.score} / {result.totalPoints}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.finishBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('CBT')}
            >
              <Text style={styles.finishBtnText}>RETURN TO HUB</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: colors.success, marginTop: SPACING.md }]}
              onPress={exportResultPdf}
              disabled={exporting}
            >
              <Text style={styles.finishBtnText}>{exporting ? 'EXPORTING...' : 'EXPORT RESULT PDF'}</Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerInfo}>
          <Text style={[styles.examTitle, { color: colors.textPrimary }]} numberOfLines={1}>{exam.title}</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <MotiView 
                animate={{ width: `${progress}%` }} 
                style={[styles.progressFill, { backgroundColor: colors.primary }]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textMuted }]}>
              {currentIdx + 1} / {questions.length}
            </Text>
          </View>
        </View>

        <View style={[
          styles.timerBox, 
          { backgroundColor: timeLeft < 120 ? colors.error + '20' : colors.bgCard },
          { borderColor: timeLeft < 120 ? colors.error : colors.border }
        ]}>
          <Text style={[
            styles.timerText, 
            { color: timeLeft < 120 ? colors.error : colors.textPrimary }
          ]}>
            {formatTime(timeLeft)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <MotiView 
          key={q.id}
          from={{ opacity: 0, translateX: 20 }}
          animate={{ opacity: 1, translateX: 0 }}
          style={styles.questionCard}
        >
          <Text style={[styles.points, { color: colors.primary }]}>{q.points} POINTS</Text>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>{q.question_text}</Text>

          {/* Options for MCQ / TF */}
          {(q.question_type === 'multiple_choice' || q.question_type === 'true_false') && (
            <View style={styles.optionsWrap}>
              {(q.options || ['True', 'False']).map((opt, i) => {
                const isSelected = answers[q.id] === opt;
                return (
                  <TouchableOpacity 
                    key={i}
                    onPress={() => { setAnswers(prev => ({ ...prev, [q.id]: opt })); light(); }}
                    activeOpacity={0.7}
                    style={[
                      styles.optionBtn,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { backgroundColor: colors.primary + '10' }
                    ]}
                  >
                    <View style={[
                      styles.optionCircle, 
                      { borderColor: isSelected ? colors.primary : colors.textMuted },
                      isSelected && { backgroundColor: colors.primary }
                    ]}>
                      {isSelected && <Text style={styles.check}>✓</Text>}
                    </View>
                    <Text style={[
                      styles.optionLabel, 
                      { color: isSelected ? colors.primary : colors.textPrimary }
                    ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Text Input for Fill Blank / Essay */}
          {(q.question_type === 'fill_blank' || q.question_type === 'essay') && (
            <TextInput
              style={[
                styles.textInput,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard },
                q.question_type === 'essay' && { height: 160, textAlignVertical: 'top' }
              ]}
              placeholder={q.question_type === 'essay' ? "Compose your response..." : "Your answer..."}
              placeholderTextColor={colors.textMuted}
              multiline={q.question_type === 'essay'}
              value={answers[q.id] || ''}
              onChangeText={(text) => setAnswers(prev => ({ ...prev, [q.id]: text }))}
            />
          )}

          {/* Placeholder for Coding Blocks */}
          {q.question_type === 'coding_blocks' && (
            <View style={[styles.codingWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.codingText, { color: colors.textMuted }]}>
                Interactive Logic Challenge not supported in mobile view yet. Please provide a text-based logic explanation below.
              </Text>
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary, borderColor: colors.border, marginTop: SPACING.md }]}
                placeholder="Logic structure..."
                value={answers[q.id] || ''}
                onChangeText={(text) => setAnswers(prev => ({ ...prev, [q.id]: text }))}
              />
            </View>
          )}
        </MotiView>
      </ScrollView>

      {/* Navigation Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => { setCurrentIdx(prev => Math.max(0, prev - 1)); light(); }}
          disabled={currentIdx === 0}
          style={[styles.navBtn, currentIdx === 0 && { opacity: 0.3 }]}
        >
          <Text style={[styles.navBtnText, { color: colors.textSecondary }]}>PREVIOUS</Text>
        </TouchableOpacity>

        {currentIdx < questions.length - 1 ? (
          <TouchableOpacity 
            onPress={() => { setCurrentIdx(prev => prev + 1); light(); }}
            style={[styles.navBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.navBtnText, { color: '#fff' }]}>PROCEED</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={() => handleSubmit(false)}
            disabled={submitting}
            style={[styles.navBtn, { backgroundColor: colors.success }]}
          >
            <Text style={[styles.navBtnText, { color: '#fff' }]}>
              {submitting ? 'VALIDATING...' : 'FINISH EXAM'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { 
    fontFamily: FONT_FAMILY.mono, 
    fontSize: 10, 
    marginTop: SPACING.lg, 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1 },
  examTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.base,
    letterSpacing: LETTER_SPACING.tight,
    textTransform: 'uppercase',
  },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  progressBar: { height: 4, flex: 1, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressText: { fontFamily: FONT_FAMILY.mono, fontSize: 10 },

  timerBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  timerText: { fontFamily: FONT_FAMILY.mono, fontSize: 16, fontWeight: 'bold' },

  scroll: { padding: SPACING.xl },
  questionCard: { minHeight: 300 },
  points: { 
    fontFamily: FONT_FAMILY.bodyBold, 
    fontSize: 10, 
    letterSpacing: 2, 
    marginBottom: SPACING.sm 
  },
  questionText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    lineHeight: 30,
    marginBottom: SPACING.xl,
  },

  optionsWrap: { gap: SPACING.md },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  optionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  optionLabel: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.md,
  },

  textInput: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  codingWrap: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  codingText: { fontFamily: FONT_FAMILY.body, fontSize: 12, fontStyle: 'italic' },

  footer: {
    flexDirection: 'row',
    padding: SPACING.xl,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  navBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navBtnText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
  },

  resultCard: {
    width: '100%',
    padding: SPACING['2xl'],
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  resultEmoji: { fontSize: 60, marginBottom: SPACING.lg },
  resultStatus: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  resultDetailed: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  scoreRow: { alignItems: 'center', marginBottom: SPACING.xl },
  scoreBig: { fontFamily: FONT_FAMILY.display, fontSize: 64, fontWeight: 'bold' },
  scoreSmall: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, marginTop: -4 },
  finishBtn: {
    width: '100%',
    height: 60,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: {
    fontFamily: FONT_FAMILY.bodyBold,
    color: '#fff',
    letterSpacing: 2,
  },
});

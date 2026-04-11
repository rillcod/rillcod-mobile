/**
 * Manual scoring for CBT sessions flagged needs_grading (essay / subjective).
 * Aligns with CBTExaminationScreen insert: auto-scored points + essay awards → final %.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cbtService } from '../../services/cbt.service';
import type { Json } from '../../types/supabase';
import type { ColorPalette } from '../../constants/colors';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string | null;
  points: number | null;
  correct_answer: string | null;
};

export default function CBTGradingScreen({ navigation, route }: any) {
  const sessionId: string = route.params?.sessionId;
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [studentName, setStudentName] = useState('');
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayScores, setEssayScores] = useState<Record<string, string>>({});
  const [gradingNotes, setGradingNotes] = useState('');
  const [autoPts, setAutoPts] = useState(0);
  const [totalPts, setTotalPts] = useState(0);

  const essayQuestions = useMemo(
    () => questions.filter((q) => (q.question_type ?? '') === 'essay'),
    [questions],
  );

  const load = useCallback(async () => {
    if (!sessionId || !profile?.id) {
      setLoading(false);
      return;
    }
    try {
      const bundle = await cbtService.loadSessionForManualGrading({
        sessionId,
        profile: { id: profile.id, role: profile.role },
      });

      setExamTitle(bundle.examTitle);
      setPassingScore(bundle.passingScore);
      setQuestions(bundle.questions as QuestionRow[]);
      setAnswers(bundle.answers);
      setAutoPts(bundle.autoPts);
      setTotalPts(bundle.totalPts);
      setGradingNotes(bundle.gradingNotes);
      setStudentName(bundle.studentName);

      setEssayScores(
        Object.fromEntries(bundle.questions.filter((q) => q.question_type === 'essay').map((q) => [q.id, ''])),
      );
    } catch (e: any) {
      if (e?.code === 'ACCESS_DENIED') {
        Alert.alert('Access denied', 'You can only grade sessions for exams you created.');
        navigation.goBack();
        return;
      }
      if (e?.code === 'ALREADY_GRADED') {
        Alert.alert('Already graded', 'This session does not need manual grading.');
        navigation.goBack();
        return;
      }
      Alert.alert('Load failed', e.message ?? 'Unknown error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [sessionId, profile?.id, profile?.role, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const essayAwarded = useMemo(() => {
    let sum = 0;
    for (const q of essayQuestions) {
      const raw = essayScores[q.id] ?? '';
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && n >= 0) sum += n;
    }
    return sum;
  }, [essayQuestions, essayScores]);

  const finalRaw = autoPts + essayAwarded;
  const previewPct = totalPts > 0 ? Math.round((finalRaw / totalPts) * 100) : 0;
  const previewPass = previewPct >= passingScore;

  const saveGrades = async () => {
    if (!sessionId || !profile?.id) return;

    for (const q of essayQuestions) {
      const max = q.points ?? 1;
      const raw = essayScores[q.id] ?? '';
      const n = parseFloat(raw);
      if (raw.trim() === '' || Number.isNaN(n) || n < 0 || n > max) {
        Alert.alert('Validation', `Enter a score between 0 and ${max} for each essay question.`);
        return;
      }
    }

    const essay_awards: Record<string, number> = {};
    for (const q of essayQuestions) {
      essay_awards[q.id] = parseFloat(essayScores[q.id] ?? '0');
    }

    setSaving(true);
    try {
      const percentage = totalPts > 0 ? Math.round((finalRaw / totalPts) * 100) : 0;
      const passed = percentage >= passingScore;

      await cbtService.saveManualGradingSession({
        sessionId,
        profileId: profile.id,
        percentage,
        passed,
        gradingNotes: gradingNotes.trim() || null,
        manualScores: {
          auto_raw: autoPts,
          essay_awards,
          final_raw: finalRaw,
          total_points: totalPts,
          graded_at: new Date().toISOString(),
          graded_by: profile.id,
        } as unknown as Json,
      });

      Alert.alert('Saved', `Final score: ${percentage}% (${passed ? 'passed' : 'not passed'})`, [
        { text: 'OK', onPress: () => navigation.navigate(ROUTES.CBT) },
      ]);
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Grade session" subtitle={examTitle} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {studentName ? `Learner: ${studentName}` : 'Learner'}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Auto-marked points: {autoPts} / {totalPts} · After essays: {finalRaw} / {totalPts} ({previewPct}%){' '}
            {previewPass ? '· Pass' : '· Below pass mark'}
          </Text>

          {essayQuestions.length === 0 ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              No essay questions on this exam; if this session still needs grading, check data or release from SQL.
            </Text>
          ) : (
            essayQuestions.map((q) => (
              <View key={q.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.qTitle, { color: colors.textPrimary }]} numberOfLines={4}>
                  {q.question_text}
                </Text>
                <Text style={[styles.answerLabel, { color: colors.textMuted }]}>STUDENT ANSWER</Text>
                <Text style={[styles.answerBody, { color: colors.textSecondary }]}>
                  {(answers[q.id] || '').trim() || '— (empty)'}
                </Text>
                <Text style={[styles.answerLabel, { color: colors.textMuted, marginTop: 10 }]}>POINTS (max {q.points ?? 1})</Text>
                <TextInput
                  style={[styles.scoreInput, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={essayScores[q.id] ?? ''}
                  onChangeText={(t) => setEssayScores((prev) => ({ ...prev, [q.id]: t }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))
          )}

          <Text style={[styles.answerLabel, { color: colors.textMuted, marginTop: 8 }]}>NOTES TO LEARNER (optional)</Text>
          <TextInput
            style={[styles.notes, { color: colors.textPrimary, borderColor: colors.border }]}
            value={gradingNotes}
            onChangeText={setGradingNotes}
            multiline
            placeholder="Feedback…"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity onPress={saveGrades} disabled={saving || essayQuestions.length === 0} style={styles.saveWrap}>
            <LinearGradient colors={colors.gradPrimary} style={styles.saveInner}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save final score</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.lg, paddingBottom: 40 },
    meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, marginBottom: 6 },
    warn: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, marginVertical: 12 },
    card: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    qTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, marginBottom: 8 },
    answerLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
    answerBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    scoreInput: {
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: FONT_FAMILY.bodyBold,
      marginTop: 4,
    },
    notes: {
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      padding: 12,
      minHeight: 80,
      textAlignVertical: 'top',
      fontFamily: FONT_FAMILY.body,
      marginBottom: SPACING.lg,
    },
    saveWrap: { borderRadius: RADIUS.md, overflow: 'hidden' },
    saveInner: { paddingVertical: 16, alignItems: 'center' },
    saveText: { fontFamily: FONT_FAMILY.bodyBold, color: '#fff', fontSize: FONT_SIZE.md, letterSpacing: 1 },
  });
}

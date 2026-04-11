/**
 * Full CBT exam authoring: exam shell + question bank (MCQ, true/false, fill blank, essay, coding_blocks)
 * aligned with `CBTExaminationScreen` scoring and `cbt_questions` schema.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cbtService } from '../../services/cbt.service';
import { questionService } from '../../services/question.service';
import type { Database, Json } from '../../types/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';

const EXAM_TYPES = ['examination', 'evaluation', 'quiz', 'practice'] as const;

type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay' | 'coding_blocks';

interface QuestionDraft {
  localKey: string;
  dbId: string | null;
  question_text: string;
  question_type: QuestionType;
  points: string;
  order_index: number;
  options: string[];
  correct_answer: string;
  metadataNote: string;
}

function newLocalKey() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyQuestion(order: number): QuestionDraft {
  return {
    localKey: newLocalKey(),
    dbId: null,
    question_text: '',
    question_type: 'multiple_choice',
    points: '1',
    order_index: order,
    options: ['', '', '', ''],
    correct_answer: '',
    metadataNote: '',
  };
}

function parseOptionsFromRow(raw: Json | null): string[] {
  if (raw == null) return ['', '', '', ''];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === 'object' && raw !== null && 'options' in raw && Array.isArray((raw as any).options)) {
    return (raw as any).options.map((x: unknown) => String(x));
  }
  return ['', '', '', ''];
}

function mapQuestionRowsToDrafts(qRows: Database['public']['Tables']['cbt_questions']['Row'][]): QuestionDraft[] {
  return (qRows ?? []).map((q, i) => {
    const qt = (q.question_type ?? 'multiple_choice') as QuestionType;
    let opts = parseOptionsFromRow(q.options);
    if (qt === 'true_false') opts = ['True', 'False'];
    if (qt === 'multiple_choice' && opts.length < 2) opts = [...opts, '', '', ''].slice(0, 4);
    const metaQ = (q.metadata ?? {}) as Record<string, unknown>;
    return {
      localKey: newLocalKey(),
      dbId: q.id,
      question_text: q.question_text ?? '',
      question_type: qt,
      points: String(q.points ?? 1),
      order_index: q.order_index ?? i,
      options: opts,
      correct_answer: q.correct_answer ?? '',
      metadataNote: typeof metaQ.author_note === 'string' ? metaQ.author_note : '',
    };
  });
}

export default function CBTExamEditorScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const paramExamId = route.params?.examId as string | undefined;

  const [resolvedExamId, setResolvedExamId] = useState<string | undefined>(paramExamId);
  const [loadingBoot, setLoadingBoot] = useState(!!paramExamId);
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; program_id: string | null }[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [passingScore, setPassingScore] = useState('50');
  const [examType, setExamType] = useState<(typeof EXAM_TYPES)[number]>('examination');
  const [difficulty, setDifficulty] = useState('medium');
  const [programId, setProgramId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [editModal, setEditModal] = useState<QuestionDraft | null>(null);

  const filteredCourses = useMemo(
    () => (programId ? courses.filter((c) => c.program_id === programId) : courses),
    [courses, programId],
  );

  const loadProgramsAndCourses = useCallback(async () => {
    if (!profile) return;
    const { programs: prog, courses: crs } = await cbtService.loadProgramsCoursesForExamEditor({
      role: profile.role,
      schoolId: profile.school_id,
    });
    setPrograms(prog);
    setCourses(crs);
  }, [profile]);

  useEffect(() => {
    loadProgramsAndCourses();
  }, [loadProgramsAndCourses]);

  useEffect(() => {
    setResolvedExamId(paramExamId);
  }, [paramExamId]);

  useEffect(() => {
    if (!resolvedExamId) {
      setLoadingBoot(false);
      setQuestions([emptyQuestion(0)]);
      return;
    }
    (async () => {
      try {
        const row = await cbtService.getCbtExamRowById(resolvedExamId);
        if (!row) throw new Error('Exam not found');
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        setTitle(row.title ?? '');
        setDescription(row.description ?? '');
        setDurationMinutes(String(row.duration_minutes ?? 60));
        setPassingScore(String(row.passing_score ?? 50));
        setExamType((meta.exam_type as (typeof EXAM_TYPES)[number]) || 'examination');
        setDifficulty(typeof meta.difficulty === 'string' ? meta.difficulty : 'medium');
        setProgramId(row.program_id ?? '');
        setCourseId(row.course_id ?? '');
        setStartDate(row.start_date ? String(row.start_date).slice(0, 10) : '');
        setEndDate(row.end_date ? String(row.end_date).slice(0, 10) : '');
        setIsActive(row.is_active ?? true);

        const qRows = await questionService.listCbtQuestionsForExam(resolvedExamId);

        const mapped = mapQuestionRowsToDrafts((qRows ?? []) as Database['public']['Tables']['cbt_questions']['Row'][]);
        setQuestions(mapped.length ? mapped : [emptyQuestion(0)]);
      } catch (e: any) {
        Alert.alert('Load failed', e.message);
        navigation.goBack();
      } finally {
        setLoadingBoot(false);
      }
    })();
  }, [resolvedExamId, navigation]);

  const buildExamMetadata = (): Json => ({
    exam_type: examType,
    difficulty: difficulty.trim() || 'medium',
  });

  const optionsToJson = (d: QuestionDraft): Json | null => {
    if (d.question_type === 'multiple_choice') {
      const cleaned = d.options.map((o) => o.trim()).filter(Boolean);
      return cleaned.length ? cleaned : null;
    }
    if (d.question_type === 'true_false') return ['True', 'False'];
    return null;
  };

  const questionMetadataJson = (d: QuestionDraft): Json | null => {
    if (d.question_type === 'coding_blocks' && d.metadataNote.trim()) {
      return { author_note: d.metadataNote.trim(), student_prompt: d.metadataNote.trim() };
    }
    if (d.metadataNote.trim()) return { author_note: d.metadataNote.trim() };
    return null;
  };

  const persistQuestions = async (examId: string, drafts: QuestionDraft[]) => {
    const existingIds = new Set(await questionService.listCbtQuestionIdsForExam(examId));
    const keepDbIds = new Set(drafts.map((d) => d.dbId).filter(Boolean) as string[]);
    const toDelete = [...existingIds].filter((id) => !keepDbIds.has(id));
    for (const id of toDelete) {
      await questionService.deleteCbtQuestion(id);
    }

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const points = parseInt(d.points, 10);
      const pts = Number.isNaN(points) || points < 0 ? 1 : points;
      const payload = {
        exam_id: examId,
        question_text: d.question_text.trim(),
        question_type: d.question_type,
        points: pts,
        order_index: i,
        options: optionsToJson({ ...d, order_index: i }),
        correct_answer: d.correct_answer.trim() || null,
        metadata: questionMetadataJson(d),
        updated_at: new Date().toISOString(),
      };

      if (!payload.question_text) continue;

      if (d.dbId) {
        await questionService.updateCbtQuestion(d.dbId, payload);
      } else {
        await questionService.insertCbtQuestion({ ...payload, created_at: new Date().toISOString() });
      }
    }
  };

  const saveAll = async () => {
    if (!profile?.id) {
      Alert.alert('Sign in required');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title required');
      return;
    }
    const dm = parseInt(durationMinutes, 10);
    const ps = parseInt(passingScore, 10);
    if (Number.isNaN(dm) || dm < 1) {
      Alert.alert('Invalid duration');
      return;
    }
    if (Number.isNaN(ps) || ps < 0 || ps > 100) {
      Alert.alert('Pass mark must be 0–100');
      return;
    }

    const validQs = questions.filter((q) => q.question_text.trim());
    for (const q of validQs) {
      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        if (!q.correct_answer.trim()) {
          Alert.alert('Validation', `Set correct answer for: "${q.question_text.slice(0, 40)}…"`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const totalQ = validQs.length;
      const examPayload = {
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: dm,
        passing_score: ps,
        total_questions: totalQ,
        metadata: buildExamMetadata(),
        program_id: programId || null,
        course_id: courseId || null,
        school_id: profile.school_id ?? null,
        start_date: startDate.trim() ? `${startDate.trim()}T00:00:00.000Z` : null,
        end_date: endDate.trim() ? `${endDate.trim()}T23:59:59.999Z` : null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      let eid = resolvedExamId;
      if (!eid) {
        eid = await cbtService.insertCbtExamForEditor({
          ...examPayload,
          created_by: profile.id,
          created_at: new Date().toISOString(),
        });
        setResolvedExamId(eid);
      } else {
        await cbtService.updateCbtExamShell(eid, examPayload);
      }

      await persistQuestions(eid, validQs);

      const refreshed = await cbtService.listCbtQuestionsForEditorRefresh(eid);
      const mapped = mapQuestionRowsToDrafts((refreshed ?? []) as Database['public']['Tables']['cbt_questions']['Row'][]);
      setQuestions(mapped.length ? mapped : [emptyQuestion(0)]);

      Alert.alert('Saved', `${totalQ} question(s) on file.`, [
        { text: 'Preview exam', onPress: () => navigation.navigate(ROUTES.CBTExamination, { examId: eid! }) },
        { text: 'Done', onPress: () => navigation.navigate(ROUTES.CBT) },
      ]);
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...questions];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setQuestions(next.map((q, i) => ({ ...q, order_index: i })));
  };

  const removeQuestion = (index: number) => {
    Alert.alert('Remove question?', 'This deletes it from the exam after you save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i }))),
      },
    ]);
  };

  const openEdit = (q: QuestionDraft) => setEditModal({ ...q });
  const saveEditModal = () => {
    if (!editModal) return;
    setQuestions((prev) => prev.map((q) => (q.localKey === editModal.localKey ? { ...editModal } : q)));
    setEditModal(null);
  };

  if (loadingBoot) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={resolvedExamId ? 'Edit CBT exam' : 'New CBT exam'}
        subtitle="Settings, schedule, and full question bank"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Exam settings</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>TITLE</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Exam title"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.area, { color: colors.textPrimary, borderColor: colors.border }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Learner-facing instructions"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>DURATION (MIN)</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>PASS MARK (%)</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                value={passingScore}
                onChangeText={setPassingScore}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>AVAILABLE FROM (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>AVAILABLE UNTIL</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {EXAM_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setExamType(t)}
                style={[
                  styles.pill,
                  { borderColor: colors.border },
                  examType === t && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                ]}
              >
                <Text style={[styles.pillText, { color: examType === t ? colors.primary : colors.textSecondary }]}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textMuted }]}>DIFFICULTY LABEL</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            value={difficulty}
            onChangeText={setDifficulty}
            placeholder="easy / medium / hard"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>PROGRAMME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => {
                setProgramId('');
                setCourseId('');
              }}
              style={[styles.pill, { borderColor: colors.border }, !programId && { borderColor: colors.primary, backgroundColor: colors.primary + '12' }]}
            >
              <Text style={[styles.pillText, { color: !programId ? colors.primary : colors.textMuted }]}>NONE</Text>
            </TouchableOpacity>
            {programs.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => {
                  setProgramId(p.id);
                  setCourseId('');
                }}
                style={[
                  styles.pill,
                  { borderColor: colors.border },
                  programId === p.id && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                ]}
              >
                <Text style={[styles.pillText, { color: programId === p.id ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>COURSE (OPTIONAL)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setCourseId('')}
              style={[styles.pill, { borderColor: colors.border }, !courseId && { borderColor: colors.info, backgroundColor: colors.info + '14' }]}
            >
              <Text style={[styles.pillText, { color: !courseId ? colors.info : colors.textMuted }]}>NONE</Text>
            </TouchableOpacity>
            {filteredCourses.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCourseId(c.id)}
                style={[
                  styles.pill,
                  { borderColor: colors.border },
                  courseId === c.id && { borderColor: colors.info, backgroundColor: colors.info + '14' },
                ]}
              >
                <Text style={[styles.pillText, { color: courseId === c.id ? colors.info : colors.textSecondary }]} numberOfLines={1}>
                  {c.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.switchRow}>
            <Text style={[styles.label, { marginBottom: 0, color: colors.textMuted }]}>PUBLISHED (ACTIVE)</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.success, false: colors.border }} />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>Question bank ({questions.length})</Text>
          <Text style={[styles.hint, { color: colors.textMuted, marginBottom: SPACING.md }]}>
            Multiple choice & true/false auto-score. Essay & coding_blocks may need manual grading in the Grade queue.
          </Text>

          {questions.map((q, index) => (
            <View key={q.localKey} style={[styles.qCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              <View style={styles.qCardTop}>
                <Text style={[styles.qBadge, { color: colors.primary }]}>Q{index + 1}</Text>
                <Text style={[styles.qType, { color: colors.textMuted }]}>{q.question_type.replace('_', ' ').toUpperCase()}</Text>
                <Text style={[styles.qPts, { color: colors.textSecondary }]}>{q.points} pts</Text>
              </View>
              <Text style={[styles.qText, { color: colors.textPrimary }]} numberOfLines={3}>
                {q.question_text.trim() || '(empty — tap edit)'}
              </Text>
              <View style={styles.qActions}>
                <TouchableOpacity onPress={() => moveQuestion(index, -1)} style={styles.qBtn}>
                  <Text style={{ color: colors.info }}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveQuestion(index, 1)} style={styles.qBtn}>
                  <Text style={{ color: colors.info }}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(q)} style={[styles.qBtn, { flex: 1 }]}>
                  <Text style={{ color: colors.primary, fontFamily: FONT_FAMILY.bodyBold }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeQuestion(index)} style={styles.qBtn}>
                  <Text style={{ color: colors.error, fontFamily: FONT_FAMILY.bodyBold, fontSize: 11 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => setQuestions((prev) => [...prev, emptyQuestion(prev.length)])}
            style={[styles.addQ, { borderColor: colors.primary }]}
          >
            <Text style={{ color: colors.primary, fontFamily: FONT_FAMILY.bodyBold }}>+ Add question</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={saveAll} disabled={saving} style={styles.saveWrap}>
            <LinearGradient colors={colors.gradPrimary} style={styles.saveInner}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save exam & questions</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!editModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit question</Text>
            {editModal ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '88%' }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>TYPE</Text>
                <ScrollView horizontal style={{ marginBottom: 12 }}>
                  {(['multiple_choice', 'true_false', 'fill_blank', 'essay', 'coding_blocks'] as QuestionType[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        let next = { ...editModal, question_type: t };
                        if (t === 'true_false') next = { ...next, options: ['True', 'False'] };
                        if (t === 'multiple_choice' && editModal.options.length < 2) next = { ...next, options: ['', '', '', ''] };
                        setEditModal(next);
                      }}
                      style={[
                        styles.pill,
                        { borderColor: colors.border },
                        editModal.question_type === t && { borderColor: colors.primary, backgroundColor: colors.primary + '14' },
                      ]}
                    >
                      <Text style={[styles.pillText, { fontSize: 9 }, editModal.question_type === t && { color: colors.primary }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.textMuted }]}>STEM</Text>
                <TextInput
                  style={[styles.input, styles.area, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={editModal.question_text}
                  onChangeText={(text) => setEditModal({ ...editModal, question_text: text })}
                  multiline
                  placeholder="Question text"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={[styles.label, { color: colors.textMuted }]}>POINTS</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={editModal.points}
                  onChangeText={(text) => setEditModal({ ...editModal, points: text })}
                  keyboardType="number-pad"
                />

                {(editModal.question_type === 'multiple_choice' || editModal.question_type === 'true_false') && (
                  <>
                    {editModal.question_type === 'multiple_choice' &&
                      editModal.options.map((opt, oi) => (
                        <View key={oi} style={{ marginBottom: 8 }}>
                          <Text style={[styles.label, { color: colors.textMuted }]}>OPTION {oi + 1}</Text>
                          <TextInput
                            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                            value={opt}
                            onChangeText={(text) => {
                              const opts = [...editModal.options];
                              opts[oi] = text;
                              setEditModal({ ...editModal, options: opts });
                            }}
                            placeholder={`Choice ${oi + 1}`}
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      ))}
                    <Text style={[styles.label, { color: colors.textMuted }]}>CORRECT ANSWER (exact match)</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                      value={editModal.correct_answer}
                      onChangeText={(text) => setEditModal({ ...editModal, correct_answer: text })}
                      placeholder={editModal.question_type === 'true_false' ? 'True or False' : 'Must match one option exactly'}
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                {editModal.question_type === 'fill_blank' && (
                  <>
                    <Text style={[styles.label, { color: colors.textMuted }]}>EXPECTED ANSWER (normalized compare)</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                      value={editModal.correct_answer}
                      onChangeText={(text) => setEditModal({ ...editModal, correct_answer: text })}
                      placeholder="Correct text"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                {(editModal.question_type === 'essay' || editModal.question_type === 'coding_blocks') && (
                  <>
                    <Text style={[styles.label, { color: colors.textMuted }]}>RUBRIC / NOTES FOR GRADERS (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.input, styles.area, { color: colors.textPrimary, borderColor: colors.border }]}
                      value={editModal.metadataNote}
                      onChangeText={(text) => setEditModal({ ...editModal, metadataNote: text })}
                      multiline
                      placeholder="What a strong answer should include"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setEditModal(null)}>
                    <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={saveEditModal}>
                    <Text style={{ color: '#fff', fontFamily: FONT_FAMILY.bodyBold }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: { bg: string }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
    sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, letterSpacing: 1, marginBottom: SPACING.sm },
    label: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1, marginBottom: 8 },
    hint: { fontSize: 12, fontFamily: FONT_FAMILY.body, lineHeight: 18 },
    input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: FONT_FAMILY.body },
    area: { minHeight: 88, textAlignVertical: 'top' },
    row2: { flexDirection: 'row', gap: SPACING.md, marginTop: 8 },
    pill: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
    pillText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg },
    qCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
    qCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    qBadge: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
    qType: { fontSize: 10, flex: 1 },
    qPts: { fontSize: 10 },
    qText: { fontSize: 14, lineHeight: 20 },
    qActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
    qBtn: { padding: 10, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
    addQ: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RADIUS.sm, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg },
    saveWrap: { borderRadius: RADIUS.sm, overflow: 'hidden' },
    saveInner: { padding: 16, alignItems: 'center' },
    saveText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: 15 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalCard: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xl, maxHeight: '92%' },
    modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: SPACING.lg, marginBottom: SPACING.xl },
    modalBtn: { flex: 1, padding: 14, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1 },
  });

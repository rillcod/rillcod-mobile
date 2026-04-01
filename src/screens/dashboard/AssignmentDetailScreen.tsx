import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface AssignmentQuestion {
  question_text: string;
  question_type?: string | null;
  points?: number | null;
  options?: string[] | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number | null;
  assignment_type: string | null;
  instructions: string | null;
  is_active: boolean | null;
  questions: AssignmentQuestion[];
  metadata: any;
  courses?: { title: string | null; programs?: { name: string | null } | null } | null;
}

interface Submission {
  id: string;
  portal_user_id: string | null;
  student_name: string;
  status: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
  submission_text: string | null;
  answers: any;
}

const TYPE_COLOR: Record<string, string> = {
  quiz: COLORS.info,
  project: '#7c3aed',
  homework: COLORS.success,
  exam: COLORS.admin,
  coding: COLORS.accent,
  essay: COLORS.gold,
};

const GRADE_PRESETS = [100, 90, 80, 70, 60, 40];

function normalizeQuestions(raw: any): AssignmentQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((question: any) => ({
    question_text: question?.question_text ?? 'Question',
    question_type: question?.question_type ?? 'essay',
    points: question?.points ?? 1,
    options: Array.isArray(question?.options) ? question.options : null,
  }));
}

export default function AssignmentDetailScreen({ route, navigation }: any) {
  const { assignmentId } = route.params ?? {};
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');

  const canGrade = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const load = useCallback(async () => {
    if (!assignmentId || !profile) return;
    try {
      const { data: asgn } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, max_points, assignment_type, instructions, is_active, questions, metadata, courses(title, programs(name))')
        .eq('id', assignmentId)
        .single();

      if (asgn) {
        setAssignment({
          ...(asgn as any),
          questions: normalizeQuestions((asgn as any).questions),
        });
      }

      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('id, portal_user_id, status, grade, feedback, submitted_at, submission_text, answers, portal_users:portal_user_id(full_name)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      const mapped = ((subs ?? []) as any[]).map((submission) => ({
        id: submission.id,
        portal_user_id: submission.portal_user_id ?? null,
        student_name: submission.portal_users?.full_name ?? 'Student',
        status: submission.status ?? 'pending',
        grade: submission.grade ?? null,
        feedback: submission.feedback ?? null,
        submitted_at: submission.submitted_at ?? null,
        submission_text: submission.submission_text ?? null,
        answers: submission.answers ?? null,
      })) as Submission[];

      setSubmissions(mapped);

      if (!canGrade) {
        const mine = mapped.find((submission) => submission.portal_user_id === profile.id) ?? null;
        setMySubmission(mine);
        setSubmissionText(mine?.submission_text ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [assignmentId, canGrade, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const saveGrade = async (submissionId: string) => {
    const grade = Number(gradeInput);
    if (!assignment) return;
    if (Number.isNaN(grade) || grade < 0 || grade > (assignment.max_points ?? 100)) {
      Alert.alert('Invalid grade', `Enter a score between 0 and ${assignment.max_points ?? 100}.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade,
          feedback: feedbackInput || null,
          status: 'graded',
          graded_by: profile?.id ?? null,
          graded_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
      if (error) throw error;
      await load();
      setGradingId(null);
      setGradeInput('');
      setFeedbackInput('');
    } catch (error: any) {
      Alert.alert('Grading failed', error?.message ?? 'Could not save grade.');
    } finally {
      setSaving(false);
    }
  };

  const submitAssignment = async () => {
    if (!assignment || !profile) return;
    if (!submissionText.trim()) {
      Alert.alert('Submission required', 'Enter your answer before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      if (mySubmission) {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            submission_text: submissionText.trim(),
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', mySubmission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assignment_submissions')
          .insert({
            assignment_id: assignment.id,
            portal_user_id: profile.id,
            status: 'submitted',
            submission_text: submissionText.trim(),
            submitted_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      await load();
      Alert.alert('Submitted', 'Your assignment has been submitted.');
    } catch (error: any) {
      Alert.alert('Submission failed', error?.message ?? 'Could not submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeColor = TYPE_COLOR[assignment?.assignment_type ?? ''] ?? COLORS.info;
  const isOverdue = !!assignment?.due_date && new Date(assignment.due_date) < new Date();
  const gradedCount = submissions.filter((submission) => submission.status === 'graded').length;
  const pendingCount = submissions.filter((submission) => submission.status === 'submitted').length;
  const scorePercent = useMemo(() => {
    if (!assignment || !mySubmission || mySubmission.grade == null) return null;
    return Math.round((mySubmission.grade / (assignment.max_points ?? 100)) * 100);
  }, [assignment, mySubmission]);

  if (loading) {
    return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.info} size="large" /></View>;
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Assignment" onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>Assignment not found.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Assignment" onBack={() => navigation.goBack()} accentColor={typeColor} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.infoCard}>
            <LinearGradient colors={[typeColor + '10', 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={styles.typeRow}>
              <View style={[styles.typePill, { backgroundColor: typeColor + '20' }]}>
                <Text style={[styles.typeText, { color: typeColor }]}>{assignment.assignment_type ?? 'assignment'}</Text>
              </View>
              {isOverdue && (
                <View style={[styles.typePill, { backgroundColor: COLORS.error + '20' }]}>
                  <Text style={[styles.typeText, { color: COLORS.error }]}>Overdue</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>{assignment.title}</Text>
            {assignment.courses?.title ? <Text style={styles.courseText}>{assignment.courses.title}</Text> : null}
            {assignment.description ? <Text style={styles.description}>{assignment.description}</Text> : null}
            {assignment.instructions ? (
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsLabel}>Instructions</Text>
                <Text style={styles.instructionsText}>{assignment.instructions}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {assignment.due_date ? <View style={styles.metaItem}><Text style={styles.metaText}>Due {new Date(assignment.due_date).toLocaleDateString('en-GB')}</Text></View> : null}
              <View style={styles.metaItem}><Text style={styles.metaText}>{assignment.max_points ?? 100} pts</Text></View>
              {assignment.questions.length > 0 ? <View style={styles.metaItem}><Text style={styles.metaText}>{assignment.questions.length} questions</Text></View> : null}
            </View>
          </View>
        </MotiView>

        {assignment.questions.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Question Outline</Text>
            {assignment.questions.map((question, index) => (
              <View key={`${assignment.id}-q-${index}`} style={styles.questionRow}>
                <Text style={styles.questionIndex}>{index + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionText}>{question.question_text}</Text>
                  <Text style={styles.questionMeta}>{question.question_type ?? 'essay'} · {question.points ?? 1} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {canGrade ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Submissions</Text><Text style={styles.summaryValue}>{submissions.length}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Pending</Text><Text style={[styles.summaryValue, { color: COLORS.warning }]}>{pendingCount}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Graded</Text><Text style={[styles.summaryValue, { color: COLORS.success }]}>{gradedCount}</Text></View>
            </View>

            <Text style={styles.subsTitle}>Student Submissions</Text>
            {submissions.length === 0 ? (
              <View style={styles.emptySubmit}><Text style={styles.emptyText}>No submissions yet.</Text></View>
            ) : (
              submissions.map((submission, index) => {
                const pct = submission.grade != null ? Math.round((submission.grade / (assignment.max_points ?? 100)) * 100) : null;
                const gradeColor = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                const isGrading = gradingId === submission.id;
                return (
                  <MotiView key={submission.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 35 }}>
                    <View style={styles.subCard}>
                      <View style={styles.subTop}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{submission.student_name.charAt(0).toUpperCase()}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName}>{submission.student_name}</Text>
                          <Text style={styles.subDate}>{submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString('en-GB')}` : 'No timestamp'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: gradeColor + '20' }]}>
                          <Text style={[styles.statusText, { color: gradeColor }]}>{submission.status ?? 'pending'}</Text>
                        </View>
                      </View>

                      {submission.submission_text ? <Text style={styles.submissionText}>{submission.submission_text}</Text> : null}
                      {submission.feedback ? <Text style={styles.feedback}>Feedback: {submission.feedback}</Text> : null}
                      {pct != null ? <Text style={[styles.scoreText, { color: gradeColor }]}>{submission.grade}/{assignment.max_points ?? 100} · {pct}%</Text> : null}

                      {isGrading ? (
                        <View style={styles.gradeForm}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                            {GRADE_PRESETS.map((pctValue) => (
                              <TouchableOpacity
                                key={pctValue}
                                style={styles.presetBtn}
                                onPress={() => setGradeInput(String(Math.round((pctValue / 100) * (assignment.max_points ?? 100))))}
                              >
                                <Text style={styles.presetText}>{pctValue}%</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <TextInput style={styles.gradeInput} value={gradeInput} onChangeText={setGradeInput} keyboardType="numeric" placeholder={`Score (max ${assignment.max_points ?? 100})`} placeholderTextColor={COLORS.textMuted} />
                          <TextInput style={[styles.gradeInput, styles.feedbackInput]} value={feedbackInput} onChangeText={setFeedbackInput} placeholder="Feedback (optional)" placeholderTextColor={COLORS.textMuted} multiline />
                          <View style={styles.gradeActions}>
                            <TouchableOpacity onPress={() => { setGradingId(null); setGradeInput(''); setFeedbackInput(''); }} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => saveGrade(submission.id)} style={styles.saveBtn} disabled={saving}>{saving ? <ActivityIndicator color={COLORS.white100} size="small" /> : <Text style={styles.saveText}>Save Grade</Text>}</TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setGradingId(submission.id);
                            setGradeInput(submission.grade != null ? String(submission.grade) : '');
                            setFeedbackInput(submission.feedback ?? '');
                          }}
                          style={styles.gradeBtn}
                        >
                          <Text style={styles.gradeBtnText}>{submission.grade != null ? 'Edit Grade' : 'Grade Submission'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </MotiView>
                );
              })
            )}
          </>
        ) : (
          <>
            {mySubmission?.grade != null && (
              <View style={styles.resultBanner}>
                <Text style={styles.resultTitle}>Your Result</Text>
                <Text style={styles.resultScore}>{mySubmission.grade}/{assignment.max_points ?? 100}{scorePercent != null ? ` · ${scorePercent}%` : ''}</Text>
                {mySubmission.feedback ? <Text style={styles.resultFeedback}>{mySubmission.feedback}</Text> : null}
              </View>
            )}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{mySubmission ? 'Update Submission' : 'Submit Assignment'}</Text>
              <TextInput
                style={styles.submissionInput}
                multiline
                placeholder={assignment.assignment_type === 'coding' ? 'Paste your code, explanation, or answer here...' : 'Write your answer here...'}
                placeholderTextColor={COLORS.textMuted}
                value={submissionText}
                onChangeText={setSubmissionText}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={submitAssignment} disabled={submitting || !!mySubmission?.grade}>
                {submitting ? <ActivityIndicator color={COLORS.white100} size="small" /> : <Text style={styles.submitBtnText}>{mySubmission ? 'Save Submission' : 'Submit Work'}</Text>}
              </TouchableOpacity>
              {mySubmission?.submitted_at ? <Text style={styles.submitMeta}>Last submitted {new Date(mySubmission.submitted_at).toLocaleString('en-GB')}</Text> : null}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl },
  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', gap: SPACING.sm },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  typeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  courseText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.warning },
  description: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  instructionsCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  instructionsLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info, marginBottom: 4 },
  instructionsText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  sectionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  questionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  questionIndex: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  questionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  questionMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, marginTop: 4 },
  subsTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  subCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  subTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.admin },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  subName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  subDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  submissionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  feedback: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.info, fontStyle: 'italic' },
  scoreText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  gradeBtn: { paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.info + '40', alignItems: 'center' },
  gradeBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info },
  gradeForm: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  presetRow: { gap: 6 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.info + '15', borderWidth: 1, borderColor: COLORS.info + '30' },
  presetText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  gradeInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  feedbackInput: { minHeight: 80, textAlignVertical: 'top' },
  gradeActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  saveBtn: { flex: 2, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  resultBanner: { borderWidth: 1, borderColor: COLORS.success + '40', backgroundColor: COLORS.success + '12', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  resultTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.success, textTransform: 'uppercase', letterSpacing: 1 },
  resultScore: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, marginTop: 4 },
  resultFeedback: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 6 },
  submissionInput: { minHeight: 160, textAlignVertical: 'top', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  submitBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  submitMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 8 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptySubmit: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

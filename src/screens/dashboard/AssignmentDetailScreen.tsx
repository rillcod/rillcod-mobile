import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Platform,
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

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number | null;
  assignment_type: string;
  status: string;
}

interface Submission {
  id: string;
  portal_user_id: string;
  student_name: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  quiz: COLORS.info, project: '#7c3aed', homework: COLORS.success,
  exam: COLORS.admin, coding: COLORS.accent, essay: COLORS.gold,
};

const GRADE_PRESETS = [
  { label: 'A+', pct: 100 }, { label: 'A', pct: 90 }, { label: 'B', pct: 80 },
  { label: 'C', pct: 70 }, { label: 'D', pct: 60 }, { label: 'F', pct: 40 },
];

export default function AssignmentDetailScreen({ route, navigation }: any) {
  const { assignmentId } = route.params ?? {};
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saving, setSaving] = useState(false);

  const canGrade = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    const load = async () => {
      const { data: asgn } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, max_points, assignment_type, status')
        .eq('id', assignmentId)
        .single();
      if (asgn) setAssignment(asgn as Assignment);

      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('id, portal_user_id, status, grade, feedback, submitted_at, portal_users:portal_user_id(full_name)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (subs) {
        setSubmissions((subs as any[]).map(s => ({
          ...s,
          student_name: s.portal_users?.full_name ?? 'Unknown',
        })));
      }
      setLoading(false);
    };
    if (assignmentId) load();
  }, [assignmentId]);

  const saveGrade = async (subId: string) => {
    const grade = parseFloat(gradeInput);
    if (isNaN(grade) || grade < 0) { Alert.alert('Invalid grade'); return; }
    setSaving(true);
    await supabase.from('assignment_submissions').update({
      grade,
      feedback: feedbackInput || null,
      status: 'graded',
      graded_by: profile!.id,
    }).eq('id', subId);
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, grade, feedback: feedbackInput || null, status: 'graded' } : s));
    setGradingId(null);
    setGradeInput('');
    setFeedbackInput('');
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
      </View>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Assignment" onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>Assignment not found.</Text></View>
      </SafeAreaView>
    );
  }

  const typeColor = TYPE_COLOR[assignment.assignment_type] ?? COLORS.info;
  const graded = submissions.filter(s => s.status === 'graded').length;
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Assignment" onBack={() => navigation.goBack()} accentColor={typeColor} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Assignment info card */}
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.infoCard}>
            <LinearGradient colors={[typeColor + '10', 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={styles.typeRow}>
              <View style={[styles.typePill, { backgroundColor: typeColor + '20' }]}>
                <Text style={[styles.typeText, { color: typeColor }]}>{assignment.assignment_type}</Text>
              </View>
              {isOverdue && (
                <View style={[styles.typePill, { backgroundColor: COLORS.error + '20' }]}>
                  <Text style={[styles.typeText, { color: COLORS.error }]}>Overdue</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>{assignment.title}</Text>
            {assignment.description ? (
              <Text style={styles.description}>{assignment.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              {assignment.due_date ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaEmoji}>📅</Text>
                  <Text style={[styles.metaText, isOverdue ? { color: COLORS.error } : {}]}>
                    Due {new Date(assignment.due_date).toLocaleDateString('en-GB')}
                  </Text>
                </View>
              ) : null}
              {assignment.max_points ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaEmoji}>🏆</Text>
                  <Text style={styles.metaText}>{assignment.max_points} pts</Text>
                </View>
              ) : null}
            </View>
          </View>
        </MotiView>

        {/* Submissions section (staff only) */}
        {canGrade && (
          <>
            <View style={styles.subsHeader}>
              <Text style={styles.subsTitle}>Submissions</Text>
              <Text style={styles.subsCount}>{graded}/{submissions.length} graded</Text>
            </View>

            {submissions.length === 0 ? (
              <View style={styles.emptySubmit}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>No submissions yet.</Text>
              </View>
            ) : (
              submissions.map((sub, i) => {
                const pct = sub.grade != null && assignment.max_points
                  ? Math.round((sub.grade / assignment.max_points) * 100) : null;
                const gradeColor = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                const isGrading = gradingId === sub.id;

                return (
                  <MotiView key={sub.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 40 }}>
                    <View style={styles.subCard}>
                      <LinearGradient colors={[gradeColor + '06', 'transparent']} style={StyleSheet.absoluteFill} />

                      <View style={styles.subTop}>
                        <LinearGradient colors={[COLORS.admin, COLORS.admin + 'aa']} style={styles.subAvatar}>
                          <Text style={styles.subAvatarText}>{sub.student_name[0]}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName}>{sub.student_name}</Text>
                          {sub.submitted_at ? (
                            <Text style={styles.subDate}>Submitted {new Date(sub.submitted_at).toLocaleDateString('en-GB')}</Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[styles.statusBadge, { backgroundColor: sub.status === 'graded' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
                            <Text style={[styles.statusText, { color: sub.status === 'graded' ? COLORS.success : COLORS.warning }]}>{sub.status}</Text>
                          </View>
                          {pct != null && (
                            <Text style={[styles.pct, { color: gradeColor }]}>{pct}%</Text>
                          )}
                        </View>
                      </View>

                      {sub.feedback ? (
                        <Text style={styles.feedback}>💬 {sub.feedback}</Text>
                      ) : null}

                      {/* Grade form */}
                      {isGrading ? (
                        <View style={styles.gradeForm}>
                          <View style={styles.gradePresets}>
                            {GRADE_PRESETS.map(p => (
                              <TouchableOpacity
                                key={p.label}
                                onPress={() => {
                                  const pts = assignment.max_points ? Math.round((p.pct / 100) * assignment.max_points) : p.pct;
                                  setGradeInput(String(pts));
                                }}
                                style={styles.presetBtn}
                              >
                                <Text style={styles.presetText}>{p.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TextInput
                            style={styles.gradeInput}
                            value={gradeInput}
                            onChangeText={setGradeInput}
                            keyboardType="numeric"
                            placeholder={`Score (max ${assignment.max_points ?? 100})`}
                            placeholderTextColor={COLORS.textMuted}
                          />
                          <TextInput
                            style={[styles.gradeInput, styles.feedbackInput]}
                            value={feedbackInput}
                            onChangeText={setFeedbackInput}
                            placeholder="Feedback (optional)"
                            placeholderTextColor={COLORS.textMuted}
                            multiline
                          />
                          <View style={styles.gradeActions}>
                            <TouchableOpacity onPress={() => { setGradingId(null); setGradeInput(''); }} style={styles.cancelBtn}>
                              <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => saveGrade(sub.id)} style={styles.saveBtn} disabled={saving}>
                              {saving ? <ActivityIndicator color={COLORS.white100} size="small" /> : <Text style={styles.saveText}>Save Grade</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setGradingId(sub.id);
                            setGradeInput(sub.grade != null ? String(sub.grade) : '');
                            setFeedbackInput(sub.feedback ?? '');
                          }}
                          style={styles.gradeBtn}
                        >
                          <Text style={styles.gradeBtnText}>{sub.grade != null ? '✏️ Edit Grade' : '📝 Grade'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </MotiView>
                );
              })
            )}
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
  description: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaEmoji: { fontSize: 14 },
  metaText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  subsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  subsTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  subsCount: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  subCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm },
  subTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  subAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  subName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  subDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  pct: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  feedback: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontStyle: 'italic' },

  gradeBtn: { paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.info + '40', alignItems: 'center' },
  gradeBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info },

  gradeForm: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  gradePresets: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.info + '15', borderWidth: 1, borderColor: COLORS.info + '30' },
  presetText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  gradeInput: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
  },
  feedbackInput: { minHeight: 70, textAlignVertical: 'top' },
  gradeActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  saveBtn: { flex: 2, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptySubmit: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

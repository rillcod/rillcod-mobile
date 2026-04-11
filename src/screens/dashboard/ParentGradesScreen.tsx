import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { gradeService } from '../../services/grade.service';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

interface GradeItem {
  id: string;
  type: 'assignment' | 'exam';
  title: string;
  grade: number | string | null;
  max_score: number | null;
  status: string;
  submitted_at: string | null;
  feedback: string | null;
}

function gradeColor(grade: number | string | null, max: number | null): string {
  if (grade == null) return COLORS.textMuted;
  const pct = max ? (Number(grade) / max) * 100 : Number(grade);
  if (pct >= 70) return COLORS.success;
  if (pct >= 55) return COLORS.warning;
  return COLORS.error;
}

export default function ParentGradesScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { studentId: paramStudentId, studentName } = route.params ?? {};
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noPortalAccount, setNoPortalAccount] = useState(false);

  const load = async () => {
    try {
      let studentId = paramStudentId as string | undefined;
      if (!studentId && profile?.email) {
        studentId = (await studentService.getFirstStudentRegistrationIdForParentEmail(profile.email)) ?? undefined;
      }
      if (!studentId) {
        setNoPortalAccount(true);
        setGrades([]);
        return;
      }

      const portalUserId = await studentService.getPortalUserIdForStudentRegistration(studentId);
      if (!portalUserId) {
        setNoPortalAccount(true);
        setGrades([]);
        return;
      }

      setNoPortalAccount(false);

      const [asgnRows, cbtRows] = await Promise.all([
        gradeService.listGradedAssignmentSubmissionsForParentGrades(portalUserId),
        gradeService.listCbtSessionsWithScoresForParentGrades(portalUserId),
      ]);

      const items: GradeItem[] = [
        ...asgnRows.map((r: any) => ({
          id: r.id,
          type: 'assignment' as const,
          title: r.assignments?.title ?? 'Assignment',
          grade: r.grade,
          max_score: r.assignments?.max_points ?? null,
          status: r.status,
          submitted_at: r.submitted_at,
          feedback: r.feedback,
        })),
        ...cbtRows.map((r: any) => ({
          id: r.id,
          type: 'exam' as const,
          title: r.cbt_exams?.title ?? 'CBT Exam',
          grade: r.score,
          max_score: r.cbt_exams?.total_marks ?? null,
          status: r.status,
          submitted_at: r.end_time,
          feedback: null,
        })),
      ].sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime());

      setGrades(items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [paramStudentId, profile?.email]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <View>
          <Text style={styles.title}>Grades</Text>
          {studentName && <Text style={styles.subtitle}>{studentName}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {noPortalAccount ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎓</Text>
              <Text style={styles.emptyTitle}>No portal account</Text>
              <Text style={styles.emptyText}>This child has no linked portal account. Grades will appear once they register.</Text>
            </View>
          ) : grades.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No grades yet</Text>
              <Text style={styles.emptyText}>Grades appear here once assignments and exams are marked.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {grades.map((item, i) => (
                <MotiView
                  key={item.id}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: i * 40 }}
                  style={styles.card}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.badgeRow}>
                        <View style={[styles.typeBadge, item.type === 'exam' ? styles.examBadge : styles.asgnBadge]}>
                          <Text style={[styles.typeBadgeText, item.type === 'exam' ? styles.examText : styles.asgnText]}>
                            {item.type}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, item.status === 'graded' || item.status === 'completed' ? styles.gradedPill : styles.pendingPill]}>
                          <Text style={[styles.statusPillText, item.status === 'graded' || item.status === 'completed' ? styles.gradedText : styles.pendingText]}>
                            {item.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.submitted_at && (
                        <Text style={styles.dateText}>
                          {new Date(item.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.gradeValue, { color: gradeColor(item.grade, item.max_score) }]}>
                      {item.grade ?? '—'}
                      {item.max_score != null && <Text style={styles.maxScore}>/{item.max_score}</Text>}
                    </Text>
                  </View>

                  {item.feedback && (
                    <View style={styles.feedbackBox}>
                      <Text style={styles.feedbackLabel}>Feedback</Text>
                      <Text style={styles.feedbackText}>{item.feedback}</Text>
                    </View>
                  )}
                </MotiView>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md },
  backBtn: { padding: SPACING.xs },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  scroll: { padding: SPACING.base, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  list: { gap: SPACING.md },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  badgeRow: { flexDirection: 'row', gap: SPACING.xs },
  typeBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  examBadge: { backgroundColor: '#7c3aed22', borderColor: '#7c3aed55' },
  asgnBadge: { backgroundColor: '#2563eb22', borderColor: '#2563eb55' },
  typeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  examText: { color: '#a78bfa' },
  asgnText: { color: '#60a5fa' },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  gradedPill: { backgroundColor: COLORS.success + '22', borderColor: COLORS.success + '55' },
  pendingPill: { backgroundColor: COLORS.warning + '22', borderColor: COLORS.warning + '55' },
  statusPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  gradedText: { color: COLORS.success },
  pendingText: { color: COLORS.warning },
  itemTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  dateText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  gradeValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  maxScore: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  feedbackBox: { padding: SPACING.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, gap: 4 },
  feedbackLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  feedbackText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: FONT_SIZE.sm * 1.6 },
});

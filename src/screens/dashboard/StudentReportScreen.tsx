import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { gradeService } from '../../services/grade.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { callAI } from '../../lib/openrouter';
import { generateAndShareReportPDF } from '../../lib/report-generator';
import ReportCardPreview from '../../components/ui/ReportCardPreview';

interface ProgressReport {
  id: string;
  course_name: string;
  report_term: string;
  report_period: string | null;
  current_module: string | null;
  next_module: string | null;
  course_duration: string | null;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  participation_score: number | null;
  participation_grade: string | null;
  projects_grade: string | null;
  homework_grade: string | null;
  proficiency_level: string | null;
  overall_score: number | null;
  overall_grade: string | null;
  is_published: boolean;
  instructor_name: string | null;
  report_date: string | null;
  learning_milestones: any;  // stored as string[] in DB
  key_strengths: string | null;
  areas_for_growth: string | null;
  instructor_assessment: string | null;
  school_name: string | null;
  section_class: string | null;
}

interface Submission {
  id: string;
  status: string;
  grade: number | null;
  submitted_at: string;
  assignments: { title: string; due_date: string | null } | null;
}

interface Enrollment {
  id: string;
  status: string;
  grade: number | null;
  progress_pct: number | null;
  programs: { title: string } | null;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={bar.track}>
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${Math.min(score, 100)}%` }}
        transition={{ type: 'timing', duration: 800 }}
        style={[bar.fill, { backgroundColor: color }]}
      />
    </View>
  );
}

function gradeColor(grade: string | null) {
  if (!grade) return COLORS.textMuted;
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return COLORS.success;
  if (g.startsWith('B')) return COLORS.info;
  if (g.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

export default function StudentReportScreen({ navigation, route }: any) {
  const { studentId, studentName } = route.params as { studentId: string; studentName?: string };
  const { profile } = useAuth();
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'submissions' | 'enrollments'>('reports');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<Record<string, { strengths: string; growth: string }>>({});

  const canEdit = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';
  const isParent = profile?.role === 'parent';
  const isOwnReport = profile?.role === 'student';
  const effectiveStudentId = canEdit || isParent ? studentId : profile?.id;

  const load = useCallback(async () => {
    if (!effectiveStudentId) {
      setReports([]);
      setSubmissions([]);
      setEnrollments([]);
      setLoading(false);
      return;
    }
    const [repRows, subRows, enrRows] = await Promise.all([
      gradeService.listFullProgressReportsForStudentReport(
        effectiveStudentId,
        studentName ?? profile?.full_name ?? null,
      ),
      gradeService.listSubmissionsForStudentReport(effectiveStudentId),
      gradeService.listEnrollmentsForStudentReport(effectiveStudentId),
    ]);

    setReports(repRows as ProgressReport[]);
    setSubmissions(subRows as unknown as Submission[]);
    setEnrollments(enrRows as unknown as Enrollment[]);
    setLoading(false);
  }, [effectiveStudentId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /** AI-generate key strengths + areas for growth based on scores */
  const generateAIInsights = useCallback(async (r: ProgressReport) => {
    if (generatingAI) return;
    setGeneratingAI(r.id);
    try {
      const scores = `Examination: ${r.theory_score ?? 0}%, Evaluation: ${r.practical_score ?? 0}%, Assignment: ${r.attendance_score ?? 0}%, Participation: ${r.participation_score ?? 0}%, Overall: ${r.overall_score ?? 0}%`;
      const reply = await callAI({
        messages: [
          {
            role: 'system',
            content: 'You are an expert school teacher writing brief, encouraging report card feedback for Nigerian students. Output ONLY valid JSON with two fields: "strengths" (2 sentences of specific praise) and "growth" (2 sentences of constructive guidance). No extra text.',
          },
          {
            role: 'user',
            content: `Student: ${studentName || 'Student'}. Course: ${r.course_name}. Term: ${r.report_term}. Scores — ${scores}. Write personalised teacher feedback.`,
          },
        ],
        maxTokens: 300,
        temperature: 0.7,
        responseFormatJsonObject: true,
      });
      const parsed = JSON.parse(reply);
      if (parsed.strengths && parsed.growth) {
        setAiInsights(prev => ({ ...prev, [r.id]: { strengths: parsed.strengths, growth: parsed.growth } }));
      }
    } catch (e: any) {
      Alert.alert('AI Insights', e.message || 'Could not generate insights. Please try again.');
    } finally {
      setGeneratingAI(null);
    }
  }, [generatingAI, studentName]);

  /** Export a single report to PDF and share */
  const exportReportPDF = useCallback(async (r: ProgressReport, isModern = false) => {
    if (generatingPdf) return;
    setGeneratingPdf(r.id);
    try {
      const insights = aiInsights[r.id];
      await generateAndShareReportPDF({
        ...r,
        student_name: studentName || 'Student',
        key_strengths:    insights?.strengths || r.key_strengths,
        areas_for_growth: insights?.growth    || r.areas_for_growth,
      }, null, isModern);
    } catch (e: any) {
      Alert.alert('PDF Export', e.message || 'Unable to generate PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  }, [generatingPdf, studentName, aiInsights]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={styles.loaderText}>Loading report...</Text>
      </View>
    );
  }

  // Aggregate stats
  const publishedReports = reports.filter(r => r.is_published || canEdit);
  const avgScore = publishedReports.length > 0
    ? Math.round(publishedReports.filter(r => r.overall_score != null).reduce((s, r) => s + (r.overall_score ?? 0), 0) / publishedReports.filter(r => r.overall_score != null).length)
    : null;
  const submittedCount = submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
  const gradedCount = submissions.filter(s => s.status === 'graded' && s.grade != null).length;
  const avgGrade = gradedCount > 0
    ? Math.round(submissions.filter(s => s.grade != null).reduce((s, sub) => s + (sub.grade ?? 0), 0) / gradedCount)
    : null;

  const latestReport = publishedReports[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={
          isOwnReport
            ? 'My Report'
            : studentName
              ? `${studentName}'s Report`
              : isParent
                ? 'Child Report'
                : 'Student Report'
        }
        onBack={() => navigation.goBack()}
        accentColor={COLORS.accent}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary stats */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.statsCard}
        >
          <LinearGradient colors={[COLORS.accent + '12', 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.statsRow}>
            {[
              { label: 'Reports', value: publishedReports.length, color: COLORS.accent },
              { label: 'Avg Score', value: avgScore != null ? `${avgScore}%` : '--', color: COLORS.success },
              { label: 'Submitted', value: submittedCount, color: COLORS.info },
              { label: 'Avg Grade', value: avgGrade != null ? `${avgGrade}%` : '--', color: COLORS.warning },
            ].map(stat => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </MotiView>

        {/* ── Live Report Card Preview (mirrors web ReportCard.tsx) ── */}
        {latestReport && (
          <ReportCardPreview
            report={{
              ...latestReport,
              key_strengths:    aiInsights[latestReport.id]?.strengths || latestReport.key_strengths,
              areas_for_growth: aiInsights[latestReport.id]?.growth    || latestReport.areas_for_growth,
            }}
            studentName={studentName}
            onExportPDF={(isModern) => exportReportPDF(latestReport, isModern)}
            exportingPdf={generatingPdf === latestReport.id}
          />
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {([
            { key: 'reports', label: `Reports (${publishedReports.length})` },
            { key: 'submissions', label: `Work (${submissions.length})` },
            { key: 'enrollments', label: `Courses (${enrollments.length})` },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabContent}>
          {/* Progress Reports */}
          {activeTab === 'reports' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {publishedReports.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>[]</Text>
                  <Text style={styles.emptyText}>No progress reports yet.</Text>
                </View>
              ) : (
                publishedReports.map((r, i) => {
                  const expanded = expandedReport === r.id;
                  const gc = gradeColor(r.overall_grade);
                  return (
                    <MotiView
                      key={r.id}
                      from={{ opacity: 0, translateY: 8 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ delay: i * 40 }}
                    >
                      <TouchableOpacity
                        style={styles.reportCard}
                        onPress={() => setExpandedReport(expanded ? null : r.id)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={[gc + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                        <View style={styles.reportTop}>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.reportCourse}>{r.course_name}</Text>
                            <Text style={styles.reportTerm}>{r.report_term}</Text>
                            {r.instructor_name ? <Text style={styles.reportMeta}>Instructor: {r.instructor_name}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            {r.overall_grade ? (
                              <View style={[styles.gradeBadge, { backgroundColor: gc + '20' }]}>
                                <Text style={[styles.gradeText, { color: gc }]}>{r.overall_grade}</Text>
                              </View>
                            ) : null}
                            {r.overall_score != null && (
                              <Text style={[styles.overallScore, { color: gc }]}>{r.overall_score}%</Text>
                            )}
                          </View>
                        </View>

                        {expanded && (
                          <View style={styles.reportDetails}>
                            {r.theory_score != null && (
                              <View style={styles.scoreRow}>
                                <Text style={styles.scoreLabel}>Theory</Text>
                                <ScoreBar score={r.theory_score} color={COLORS.info} />
                                <Text style={styles.scoreVal}>{r.theory_score}%</Text>
                              </View>
                            )}
                            {r.practical_score != null && (
                              <View style={styles.scoreRow}>
                                <Text style={styles.scoreLabel}>Practical</Text>
                                <ScoreBar score={r.practical_score} color={COLORS.success} />
                                <Text style={styles.scoreVal}>{r.practical_score}%</Text>
                              </View>
                            )}
                            {r.attendance_score != null && (
                              <View style={styles.scoreRow}>
                                <Text style={styles.scoreLabel}>Attendance</Text>
                                <ScoreBar score={r.attendance_score} color={COLORS.warning} />
                                <Text style={styles.scoreVal}>{r.attendance_score}%</Text>
                              </View>
                            )}
                            {r.participation_score != null && (
                              <View style={styles.scoreRow}>
                                <Text style={styles.scoreLabel}>Participation</Text>
                                <ScoreBar score={r.participation_score} color={COLORS.accent} />
                                <Text style={styles.scoreVal}>{r.participation_score}%</Text>
                              </View>
                            )}
                            {r.report_period ? <Text style={styles.reportMeta}>Period: {r.report_period}</Text> : null}
                            {r.school_name ? <Text style={styles.reportMeta}>{r.school_name}{r.section_class ? ` / ${r.section_class}` : ''}</Text> : null}
                            {r.proficiency_level ? <Text style={styles.reportMeta}>Proficiency: <Text style={{textTransform:'capitalize'}}>{r.proficiency_level}</Text></Text> : null}
                            {(r.participation_grade || r.projects_grade || r.homework_grade) && (
                              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {r.participation_grade && <View style={styles.ratingChip}><Text style={styles.ratingChipText}>Participation / {r.participation_grade}</Text></View>}
                                {r.projects_grade && <View style={styles.ratingChip}><Text style={styles.ratingChipText}>Projects / {r.projects_grade}</Text></View>}
                                {r.homework_grade && <View style={styles.ratingChip}><Text style={styles.ratingChipText}>Homework / {r.homework_grade}</Text></View>}
                              </View>
                            )}
                            {/* AI Insights (generated or from DB) */}
                            {(r.key_strengths || aiInsights[r.id]?.strengths) ? (
                              <View style={styles.notesBlock}>
                                <Text style={styles.notesLabel}>Key Strengths</Text>
                                <Text style={styles.notesText}>{aiInsights[r.id]?.strengths || r.key_strengths}</Text>
                              </View>
                            ) : null}
                            {(r.areas_for_growth || aiInsights[r.id]?.growth) ? (
                              <View style={styles.notesBlock}>
                                <Text style={styles.notesLabel}>Areas for Growth</Text>
                                <Text style={styles.notesText}>{aiInsights[r.id]?.growth || r.areas_for_growth}</Text>
                              </View>
                            ) : null}
                            {/* AI Generate button — when insights are missing */}
                            {!r.key_strengths && !r.areas_for_growth && !aiInsights[r.id] && (
                              <TouchableOpacity
                                style={styles.aiInsightsBtn}
                                onPress={() => generateAIInsights(r)}
                                disabled={generatingAI === r.id}
                              >
                                {generatingAI === r.id ? (
                                  <ActivityIndicator size="small" color={COLORS.accent} />
                                ) : (
                                  <Text style={styles.aiInsightsBtnText}>✦ Generate AI Feedback</Text>
                                )}
                              </TouchableOpacity>
                            )}
                            {/* Regenerate button — when insights exist */}
                            {(r.key_strengths || aiInsights[r.id]) && (
                              <TouchableOpacity
                                style={[styles.aiInsightsBtn, styles.aiInsightsBtnSm]}
                                onPress={() => generateAIInsights(r)}
                                disabled={generatingAI === r.id}
                              >
                                {generatingAI === r.id ? (
                                  <ActivityIndicator size="small" color={COLORS.accent} />
                                ) : (
                                  <Text style={styles.aiInsightsBtnText}>✦ Regenerate AI Insights</Text>
                                )}
                              </TouchableOpacity>
                            )}
                            {r.instructor_assessment ? <View style={styles.notesBlock}><Text style={styles.notesLabel}>Instructor Assessment</Text><Text style={styles.notesText}>{r.instructor_assessment}</Text></View> : null}
                            {(() => {
                              let miles: string[] = [];
                              if (Array.isArray(r.learning_milestones)) miles = r.learning_milestones;
                              else if (typeof r.learning_milestones === 'string' && r.learning_milestones) {
                                try { miles = JSON.parse(r.learning_milestones); } catch { miles = r.learning_milestones.split('\n').filter(Boolean); }
                              }
                              return miles.length > 0 ? (
                                <View style={styles.milestonesWrap}>
                                  <Text style={styles.milestonesLabel}>Learning Milestones</Text>
                                  {miles.map((m, mi) => (
                                    <Text key={mi} style={styles.milestonesText}>- {m}</Text>
                                  ))}
                                </View>
                              ) : null;
                            })()}
                            {r.report_date ? (
                              <Text style={styles.reportDate}>{new Date(r.report_date).toLocaleDateString('en-GB')}</Text>
                            ) : null}
                            {/* PDF Export row */}
                            <View style={styles.pdfRow}>
                              <TouchableOpacity
                                style={[styles.pdfBtn, generatingPdf === r.id && { opacity: 0.6 }]}
                                onPress={() => exportReportPDF(r, false)}
                                disabled={!!generatingPdf}
                              >
                                {generatingPdf === r.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.pdfBtnText}>📄 Export Standard PDF</Text>}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.pdfBtnModern, generatingPdf === r.id && { opacity: 0.6 }]}
                                onPress={() => exportReportPDF(r, true)}
                                disabled={!!generatingPdf}
                              >
                                {generatingPdf === r.id ? <ActivityIndicator size="small" color={COLORS.accent} /> : <Text style={[styles.pdfBtnText, { color: COLORS.accent }]}>✦ Export Modern PDF</Text>}
                              </TouchableOpacity>
                            </View>
                            {canEdit && (
                              <TouchableOpacity
                                style={styles.editReportBtn}
                                onPress={() => navigation.navigate(ROUTES.ReportBuilder, { studentId: effectiveStudentId, studentName })}
                              >
                                <Text style={styles.editReportText}>Edit in Report Builder</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        <Text style={styles.expandChevron}>{expanded ? 'Hide details' : 'Open details'}</Text>
                      </TouchableOpacity>
                    </MotiView>
                  );
                })
              )}
            </MotiView>
          )}

          {/* Submissions */}
          {activeTab === 'submissions' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {submissions.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>[]</Text>
                  <Text style={styles.emptyText}>No submissions found.</Text>
                </View>
              ) : (
                submissions.map((s, i) => {
                  const statusColor = s.status === 'graded' ? COLORS.success : s.status === 'submitted' ? COLORS.info : COLORS.textMuted;
                  return (
                    <MotiView
                      key={s.id}
                      from={{ opacity: 0, translateY: 6 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ delay: i * 30 }}
                    >
                      <View style={styles.subCard}>
                        <LinearGradient colors={[statusColor + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={styles.subTitle}>{s.assignments?.title ?? 'Assignment'}</Text>
                          <Text style={styles.subMeta}>
                            Submitted: {new Date(s.submitted_at).toLocaleDateString('en-GB')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {s.grade != null && (
                            <Text style={[styles.subGrade, { color: COLORS.success }]}>{s.grade}%</Text>
                          )}
                          <View style={[styles.subBadge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.subBadgeText, { color: statusColor }]}>{s.status}</Text>
                          </View>
                        </View>
                      </View>
                    </MotiView>
                  );
                })
              )}
            </MotiView>
          )}

          {/* Enrollments */}
          {activeTab === 'enrollments' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {enrollments.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>[]</Text>
                  <Text style={styles.emptyText}>No course enrollments found.</Text>
                </View>
              ) : (
                enrollments.map((e, i) => {
                  const pct = e.progress_pct ?? 0;
                  return (
                    <MotiView
                      key={e.id}
                      from={{ opacity: 0, translateY: 6 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ delay: i * 30 }}
                    >
                      <View style={styles.enrCard}>
                        <LinearGradient colors={[COLORS.info + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text style={styles.enrTitle}>{e.programs?.title ?? 'Course'}</Text>
                          <View style={bar.track}>
                            <MotiView
                              from={{ width: '0%' }}
                              animate={{ width: `${pct}%` }}
                              transition={{ type: 'timing', duration: 800, delay: i * 30 }}
                              style={[bar.fill, { backgroundColor: COLORS.info }]}
                            />
                          </View>
                          <Text style={styles.enrPct}>{pct}% complete</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {e.grade != null && (
                            <Text style={[styles.subGrade, { color: COLORS.success }]}>{e.grade}%</Text>
                          )}
                          <View style={[styles.subBadge, { backgroundColor: (e.status === 'active' ? COLORS.success : COLORS.textMuted) + '20' }]}>
                            <Text style={[styles.subBadgeText, { color: e.status === 'active' ? COLORS.success : COLORS.textMuted }]}>
                              {e.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </MotiView>
                  );
                })
              )}
            </MotiView>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const bar = StyleSheet.create({
  track: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  statsCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.md, overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  previewCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    gap: SPACING.sm,
  },
  previewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewCardTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  previewCardBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  previewCardGrade: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  previewDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  previewStudentName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  previewMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  previewScoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  previewScoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 88 },
  previewScoreTrack: { flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  previewScoreFill: { height: 5, borderRadius: 3 },
  previewScoreVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, width: 36, textAlign: 'right' },
  previewChipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  previewChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  previewChipAccent: { backgroundColor: COLORS.accent + '18', borderColor: COLORS.accent + '32' },
  previewChipText: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.textSecondary },
  previewChipAccentText: { color: COLORS.accent },

  webParityGrid: { flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md },
  identityCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.primaryPale, padding: SPACING.md },
  moduleCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.primaryPale, padding: SPACING.md },
  webParityEyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1.3, marginBottom: 6 },
  identityName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  identityLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  identityValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, marginTop: 2 },
  moduleBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, padding: SPACING.sm, marginTop: SPACING.xs },
  moduleBoxAccent: { backgroundColor: COLORS.accent + '10', borderColor: COLORS.accent + '25' },
  moduleValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, marginTop: 3 },

  matrixCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.bgCard, padding: SPACING.md },
  matrixTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1.2 },
  matrixRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  matrixLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  matrixTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 999, overflow: 'hidden' },
  matrixFill: { height: 6, borderRadius: 999 },
  matrixValue: { width: 46, textAlign: 'right', fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm },
  matrixFooter: { alignItems: 'flex-end', marginTop: SPACING.xs },
  matrixGradeBox: { minWidth: 110, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, padding: SPACING.md, alignItems: 'center' },
  matrixGradeLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  matrixGradeValue: { fontFamily: FONT_FAMILY.display, fontSize: 40, lineHeight: 42, marginTop: 4 },
  matrixGradePct: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginHorizontal: SPACING.xl },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.accent },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tabTextActive: { color: COLORS.accent },

  tabContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  reportCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm,
  },
  reportTop: { flexDirection: 'row', gap: SPACING.md },
  reportCourse: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  reportTerm: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  reportMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  gradeText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  overallScore: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  expandChevron: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, marginTop: -4 },

  reportDetails: { gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 70 },
  scoreVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, width: 36, textAlign: 'right' },
  milestonesWrap: { gap: 4, paddingTop: SPACING.xs },
  milestonesLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  milestonesText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  reportDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  subCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  subTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  subMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  subGrade: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  subBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  subBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },

  enrCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  enrTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  enrPct: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  ratingChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  ratingChipText: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.textSecondary },
  notesBlock: { gap: 4, paddingTop: SPACING.xs },
  notesLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  notesText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  editReportBtn: { marginTop: SPACING.sm, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.accent + '18', alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '40' },
  editReportText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.accent },
  reportMeta2: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  // AI Insights button
  aiInsightsBtn: { marginTop: SPACING.sm, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.accent + '14', alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '35', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  aiInsightsBtnSm: { paddingVertical: 7 },
  aiInsightsBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 12, color: COLORS.accent, letterSpacing: 0.3 },

  // PDF export row
  pdfRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  pdfBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.info, alignItems: 'center' },
  pdfBtnModern: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: 'transparent', alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '50' },
  pdfBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11, color: '#fff', letterSpacing: 0.3 },
});

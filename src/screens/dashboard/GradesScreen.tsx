import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { gradeService } from '../../services/grade.service';
import { schoolService } from '../../services/school.service';
import { callAI } from '../../lib/openrouter';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { shareCsv } from '../../lib/csv';

interface Report {
  id: string;
  course_name: string | null;
  report_term: string | null;
  report_date: string | null;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  overall_score: number | null;
  overall_grade: string | null;
  is_published: boolean | null;
  instructor_name: string | null;
  learning_milestones: string[] | null;
  key_strengths: string | null;
  areas_for_growth: string | null;
  instructor_assessment: string | null;
}

interface SubmissionSummary {
  id: string;
  status: string | null;
  grade: number | null;
  submitted_at: string | null;
  assignments?: { title: string | null; max_points: number | null } | null;
}

interface CbtSummary {
  id: string;
  status: string | null;
  score: number | null;
  end_time: string | null;
  cbt_exams?: { title: string | null; total_marks: number | null } | null;
}

interface GpaData {
  gpa: number;
  averageScore: number;
}

interface AiAnalysis {
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  studyTips: string[];
  predictedGrade: string;
}

function gradeColor(grade: string | null): string {
  if (!grade) return COLORS.textMuted;
  if (grade.startsWith('A')) return COLORS.success;
  if (grade.startsWith('B')) return COLORS.info;
  if (grade.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

function gpaColor(gpa: number): string {
  if (gpa >= 3.5) return COLORS.success;
  if (gpa >= 2.5) return COLORS.info;
  if (gpa >= 1.5) return COLORS.warning;
  return COLORS.error;
}

function scoreTrend(reports: Report[]): 'up' | 'down' | 'stable' {
  if (reports.length < 2) return 'stable';
  const latest = reports[0]?.overall_score ?? 0;
  const prev = reports[1]?.overall_score ?? 0;
  if (latest > prev + 3) return 'up';
  if (latest < prev - 3) return 'down';
  return 'stable';
}

type ActiveTab = 'reports' | 'assignments' | 'cbt' | 'ai';

export default function GradesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [cbtSessions, setCbtSessions] = useState<CbtSummary[]>([]);
  const [gpaData, setGpaData] = useState<GpaData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('reports');

  const isParent = profile?.role === 'parent';

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      let targetId = profile.id;
      if (isParent) {
        const studentIds = await schoolService.getParentStudentIds();
        if (studentIds.length > 0) targetId = studentIds[0];
      }

      const [reportRows, gpa, submissionRows, cbtRows] = await Promise.all([
        gradeService.listProgressReports(targetId),
        gradeService.calculateGPA(targetId),
        gradeService.listGradedAssignmentSubmissionsForParentGrades(targetId, 50),
        gradeService.listCbtSessionsWithScoresForParentGrades(targetId, 50),
      ]);

      setReports(reportRows as Report[]);
      setGpaData(gpa);
      setSubmissions(submissionRows as SubmissionSummary[]);
      setCbtSessions(cbtRows as CbtSummary[]);
    } catch (err: any) {
      console.error('Grades Load Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, isParent]);

  useEffect(() => { load(); }, [load]);

  const avgScore = useMemo(() => {
    const valid = reports.filter((r) => r.overall_score != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((s, r) => s + (r.overall_score ?? 0), 0) / valid.length);
  }, [reports]);

  const assignmentAvg = useMemo(() => {
    const valid = submissions.filter((s) => s.grade != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((s, sub) => s + (sub.grade ?? 0), 0) / valid.length);
  }, [submissions]);

  const cbtAvg = useMemo(() => {
    const valid = cbtSessions.filter((s) => s.score != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((s, cs) => s + (cs.score ?? 0), 0) / valid.length);
  }, [cbtSessions]);

  const trend = useMemo(() => scoreTrend(reports), [reports]);
  const latestGrade = reports[0]?.overall_grade ?? null;

  const generateAiAnalysis = async () => {
    if (generatingAi) return;
    if (!reports.length && !submissions.length && !cbtSessions.length) {
      Alert.alert('No Data', 'No grade data available for analysis yet.');
      return;
    }
    setGeneratingAi(true);
    try {
      const summaryData = {
        gpa: gpaData?.gpa ?? 0,
        averageScore: gpaData?.averageScore ?? avgScore ?? 0,
        latestGrade,
        reportCount: reports.length,
        assignmentAvg,
        cbtAvg,
        recentReports: reports.slice(0, 5).map((r) => ({
          course: r.course_name,
          term: r.report_term,
          theory: r.theory_score,
          practical: r.practical_score,
          attendance: r.attendance_score,
          overall: r.overall_score,
          grade: r.overall_grade,
        })),
        trend,
      };

      const result = await callAI({
        messages: [
          {
            role: 'system',
            content: 'You are a smart academic advisor at a Nigerian educational institution. Analyze a student\'s grade data and provide concise, encouraging, actionable feedback. Respond with valid JSON only — no markdown fences, no extra text.',
          },
          {
            role: 'user',
            content: `Analyze these grades and return JSON with keys: overallFeedback (2-3 sentences), strengths (array of 3 strings), improvements (array of 3 strings), studyTips (array of 3 strings), predictedGrade (single letter A/B/C/D/F based on trend).\nData: ${JSON.stringify(summaryData)}`,
          },
        ],
        responseFormatJsonObject: true,
        maxTokens: 700,
        temperature: 0.6,
      });

      const parsed: AiAnalysis = JSON.parse(result);
      setAiAnalysis(parsed);
      setActiveTab('ai');
    } catch (err: any) {
      Alert.alert('AI Analysis', 'Could not generate analysis. Please try again.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const exportGradesCsv = async () => {
    if (reports.length === 0) {
      Alert.alert('Export', 'No reports to export yet.');
      return;
    }
    const rows: string[][] = [
      ['course_name', 'report_term', 'report_date', 'theory_score', 'practical_score',
        'attendance_score', 'overall_score', 'overall_grade', 'instructor_name', 'is_published'],
      ...reports.map((r) => [
        r.course_name ?? '', r.report_term ?? '', r.report_date ?? '',
        String(r.theory_score ?? ''), String(r.practical_score ?? ''),
        String(r.attendance_score ?? ''), String(r.overall_score ?? ''),
        r.overall_grade ?? '', r.instructor_name ?? '', r.is_published ? 'true' : 'false',
      ]),
    ];
    try {
      await shareCsv('grades-export.csv', rows);
    } catch (e: any) {
      Alert.alert('Export', e?.message ?? 'Could not share CSV.');
    }
  };

  const tabs: { key: ActiveTab; label: string; count?: number }[] = [
    { key: 'reports', label: 'Reports', count: reports.length },
    { key: 'assignments', label: 'Assignments', count: submissions.length },
    { key: 'cbt', label: 'CBT', count: cbtSessions.length },
    { key: 'ai', label: '✦ AI', count: undefined },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isParent ? "Children's Grades" : 'My Grades'}</Text>
            <Text style={styles.subtitle}>Smart academic performance hub</Text>
          </View>
          {reports.length > 0 && (
            <TouchableOpacity onPress={() => void exportGradesCsv()} style={styles.exportLink}>
              <Text style={styles.exportLinkText}>CSV</Text>
            </TouchableOpacity>
          )}
        </View>

        {!loading && (
          <>
            {/* GPA Banner */}
            {gpaData && gpaData.gpa > 0 && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.gpaBanner}
              >
                <View style={styles.gpaLeft}>
                  <Text style={styles.gpaSmallLabel}>CUMULATIVE GPA</Text>
                  <Text style={[styles.gpaValue, { color: gpaColor(gpaData.gpa) }]}>
                    {gpaData.gpa.toFixed(2)}
                    <Text style={styles.gpaScale}> / 4.00</Text>
                  </Text>
                  <Text style={styles.gpaAvgText}>Avg Score: {gpaData.averageScore.toFixed(1)}%</Text>
                </View>
                <View style={styles.gpaRight}>
                  <Text style={styles.trendEmoji}>
                    {trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️'}
                  </Text>
                  <Text style={styles.trendLabel}>
                    {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
                  </Text>
                  {latestGrade && (
                    <Text style={[styles.latestGradePill, { color: gradeColor(latestGrade), borderColor: gradeColor(latestGrade) }]}>
                      {latestGrade}
                    </Text>
                  )}
                </View>
              </MotiView>
            )}

            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              {[
                { label: 'Reports', value: reports.length, color: COLORS.primary },
                { label: 'Report Avg', value: avgScore != null ? `${avgScore}%` : '—', color: COLORS.success },
                { label: 'Assignments', value: assignmentAvg != null ? `${assignmentAvg}%` : submissions.length > 0 ? `${submissions.length} done` : '—', color: COLORS.info },
                { label: 'CBT Avg', value: cbtAvg != null ? `${cbtAvg}%` : cbtSessions.length > 0 ? `${cbtSessions.length} done` : '—', color: COLORS.warning },
              ].map((item) => (
                <MotiView
                  key={item.label}
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  style={styles.summaryCard}
                >
                  <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                </MotiView>
              ))}
            </View>

            {/* AI Analysis Button */}
            <TouchableOpacity
              style={[styles.aiBtn, generatingAi && styles.aiBtnDisabled]}
              onPress={generateAiAnalysis}
              disabled={generatingAi}
            >
              {generatingAi ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.aiBtnText}>✦ Smart Grade Analysis</Text>
              )}
            </TouchableOpacity>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                    {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <>
            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              reports.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>No published grades yet</Text>
                  <Text style={styles.emptyText}>Published report cards will appear here once your academic record is ready.</Text>
                </View>
              ) : (
                <View style={styles.listSection}>
                  {reports.map((report, index) => {
                    const isOpen = expanded === report.id;
                    const gc = gradeColor(report.overall_grade);
                    return (
                      <MotiView
                        key={report.id}
                        from={{ opacity: 0, translateY: 12 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: index * 40 }}
                      >
                        <TouchableOpacity
                          style={[styles.reportCard, isOpen && { borderColor: COLORS.primary + '55' }]}
                          onPress={() => setExpanded(isOpen ? null : report.id)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.reportHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.courseName}>{report.course_name ?? 'Progress Report'}</Text>
                              <Text style={styles.termText}>
                                {(report.report_term ?? 'Report') + (report.report_date ? ` · ${new Date(report.report_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : '')}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'center', gap: 4 }}>
                              <Text style={[styles.grade, { color: gc }]}>{report.overall_grade ?? '—'}</Text>
                              <Text style={[styles.scoreText, { color: gc }]}>{report.overall_score ?? 0}%</Text>
                            </View>
                          </View>

                          {/* Score bars */}
                          <View style={styles.scoreBars}>
                            {[
                              { label: 'Theory', val: report.theory_score },
                              { label: 'Practical', val: report.practical_score },
                              { label: 'Attendance', val: report.attendance_score },
                            ].map(({ label, val }) => (
                              <View key={label} style={styles.scoreRow}>
                                <Text style={styles.scoreLabel}>{label}</Text>
                                <View style={styles.barBg}>
                                  <View
                                    style={[
                                      styles.barFill,
                                      {
                                        width: `${val ?? 0}%` as any,
                                        backgroundColor: (val ?? 0) >= 70 ? COLORS.success : (val ?? 0) >= 50 ? COLORS.warning : COLORS.error,
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.scoreNum}>{val ?? 0}</Text>
                              </View>
                            ))}
                          </View>

                          {isOpen && (
                            <MotiView
                              from={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              style={styles.expandedContent}
                            >
                              {report.instructor_name ? (
                                <Text style={styles.instructor}>Instructor: {report.instructor_name}</Text>
                              ) : null}
                              {report.key_strengths ? (
                                <View style={styles.infoBox}>
                                  <Text style={[styles.infoBoxLabel, { color: COLORS.success }]}>Key Strengths</Text>
                                  <Text style={styles.infoBoxText}>{report.key_strengths}</Text>
                                </View>
                              ) : null}
                              {report.areas_for_growth ? (
                                <View style={styles.infoBox}>
                                  <Text style={[styles.infoBoxLabel, { color: COLORS.warning }]}>Areas for Growth</Text>
                                  <Text style={styles.infoBoxText}>{report.areas_for_growth}</Text>
                                </View>
                              ) : null}
                              {report.instructor_assessment ? (
                                <View style={styles.infoBox}>
                                  <Text style={[styles.infoBoxLabel, { color: COLORS.info }]}>Instructor Assessment</Text>
                                  <Text style={styles.infoBoxText}>{report.instructor_assessment}</Text>
                                </View>
                              ) : null}
                              {report.learning_milestones && report.learning_milestones.length > 0 ? (
                                <View style={styles.infoBox}>
                                  <Text style={[styles.infoBoxLabel, { color: COLORS.info }]}>Milestones</Text>
                                  {report.learning_milestones.map((m, mi) => (
                                    <Text key={mi} style={[styles.infoBoxText, { marginTop: 2 }]}>• {m}</Text>
                                  ))}
                                </View>
                              ) : null}
                            </MotiView>
                          )}

                          <Text style={styles.expandHint}>{isOpen ? '▲ Less' : '▼ Details'}</Text>
                        </TouchableOpacity>
                      </MotiView>
                    );
                  })}
                </View>
              )
            )}

            {/* ASSIGNMENTS TAB */}
            {activeTab === 'assignments' && (
              submissions.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📝</Text>
                  <Text style={styles.emptyTitle}>No graded assignments</Text>
                  <Text style={styles.emptyText}>Graded assignment submissions will appear here.</Text>
                </View>
              ) : (
                <View style={styles.listSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Assignment Submissions</Text>
                    <Text style={styles.sectionMeta}>{submissions.length} graded · Avg: {assignmentAvg ?? '—'}%</Text>
                  </View>
                  {submissions.map((sub, index) => {
                    const assign = sub.assignments as any;
                    const maxPts = assign?.max_points ?? 100;
                    const pct = sub.grade != null ? Math.round((sub.grade / maxPts) * 100) : null;
                    const scoreColor = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                    return (
                      <MotiView
                        key={sub.id}
                        from={{ opacity: 0, translateY: 8 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: index * 30 }}
                        style={styles.submissionCard}
                      >
                        <View style={styles.submissionRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.submissionTitle}>{assign?.title ?? 'Assignment'}</Text>
                            {sub.submitted_at && (
                              <Text style={styles.submissionMeta}>
                                Submitted: {new Date(sub.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Text>
                            )}
                          </View>
                          <View style={styles.submissionScore}>
                            <Text style={[styles.submissionPct, { color: scoreColor }]}>
                              {sub.grade ?? '—'}/{maxPts}
                            </Text>
                            {pct != null && (
                              <Text style={[styles.submissionPctSmall, { color: scoreColor }]}>{pct}%</Text>
                            )}
                          </View>
                        </View>
                        {pct != null && (
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: scoreColor }]} />
                          </View>
                        )}
                      </MotiView>
                    );
                  })}
                </View>
              )
            )}

            {/* CBT TAB */}
            {activeTab === 'cbt' && (
              cbtSessions.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🧠</Text>
                  <Text style={styles.emptyTitle}>No CBT sessions yet</Text>
                  <Text style={styles.emptyText}>Completed CBT exam scores will appear here.</Text>
                </View>
              ) : (
                <View style={styles.listSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>CBT Exam Sessions</Text>
                    <Text style={styles.sectionMeta}>{cbtSessions.length} sessions · Avg: {cbtAvg ?? '—'}%</Text>
                  </View>
                  {cbtSessions.map((session, index) => {
                    const exam = session.cbt_exams as any;
                    const total = exam?.total_marks ?? 100;
                    const pct = session.score != null ? Math.round((session.score / total) * 100) : null;
                    const scoreColor = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                    return (
                      <MotiView
                        key={session.id}
                        from={{ opacity: 0, translateY: 8 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: index * 30 }}
                        style={styles.submissionCard}
                      >
                        <View style={styles.submissionRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.submissionTitle}>{exam?.title ?? 'CBT Exam'}</Text>
                            {session.end_time && (
                              <Text style={styles.submissionMeta}>
                                Completed: {new Date(session.end_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Text>
                            )}
                            <View style={[styles.statusBadge, { backgroundColor: session.status === 'passed' ? COLORS.success + '22' : COLORS.warning + '22' }]}>
                              <Text style={[styles.statusBadgeText, { color: session.status === 'passed' ? COLORS.success : COLORS.warning }]}>
                                {session.status ?? 'completed'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.submissionScore}>
                            <Text style={[styles.submissionPct, { color: scoreColor }]}>
                              {session.score ?? '—'}/{total}
                            </Text>
                            {pct != null && (
                              <Text style={[styles.submissionPctSmall, { color: scoreColor }]}>{pct}%</Text>
                            )}
                          </View>
                        </View>
                        {pct != null && (
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: scoreColor }]} />
                          </View>
                        )}
                      </MotiView>
                    );
                  })}
                </View>
              )
            )}

            {/* AI TAB */}
            {activeTab === 'ai' && (
              !aiAnalysis ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>✦</Text>
                  <Text style={styles.emptyTitle}>AI Grade Analysis</Text>
                  <Text style={styles.emptyText}>Tap "Smart Grade Analysis" above to get personalized insights powered by AI.</Text>
                  <TouchableOpacity
                    style={[styles.aiBtn, generatingAi && styles.aiBtnDisabled, { marginTop: SPACING.lg }]}
                    onPress={generateAiAnalysis}
                    disabled={generatingAi}
                  >
                    {generatingAi ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.aiBtnText}>✦ Generate Analysis</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listSection}>
                  {/* Overall Feedback */}
                  <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    style={[styles.aiCard, { borderColor: COLORS.primary + '44' }]}
                  >
                    <Text style={styles.aiCardLabel}>✦ AI Assessment</Text>
                    <Text style={styles.aiCardText}>{aiAnalysis.overallFeedback}</Text>
                    <View style={styles.predictedGradeRow}>
                      <Text style={styles.predictedLabel}>Predicted Next Grade:</Text>
                      <Text style={[styles.predictedValue, { color: gradeColor(aiAnalysis.predictedGrade) }]}>
                        {aiAnalysis.predictedGrade}
                      </Text>
                    </View>
                  </MotiView>

                  {/* Strengths */}
                  <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: 100 }}
                    style={[styles.aiCard, { borderColor: COLORS.success + '44' }]}
                  >
                    <Text style={[styles.aiCardLabel, { color: COLORS.success }]}>💪 Your Strengths</Text>
                    {aiAnalysis.strengths.map((s, i) => (
                      <Text key={i} style={styles.aiListItem}>✓ {s}</Text>
                    ))}
                  </MotiView>

                  {/* Improvements */}
                  <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: 200 }}
                    style={[styles.aiCard, { borderColor: COLORS.warning + '44' }]}
                  >
                    <Text style={[styles.aiCardLabel, { color: COLORS.warning }]}>🎯 Areas to Improve</Text>
                    {aiAnalysis.improvements.map((s, i) => (
                      <Text key={i} style={styles.aiListItem}>→ {s}</Text>
                    ))}
                  </MotiView>

                  {/* Study Tips */}
                  <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: 300 }}
                    style={[styles.aiCard, { borderColor: COLORS.info + '44' }]}
                  >
                    <Text style={[styles.aiCardLabel, { color: COLORS.info }]}>📚 Smart Study Tips</Text>
                    {aiAnalysis.studyTips.map((s, i) => (
                      <Text key={i} style={styles.aiListItem}>• {s}</Text>
                    ))}
                  </MotiView>

                  <TouchableOpacity
                    style={[styles.aiBtn, styles.aiBtnOutline, generatingAi && styles.aiBtnDisabled]}
                    onPress={generateAiAnalysis}
                    disabled={generatingAi}
                  >
                    {generatingAi ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={[styles.aiBtnText, { color: COLORS.primary }]}>↻ Regenerate Analysis</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  // GPA Banner
  gpaBanner: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpaLeft: { gap: 4 },
  gpaSmallLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  gpaValue: { fontFamily: FONT_FAMILY.display, fontSize: 32 },
  gpaScale: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  gpaAvgText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  gpaRight: { alignItems: 'center', gap: 6 },
  trendEmoji: { fontSize: 28 },
  trendLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  latestGradePill: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.lg,
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginTop: 2,
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  summaryLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // AI Button
  aiBtn: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },

  // Tabs
  tabsRow: { marginBottom: SPACING.md },
  tabsContent: { paddingHorizontal: SPACING.base, gap: SPACING.sm },
  tabBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  tabBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  tabLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  tabLabelActive: { fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primary },

  // Shared
  center: { paddingTop: 80, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm, paddingHorizontal: SPACING['2xl'] },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted, textAlign: 'center' },
  listSection: { padding: SPACING.base, gap: SPACING.md },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  sectionMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  // Reports
  reportCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.md,
  },
  reportHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  courseName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  termText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  grade: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  scoreText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  scoreBars: { gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 70 },
  barBg: { flex: 1, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: RADIUS.full },
  scoreNum: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, width: 26, textAlign: 'right' },
  expandedContent: { gap: SPACING.sm },
  instructor: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  infoBox: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 4 },
  infoBoxLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoBoxText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.5 },
  expandHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },

  // Submissions / CBT
  submissionCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  submissionRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  submissionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  submissionMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  submissionScore: { alignItems: 'flex-end', gap: 2 },
  submissionPct: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  submissionPctSmall: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
  statusBadge: { marginTop: 4, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  statusBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },

  // AI Cards
  aiCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  aiCardLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  aiCardText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textSecondary, lineHeight: FONT_SIZE.base * 1.6 },
  aiListItem: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.7 },
  predictedGradeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  predictedLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  predictedValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },

  exportLink: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  exportLinkText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
});

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export class GradeService {
  private async listPublishedReportsWithLegacyFallback(
    selectClause: string,
    params: { studentId: string; studentName?: string | null; limit?: number },
  ): Promise<any[]> {
    const limit = params.limit ?? 100;
    const primary = await supabase
      .from('student_progress_reports')
      .select(selectClause)
      .eq('student_id', params.studentId)
      .eq('is_published', true)
      .order('report_date', { ascending: false })
      .limit(limit);
    if (primary.error) throw primary.error;
    if ((primary.data ?? []).length > 0 || !params.studentName?.trim()) {
    return (primary.data ?? []) as any[];
    }

    const fallback = await supabase
      .from('student_progress_reports')
      .select(selectClause)
      .is('student_id', null)
      .eq('student_name', params.studentName.trim())
      .eq('is_published', true)
      .order('report_date', { ascending: false })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as any[];
  }

  private async listAssignmentSubmissionsByStudentKeys(
    portalUserId: string,
    selectClause: string,
    params?: { gradedOnly?: boolean; limit?: number },
  ): Promise<any[]> {
    const buildQuery = (column: 'portal_user_id' | 'user_id') => {
      let query = supabase.from('assignment_submissions').select(selectClause).eq(column, portalUserId);
      if (params?.gradedOnly) query = query.eq('status', 'graded').not('grade', 'is', null);
      query = query.order('submitted_at', { ascending: false });
      if (params?.limit) query = query.limit(params.limit);
      return query;
    };

    const [portalRows, userRows] = await Promise.all([buildQuery('portal_user_id'), buildQuery('user_id')]);
    if (portalRows.error) throw portalRows.error;
    if (userRows.error) throw userRows.error;

    const merged = new Map<string, any>();
    for (const row of [...(portalRows.data ?? []), ...(userRows.data ?? [])] as any[]) merged.set(row.id, row);
    return Array.from(merged.values());
  }

  async listGrades(userId: string, programId?: string, schoolId?: string | null) {
    let query = supabase
      .from('enrollments')
      .select('*, programs!inner(name, school_id)')
      .eq('user_id', userId);

    if (programId) query = query.eq('program_id', programId);
    if (schoolId) query = query.eq('programs.school_id', schoolId);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async calculateGPA(userId: string) {
    // 1. Fetch assignment submissions
    const { data: submissions, error: subErr } = await supabase
      .from('assignment_submissions')
      .select('grade, assignments!inner(max_points)')
      .eq('portal_user_id', userId)
      .eq('status', 'graded')
      .not('grade', 'is', null);

    // 2. Fetch CBT results from both possible sources (cbt_sessions and exam_attempts)
    const [cbtRes, attemptsRes] = await Promise.all([
      supabase
        .from('cbt_sessions')
        .select('score, cbt_exams!inner(passing_score)')
        .eq('user_id', userId)
        .eq('status', 'passed')
        .not('score', 'is', null),
      supabase
        .from('exam_attempts')
        .select('percentage, exams!inner(passing_score)')
        .eq('portal_user_id', userId)
        .eq('status', 'graded')
        .not('percentage', 'is', null)
    ]);

    let totalWeight = 0;
    let totalScore = 0;

    if (submissions && !subErr) {
      submissions.forEach(sub => {
        const assign = sub.assignments as any;
        const maxPts = assign?.max_points || 100;
        totalScore += ((sub.grade || 0) / maxPts) * 100;
        totalWeight += 1;
      });
    }

    if (cbtRes.data) {
      cbtRes.data.forEach(session => {
        // Score in sessions is often already percentage-based or absolute. 
        // We treat it as 100% scale here for simplified logic.
        totalScore += (session.score || 0);
        totalWeight += 2;
      });
    }

    if (attemptsRes.data) {
      attemptsRes.data.forEach(attempt => {
        totalScore += (attempt.percentage || 0);
        totalWeight += 2;
      });
    }

    if (totalWeight === 0) return { gpa: 0, averageScore: 0 };

    const averageScore = totalScore / totalWeight;

    // Convert 100 scale to 4.0 scale
    let gpa = 0.0;
    if (averageScore >= 90) gpa = 4.0;
    else if (averageScore >= 80) gpa = 3.0 + ((averageScore - 80) / 10);
    else if (averageScore >= 70) gpa = 2.0 + ((averageScore - 70) / 10);
    else if (averageScore >= 60) gpa = 1.0 + ((averageScore - 60) / 10);

    return {
      gpa: Math.round(gpa * 100) / 100,
      averageScore: Math.round(averageScore * 100) / 100
    };
  }

  async manualGradeExam(attemptId: string, scores: Record<string, number>, feedback: string) {
    const { data: attempt } = await supabase
      .from('exam_attempts')
      .select('*, exams(title)')
      .eq('id', attemptId)
      .single();

    if (!attempt) throw new Error('Attempt not found');

    let newScore = (attempt.score || 0);
    Object.values(scores).forEach(s => { if (typeof s === 'number') newScore += s; });
    const newPercentage = (newScore / (attempt.total_points || 100)) * 100;

    const { error } = await supabase
      .from('exam_attempts')
      .update({
        score: newScore,
        percentage: newPercentage,
        status: 'graded',
        feedback: feedback || null,
        graded_at: new Date().toISOString()
      })
      .eq('id', attemptId);

    if (error) throw error;
    return true;
  }

  /** Most recent published report for the student’s portal user id. */
  async getLatestPublishedReportForStudent(studentPortalUserId: string, studentName?: string | null) {
    const data = await this.listPublishedReportsWithLegacyFallback('*', {
      studentId: studentPortalUserId,
      studentName,
      limit: 1,
    });
    return data[0] ?? null;
  }

  async listProgressReports(studentId: string, studentName?: string | null) {
    return this.listPublishedReportsWithLegacyFallback(
      'id, course_name, report_term, report_date, theory_score, practical_score, attendance_score, overall_score, overall_grade, is_published, instructor_name, learning_milestones, key_strengths, areas_for_growth, instructor_assessment',
      { studentId, studentName },
    );
  }

  async listPortalStudentsByIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class')
      .in('id', ids)
      .eq('role', 'student')
      .order('full_name');
    if (error) throw error;
    return data ?? [];
  }

  async listPublishedReportSummariesForStudentIds(studentIds: string[]) {
    if (!studentIds.length) return [];
    const { data, error } = await supabase
      .from('student_progress_reports')
      .select('id, student_id, overall_grade, overall_score, is_published, course_name, report_term, report_date')
      .in('student_id', studentIds)
      .eq('is_published', true)
      .order('report_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Staff report directory: student rows (capped). */
  async listStudentsForReportDirectory(params: {
    schoolId?: string | null;
    teacherSchoolIds?: string[];
    limit?: number;
  }) {
    const lim = params.limit ?? 200;
    let sq = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, section_class')
      .eq('role', 'student')
      .order('full_name')
      .limit(lim);
    if (params.schoolId) {
      sq = sq.eq('school_id', params.schoolId);
    } else if (params.teacherSchoolIds?.length) {
      sq = sq.in('school_id', params.teacherSchoolIds);
    }
    const { data, error } = await sq;
    if (error) throw error;
    return data ?? [];
  }

  /** Published reports for many students; optional school scoping (teacher/school roles). */
  async listPublishedReportSummariesForStudentsScoped(
    studentIds: string[],
    scope?: { schoolId?: string; schoolIds?: string[] },
  ) {
    if (!studentIds.length) return [];
    let repQuery = supabase
      .from('student_progress_reports')
      .select('id, student_id, overall_grade, overall_score, is_published, course_name, report_term, report_date, school_id')
      .in('student_id', studentIds)
      .order('report_date', { ascending: false });
    if (scope?.schoolId) {
      repQuery = repQuery.eq('school_id', scope.schoolId);
    } else if (scope?.schoolIds?.length) {
      repQuery = repQuery.in('school_id', scope.schoolIds);
    }
    const { data, error } = await repQuery;
    if (error) throw error;
    return data ?? [];
  }

  /** Parent grades: graded assignment rows for a student’s portal user id. */
  async listGradedAssignmentSubmissionsForParentGrades(portalUserId: string, limit = 30) {
    return this.listAssignmentSubmissionsByStudentKeys(
      portalUserId,
      'id, status, grade, feedback, submitted_at, assignments(title, max_points)',
      { gradedOnly: true, limit },
    );
  }

  /** Parent grades: CBT session rows with scores. */
  async listCbtSessionsWithScoresForParentGrades(portalUserId: string, limit = 30) {
    const { data, error } = await supabase
      .from('cbt_sessions')
      .select('id, status, score, end_time, cbt_exams(title, total_marks)')
      .eq('user_id', portalUserId)
      .not('score', 'is', null)
      .order('end_time', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** My Children: latest published letter grade for a portal student. */
  async getLatestPublishedOverallGradeForPortalStudent(portalUserId: string, studentName?: string | null) {
    const rows = await this.listPublishedReportsWithLegacyFallback('overall_grade', {
      studentId: portalUserId,
      studentName,
      limit: 1,
    });
    return (rows[0] as any)?.overall_grade ?? null;
  }

  /** Progress screen (school / admin): flat report list. */
  async listProgressReportRowsForProgressScreen(params: {
    isAdmin: boolean;
    schoolId?: string | null;
    limit?: number;
  }) {
    const lim = params.limit ?? 200;
    let reportQuery = supabase
      .from('student_progress_reports')
      .select(
        'id, student_name, school_name, section_class, course_name, overall_score, overall_grade, theory_score, practical_score, report_term, report_date, is_published, school_id',
      )
      .order('report_date', { ascending: false })
      .limit(lim);
    if (!params.isAdmin && params.schoolId) {
      reportQuery = reportQuery.eq('school_id', params.schoolId);
    }
    const { data, error } = await reportQuery;
    if (error) throw error;
    return data ?? [];
  }

  /** Student report screen: full progress report rows for a portal user id. */
  async listFullProgressReportsForStudentReport(portalUserId: string, studentName?: string | null) {
    return this.listPublishedReportsWithLegacyFallback(
      'id, course_name, report_term, report_period, current_module, next_module, course_duration, theory_score, practical_score, attendance_score, participation_score, participation_grade, projects_grade, homework_grade, proficiency_level, overall_score, overall_grade, is_published, instructor_name, report_date, learning_milestones, key_strengths, areas_for_growth, instructor_assessment, school_name, section_class, student_name',
      { studentId: portalUserId, studentName },
    );
  }

  async listSubmissionsForStudentReport(portalUserId: string, limit = 50) {
    return this.listAssignmentSubmissionsByStudentKeys(
      portalUserId,
      'id, status, grade, submitted_at, assignments(title, due_date)',
      { limit },
    );
  }

  async listEnrollmentsForStudentReport(portalUserId: string, limit = 50) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, status, grade, progress_pct, programs(title)')
      .eq('user_id', portalUserId)
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}

export const gradeService = new GradeService();

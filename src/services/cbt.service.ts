import { supabase } from '../lib/supabase';
import type { Database, Json } from '../types/supabase';

export type CBTExam = Database['public']['Tables']['cbt_exams']['Row'];
export type CBTQuestion = Database['public']['Tables']['cbt_questions']['Row'];
export type CBTSession = Database['public']['Tables']['cbt_sessions']['Row'];

export interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay' | 'coding_blocks';
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  metadata: unknown;
  order_index: number | null;
}

export type PrepareStudentExamAttemptResult =
  | { type: 'blocked'; score: number; status: string }
  | {
      type: 'ready';
      sessionId: string;
      exam: CBTExam;
      questions: Question[];
      answers: Record<string, string>;
      startTimeIso: string;
    };

const TERMINAL_SESSION_STATUSES = new Set(['passed', 'failed', 'pending_grading']);

export class CBTService {
  async listExamsForProgram(programId: string) {
    const { data, error } = await supabase
      .from('cbt_exams')
      .select('id, title, duration_minutes, total_questions, is_active')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getExam(examId: string) {
    const { data, error } = await supabase
      .from('cbt_exams')
      .select(`
        *,
        cbt_questions (*)
      `)
      .eq('id', examId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Exam not found');

    const sanitizedQuestions: Question[] = ((data.cbt_questions ?? []) as any[])
      .map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: (q.question_type ?? 'multiple_choice') as Question['question_type'],
        options: this.parseOptions(q.options),
        correct_answer: q.correct_answer,
        points: q.points ?? 1,
        metadata: q.metadata ?? null,
        order_index: q.order_index ?? null,
      }))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    return {
      exam: data as CBTExam,
      questions: sanitizedQuestions,
    };
  }

  async checkSession(examId: string, userId: string) {
    const { data, error } = await supabase
      .from('cbt_sessions')
      .select('id, score, status, end_time')
      .eq('exam_id', examId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Single entry for learner exam screens: resume `in_progress` session, or start a new one,
   * or report a terminal attempt (no duplicate submit rows). Aligns with web “one session per attempt” flow.
   */
  async prepareStudentExamAttempt(examId: string, userId: string): Promise<PrepareStudentExamAttemptResult> {
    const { data: latest, error } = await supabase
      .from('cbt_sessions')
      .select('id, score, status, answers, start_time, end_time')
      .eq('exam_id', examId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const rowTerminal = !!(latest?.end_time || (latest?.status && TERMINAL_SESSION_STATUSES.has(latest.status)));

    if (latest && rowTerminal) {
      return { type: 'blocked', score: latest.score ?? 0, status: latest.status ?? 'completed' };
    }

    if (latest && !latest.end_time) {
      const { exam, questions } = await this.getExam(examId);
      const raw = latest.answers;
      const answers: Record<string, string> =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
      return {
        type: 'ready',
        sessionId: latest.id,
        exam: exam as CBTExam,
        questions,
        answers,
        startTimeIso: latest.start_time ?? new Date().toISOString(),
      };
    }

    const started = await this.startExam(examId, userId);
    return {
      type: 'ready',
      sessionId: started.sessionId,
      exam: started.exam as CBTExam,
      questions: started.questions,
      answers: {},
      startTimeIso: new Date().toISOString(),
    };
  }

  private parseOptions(options: any): string[] | null {
    if (Array.isArray(options)) return options;
    if (Array.isArray(options?.options)) return options.options;
    return null;
  }

  async submitExam(payload: {
    examId: string;
    userId: string;
    startTime: string;
    answers: Record<string, any>;
    questions: Question[];
    passingScore: number;
    sessionId?: string;
  }) {
    const { examId, userId, answers, questions, passingScore, sessionId } = payload;
    
    let score = 0;
    let totalPoints = 0;
    let needsManualGrading = false;

    const gradingResults = questions.map(q => {
      const qPoints = q.points || 0;
      totalPoints += qPoints;
      const userAnswer = (answers[q.id] || '').trim().toLowerCase();
      const correctAnswer = (q.correct_answer || '').trim().toLowerCase();
      
      let questionScore = 0;

      if (['essay', 'coding_blocks'].includes(q.question_type || '')) {
        needsManualGrading = true;
      } else {
        if (userAnswer === correctAnswer) {
          questionScore = qPoints;
          score += qPoints;
        }
      }

      return {
        question_id: q.id,
        user_answer: userAnswer,
        score: questionScore,
      };
    });

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= passingScore;
    const status = needsManualGrading ? 'pending_grading' : (passed ? 'passed' : 'failed');

    if (sessionId) {
      await supabase
        .from('cbt_sessions')
        .update({
          answers: answers as any,
          status,
          score: percentage,
          end_time: new Date().toISOString(),
          needs_grading: needsManualGrading,
        })
        .eq('id', sessionId);
    } else {
      await supabase
        .from('cbt_sessions')
        .insert([{
          exam_id: examId,
          user_id: userId,
          answers: answers as any,
          status,
          score: percentage,
          start_time: payload.startTime,
          end_time: new Date().toISOString(),
          needs_grading: needsManualGrading,
        }]);
    }

    return {
      result: {
        score,
        totalPoints,
        percentage,
        status,
        passed,
        needsManualGrading,
        manualGradingRequired: needsManualGrading,
      },
    };
  }

  async startExam(examId: string, userId: string) {
    const { data: exam, error: examError } = await supabase.from('cbt_exams').select('*').eq('id', examId).single();
    if (examError || !exam) throw new Error('Exam not found');
    if (!exam.is_active) throw new Error('Exam is not currently active');

    // Create session record
    const { data: session, error: sessionError } = await supabase
      .from('cbt_sessions')
      .insert([{
        exam_id: examId,
        user_id: userId,
        status: 'in_progress',
        start_time: new Date().toISOString()
      }])
      .select()
      .single();

    if (sessionError) throw sessionError;

    const { questions } = await this.getExam(examId);

    return {
      sessionId: session.id,
      exam,
      questions
    };
  }

  async saveProgress(sessionId: string, answers: any) {
    const { error } = await supabase
      .from('cbt_sessions')
      .update({ answers })
      .eq('id', sessionId)
      .eq('status', 'in_progress');
    if (error) throw error;
    return true;
  }

  async recordTabSwitch(sessionId: string) {
    const { data: session, error: readError } = await supabase
      .from('cbt_sessions')
      .select('manual_scores')
      .eq('id', sessionId)
      .single();

    if (readError) return;

    const prev = (session?.manual_scores as Record<string, unknown> | null) ?? {};
    const tabSwitches = Number(prev.tab_switches ?? 0) + 1;

    await supabase
      .from('cbt_sessions')
      .update({
        manual_scores: { ...prev, tab_switches: tabSwitches } as Json,
      })
      .eq('id', sessionId);
  }

  /** Editor / admin: ordered question rows for one exam. */
  async listCbtQuestionRows(examId: string) {
    const { data, error } = await supabase
      .from('cbt_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Database['public']['Tables']['cbt_questions']['Row'][];
  }

  async listCbtQuestionIdsForExam(examId: string) {
    const { data } = await supabase.from('cbt_questions').select('id').eq('exam_id', examId);
    return (data ?? []).map((r) => r.id);
  }

  async deleteCbtQuestion(id: string) {
    const { error } = await supabase.from('cbt_questions').delete().eq('id', id);
    if (error) throw error;
  }

  async updateCbtQuestion(id: string, payload: Database['public']['Tables']['cbt_questions']['Update']) {
    const { error } = await supabase.from('cbt_questions').update(payload).eq('id', id);
    if (error) throw error;
  }

  async insertCbtQuestion(payload: Database['public']['Tables']['cbt_questions']['Insert']) {
    const { error } = await supabase.from('cbt_questions').insert(payload).select('id').single();
    if (error) throw error;
  }

  async createExamReturningId(row: Database['public']['Tables']['cbt_exams']['Insert']) {
    const { data, error } = await supabase.from('cbt_exams').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to save CBT');
    return data.id;
  }

  async insertCbtQuestions(rows: Database['public']['Tables']['cbt_questions']['Insert'][]) {
    if (!rows.length) return;
    const { error } = await supabase.from('cbt_questions').insert(rows);
    if (error) throw error;
  }

  /** CBT hub screen: exam catalogue, teacher grading queue, student session history. */
  async loadCbtHubBundle(params: {
    userId: string;
    isStudent: boolean;
    isTeacherRole: boolean;
    isAdmin: boolean;
  }) {
    let examQuery = supabase
      .from('cbt_exams')
      .select('id, title, description, duration_minutes, passing_score, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (params.isTeacherRole && !params.isAdmin) {
      examQuery = examQuery.eq('created_by', params.userId);
    }

    const { data: examData } = await examQuery;

    const mappedExams = (examData ?? []).map((exam: any) => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      exam_type: exam.metadata?.exam_type ?? 'examination',
      difficulty: exam.metadata?.difficulty ?? null,
      duration_minutes: exam.duration_minutes ?? null,
      pass_mark: exam.passing_score ?? null,
      created_at: exam.created_at ?? null,
    }));

    let pendingGrades: {
      id: string;
      exam_title: string;
      student_name: string;
      completed_at: string | null;
    }[] = [];

    const author = params.isAdmin || params.isTeacherRole;
    if (author && mappedExams.length > 0) {
      const examIds = mappedExams.map((e) => e.id);
      const { data: pend } = await supabase
        .from('cbt_sessions')
        .select('id, end_time, user_id, exam_id, cbt_exams(title)')
        .in('exam_id', examIds)
        .eq('needs_grading', true)
        .order('end_time', { ascending: false })
        .limit(30);
      const rows = (pend ?? []) as any[];
      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (uids.length > 0) {
        const { data: profs } = await supabase.from('portal_users').select('id, full_name').in('id', uids);
        for (const p of profs ?? []) names[p.id] = p.full_name ?? '';
      }
      pendingGrades = rows.map((r) => {
        const ex = r.cbt_exams;
        const title = Array.isArray(ex) ? ex[0]?.title : ex?.title;
        return {
          id: r.id,
          exam_title: title ?? 'Exam',
          student_name: r.user_id ? names[r.user_id] || 'Student' : 'Student',
          completed_at: r.end_time ?? null,
        };
      });
    }

    let mySessions: {
      id: string;
      exam_id: string;
      exam_title: string;
      score: number | null;
      status: string | null;
      completed_at: string | null;
    }[] = [];

    if (params.isStudent) {
      const { data: sessions } = await supabase
        .from('cbt_sessions')
        .select(
          `
          id, score, status, end_time, exam_id,
          cbt_exams:exam_id(title)
        `,
        )
        .eq('user_id', params.userId)
        .order('created_at', { ascending: false })
        .limit(30);

      mySessions = (sessions ?? []).map((s: any) => ({
        id: s.id,
        exam_id: s.exam_id,
        score: s.score,
        status: s.status,
        completed_at: s.end_time,
        exam_title: s.cbt_exams?.title ?? 'Unknown Exam',
      }));
    }

    return { exams: mappedExams, pendingGrades, mySessions };
  }

  async loadProgramsCoursesForExamEditor(params: { role: string | undefined; schoolId: string | null | undefined }) {
    let pq = supabase.from('programs').select('id, name').eq('is_active', true).order('name');
    if (params.role !== 'admin' && params.schoolId) pq = pq.eq('school_id', params.schoolId);
    let cq = supabase.from('courses').select('id, title, program_id').eq('is_active', true).order('title');
    if (params.role !== 'admin' && params.schoolId) cq = cq.eq('school_id', params.schoolId);
    const [{ data: prog, error: pErr }, { data: crs, error: cErr }] = await Promise.all([pq, cq]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;
    return {
      programs: (prog ?? []) as { id: string; name: string }[],
      courses: (crs ?? []) as { id: string; title: string; program_id: string | null }[],
    };
  }

  async getCbtExamRowById(examId: string) {
    const { data, error } = await supabase.from('cbt_exams').select('*').eq('id', examId).single();
    if (error) throw error;
    return data;
  }

  async insertCbtExamForEditor(row: Database['public']['Tables']['cbt_exams']['Insert']) {
    const { data, error } = await supabase.from('cbt_exams').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Could not create exam');
    return data.id;
  }

  async updateCbtExamShell(examId: string, payload: Database['public']['Tables']['cbt_exams']['Update']) {
    const { error } = await supabase.from('cbt_exams').update(payload).eq('id', examId);
    if (error) throw error;
  }

  async listCbtQuestionsForEditorRefresh(examId: string) {
    return this.listCbtQuestionRows(examId);
  }

  private parseSessionAnswers(raw: Json | null): Record<string, string> {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = v == null ? '' : String(v);
    }
    return out;
  }

  private autoScoreMcqPoints(
    questions: { id: string; question_type: string | null; points: number | null; correct_answer: string | null }[],
    answers: Record<string, string>,
  ) {
    let score = 0;
    for (const q of questions) {
      const type = q.question_type ?? 'multiple_choice';
      if (type === 'essay') continue;
      const pts = q.points ?? 1;
      const studentAns = (answers[q.id] || '').trim().toLowerCase();
      const correctAns = (q.correct_answer || '').trim().toLowerCase();
      if (studentAns && studentAns === correctAns) score += pts;
    }
    return score;
  }

  async loadSessionForManualGrading(params: {
    sessionId: string;
    profile: { id: string; role: string | undefined };
  }) {
    const { data: session, error: sErr } = await supabase
      .from('cbt_sessions')
      .select('id, exam_id, user_id, answers, needs_grading, manual_scores, grading_notes, cbt_exams(id, title, passing_score, created_by)')
      .eq('id', params.sessionId)
      .single();
    if (sErr || !session) throw sErr || new Error('Session not found');

    const exam = session.cbt_exams as { id: string; title: string; passing_score: number | null; created_by: string | null } | null;
    if (!exam) throw new Error('Exam missing');

    const isAdmin = params.profile.role === 'admin';
    const isOwner = exam.created_by === params.profile.id;
    if (!isAdmin && !isOwner) {
      const err = new Error('ACCESS_DENIED');
      (err as { code?: string }).code = 'ACCESS_DENIED';
      throw err;
    }

    if (!session.needs_grading) {
      const err = new Error('ALREADY_GRADED');
      (err as { code?: string }).code = 'ALREADY_GRADED';
      throw err;
    }

    const { data: qRows, error: qErr } = await supabase
      .from('cbt_questions')
      .select('id, question_text, question_type, points, correct_answer')
      .eq('exam_id', exam.id)
      .order('order_index', { ascending: true });
    if (qErr) throw qErr;

    const qs = (qRows ?? []) as {
      id: string;
      question_text: string;
      question_type: string | null;
      points: number | null;
      correct_answer: string | null;
    }[];
    const ans = this.parseSessionAnswers(session.answers as Json);
    const totalPts = qs.reduce((s, q) => s + (q.points ?? 1), 0);
    const autoPts = this.autoScoreMcqPoints(qs, ans);

    let studentName = 'Student';
    if (session.user_id) {
      const { data: pu } = await supabase.from('portal_users').select('full_name').eq('id', session.user_id).maybeSingle();
      studentName = (pu as { full_name: string | null } | null)?.full_name ?? 'Student';
    }

    const gradingNotes =
      session.grading_notes && session.grading_notes !== 'Awaiting manual review' ? session.grading_notes : '';

    return {
      examTitle: exam.title ?? 'Exam',
      passingScore: exam.passing_score ?? 70,
      studentName,
      questions: qs,
      answers: ans,
      autoPts,
      totalPts,
      gradingNotes,
    };
  }

  async saveManualGradingSession(params: {
    sessionId: string;
    profileId: string;
    percentage: number;
    passed: boolean;
    gradingNotes: string | null;
    manualScores: Json;
  }) {
    const { error } = await supabase
      .from('cbt_sessions')
      .update({
        needs_grading: false,
        score: params.percentage,
        status: params.passed ? 'passed' : 'failed',
        grading_notes: params.gradingNotes,
        manual_scores: params.manualScores,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.sessionId);
    if (error) throw error;
  }
}

export const cbtService = new CBTService();

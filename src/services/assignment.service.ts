import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Assignment = Database['public']['Tables']['assignments']['Row'];
export type Submission = Database['public']['Tables']['assignment_submissions']['Row'];

export class AssignmentService {
  private async resolveStudentAssignmentScope(userId: string): Promise<{ classIds: string[]; courseIds: string[] }> {
    const [{ data: profile }, { data: enrollments }] = await Promise.all([
      supabase.from('portal_users').select('class_id').eq('id', userId).maybeSingle(),
      supabase.from('enrollments').select('program_id').eq('user_id', userId),
    ]);

    const classIds = new Set<string>();
    const courseIds = new Set<string>();

    if (profile?.class_id) classIds.add(profile.class_id);

    const programIds = (enrollments ?? [])
      .map((row: { program_id: string | null }) => row.program_id)
      .filter(Boolean) as string[];

    if (programIds.length) {
      const [{ data: classes }, { data: courses }] = await Promise.all([
        supabase.from('classes').select('id').in('program_id', programIds),
        supabase.from('courses').select('id').in('program_id', programIds),
      ]);
      for (const row of classes ?? []) {
        if (row.id) classIds.add(row.id);
      }
      for (const row of courses ?? []) {
        if (row.id) courseIds.add(row.id);
      }
    }

    return { classIds: Array.from(classIds), courseIds: Array.from(courseIds) };
  }

  async listAssignments(params: {
    role: string;
    userId: string;
    schoolId?: string | null;
  }) {
    const { role, userId, schoolId } = params;
    const isStaff = role === 'admin' || role === 'teacher' || role === 'school';
    
    if (isStaff) {
      let query = supabase
        .from('assignments')
        .select(`
          *,
          courses(title, programs(name)),
          assignment_submissions(id, status)
        `)
        .order('created_at', { ascending: false })
        .limit(80);

      if (role === 'teacher') {
        query = query.eq('created_by', userId);
      } else if (role === 'school' && schoolId) {
        const { data: schoolClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', schoolId);
        const classIds = (schoolClasses ?? []).map((c: any) => c.id);
        if (classIds.length > 0) query = query.in('class_id', classIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((asgn: any) => ({
        ...asgn,
        submissionCount: asgn.assignment_submissions?.length ?? 0,
        submittedCount: asgn.assignment_submissions?.filter((s: any) => s.status === 'submitted').length ?? 0,
        gradedCount: asgn.assignment_submissions?.filter((s: any) => s.status === 'graded').length ?? 0,
      }));
    } else {
      // Student view: list active assignments + their own submissions
      const scope = await this.resolveStudentAssignmentScope(userId);

      let assignmentsQuery = supabase
        .from('assignments')
        .select('*, courses(title, programs(name))')
        .eq('is_active', true)
        .order('due_date', { ascending: true })
        .limit(80);

      const scopedClass = scope.classIds.length
        ? `class_id.in.(${scope.classIds.join(',')})`
        : '';
      const scopedCourse = scope.courseIds.length
        ? `course_id.in.(${scope.courseIds.join(',')})`
        : '';
      const scopeFilters = [scopedClass, scopedCourse].filter(Boolean).join(',');
      if (scopeFilters) assignmentsQuery = assignmentsQuery.or(scopeFilters);
      else assignmentsQuery = assignmentsQuery.is('id', null);

      const [{ data: assignments }, { data: submissions }] = await Promise.all([
        assignmentsQuery,
        supabase
          .from('assignment_submissions')
          .select('*')
          .eq('portal_user_id', userId)
      ]);

      const subMap = new Map((submissions ?? []).map(s => [s.assignment_id, s]));
      return (assignments ?? []).map(asgn => ({
        ...asgn,
        submission: subMap.get(asgn.id) || null
      }));
    }
  }

  async getAssignmentDetail(assignmentId: string, userId?: string, isStaff: boolean = false) {
    const { data: asgn, error } = await supabase
      .from('assignments')
      .select('*, courses(title, programs(name)), classes(name)')
      .eq('id', assignmentId)
      .single();

    if (error) throw error;

    let submissions = [];
    if (isStaff) {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, portal_users:portal_user_id(full_name)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });
      submissions = (data ?? []).map((s: any) => ({
        ...s,
        student_name: s.portal_users?.full_name ?? 'Student'
      }));
    } else if (userId) {
      const visibleAssignments = await this.listAssignments({ role: 'student', userId, schoolId: null });
      const canView = (visibleAssignments as { id: string }[]).some((assignment) => assignment.id === assignmentId);
      if (!canView) throw new Error('You are not allowed to view this assignment.');

      const { data } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('portal_user_id', userId)
        .maybeSingle();
      if (data) submissions = [data];
    }

    return {
      assignment: asgn,
      submissions
    };
  }

  async submitAssignment(params: {
    assignmentId: string;
    userId: string;
    submissionText: string;
    existingSubmissionId?: string;
    /** Photo / PDF URL after R2 upload (web `/api/assignments/:id/submit` `file_url`). */
    fileUrl?: string | null;
  }) {
    const { assignmentId, userId, submissionText, existingSubmissionId, fileUrl } = params;
    const text = submissionText.trim();

    const { data: assignmentRow, error: assignmentError } = await supabase
      .from('assignments')
      .select('due_date, metadata')
      .eq('id', assignmentId)
      .single();
    if (assignmentError) throw assignmentError;

    const dueDate = assignmentRow?.due_date ? new Date(assignmentRow.due_date) : null;
    const metadata = assignmentRow?.metadata && typeof assignmentRow.metadata === 'object' && !Array.isArray(assignmentRow.metadata)
      ? assignmentRow.metadata as Record<string, unknown>
      : null;
    const allowLate = metadata?.allow_late !== false;
    const isLateNow = !!dueDate && dueDate.getTime() < Date.now();
    if (!allowLate && isLateNow) {
      throw new Error('This assignment is closed. Late submissions are not allowed.');
    }

    const base = {
      submission_text: text.length ? text : null,
      status: 'submitted' as const,
      submitted_at: new Date().toISOString(),
      file_url: fileUrl ?? null,
    };

    if (existingSubmissionId) {
      const updatePayload: Database['public']['Tables']['assignment_submissions']['Update'] = base;
      const { error } = await supabase.from('assignment_submissions').update(updatePayload).eq('id', existingSubmissionId);
      if (error) throw error;
    } else {
      const insertPayload: Database['public']['Tables']['assignment_submissions']['Insert'] = {
        ...base,
        assignment_id: assignmentId,
        portal_user_id: userId,
      };
      const { error } = await supabase.from('assignment_submissions').insert(insertPayload);
      if (error) throw error;
    }
    return true;
  }

  /** Assignments the student still needs to hand in (no row, or not yet submitted / graded). */
  async countStudentAssignmentsTodo(userId: string): Promise<number> {
    const rows = await this.listAssignments({ role: 'student', userId, schoolId: null });
    let n = 0;
    for (const a of rows as any[]) {
      const sub = a.submission as { status?: string | null } | null | undefined;
      if (!sub) {
        n += 1;
        continue;
      }
      if (sub.status === 'graded') continue;
      if (sub.status === 'submitted') continue;
      n += 1;
    }
    return n;
  }

  async countSubmissionsForPortalUser(portalUserId: string) {
    const { count, error } = await supabase
      .from('assignment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('portal_user_id', portalUserId);
    if (error) throw error;
    return count ?? 0;
  }

  async gradeSubmission(params: {
    submissionId: string;
    graderId: string;
    grade: number;
    feedback?: string;
  }) {
    const { submissionId, graderId, grade, feedback } = params;
    const [{ data: grader, error: graderError }, { data: submissionRow, error: submissionError }] = await Promise.all([
      supabase.from('portal_users').select('id, role, school_id').eq('id', graderId).single(),
      supabase
        .from('assignment_submissions')
        .select('id, assignment_id')
        .eq('id', submissionId)
        .single(),
    ]);
    if (graderError) throw graderError;
    if (submissionError) throw submissionError;

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, created_by, school_id')
      .eq('id', submissionRow.assignment_id ?? '')
      .single();
    if (assignmentError) throw assignmentError;

    const role = grader.role;
    const isAdmin = role === 'admin';
    const isSchool = role === 'school' && !!grader.school_id && grader.school_id === assignment.school_id;
    const isTeacherOwner = role === 'teacher' && assignment.created_by === grader.id;
    if (!isAdmin && !isSchool && !isTeacherOwner) {
      throw new Error('You are not authorized to grade this submission.');
    }

    const { error } = await supabase
      .from('assignment_submissions')
      .update({
        grade,
        feedback: feedback || null,
        status: 'graded',
        graded_by: graderId,
        graded_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) throw error;
    return true;
  }

  async getAssignmentForEditor(assignmentId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(
        'id, title, description, instructions, assignment_type, max_points, due_date, metadata, course_id, lesson_id, class_id, classes(name)',
      )
      .eq('id', assignmentId)
      .single();
    if (error) throw error;
    return data;
  }

  async createAssignment(row: Database['public']['Tables']['assignments']['Insert']) {
    const { error } = await supabase.from('assignments').insert(row);
    if (error) throw error;
  }

  async createAssignmentReturningSummary(row: Database['public']['Tables']['assignments']['Insert']) {
    const { data, error } = await supabase.from('assignments').insert(row).select('id,title').single();
    if (error) throw error;
    if (!data) throw new Error('Failed to save assignment');
    return data;
  }

  async updateAssignment(assignmentId: string, updates: Database['public']['Tables']['assignments']['Update']) {
    const { error } = await supabase.from('assignments').update(updates).eq('id', assignmentId);
    if (error) throw error;
  }

  /** Lesson editor: existing assignment titles on a lesson (normalized for duplicate checks). */
  async listNormalizedAssignmentTitlesForLesson(lessonId: string): Promise<string[]> {
    const { data, error } = await supabase.from('assignments').select('title').eq('lesson_id', lessonId);
    if (error) throw error;
    return (data ?? []).map((a) => (a.title ?? '').trim().toLowerCase()).filter(Boolean);
  }

  /** Class detail: submission counts + per-student grade normalization. */
  async listSubmissionsForGradeAggregation(assignmentIds: string[]) {
    if (!assignmentIds.length) return [];
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('assignment_id, portal_user_id, grade')
      .in('assignment_id', assignmentIds);
    if (error) throw error;
    return data ?? [];
  }

  async countAssignmentsByCreator(teacherId: string) {
    const { count, error } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', teacherId);
    if (error) throw error;
    return count ?? 0;
  }
}

export const assignmentService = new AssignmentService();

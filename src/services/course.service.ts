import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export type Course = Database['public']['Tables']['courses']['Row'];
/** Row from `listCourses` (includes joined `programs(name)`). */
export type CourseListRow = Course & { programs?: { name: string } | null };
export type Program = Database['public']['Tables']['programs']['Row'];
export type Lesson = Database['public']['Tables']['lessons']['Row'];
export type LiveSession = Database['public']['Tables']['live_sessions']['Row'];
export type Enrollment = Database['public']['Tables']['enrollments']['Row'];
export type Progress = Database['public']['Tables']['student_progress']['Row'];

export type CourseWithDetail = Course & {
  lessons: Lesson[];
  live_sessions: LiveSession[];
  teacher_name?: string | null;
};

export type EnrollmentWithContact = Enrollment & {
  user_name?: string | null;
  user_email?: string | null;
};

export class CourseService {
  /** First active course in a programme (for Learn tab `programId`-only navigation). */
  /** Class detail: map lessons to course titles within a programme. */
  async listCourseIdsTitlesForProgram(programId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title')
      .eq('program_id', programId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []) as { id: string; title: string }[];
  }

  async listLessonsForCourseIds(courseIds: string[]) {
    if (!courseIds.length) return [];
    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, lesson_type, status, course_id')
      .in('course_id', courseIds)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async resolveFirstCourseIdForProgram(programId: string, isStaff: boolean): Promise<string | null> {
    let q = supabase
      .from('courses')
      .select('id')
      .eq('program_id', programId)
      .eq('is_active', true);
    if (!isStaff) q = q.eq('is_locked', false);
    const { data, error } = await q
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0]?.id ?? null;
  }
  async listCourses(params: {
    programId?: string;
    role?: string;
    userId?: string;
    schoolId?: string | null;
  }) {
    const { programId, role, userId, schoolId } = params;
    
    let query = supabase
      .from('courses')
      .select('*, programs(name)')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (programId) query = query.eq('program_id', programId);
    
    if (role === 'school' && schoolId) {
      query = query.eq('school_id', schoolId);
    } else if (role === 'teacher') {
      if (schoolId) query = query.eq('school_id', schoolId);
      else if (userId) query = query.eq('teacher_id', userId);
    } else if (role === 'student' && userId) {
      const { data: enrollments } = await supabase.from('enrollments').select('program_id').eq('user_id', userId);
      const programIds = (enrollments ?? []).map((item: any) => item.program_id).filter(Boolean);
      if (!programIds.length) return [];
      query = query.in('program_id', programIds).eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CourseListRow[];
  }

  async getCourseDetail(courseId: string, userId?: string, isStaff: boolean = false) {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*, lessons(*)')
      .eq('id', courseId)
      .single();

    if (error) throw error;
    if (!isStaff && course.is_locked) {
      throw new Error('This course is locked.');
    }

    const lessons = ((course as { lessons?: Lesson[] }).lessons ?? []).slice().sort((a, b) => {
      const oa = a.order_index ?? 999999;
      const ob = b.order_index ?? 999999;
      if (oa !== ob) return oa - ob;
      const ca = a.created_at ?? '';
      const cb = b.created_at ?? '';
      return ca.localeCompare(cb);
    });

    let live_sessions: LiveSession[] = [];
    if (course.program_id) {
      const { data: sessionRows, error: sessionError } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('program_id', course.program_id)
        .order('scheduled_at', { ascending: true });
      if (sessionError) throw sessionError;
      live_sessions = (sessionRows ?? []) as LiveSession[];
    }

    let teacher_name: string | null = null;
    if (course.teacher_id) {
      const { data: teacherRow } = await supabase
        .from('portal_users')
        .select('full_name')
        .eq('id', course.teacher_id)
        .maybeSingle();
      teacher_name = teacherRow?.full_name ?? null;
    }

    let progress = null;
    if (userId && !isStaff) {
      const { data: progData } = await supabase
        .from('student_progress')
        .select('*')
        .eq('course_id', courseId)
        .eq('portal_user_id', userId)
        .maybeSingle();
      progress = progData;
    }

    const { lessons: _nested, ...courseBase } = course as Course & { lessons?: Lesson[] };
    const courseOut: CourseWithDetail = {
      ...(courseBase as Course),
      lessons,
      live_sessions,
      teacher_name,
    };

    return {
      course: courseOut,
      progress: progress as Progress | null,
    };
  }

  /** Programme row, sibling courses, and enrollments with contact names (for course detail sidebar). */
  async getProgramEnrollmentContext(
    programId: string,
    profileId: string,
    isStaff: boolean,
  ): Promise<{
    program: Program | null;
    siblings: Course[];
    enrollments: EnrollmentWithContact[];
  }> {
    const [programRes, siblingRes, enrollmentRes] = await Promise.all([
      supabase.from('programs').select('*').eq('id', programId).maybeSingle(),
      supabase
        .from('courses')
        .select('*')
        .eq('program_id', programId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('enrollments')
        .select('*, portal_users(full_name, email)')
        .eq('program_id', programId)
        .order('enrollment_date', { ascending: false }),
    ]);

    if (programRes.error) throw programRes.error;
    if (siblingRes.error) throw siblingRes.error;
    if (enrollmentRes.error) throw enrollmentRes.error;

    const siblingRows = (siblingRes.data ?? []) as Course[];
    const siblings = isStaff ? siblingRows : siblingRows.filter((c) => !c.is_locked);

    type ERow = Enrollment & {
      portal_users?: { full_name: string | null; email: string | null } | null;
    };
    const raw = (enrollmentRes.data ?? []) as ERow[];
    const visible = isStaff ? raw : raw.filter((e) => e.user_id === profileId);
    const enrollments: EnrollmentWithContact[] = visible.map((e) => ({
      ...e,
      user_name: e.portal_users?.full_name ?? null,
      user_email: e.portal_users?.email ?? null,
    }));

    return {
      program: programRes.data ?? null,
      siblings,
      enrollments,
    };
  }

  async deleteCourse(courseId: string) {
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) throw error;
    return true;
  }

  async linkCourseToProgram(courseId: string, programId: string) {
    const { data: programRow, error: programError } = await supabase
      .from('programs')
      .select('school_id')
      .eq('id', programId)
      .single();
    if (programError) throw programError;

    let schoolName: string | null = null;
    if (programRow?.school_id) {
      const { data: schoolRow } = await supabase
        .from('schools')
        .select('name')
        .eq('id', programRow.school_id)
        .maybeSingle();
      schoolName = schoolRow?.name ?? null;
    }

    const { error } = await supabase
      .from('courses')
      .update({
        program_id: programId,
        school_id: programRow?.school_id ?? null,
        school_name: schoolName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (error) throw error;
    return true;
  }

  async updateLessonProgress(params: {
    userId: string;
    courseId: string;
    lessonId: string;
    status: 'completed' | 'in_progress';
    /** Added to time_spent_minutes when merging with existing row (e.g. on complete). */
    incrementMinutes?: number;
  }) {
    const { userId, lessonId, status, incrementMinutes, courseId } = params;

    const { data: existing } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('portal_user_id', userId)
      .maybeSingle();

    const now = new Date().toISOString();
    let minutes = existing?.time_spent_minutes ?? 0;
    if (incrementMinutes && incrementMinutes > 0) minutes += incrementMinutes;

    const row: Database['public']['Tables']['lesson_progress']['Insert'] = {
      portal_user_id: userId,
      lesson_id: lessonId,
      status,
      progress_percentage:
        status === 'completed' ? 100 : Math.max(existing?.progress_percentage ?? 0, 10),
      last_accessed_at: now,
      time_spent_minutes: minutes,
      updated_at: now,
      completed_at: status === 'completed' ? now : existing?.completed_at ?? null,
    };

    const { error } = await supabase.from('lesson_progress').upsert(row, {
      onConflict: 'lesson_id,portal_user_id',
    });

    if (error) throw error;

    if (courseId) {
      const [{ data: lessonRows }, { data: assignmentRows }] = await Promise.all([
        supabase
          .from('lessons')
          .select('id')
          .eq('course_id', courseId)
          .in('status', ['published', 'active']),
        supabase
          .from('assignments')
          .select('id')
          .eq('course_id', courseId)
          .eq('is_active', true),
      ]);

      const lessonIds = (lessonRows ?? []).map((item) => item.id).filter(Boolean);
      let lessonsCompleted = 0;
      if (lessonIds.length) {
        const { count } = await supabase
          .from('lesson_progress')
          .select('id', { count: 'exact', head: true })
          .eq('portal_user_id', userId)
          .in('lesson_id', lessonIds)
          .eq('status', 'completed');
        lessonsCompleted = count ?? 0;
      }

      const totalLessons = lessonIds.length;
      const totalAssignments = (assignmentRows ?? []).length;
      const nowIso = new Date().toISOString();
      const completedAt = totalLessons > 0 && lessonsCompleted >= totalLessons ? nowIso : null;

      await supabase.from('student_progress').upsert(
        {
          portal_user_id: userId,
          student_id: userId,
          course_id: courseId,
          lessons_completed: lessonsCompleted,
          total_lessons: totalLessons,
          total_assignments: totalAssignments,
          started_at: existing?.last_accessed_at ?? nowIso,
          completed_at: completedAt,
          updated_at: nowIso,
        },
        { onConflict: 'portal_user_id,course_id' },
      );
    }

    return true;
  }

  async scheduleLiveSession(payload: Database['public']['Tables']['live_sessions']['Insert']) {
    const { error } = await supabase
      .from('live_sessions')
      .insert(payload);
    
    if (error) throw error;
    return true;
  }

  async getLessonDetail(lessonId: string, userId?: string, isStaff: boolean = false) {
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*, courses(id, title)')
      .eq('id', lessonId)
      .single();

    if (lessonError) throw lessonError;

    if (!isStaff && lesson.status && lesson.status !== 'published' && lesson.status !== 'active') {
      throw new Error('Lesson unavailable');
    }

    const [materials, assignments, lessonPlan, progressRes] = await Promise.all([
      supabase.from('lesson_materials').select('*').eq('lesson_id', lessonId).order('created_at'),
      supabase.from('assignments').select('*').eq('lesson_id', lessonId).eq('is_active', true).order('created_at'),
      supabase.from('lesson_plans').select('*').eq('lesson_id', lessonId).maybeSingle(),
      userId ? supabase.from('lesson_progress').select('*').eq('lesson_id', lessonId).eq('portal_user_id', userId).maybeSingle() : { data: null }
    ]);

    let siblings: { id: string; title: string }[] = [];
    if (lesson.course_id) {
      const { data } = await supabase
        .from('lessons')
        .select('id, title')
        .eq('course_id', lesson.course_id)
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      siblings = data ?? [];
    }

    return {
      lesson,
      materials: materials.data ?? [],
      assignments: assignments.data ?? [],
      lessonPlan: lessonPlan.data,
      siblings,
      progress: progressRes.data,
    };
  }
  async listPrograms(schoolId?: string | null) {
    let query = supabase
      .from('programs')
      .select('id, name, school_id')
      .order('name', { ascending: true });

    if (schoolId) query = query.eq('school_id', schoolId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async listUserEnrollmentsSummary(userId: string) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, program_id, progress_pct, status')
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  }

  /** For Learn hub: active courses with programme + lock flags. */
  async listActiveCourseProgramStats() {
    const { data, error } = await supabase
      .from('courses')
      .select('program_id, is_locked')
      .eq('is_active', true)
      .not('program_id', 'is', null);
    if (error) throw error;
    return data ?? [];
  }

  /** Staff lesson directory (role filters match business access). */
  async listLessonsDirectory(params: { isStaff: boolean; role: string; userId?: string; limit?: number }) {
    const limit = params.limit ?? 120;
    let query = supabase
      .from('lessons')
      .select(
        `id, title, lesson_type, course_id, duration_minutes, order_index, status, created_at, created_by, courses ( title, programs ( name ) )`,
      )
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!params.isStaff) query = query.eq('status', 'active');
    if (params.role === 'teacher' && params.userId) query = query.eq('created_by', params.userId);

    const { data, error } = await query.limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updateLessonStatus(lessonId: string, status: string) {
    const { error } = await supabase
      .from('lessons')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', lessonId);
    if (error) throw error;
    return true;
  }

  async updateLesson(lessonId: string, updates: Database['public']['Tables']['lessons']['Update']) {
    const { error } = await supabase.from('lessons').update(updates).eq('id', lessonId);
    if (error) throw error;
  }

  /** Lesson editor: active programmes (picker). */
  async listActiveProgramsForEditor() {
    const { data, error } = await supabase.from('programs').select('id, name').eq('is_active', true).order('name');
    if (error) throw error;
    return data ?? [];
  }

  /** Lesson editor: active courses with programme name; optional school scope (matches prior `or` filter). */
  async listCoursesForLessonEditor(schoolId?: string | null) {
    let q = supabase
      .from('courses')
      .select('id, title, program_id, school_id, programs(name)')
      .eq('is_active', true);
    if (schoolId) {
      q = q.or(`school_id.eq.${schoolId},school_id.is.null`);
    }
    const { data, error } = await q.order('title');
    if (error) throw error;
    return data ?? [];
  }

  async getLessonRow(lessonId: string) {
    const { data, error } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (error) throw error;
    return data as Lesson;
  }

  async getCourseProgramAndTitle(courseId: string) {
    const { data } = await supabase.from('courses').select('program_id, title').eq('id', courseId).maybeSingle();
    return data ?? null;
  }

  async getLessonPlanObjectives(lessonId: string) {
    const { data } = await supabase.from('lesson_plans').select('objectives').eq('lesson_id', lessonId).maybeSingle();
    return data?.objectives ?? null;
  }

  /** Titles of other lessons in the same course (for AI sibling context). */
  async listSiblingLessonTitles(courseId: string, excludeLessonId?: string) {
    let q = supabase.from('lessons').select('title').eq('course_id', courseId).limit(20);
    if (excludeLessonId) q = q.neq('id', excludeLessonId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => r.title).filter(Boolean) as string[];
  }

  async getClassProgramId(classId: string) {
    const { data } = await supabase.from('classes').select('program_id').eq('id', classId).maybeSingle();
    return data?.program_id ?? null;
  }

  async listCourseTitlesForProgram(programId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title')
      .eq('program_id', programId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listLessonsMinimalForCourse(courseId: string) {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, course_id')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /** Count courses per programme id (for programme list UI). */
  async countCoursesByProgram(): Promise<Record<string, number>> {
    const { data } = await supabase.from('courses').select('program_id');
    const counts: Record<string, number> = {};
    (data ?? []).forEach((item: { program_id: string | null }) => {
      if (!item.program_id) return;
      counts[item.program_id] = (counts[item.program_id] || 0) + 1;
    });
    return counts;
  }

  /**
   * Recent lessons / assignments / courses + programme name for AI Tutor context
   * (same filters as the former AIScreen inline queries).
   */
  async getAiTutorContentContext(profile: {
    id: string;
    role?: string;
    school_id?: string | null;
  }): Promise<{
    activeCourse: string | null;
    activeProgram: string | null;
    recentLessonTitles: string[];
    recentAssignmentTitles: string[];
  }> {
    if (!profile?.id) {
      return {
        activeCourse: null,
        activeProgram: null,
        recentLessonTitles: [],
        recentAssignmentTitles: [],
      };
    }

    let lessonsQuery = supabase
      .from('lessons')
      .select('title,course_id,created_at')
      .order('created_at', { ascending: false })
      .limit(4);

    let assignmentsQuery = supabase
      .from('assignments')
      .select('title,due_date,created_at')
      .order('created_at', { ascending: false })
      .limit(4);

    let coursesQuery = supabase
      .from('courses')
      .select('id,title,program_id,updated_at')
      .order('updated_at', { ascending: false })
      .limit(4);

    if (profile.role === 'teacher') {
      lessonsQuery = lessonsQuery.eq('created_by', profile.id);
      assignmentsQuery = assignmentsQuery.eq('created_by', profile.id);
      coursesQuery = coursesQuery.eq('teacher_id', profile.id);
    } else if (profile.school_id) {
      lessonsQuery = lessonsQuery.eq('school_id', profile.school_id);
      assignmentsQuery = assignmentsQuery.eq('school_id', profile.school_id);
      coursesQuery = coursesQuery.eq('school_id', profile.school_id);
    }

    const [{ data: lessonsData }, { data: assignmentsData }, { data: coursesData }] = await Promise.all([
      lessonsQuery,
      assignmentsQuery,
      coursesQuery,
    ]);

    const activeCourse = coursesData?.[0]?.title ?? null;
    let activeProgram: string | null = null;

    const firstProgramId = coursesData?.find((course) => !!course.program_id)?.program_id;
    if (firstProgramId) {
      const { data: program } = await supabase.from('programs').select('name').eq('id', firstProgramId).maybeSingle();
      activeProgram = program?.name ?? null;
    }

    return {
      activeCourse,
      activeProgram,
      recentLessonTitles: (lessonsData ?? []).map((item) => item.title).filter(Boolean) as string[],
      recentAssignmentTitles: (assignmentsData ?? []).map((item) => item.title).filter(Boolean) as string[],
    };
  }

  async insertLessonReturningId(row: Database['public']['Tables']['lessons']['Insert']) {
    const { data, error } = await supabase.from('lessons').insert(row).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Failed to save lesson');
    return data.id;
  }

  async upsertLessonPlan(row: Database['public']['Tables']['lesson_plans']['Insert']) {
    const { error } = await supabase.from('lesson_plans').upsert(row, { onConflict: 'lesson_id' });
    if (error) throw error;
  }

  /** Program / school / teacher pickers for `CourseEditorScreen`. */
  async loadCourseEditorMeta(params: { isAdmin: boolean; schoolId: string | null | undefined }) {
    const schoolFilter = params.schoolId ?? null;
    const [progRes, schoolRes, teacherRes] = await Promise.all([
      params.isAdmin
        ? supabase.from('programs').select('id, name, school_id').order('name')
        : schoolFilter
          ? supabase.from('programs').select('id, name, school_id').eq('school_id', schoolFilter).order('name')
          : supabase.from('programs').select('id, name, school_id').order('name'),
      params.isAdmin
        ? supabase.from('schools').select('id, name').eq('status', 'approved').order('name')
        : schoolFilter
          ? supabase.from('schools').select('id, name').eq('id', schoolFilter)
          : Promise.resolve({ data: [] as { id: string; name: string }[], error: null as null }),
      params.isAdmin
        ? supabase.from('portal_users').select('id, full_name').eq('role', 'teacher').eq('is_deleted', false).order('full_name')
        : schoolFilter
          ? supabase
              .from('portal_users')
              .select('id, full_name')
              .eq('role', 'teacher')
              .eq('is_deleted', false)
              .eq('school_id', schoolFilter)
              .order('full_name')
          : supabase.from('portal_users').select('id, full_name').eq('role', 'teacher').eq('is_deleted', false).order('full_name'),
    ]);
    if (progRes.error) throw progRes.error;
    if (schoolRes.error) throw schoolRes.error;
    if (teacherRes.error) throw teacherRes.error;
    return {
      programs: (progRes.data ?? []) as { id: string; name: string; school_id: string | null }[],
      schools: (schoolRes.data ?? []) as { id: string; name: string }[],
      teachers: (teacherRes.data ?? []) as { id: string; full_name: string | null }[],
    };
  }

  async getCourseRowById(courseId: string) {
    const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (error) throw error;
    return data;
  }

  async updateCourse(courseId: string, payload: Database['public']['Tables']['courses']['Update']) {
    const { error } = await supabase.from('courses').update(payload).eq('id', courseId);
    if (error) throw error;
  }

  async insertCourseReturningId(payload: Database['public']['Tables']['courses']['Insert']) {
    const { data, error } = await supabase.from('courses').insert(payload).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('Insert failed');
    return data.id;
  }
}

export const courseService = new CourseService();

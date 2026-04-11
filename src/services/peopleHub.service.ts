import { supabase } from '../lib/supabase';

export type PeopleHubSnapshot = {
  studentsTotal: number;
  studentsInactive: number;
  teachersTotal: number;
  teachersInactive: number;
  schoolsTotal: number;
  schoolsPending: number;
  parentsPortalTotal: number;
  portalInactiveAnyRole: number;
  pendingStudentRegistrations: number;
  /** Teacher-scoped */
  teacherClasses: number;
  teacherEnrolledStudents: number;
  /** Parent-scoped */
  linkedChildren: number;
};

const emptySnapshot = (): PeopleHubSnapshot => ({
  studentsTotal: 0,
  studentsInactive: 0,
  teachersTotal: 0,
  teachersInactive: 0,
  schoolsTotal: 0,
  schoolsPending: 0,
  parentsPortalTotal: 0,
  portalInactiveAnyRole: 0,
  pendingStudentRegistrations: 0,
  teacherClasses: 0,
  teacherEnrolledStudents: 0,
  linkedChildren: 0,
});

export class PeopleHubService {
  async loadSnapshot(params: {
    role: string;
    userId: string;
    schoolId?: string | null;
    parentEmail?: string | null;
  }): Promise<PeopleHubSnapshot> {
    const { role, userId, schoolId, parentEmail } = params;
    const base = emptySnapshot();

    if (role === 'parent') {
      if (!parentEmail?.trim()) return base;
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('parent_email', parentEmail.trim());
      base.linkedChildren = count ?? 0;
      return base;
    }

    if (role === 'teacher' && userId) {
      const { data: classes } = await supabase.from('classes').select('id').eq('teacher_id', userId);
      const classIds = (classes ?? []).map((c: { id: string }) => c.id);
      const enrolled = classIds.length
        ? await supabase
            .from('portal_users')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'student')
            .eq('is_deleted', false)
            .in('class_id', classIds)
        : { count: 0 };
      base.teacherClasses = classIds.length;
      base.teacherEnrolledStudents = enrolled.count ?? 0;
      base.studentsTotal = base.teacherEnrolledStudents;
      const { count: tch } = await supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('is_active', true);
      base.teachersTotal = tch ?? 0;
      return base;
    }

    if (role === 'school' && schoolId) {
      const [
        stu,
        stuIn,
        tch,
        tchIn,
        pendReg,
      ] = await Promise.all([
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', schoolId),
        supabase
          .from('portal_users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('school_id', schoolId)
          .eq('is_active', false),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', schoolId),
        supabase
          .from('portal_users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'teacher')
          .eq('school_id', schoolId)
          .eq('is_active', false),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('school_id', schoolId)
          .or('is_deleted.is.null,is_deleted.eq.false'),
      ]);
      base.studentsTotal = stu.count ?? 0;
      base.studentsInactive = stuIn.count ?? 0;
      base.teachersTotal = tch.count ?? 0;
      base.teachersInactive = tchIn.count ?? 0;
      base.pendingStudentRegistrations = pendReg.count ?? 0;

      const { count: parRows } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .not('parent_email', 'is', null);
      base.parentsPortalTotal = parRows ?? 0;

      const { count: inactivePortalCount } = await supabase
        .from('portal_users')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', false);
      base.portalInactiveAnyRole = inactivePortalCount ?? 0;
      return base;
    }

    if (role === 'admin') {
      const [
        stu,
        stuIn,
        tch,
        tchIn,
        sch,
        schPend,
        par,
        inactive,
        pendStu,
      ] = await Promise.all([
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', false),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', false),
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('schools').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
        supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('is_active', false),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .or('is_deleted.is.null,is_deleted.eq.false'),
      ]);
      base.studentsTotal = stu.count ?? 0;
      base.studentsInactive = stuIn.count ?? 0;
      base.teachersTotal = tch.count ?? 0;
      base.teachersInactive = tchIn.count ?? 0;
      base.schoolsTotal = sch.count ?? 0;
      base.schoolsPending = schPend.count ?? 0;
      base.parentsPortalTotal = par.count ?? 0;
      base.portalInactiveAnyRole = inactive.count ?? 0;
      base.pendingStudentRegistrations = pendStu.count ?? 0;
      return base;
    }

    return base;
  }
}

export const peopleHubService = new PeopleHubService();

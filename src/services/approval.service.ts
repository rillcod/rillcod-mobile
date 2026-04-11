import { supabase } from '../lib/supabase';

export type ApprovalPendingStudentRow = {
  id: string;
  full_name: string;
  student_email: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  school_id: string | null;
  school_name: string | null;
  current_class: string | null;
  grade_level: string | null;
  enrollment_type: string | null;
  goals: string | null;
  created_at: string;
  status: string;
};

export type ApprovalPendingSchoolRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  contact_person: string | null;
  student_count: number | null;
  school_type: string | null;
  status: string;
  created_at: string;
};

export type ApprovalProspectiveRow = {
  id: string;
  full_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  school_name: string | null;
  grade: string | null;
  course_interest: string | null;
  created_at: string;
};

export class ApprovalService {
  async loadApprovalsQueues() {
    const [stuRes, schRes, proRes] = await Promise.all([
      supabase
        .from('students')
        .select(
          'id, full_name, student_email, parent_email, parent_name, parent_phone, school_id, school_name, current_class, grade_level, enrollment_type, goals, created_at, status',
        )
        .eq('status', 'pending')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: true })
        .limit(50),
      supabase
        .from('schools')
        .select(
          'id, name, email, phone, city, state, contact_person, student_count, school_type, status, created_at',
        )
        .eq('status', 'pending')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: true })
        .limit(50),
      supabase
        .from('prospective_students')
        .select('id, full_name, parent_email, parent_phone, school_name, grade, course_interest, created_at')
        .eq('is_active', false)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: true })
        .limit(50),
    ]);

    if (stuRes.error) throw stuRes.error;
    if (schRes.error) throw schRes.error;
    if (proRes.error) throw proRes.error;

    return {
      pendingStudents: (stuRes.data ?? []) as ApprovalPendingStudentRow[],
      pendingSchools: (schRes.data ?? []) as ApprovalPendingSchoolRow[],
      prospective: (proRes.data ?? []) as ApprovalProspectiveRow[],
    };
  }

  /**
   * Creates Auth user (if needed), marks registration approved, upserts `portal_users` by email.
   * @returns portal row id when upsert returns one
   */
  async approvePendingStudentWithAuth(params: {
    student: ApprovalPendingStudentRow;
    email: string;
    password: string;
    approvedBy: string | null;
  }) {
    const { student, email, password, approvedBy } = params;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: student.full_name, role: 'student' } },
    });

    if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
      throw new Error(signUpError.message);
    }

    const userId = signUpData?.user?.id;

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('students')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: approvedBy,
        updated_at: now,
      })
      .eq('id', student.id);
    if (updErr) throw updErr;

    const { data: portalUser, error: portalErr } = await supabase
      .from('portal_users')
      .upsert(
        {
          ...(userId ? { id: userId } : {}),
          email,
          full_name: student.full_name,
          role: 'student',
          is_active: true,
          is_deleted: false,
          student_id: student.id,
          school_id: student.school_id,
          school_name: student.school_name,
          section_class: student.current_class,
          enrollment_type: student.enrollment_type,
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();
    if (portalErr) throw portalErr;

    return { portalUserId: portalUser?.id ?? null };
  }

  async rejectPendingStudent(studentId: string) {
    const { error } = await supabase
      .from('students')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', studentId);
    if (error) throw error;
  }

  async approvePendingSchoolWithAuth(params: {
    school: ApprovalPendingSchoolRow;
    email: string;
    password: string;
  }) {
    const { school, email, password } = params;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: school.contact_person ?? school.name, role: 'school' } },
    });

    if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
      throw new Error(signUpError.message);
    }

    const userId = signUpData?.user?.id;
    const now = new Date().toISOString();

    const { error: schErr } = await supabase
      .from('schools')
      .update({ status: 'approved', is_active: true, updated_at: now })
      .eq('id', school.id);
    if (schErr) throw schErr;

    const { error: portalErr } = await supabase.from('portal_users').upsert(
      {
        ...(userId ? { id: userId } : {}),
        email,
        full_name: school.contact_person ?? school.name,
        role: 'school',
        is_active: true,
        is_deleted: false,
        school_id: school.id,
        school_name: school.name,
      },
      { onConflict: 'email' },
    );
    if (portalErr) throw portalErr;
  }

  async rejectPendingSchool(schoolId: string) {
    const { error } = await supabase
      .from('schools')
      .update({
        status: 'rejected',
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schoolId);
    if (error) throw error;
  }

  async activateProspectiveStudent(prospectId: string) {
    const { error } = await supabase.from('prospective_students').update({ is_active: true }).eq('id', prospectId);
    if (error) throw error;
  }

  /** Matches web `POST /api/approvals/prospective` with `action: 'rejected'`. */
  async rejectProspectiveStudent(prospectId: string) {
    const { error } = await supabase
      .from('prospective_students')
      .update({ is_deleted: true, is_active: false })
      .eq('id', prospectId);
    if (error) throw error;
  }
}

export const approvalService = new ApprovalService();

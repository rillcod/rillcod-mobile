import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

const DEFAULT_PASSWORD_RESET_REDIRECT = 'rillcod://reset-password';

/**
 * Auth flows that screens should use instead of calling `supabase.auth` / profile inserts directly.
 * Session lifecycle stays in `AuthContext` + `supabase` client.
 */
export class AuthService {
  resetPasswordForEmail(email: string, redirectTo: string = DEFAULT_PASSWORD_RESET_REDIRECT) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }

  /**
   * Public student self-registration: Supabase Auth user + `portal_users` + `students` (pending).
   */
  async registerStudentWithPendingProfile(params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string | null;
    enrollmentType: string;
    schoolName?: string | null;
    gradeLevel?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    courseInterest?: string | null;
  }) {
    const emailNorm = params.email.trim().toLowerCase();
    const fullName = params.fullName.trim();

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: emailNorm,
      password: params.password,
      options: { data: { full_name: fullName } },
    });

    if (authErr || !authData.user) {
      throw new Error(authErr?.message || 'Could not create account.');
    }

    const uid = authData.user.id;
    const now = new Date().toISOString();

    const portalRow: Database['public']['Tables']['portal_users']['Insert'] = {
      id: uid,
      email: emailNorm,
      full_name: fullName,
      role: 'student',
      phone: params.phone?.trim() || null,
      enrollment_type: params.enrollmentType,
      school_name: params.schoolName?.trim() || null,
      is_active: false,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };

    const studentRow: Database['public']['Tables']['students']['Insert'] = {
      name: fullName,
      full_name: fullName,
      student_email: emailNorm,
      parent_name: params.parentName?.trim() || null,
      parent_phone: params.parentPhone?.trim() || null,
      grade_level: params.gradeLevel?.trim() || null,
      school_name: params.schoolName?.trim() || null,
      course_interest: params.courseInterest?.trim() || null,
      enrollment_type: params.enrollmentType,
      status: 'pending',
      user_id: uid,
      created_at: now,
      updated_at: now,
    };

    const [portalRes, studentRes] = await Promise.all([
      supabase.from('portal_users').insert(portalRow),
      supabase.from('students').insert(studentRow),
    ]);

    if (portalRes.error) throw portalRes.error;
    if (studentRes.error) throw studentRes.error;

    return { userId: uid };
  }

  /**
   * Admin register teacher: Auth sign-up. Allows "already registered" so `portal_users` upsert can link by email.
   */
  async signUpTeacherAccount(params: { email: string; password: string; fullName: string }) {
    const email = params.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: { data: { full_name: params.fullName.trim(), role: 'teacher' } },
    });

    if (error && !error.message.toLowerCase().includes('already registered')) {
      throw new Error(error.message);
    }

    return { userId: data?.user?.id as string | undefined };
  }
}

export const authService = new AuthService();

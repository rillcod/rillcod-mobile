import type { Session, User } from '@supabase/supabase-js';

// ─── Portal auth (matches `portal_users` + `AuthContext` fetch) ───────────────
//
// Registration / directory models live in `student.types.ts`, `school.types.ts`, `teacher.types.ts`.
// For DB row types use `Database` from `./supabase`.

/** Values stored on `portal_users.role`. */
export type UserRole = 'admin' | 'teacher' | 'student' | 'school' | 'parent';

/**
 * Row shape loaded in `AuthContext` (`portal_users` subset).
 * Extra keys are optional for compatibility with broader selects / UI.
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  school_id: string | null;
  school_name: string | null;
  profile_image_url: string | null;
  phone: string | null;
  bio: string | null;
  is_active: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  section_class?: string | null;
  current_module?: string | null;
  date_of_birth?: string | null;
}

/** Must match `AuthContext.Provider` value shape. */
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

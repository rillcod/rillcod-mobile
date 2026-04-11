/**
 * App-level types (not the generated DB schema — see `./supabase`).
 *
 * - `./auth` — Supabase `User` / `Session` + `portal_users` profile (`UserProfile`, `UserRole`, context contract).
 * - `./*.types` — Domain DTOs for forms and list UIs; names may overlap concepts in `auth` but shapes differ on purpose.
 */

export type { UserRole, UserProfile, AuthContextType } from './auth';
export type { Student, ProspectiveStudent, StudentFormData } from './student.types';
export type { School, SchoolFormData } from './school.types';
export type { Teacher, TeacherFormData } from './teacher.types';

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

export type PaginatedResponse<T> = ApiResponse<T> & {
  count: number;
  page: number;
  pageSize: number;
};

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

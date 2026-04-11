import { supabase } from '../lib/supabase';
import type { Json } from '../types/supabase';

export type ParentDirectoryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
  child_count?: number;
  approved_children?: number;
  /** Registrations still pending approval */
  pending_children?: number;
  /** Up to a few learner display names (several children supported) */
  child_names_preview?: string[];
  /** Staff-only notes stored on `portal_users.metadata.staff_notes` */
  staff_notes?: string | null;
};

function normalizeParentEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function readStaffNotesFromMetadata(metadata: Json | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const n = (metadata as Record<string, unknown>).staff_notes;
  if (typeof n !== 'string') return null;
  const t = n.trim();
  return t.length ? t : null;
}

type ChildAgg = { total: number; approved: number; pending: number; names: string[] };

function bumpChildAgg(map: Map<string, ChildAgg>, emailRaw: string | null | undefined, status: string | null | undefined, displayName: string) {
  const key = normalizeParentEmail(emailRaw);
  if (!key) return;
  if (!map.has(key)) map.set(key, { total: 0, approved: 0, pending: 0, names: [] });
  const a = map.get(key)!;
  a.total += 1;
  const st = String(status ?? '').toLowerCase();
  if (st === 'approved') a.approved += 1;
  if (st === 'pending') a.pending += 1;
  if (a.names.length < 5) a.names.push(displayName.trim() || 'Learner');
}

async function teacherSchoolIds(teacherId: string): Promise<string[]> {
  const { data, error } = await supabase.from('teacher_schools').select('school_id').eq('teacher_id', teacherId);
  if (error) throw error;
  return (data ?? []).map((r: { school_id: string }) => r.school_id).filter(Boolean);
}

type StudentParentAggRow = {
  parent_email: string | null;
  status: string | null;
  full_name: string | null;
  name: string | null;
};

async function fetchStudentsForParentAggBySchools(params: {
  schoolIds: string[];
  currentClass?: string | null;
}): Promise<StudentParentAggRow[]> {
  if (!params.schoolIds.length) return [];
  let q = supabase
    .from('students')
    .select('parent_email, status, full_name, name')
    .in('school_id', params.schoolIds)
    .not('parent_email', 'is', null)
    .or('is_deleted.is.null,is_deleted.eq.false');
  const cls = String(params.currentClass ?? '').trim();
  if (cls) q = q.eq('current_class', cls);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StudentParentAggRow[];
}

export class ParentService {
  async getPortalProfileForParentDetail(parentId: string) {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, is_active, created_at, metadata')
      .eq('id', parentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async listRegistrationChildrenByParentEmail(parentEmail: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, school_name, current_class, status, user_id, parent_relationship')
      .eq('parent_email', parentEmail)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async setPortalUserActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  }

  async clearStudentParentLink(studentId: string) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: null,
        parent_name: null,
        parent_phone: null,
        parent_relationship: null,
      })
      .eq('id', studentId);
    if (error) throw error;
  }

  /** Distinct `students.current_class` values (non-empty) for learners with a parent email at this school. */
  async listDistinctCurrentClassesForSchool(schoolId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('students')
      .select('current_class')
      .eq('school_id', schoolId)
      .not('parent_email', 'is', null)
      .or('is_deleted.is.null,is_deleted.eq.false');
    if (error) throw error;
    const out = new Set<string>();
    for (const row of data ?? []) {
      const c = String((row as { current_class?: string | null }).current_class ?? '').trim();
      if (c) out.add(c);
    }
    return Array.from(out).sort((a, b) => a.localeCompare(b));
  }

  /** Schools available for the Parents directory scope picker (admin: approved; teacher: partner schools). */
  async listSchoolsForParentDirectoryFilter(params: {
    role: 'admin' | 'teacher' | 'school';
    userId: string;
    schoolId?: string | null;
  }): Promise<{ id: string; name: string }[]> {
    if (params.role === 'admin') {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name')
        .eq('status', 'approved')
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    }
    if (params.role === 'teacher' && params.userId) {
      const ids = await teacherSchoolIds(params.userId);
      if (!ids.length) return [];
      const { data, error } = await supabase.from('schools').select('id, name').in('id', ids).order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    }
    if (params.role === 'school' && params.schoolId) {
      const { data, error } = await supabase.from('schools').select('id, name').eq('id', params.schoolId).maybeSingle();
      if (error) throw error;
      return data?.id ? [{ id: data.id, name: data.name }] : [];
    }
    return [];
  }

  /**
   * Scoped parent directory: admin (network-wide), school (learners at this school),
   * teacher (learners at linked partner schools). Child counts reflect that scope so
   * multi-child and pending registrations surface correctly.
   *
   * Optional `filterSchoolId` (admin / teacher) and `filterCurrentClass` narrow to learners at that school
   * and optionally that class label (`students.current_class`).
   */
  async listParentsDirectoryForStaff(params: {
    role: 'admin' | 'teacher' | 'school';
    userId: string;
    schoolId?: string | null;
    limit?: number;
    /** Admin / teacher: restrict to one partner school (must be allowed for the role). */
    filterSchoolId?: string | null;
    /** When set, only parents with a learner in this `students.current_class` within the active school scope. */
    filterCurrentClass?: string | null;
  }): Promise<ParentDirectoryRow[]> {
    const lim = params.limit ?? 250;
    const role = params.role;
    const classFilter = String(params.filterCurrentClass ?? '').trim() || null;

    let studentRows: StudentParentAggRow[] = [];

    if (role === 'school' && params.schoolId) {
      studentRows = await fetchStudentsForParentAggBySchools({
        schoolIds: [params.schoolId],
        currentClass: classFilter,
      });
    } else if (role === 'teacher' && params.userId) {
      const schoolIds = await teacherSchoolIds(params.userId);
      if (!schoolIds.length) return [];
      const pick = params.filterSchoolId && schoolIds.includes(params.filterSchoolId) ? [params.filterSchoolId] : schoolIds;
      studentRows = await fetchStudentsForParentAggBySchools({
        schoolIds: pick,
        currentClass: classFilter,
      });
    }

    const agg = new Map<string, ChildAgg>();
    for (const row of studentRows) {
      const display = String(row.full_name || row.name || 'Learner').trim() || 'Learner';
      bumpChildAgg(agg, row.parent_email, row.status, display);
    }

    if (role === 'admin') {
      const scopedSchool = params.filterSchoolId?.trim() || null;
      if (scopedSchool) {
        studentRows = await fetchStudentsForParentAggBySchools({
          schoolIds: [scopedSchool],
          currentClass: classFilter,
        });
        const scopedAgg = new Map<string, ChildAgg>();
        for (const row of studentRows) {
          const display = String(row.full_name || row.name || 'Learner').trim() || 'Learner';
          bumpChildAgg(scopedAgg, row.parent_email, row.status, display);
        }
        if (scopedAgg.size === 0) return [];
        const { data: allParents, error: pErr } = await supabase
          .from('portal_users')
          .select('id, full_name, email, phone, is_active, created_at, metadata')
          .eq('role', 'parent')
          .order('created_at', { ascending: false })
          .limit(800);
        if (pErr) throw pErr;
        const filtered = (allParents ?? []).filter((row: { email: string }) => scopedAgg.has(normalizeParentEmail(row.email)));
        return this.mapParentsWithAgg(filtered as any[], scopedAgg);
      }
      const { data: parentRows, error } = await supabase
        .from('portal_users')
        .select('id, full_name, email, phone, is_active, created_at, metadata')
        .eq('role', 'parent')
        .order('created_at', { ascending: false })
        .limit(lim);
      if (error) throw error;
      const parentsList = (parentRows ?? []) as any[];
      if (!parentsList.length) return [];

      const emails = [...new Set(parentsList.map((p: { email: string }) => String(p.email ?? '').trim()).filter(Boolean))];
      const adminAgg = new Map<string, ChildAgg>();
      const chunk = 60;
      for (let i = 0; i < emails.length; i += chunk) {
        const slice = emails.slice(i, i + chunk);
        if (!slice.length) continue;
        const { data: st, error: sErr } = await supabase
          .from('students')
          .select('parent_email, status, full_name, name')
          .in('parent_email', slice)
          .or('is_deleted.is.null,is_deleted.eq.false');
        if (sErr) throw sErr;
        for (const row of (st ?? []) as StudentParentAggRow[]) {
          const display = String(row.full_name || row.name || 'Learner').trim() || 'Learner';
          bumpChildAgg(adminAgg, row.parent_email, row.status, display);
        }
      }
      return this.mapParentsWithAgg(parentsList, adminAgg);
    }

    const scopedEmails = [...agg.keys()];
    if (scopedEmails.length === 0) return [];

    const { data: allParents, error: pErr } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, is_active, created_at, metadata')
      .eq('role', 'parent')
      .order('created_at', { ascending: false })
      .limit(800);
    if (pErr) throw pErr;
    const filtered = (allParents ?? []).filter((row: { email: string }) => agg.has(normalizeParentEmail(row.email)));
    return this.mapParentsWithAgg(filtered as any[], agg);
  }

  private mapParentsWithAgg(
    parentRows: Array<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      is_active: boolean | null;
      created_at: string | null;
      metadata: Json | null;
    }>,
    agg: Map<string, ChildAgg>,
  ): ParentDirectoryRow[] {
    return parentRows.map((item) => {
      const key = normalizeParentEmail(item.email);
      const a = agg.get(key);
      const total = a?.total ?? 0;
      const approved = a?.approved ?? 0;
      const pending = a?.pending ?? 0;
      return {
        id: item.id,
        full_name: item.full_name,
        email: item.email,
        phone: item.phone,
        is_active: item.is_active ?? true,
        created_at: item.created_at,
        child_count: total,
        approved_children: approved,
        pending_children: pending,
        child_names_preview: a?.names?.length ? a.names : undefined,
        staff_notes: readStaffNotesFromMetadata(item.metadata),
      };
    });
  }

  /** @deprecated Prefer `listParentsDirectoryForStaff` with role `admin`. */
  async listParentsDirectoryWithChildStats(limit = 200): Promise<ParentDirectoryRow[]> {
    return this.listParentsDirectoryForStaff({ role: 'admin', userId: '', limit });
  }

  async updateParentPortalProfile(params: {
    parentId: string;
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    /** Merged into `metadata.staff_notes` when provided (empty string clears). */
    staff_notes?: string | null;
  }) {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      full_name: params.full_name,
      email: params.email,
      phone: params.phone,
      is_active: params.is_active,
      updated_at: now,
    };

    if (params.staff_notes !== undefined) {
      const { data: row, error: rErr } = await supabase.from('portal_users').select('metadata').eq('id', params.parentId).maybeSingle();
      if (rErr) throw rErr;
      const prev =
        row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? { ...(row.metadata as Record<string, unknown>) }
          : {};
      const trimmed = params.staff_notes?.trim() ?? '';
      if (trimmed) prev.staff_notes = trimmed;
      else delete prev.staff_notes;
      payload.metadata = prev as Json;
    }

    const { error } = await supabase.from('portal_users').update(payload as never).eq('id', params.parentId);
    if (error) throw error;
  }

  async syncStudentsParentContactByOldEmail(params: {
    oldEmail: string;
    newEmail: string;
    newName: string;
    newPhone: string | null;
  }) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: params.newEmail,
        parent_name: params.newName,
        parent_phone: params.newPhone,
      })
      .eq('parent_email', params.oldEmail);
    if (error) throw error;
  }

  async signUpParentAndUpsertPortal(params: {
    email: string;
    password: string;
    full_name: string;
    phone: string | null;
    is_active: boolean;
    staff_notes?: string | null;
  }) {
    const signUp = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: { data: { full_name: params.full_name, role: 'parent' } },
    });
    if (signUp.error && !signUp.error.message.toLowerCase().includes('already registered')) {
      throw signUp.error;
    }
    const userId = signUp.data.user?.id;
    const meta =
      params.staff_notes?.trim() ? ({ staff_notes: params.staff_notes.trim() } as Json) : null;
    const { error } = await supabase.from('portal_users').upsert(
      {
        ...(userId ? { id: userId } : {}),
        email: params.email,
        full_name: params.full_name,
        phone: params.phone,
        role: 'parent',
        is_active: params.is_active,
        is_deleted: false,
        ...(meta ? { metadata: meta } : {}),
      },
      { onConflict: 'email' },
    );
    if (error) throw error;
    return { tempPassword: params.password };
  }

  async unlinkStudentsByParentEmail(parentEmail: string) {
    const { error } = await supabase
      .from('students')
      .update({
        parent_email: null,
        parent_name: null,
        parent_phone: null,
        parent_relationship: null,
      })
      .eq('parent_email', parentEmail);
    if (error) throw error;
  }

  async deleteParentPortalUser(parentId: string) {
    const { error } = await supabase.from('portal_users').delete().eq('id', parentId);
    if (error) throw error;
  }

  async toggleParentPortalActive(parentId: string, isActive: boolean) {
    const { error } = await supabase
      .from('portal_users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', parentId);
    if (error) throw error;
  }
}

export const parentService = new ParentService();

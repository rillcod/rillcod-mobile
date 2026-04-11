import type { Database } from '../types/supabase';
import { studentService } from './student.service';

export type ParsedImportStudent = {
  full_name: string;
  student_email: string;
  parent_email?: string;
  parent_name?: string;
  parent_phone?: string;
  grade?: string;
  section?: string;
  enrollment_type: string;
  _row: number;
  _error?: string;
};

const REQUIRED = ['full_name', 'student_email'] as const;

/** Same column intent as web `students/import/page.tsx` (simple CSV). */
export function parseStudentImportCsv(text: string): ParsedImportStudent[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.replace(/\r/g, ''));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines
    .slice(1)
    .map((line, i) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = { enrollment_type: 'school' };
      headers.forEach((h, idx) => {
        row[h] = vals[idx] ?? '';
      });
      const full_name = row.full_name ?? '';
      const student_email = row.student_email ?? '';
      const parent_email = row.parent_email ?? '';
      let _error: string | undefined;
      if (!full_name) _error = 'Missing full_name';
      if (!student_email && !parent_email) _error = 'Missing student_email or parent_email';
      return {
        full_name,
        student_email: student_email || parent_email,
        parent_email: parent_email || undefined,
        parent_name: row.parent_name || undefined,
        parent_phone: row.parent_phone || undefined,
        grade: row.grade || undefined,
        section: row.section || undefined,
        enrollment_type: row.enrollment_type || 'school',
        _row: i + 2,
        _error,
      } as ParsedImportStudent;
    })
    .filter((r) => r.full_name || r.student_email);
}

export class StudentImportService {
  async importPendingRows(
    rows: ParsedImportStudent[],
    scope: { schoolId: string | null; schoolName: string | null },
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const out = { success: 0, failed: 0, errors: [] as string[] };
    const now = new Date().toISOString();
    for (const r of rows) {
      if (r._error) {
        out.failed++;
        out.errors.push(`Row ${r._row}: ${r._error}`);
        continue;
      }
      const row: Database['public']['Tables']['students']['Insert'] = {
        name: r.full_name.trim(),
        full_name: r.full_name.trim(),
        student_email: r.student_email?.trim() || null,
        email: r.student_email?.trim() || r.parent_email?.trim() || null,
        parent_email: r.parent_email?.trim() || null,
        parent_name: r.parent_name?.trim() || null,
        parent_phone: r.parent_phone?.trim() || null,
        grade_level: r.grade?.trim() || null,
        section: r.section?.trim() || null,
        enrollment_type: r.enrollment_type || 'school',
        school_id: scope.schoolId,
        school_name: scope.schoolName,
        status: 'pending',
        is_active: true,
        is_deleted: false,
        goals: 'CSV staff import',
        created_at: now,
        updated_at: now,
      };
      try {
        await studentService.insertPublicStudentInterestRow(row);
        out.success++;
      } catch (e: any) {
        out.failed++;
        out.errors.push(`Row ${r._row} (${r.full_name}): ${e?.message ?? 'insert failed'}`);
      }
    }
    return out;
  }
}

export const studentImportService = new StudentImportService();

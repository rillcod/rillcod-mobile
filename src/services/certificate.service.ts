import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { studentService } from './student.service';

export type Certificate = Database['public']['Tables']['certificates']['Row'];

export type ParentCertificateListRow = {
  id: string;
  certificate_number: string;
  verification_code: string;
  issued_date: string;
  pdf_url: string | null;
  course_title: string | null;
};

export class CertificateService {
  async listCertificates(userId: string) {
    const { data, error } = await supabase
      .from('certificates')
      .select('id, certificate_number, issued_date, pdf_url, metadata, courses(title)')
      .eq('portal_user_id', userId)
      .order('issued_date', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((cert: any) => ({
      id: cert.id,
      certificate_number: cert.certificate_number,
      title: cert.metadata?.title ?? cert.courses?.title ?? 'Course Certificate',
      course_name: cert.metadata?.course_name ?? cert.courses?.title ?? null,
      issued_date: cert.issued_date,
      issued_by: cert.metadata?.issued_by ?? 'Rillcod Academy',
      certificate_url: cert.pdf_url ?? null,
    }));
  }

  async verifyCertificate(certificateNumber: string) {
    const { data, error } = await supabase
      .from('certificates')
      .select('*, portal_users(full_name), courses(title)')
      .eq('certificate_number', certificateNumber)
      .single();

    if (error) throw error;
    return data;
  }

  async listCertificatesForParentByRegistrationId(registrationId: string) {
    const portalUserId = await studentService.getPortalUserIdForStudentRegistration(registrationId);
    if (!portalUserId) {
      return { hasPortal: false as const, rows: [] as ParentCertificateListRow[] };
    }
    const { data, error } = await supabase
      .from('certificates')
      .select('id, certificate_number, verification_code, issued_date, pdf_url, courses(title)')
      .eq('portal_user_id', portalUserId)
      .order('issued_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((c: any) => ({
      id: c.id,
      certificate_number: c.certificate_number,
      verification_code: c.verification_code,
      issued_date: c.issued_date,
      pdf_url: c.pdf_url,
      course_title: c.courses?.title ?? null,
    }));
    return { hasPortal: true as const, rows };
  }

  async countCertificatesForPortalUser(portalUserId: string) {
    const { count, error } = await supabase
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('portal_user_id', portalUserId);
    if (error) throw error;
    return count ?? 0;
  }

  /** Staff certificate registry + manual issue (`ManageCertificatesScreen`). */
  async listCertificatesForManageScreen() {
    const { data, error } = await supabase
      .from('certificates')
      .select(
        'id, portal_user_id, certificate_number, verification_code, issued_date, pdf_url, metadata, portal_users!certificates_portal_user_id_fkey(full_name, email)',
      )
      .order('issued_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((cert: any) => ({
      id: cert.id,
      portal_user_id: cert.portal_user_id ?? null,
      certificate_number: cert.certificate_number,
      verification_code: cert.verification_code,
      title: cert.metadata?.title ?? cert.metadata?.course_name ?? 'Certificate',
      description: cert.metadata?.description ?? cert.metadata?.notes ?? null,
      issued_date: cert.issued_date,
      issued_by: cert.metadata?.issued_by ?? 'Rillcod Academy',
      pdf_url: cert.pdf_url ?? null,
      portal_users: cert.portal_users ?? null,
    }));
  }

  async listStudentsForCertificatePicker() {
    const { data, error } = await supabase
      .from('portal_users')
      .select('id, full_name, email')
      .eq('role', 'student')
      .order('full_name');
    if (error) throw error;
    return (data ?? []) as { id: string; full_name: string; email: string }[];
  }

  async insertManualCertificate(row: Database['public']['Tables']['certificates']['Insert']) {
    const { error } = await supabase.from('certificates').insert(row);
    if (error) throw error;
  }
}

export const certificateService = new CertificateService();

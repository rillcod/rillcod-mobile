import { supabase } from '../lib/supabase';
import type { Database, Json } from '../types/supabase';

export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];
export type PaymentAccount = Database['public']['Tables']['payment_accounts']['Row'];
export type PaymentAccountInsert = Database['public']['Tables']['payment_accounts']['Insert'];
export type PaymentAccountUpdate = Database['public']['Tables']['payment_accounts']['Update'];
export type PaymentTransactionUpdate = Database['public']['Tables']['payment_transactions']['Update'];
export type ReceiptInsert = Database['public']['Tables']['receipts']['Insert'];

export class PaymentService {
  async listInvoices(params: {
    role: string;
    userId: string;
    schoolId?: string | null;
  }) {
    const { role, userId, schoolId } = params;
    const isAdmin = role === 'admin';
    const isSchool = role === 'school';
    
    let query = supabase
      .from('invoices')
      .select(`
        *,
        schools(name),
        portal_users(full_name, email)
      `);

    if (isAdmin) {
      // full ledger
    } else if (isSchool) {
      if (!schoolId) return [];
      query = query.eq('school_id', schoolId);
    } else {
      query = query.eq('portal_user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async listTransactions(params: {
    role: string;
    userId: string;
    schoolId?: string | null;
    /** Parent view: linked students’ portal user ids */
    forStudentIds?: string[] | null;
  }) {
    const { role, userId, schoolId, forStudentIds } = params;

    if (role === 'parent' && (!forStudentIds || forStudentIds.length === 0)) {
      return [];
    }

    let query = supabase
      .from('payment_transactions')
      .select(
        'id, amount, currency, external_transaction_id, payment_method, payment_gateway_response, payment_status, transaction_reference, created_at, paid_at, receipt_url, refund_reason, refunded_at, invoice_id, portal_user_id, school_id',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (role === 'admin') {
      // no scope filter
    } else if (role === 'school') {
      if (!schoolId) return [];
      query = query.eq('school_id', schoolId);
    } else if (role === 'parent' && forStudentIds?.length) {
      query = query.in('portal_user_id', forStudentIds);
    } else {
      query = query.eq('portal_user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async listPaymentAccounts(params: {
    isAdmin: boolean;
    schoolId?: string | null;
  }) {
    const { isAdmin, schoolId } = params;
    
    let query = supabase
      .from('payment_accounts')
      .select('*')
      .eq('is_active', true);

    if (!isAdmin) {
      query = query.or(schoolId ? `school_id.eq.${schoolId},owner_type.eq.global,owner_type.eq.rillcod` : 'owner_type.eq.global,owner_type.eq.rillcod');
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createInvoice(payload: InvoiceInsert) {
    const { error } = await supabase.from('invoices').insert(payload);
    if (error) throw error;
    return true;
  }

  async createBulkInvoices(rows: InvoiceInsert[]) {
    const { error } = await supabase.from('invoices').insert(rows);
    if (error) throw error;
    return true;
  }

  async updateInvoiceStatus(invoiceId: string, status: string) {
    const { error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);
    if (error) throw error;
    return true;
  }

  async markAsPaid(invoiceId: string, _graderId?: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        updated_at: now,
      })
      .eq('id', invoiceId);
    if (error) throw error;
    return true;
  }

  /** Sync invoice + ledger after Paystack (calls Edge Function; idempotent with webhook). */
  async verifyPaystackReference(reference: string) {
    const { data, error } = await supabase.functions.invoke<{
      fulfilled?: boolean;
      alreadyDone?: boolean;
      invoice_id?: string | null;
      reason?: string;
      error?: string;
    }>('paystack-verify', { body: { reference } });

    if (error) throw error;
    return data ?? null;
  }

  async listReceiptRecords(limit = 100) {
    const { data, error } = await supabase
      .from('receipts')
      .select(
        'id, receipt_number, amount, currency, issued_at, pdf_url, school_id, student_id, transaction_id, metadata',
      )
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /** Invoices whose notes tag a bulk batch (`BULK-…`), for archive / audit UI. */
  async listBulkTaggedInvoices(params: { isAdmin: boolean; schoolId?: string | null; limit?: number }) {
    const lim = params.limit ?? 200;
    let q = supabase
      .from('invoices')
      .select('invoice_number, amount, currency, status, created_at, notes, school_id, portal_users(full_name)')
      .ilike('notes', '%BULK-%')
      .order('created_at', { ascending: false })
      .limit(lim);
    if (!params.isAdmin && params.schoolId) q = q.eq('school_id', params.schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  groupReceiptsByBatchId(rows: { metadata: Json | null }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : null;
      const bid = meta && typeof meta.batch_id === 'string' ? meta.batch_id : null;
      if (bid) map.set(bid, (map.get(bid) ?? 0) + 1);
    }
    return map;
  }

  /** Invoices billed to a portal user (e.g. parent viewing child’s billing). */
  async listInvoicesForPortalUser(portalUserId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, amount, currency, status, due_date, notes, payment_link, items, created_at',
      )
      .eq('portal_user_id', portalUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Legacy `payments` rows keyed by `students.id` registration id. */
  async listPaymentsForStudentRegistration(studentRegistrationId: string, limit = 30) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, payment_method, payment_status, transaction_reference, payment_date')
      .eq('student_id', studentRegistrationId)
      .order('payment_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updatePaymentTransaction(transactionId: string, payload: PaymentTransactionUpdate) {
    const { error } = await supabase.from('payment_transactions').update(payload).eq('id', transactionId);
    if (error) throw error;
  }

  async patchInvoice(invoiceId: string, updates: InvoiceUpdate) {
    const { error } = await supabase.from('invoices').update(updates).eq('id', invoiceId);
    if (error) throw error;
  }

  async insertPaymentAccount(row: PaymentAccountInsert) {
    const now = new Date().toISOString();
    const { error } = await supabase.from('payment_accounts').insert({
      ...row,
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
    });
    if (error) throw error;
  }

  async updatePaymentAccount(accountId: string, row: PaymentAccountUpdate) {
    const { error } = await supabase
      .from('payment_accounts')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', accountId);
    if (error) throw error;
  }

  async deletePaymentAccount(accountId: string) {
    const { error } = await supabase.from('payment_accounts').delete().eq('id', accountId);
    if (error) throw error;
  }

  async insertReceipt(row: ReceiptInsert) {
    const { error } = await supabase.from('receipts').insert(row);
    if (error) throw error;
  }

  async insertReceipts(rows: ReceiptInsert[]) {
    const { error } = await supabase.from('receipts').insert(rows);
    if (error) throw error;
  }

  async deleteReceipt(receiptId: string) {
    const { error } = await supabase.from('receipts').delete().eq('id', receiptId);
    if (error) throw error;
  }

  async countUnpaidInvoicesForPortalUser(portalUserId: string) {
    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('portal_user_id', portalUserId)
      .in('status', ['pending', 'overdue']);
    if (error) throw error;
    return count ?? 0;
  }

  /** Admin / school `TransactionsScreen`: joined rows for ledger UI. */
  async listFinanceConsoleTransactionsWithJoins(params: { schoolId?: string | null }) {
    let q = supabase
      .from('payment_transactions')
      .select(
        'id, amount, currency, external_transaction_id, payment_method, payment_status, payment_gateway_response, transaction_reference, created_at, paid_at, receipt_url, refund_reason, refunded_at, invoice_id, school_id, portal_user_id, courses(title), schools(name), portal_users(full_name, email), invoices(invoice_number)',
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (params.schoolId) q = q.eq('school_id', params.schoolId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listReceiptsForFinanceConsole(limit = 200) {
    const { data, error } = await supabase
      .from('receipts')
      .select('id, receipt_number, amount, currency, issued_at, pdf_url, school_id, student_id, transaction_id, metadata')
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async financeApplyTransactionStatus(params: {
    transactionId: string;
    invoiceId: string | null;
    status: string;
    refundReason?: string | null;
  }) {
    const now = new Date().toISOString();
    const payload: PaymentTransactionUpdate = {
      payment_status: params.status,
      updated_at: now,
    };
    if (params.status === 'success' || params.status === 'completed') {
      payload.paid_at = now;
    }
    if (params.status === 'refunded') {
      payload.refunded_at = now;
      payload.refund_reason = params.refundReason ?? 'Manual finance action';
    }
    await this.updatePaymentTransaction(params.transactionId, payload);

    if (params.invoiceId) {
      const invStatus =
        params.status === 'success' || params.status === 'completed'
          ? 'paid'
          : params.status === 'refunded'
            ? 'sent'
            : undefined;
      if (invStatus) {
        await this.patchInvoice(params.invoiceId, {
          status: invStatus,
          payment_transaction_id: params.status === 'refunded' ? null : params.transactionId,
          updated_at: now,
        });
      }
    }
  }

  async financeDeleteTransactionCascade(params: { transactionId: string; invoiceId: string | null }) {
    const { error: e1 } = await supabase.from('receipts').delete().eq('transaction_id', params.transactionId);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('payment_transactions').delete().eq('id', params.transactionId);
    if (e2) throw e2;
    if (params.invoiceId) {
      await this.patchInvoice(params.invoiceId, {
        payment_transaction_id: null,
        status: 'sent',
        updated_at: new Date().toISOString(),
      });
    }
  }
}

export const paymentService = new PaymentService();

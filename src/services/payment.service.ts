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

/** In-memory line row before persisting to `invoices.items` (JSON). */
export type InvoiceLineDraft = { description: string; quantity: number; unit_price: number; total: number };

/**
 * Normalizes line-item drafts for `invoices.items` + `invoices.amount` (web-style invoice editor).
 * Drops blank zero rows; returns null if nothing billable remains.
 */
export function finalizeInvoiceLineDrafts(
  items: InvoiceLineDraft[],
): { items: Json; amount: number } | null {
  const rows = items
    .map((i) => {
      const qty = Math.max(0, Number(i.quantity) || 0);
      const unit = Math.max(0, Number(i.unit_price) || 0);
      const desc = String(i.description ?? '').trim();
      const total = qty * unit;
      if (!desc && total <= 0) return null;
      return { description: desc || 'Item', quantity: qty || 1, unit_price: unit, total };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  if (!rows.length) return null;
  const amount = rows.reduce((s, r) => s + r.total, 0);
  return { items: rows as unknown as Json, amount };
}

/** Minimal rows for client-side billing intelligence (invoices + transactions). */
export type SmartBillingInvoiceInput = { id: string; amount: number; status: string };
export type SmartBillingTransactionInput = {
  id: string;
  amount: number;
  payment_status: string | null;
  invoice_id: string | null;
  created_at: string | null;
};

export type SmartBillingSignals = {
  currency: string;
  outstandingInvoiceAmount: number;
  outstandingInvoiceCount: number;
  overdueInvoiceAmount: number;
  overdueInvoiceCount: number;
  /** `sent` / `overdue` invoices with no success/completed transaction linked by `invoice_id`. */
  unpaidWithoutSettledTxCount: number;
  unpaidWithoutSettledTxAmount: number;
  settledTxAmount: number;
  settledTxCount: number;
  pendingTxCount: number;
  pendingTxAmount: number;
  /** Pending / processing older than `staleDays` (follow up with payer or gateway). */
  stalePendingTxCount: number;
  stalePendingTxAmount: number;
  failedTxCount: number;
};

const SETTLED_STATUSES = new Set(['success', 'completed']);
const PENDING_LIKE = new Set(['pending', 'processing']);

function isSettledTx(status: string | null | undefined) {
  return SETTLED_STATUSES.has(String(status ?? '').toLowerCase());
}

/**
 * Cross-checks invoices vs `payment_transactions` for mobile finance hubs (no extra round trips).
 */
export function computeSmartBillingSignals(
  invoices: SmartBillingInvoiceInput[],
  transactions: SmartBillingTransactionInput[],
  opts?: { now?: Date; staleDays?: number; currencyFallback?: string },
): SmartBillingSignals {
  const now = opts?.now ?? new Date();
  const staleDays = opts?.staleDays ?? 7;
  const staleMs = staleDays * 86400000;
  const currency = opts?.currencyFallback ?? 'NGN';

  const settledOnInvoice = new Set(
    transactions.filter((t) => t.invoice_id && isSettledTx(t.payment_status)).map((t) => t.invoice_id as string),
  );

  let outstandingInvoiceAmount = 0;
  let outstandingInvoiceCount = 0;
  let overdueInvoiceAmount = 0;
  let overdueInvoiceCount = 0;
  let unpaidWithoutSettledTxCount = 0;
  let unpaidWithoutSettledTxAmount = 0;

  for (const inv of invoices) {
    const amt = Number(inv.amount) || 0;
    const st = String(inv.status ?? '').toLowerCase();
    if (st === 'sent') {
      outstandingInvoiceCount += 1;
      outstandingInvoiceAmount += amt;
    }
    if (st === 'overdue') {
      overdueInvoiceCount += 1;
      overdueInvoiceAmount += amt;
      outstandingInvoiceCount += 1;
      outstandingInvoiceAmount += amt;
    }
    if ((st === 'sent' || st === 'overdue') && !settledOnInvoice.has(inv.id)) {
      unpaidWithoutSettledTxCount += 1;
      unpaidWithoutSettledTxAmount += amt;
    }
  }

  let settledTxAmount = 0;
  let settledTxCount = 0;
  let pendingTxCount = 0;
  let pendingTxAmount = 0;
  let stalePendingTxCount = 0;
  let stalePendingTxAmount = 0;
  let failedTxCount = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    const ps = String(tx.payment_status ?? '').toLowerCase();
    if (isSettledTx(ps)) {
      settledTxCount += 1;
      settledTxAmount += amt;
    } else if (PENDING_LIKE.has(ps)) {
      pendingTxCount += 1;
      pendingTxAmount += amt;
      const created = tx.created_at ? new Date(tx.created_at).getTime() : now.getTime();
      if (now.getTime() - created > staleMs) {
        stalePendingTxCount += 1;
        stalePendingTxAmount += amt;
      }
    } else if (ps === 'failed') {
      failedTxCount += 1;
    }
  }

  return {
    currency,
    outstandingInvoiceAmount,
    outstandingInvoiceCount,
    overdueInvoiceAmount,
    overdueInvoiceCount,
    unpaidWithoutSettledTxCount,
    unpaidWithoutSettledTxAmount,
    settledTxAmount,
    settledTxCount,
    pendingTxCount,
    pendingTxAmount,
    stalePendingTxCount,
    stalePendingTxAmount,
    failedTxCount,
  };
}

/** Failed or long-running pending/processing transactions (finance queue triage). */
export function transactionNeedsFinanceAttention(
  tx: SmartBillingTransactionInput,
  opts?: { now?: Date; staleDays?: number },
): boolean {
  const now = opts?.now ?? new Date();
  const staleDays = opts?.staleDays ?? 7;
  const staleMs = staleDays * 86400000;
  const ps = String(tx.payment_status ?? '').toLowerCase();
  if (ps === 'failed') return true;
  if (!PENDING_LIKE.has(ps)) return false;
  const created = tx.created_at ? new Date(tx.created_at).getTime() : now.getTime();
  return now.getTime() - created > staleMs;
}

export class PaymentService {
  async listInvoices(params: {
    role: string;
    userId: string;
    schoolId?: string | null;
  }) {
    const { role, userId, schoolId } = params;
    if (role === 'student') return [];

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

    if (role === 'student') return [];

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

  /** Public registration checkout (no logged-in user). Creates/links invoice then returns Paystack URL. */
  async initializePublicRegistrationCheckout(params: { studentInterestId: string; payerEmail: string }) {
    const { data, error } = await supabase.functions.invoke<{
      authorization_url?: string;
      reference?: string;
      access_code?: string;
      invoice_id?: string;
      amount_ngn?: number;
      error?: string;
    }>('paystack-initialize-public-registration', {
      body: {
        student_interest_id: params.studentInterestId,
        payer_email: params.payerEmail.trim().toLowerCase(),
      },
    });

    if (error) throw error;
    if (data && typeof (data as { error?: string }).error === 'string') {
      throw new Error((data as { error: string }).error);
    }
    return data ?? null;
  }

  /** After public registration Paystack WebView (no session). Same fulfillment as webhook. */
  async verifyPaystackReferencePublic(reference: string) {
    const { data, error } = await supabase.functions.invoke<{
      fulfilled?: boolean;
      alreadyDone?: boolean;
      reason?: string;
      error?: string;
    }>('paystack-verify-public', { body: { reference } });

    if (error) throw error;
    return data ?? null;
  }

  async listReceiptRecords(params: number | { limit?: number; schoolId?: string | null } = 100) {
    const opts = typeof params === 'number' ? { limit: params } : (params ?? {});
    const limit = opts.limit ?? 100;
    let q = supabase
      .from('receipts')
      .select(
        'id, receipt_number, amount, currency, issued_at, pdf_url, school_id, student_id, transaction_id, metadata',
      )
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (opts.schoolId) q = q.eq('school_id', opts.schoolId);
    const { data, error } = await q;
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
        'id, invoice_number, amount, currency, status, due_date, notes, payment_link, items, created_at, school_id',
      )
      .eq('portal_user_id', portalUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Bank transfer: after R2 upload, registers proof + pending ledger transaction + receipt (Edge).
   * Invoice remains unpaid until finance marks the transaction completed.
   */
  async submitBankTransferProofAfterUpload(params: {
    invoiceId: string;
    proofImageUrl: string;
    payerNote?: string | null;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      duplicate?: boolean;
      message?: string;
      transaction_id?: string;
      transaction_reference?: string;
      error?: string;
    }>('bank-transfer-submit-proof', {
      body: {
        invoice_id: params.invoiceId,
        proof_image_url: params.proofImageUrl,
        payer_note: params.payerNote ?? null,
      },
    });
    if (error) throw error;
    if (data && typeof (data as { error?: string }).error === 'string') {
      throw new Error((data as { error: string }).error);
    }
    return data ?? null;
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

  async listReceiptsForFinanceConsole(params: number | { limit?: number; schoolId?: string | null } = 200) {
    const opts = typeof params === 'number' ? { limit: params } : (params ?? {});
    const limit = opts.limit ?? 200;
    let q = supabase
      .from('receipts')
      .select('id, receipt_number, amount, currency, issued_at, pdf_url, school_id, student_id, transaction_id, metadata')
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (opts.schoolId) q = q.eq('school_id', opts.schoolId);
    const { data, error } = await q;
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
    /** Postgres check allows `completed` (not `success`); normalize legacy callers. */
    const normalizedStatus = params.status === 'success' ? 'completed' : params.status;
    const payload: PaymentTransactionUpdate = {
      payment_status: normalizedStatus,
      updated_at: now,
    };
    if (normalizedStatus === 'completed') {
      payload.paid_at = now;
    }
    if (normalizedStatus === 'refunded') {
      payload.refunded_at = now;
      payload.refund_reason = params.refundReason ?? 'Manual finance action';
    }
    await this.updatePaymentTransaction(params.transactionId, payload);

    if (params.invoiceId) {
      const invStatus =
        normalizedStatus === 'completed'
          ? 'paid'
          : normalizedStatus === 'refunded'
            ? 'sent'
            : undefined;
      if (invStatus) {
        await this.patchInvoice(params.invoiceId, {
          status: invStatus,
          payment_transaction_id: normalizedStatus === 'refunded' ? null : params.transactionId,
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

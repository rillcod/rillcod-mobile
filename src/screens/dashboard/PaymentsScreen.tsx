import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  paymentService,
  type PaymentAccountInsert,
  type ReceiptInsert,
} from '../../services/payment.service';
import { schoolService } from '../../services/school.service';
import { studentService } from '../../services/student.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ROUTES } from '../../navigation/routes';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
type BillingTab = 'invoices' | 'transactions' | 'receipts' | 'accounts';
type ReceiptPayerType = 'school' | 'student';

type InvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string | null;
  created_at: string | null;
  notes: string | null;
  payment_link: string | null;
  payment_transaction_id: string | null;
  school_id: string | null;
  portal_user_id: string | null;
  items: InvoiceItem[];
  schools: { name: string | null } | null;
  portal_users: { full_name: string | null; email: string | null } | null;
};

type TransactionRow = {
  id: string;
  amount: number;
  currency: string;
  external_transaction_id?: string | null;
  payment_method: string | null;
  payment_gateway_response?: any;
  payment_status: string | null;
  transaction_reference: string | null;
  created_at: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  refund_reason?: string | null;
  refunded_at?: string | null;
  invoice_id: string | null;
  portal_user_id: string | null;
  school_id: string | null;
};

type PaymentAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  owner_type: string;
  payment_note: string | null;
  school_id: string | null;
};

type ReceiptItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type ReceiptRow = {
  id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  issued_at: string | null;
  pdf_url: string | null;
  school_id: string | null;
  student_id: string | null;
  transaction_id: string | null;
  metadata: any;
  school_name?: string | null;
  student_name?: string | null;
};

function formatMoney(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : 'N/A';
}

function parseItems(value: unknown): InvoiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => {
      const quantity = Number(item?.quantity ?? 1) || 1;
      const unitPrice = Number(item?.unit_price ?? 0) || 0;
      return {
        description: typeof item?.description === 'string' && item.description.trim() ? item.description : 'Payment item',
        quantity,
        unit_price: unitPrice,
        total: typeof item?.total === 'number' ? item.total : quantity * unitPrice,
      };
    })
    .filter((item) => item.description || item.total > 0);
}

export default function PaymentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [tab, setTab] = useState<BillingTab>('invoices');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; email: string; school_id: string | null }[]>([]);
  const [receiptForm, setReceiptForm] = useState({
    payer_type: 'school' as ReceiptPayerType,
    school_id: '',
    student_id: '',
    transaction_id: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    received_by: '',
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
  });
  const [accountForm, setAccountForm] = useState({
    label: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    account_type: 'savings',
    owner_type: 'rillcod',
    payment_note: '',
    school_id: '',
    is_active: true,
  });

  const isAdmin = profile?.role === 'admin';
  const isSchool = profile?.role === 'school';
  const isStudent = profile?.role === 'student';
  const isParent = profile?.role === 'parent';
  const canManage = isAdmin || isSchool;

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let linkedStudentIds: string[] | null = null;
      if (isParent) {
        const ids = await schoolService.getParentStudentIds();
        linkedStudentIds = (ids as string[]).filter(Boolean);
      }

      const [invoiceData, transactionData, accountData, receiptRows] = await Promise.all([
        isParent && linkedStudentIds?.length === 0 ? [] : paymentService.listInvoices({ role: profile.role, userId: profile.id, schoolId: profile.school_id }),
        paymentService.listTransactions({
          role: profile.role,
          userId: profile.id,
          schoolId: profile.school_id,
          forStudentIds: isParent ? linkedStudentIds : undefined,
        }),
        paymentService.listPaymentAccounts({ isAdmin, schoolId: profile.school_id }),
        canManage ? paymentService.listReceiptRecords(100) : Promise.resolve([]),
      ]);

      setInvoices(
        ((invoiceData ?? []) as any[]).map((invoice) => ({
          ...invoice,
          amount: Number(invoice.amount ?? 0),
          currency: invoice.currency ?? 'NGN',
          status: (invoice.status ?? 'sent') as InvoiceStatus,
          items: parseItems(invoice.items),
        }))
      );

      setTransactions(
        (transactionData as any[]).map((tx) => ({
          id: tx.id,
          amount: Number(tx.amount ?? 0),
          currency: tx.currency ?? 'NGN',
          external_transaction_id: tx.external_transaction_id ?? null,
          payment_method: tx.payment_method ?? null,
          payment_gateway_response: tx.payment_gateway_response ?? null,
          payment_status: tx.payment_status ?? 'pending',
          transaction_reference: tx.transaction_reference ?? null,
          created_at: tx.created_at ?? null,
          paid_at: tx.paid_at ?? null,
          receipt_url: tx.receipt_url ?? null,
          refund_reason: tx.refund_reason ?? null,
          refunded_at: tx.refunded_at ?? null,
          invoice_id: tx.invoice_id ?? null,
          portal_user_id: tx.portal_user_id ?? null,
          school_id: tx.school_id ?? null,
        }))
      );

      setAccounts((accountData ?? []) as PaymentAccount[]);
      setReceipts(receiptRows as ReceiptRow[]);

      if (canManage) {
        const [schoolRows, studentRows] = await Promise.all([
          isAdmin
            ? schoolService.listApprovedSchoolOptions()
            : profile.school_id
              ? schoolService.getSchoolOptionRow(profile.school_id)
              : Promise.resolve([]),
          studentService.listActiveStudentsForBilling({
            schoolId: isSchool && profile.school_id ? profile.school_id : undefined,
          }),
        ]);

        setSchools(schoolRows as { id: string; name: string }[]);
        setStudents(studentRows as { id: string; full_name: string; email: string; school_id: string | null }[]);
      } else {
        setSchools([]);
        setStudents([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isParent, isSchool, isStudent, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const findTransaction = useCallback(
    (invoiceId: string | null | undefined) => transactions.find((tx) => tx.invoice_id === invoiceId) ?? null,
    [transactions]
  );

  const filteredInvoices = useMemo(() => {
    const value = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const recipient = invoice.portal_users?.full_name || invoice.schools?.name || '';
      const itemName = invoice.items[0]?.description || '';
      const matchesQuery =
        !value ||
        invoice.invoice_number.toLowerCase().includes(value) ||
        recipient.toLowerCase().includes(value) ||
        itemName.toLowerCase().includes(value);
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [invoices, query, statusFilter]);

  const filteredTransactions = useMemo(() => {
    const value = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const linkedInvoice = invoices.find((invoice) => invoice.id === tx.invoice_id);
      const target = linkedInvoice?.portal_users?.full_name || linkedInvoice?.schools?.name || linkedInvoice?.invoice_number || '';
      return (
        !value ||
        (tx.transaction_reference ?? '').toLowerCase().includes(value) ||
        (tx.payment_method ?? '').toLowerCase().includes(value) ||
        target.toLowerCase().includes(value)
      );
    });
  }, [invoices, query, transactions]);

  const filteredReceipts = useMemo(() => {
    const value = query.trim().toLowerCase();
    return receipts.filter((receipt) => {
      const schoolName = schools.find((school) => school.id === receipt.school_id)?.name ?? '';
      const studentName = students.find((student) => student.id === receipt.student_id)?.full_name ?? '';
      return (
        !value ||
        receipt.receipt_number.toLowerCase().includes(value) ||
        schoolName.toLowerCase().includes(value) ||
        studentName.toLowerCase().includes(value) ||
        String(receipt.metadata?.reference ?? '').toLowerCase().includes(value)
      );
    });
  }, [query, receipts, schools, students]);

  const stats = useMemo(() => {
    const outstanding = invoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue');
    const paid = invoices.filter((invoice) => invoice.status === 'paid');
    return {
      outstandingAmount: outstanding.reduce((sum, invoice) => sum + invoice.amount, 0),
      paidAmount: paid.reduce((sum, invoice) => sum + invoice.amount, 0),
      overdueCount: invoices.filter((invoice) => invoice.status === 'overdue').length,
      successTransactions: transactions.filter((tx) => tx.payment_status === 'success').length,
      refundedTransactions: transactions.filter((tx) => tx.payment_status === 'refunded').length,
      currency: invoices[0]?.currency ?? transactions[0]?.currency ?? 'NGN',
    };
  }, [invoices, transactions]);

  const getStatusColor = (status: string | null | undefined) => {
    if (status === 'paid' || status === 'success') return colors.success;
    if (status === 'overdue' || status === 'failed') return colors.error;
    if (status === 'draft' || status === 'pending') return colors.warning;
    return colors.primary;
  };

  const openPayment = async (invoice: InvoiceRow) => {
    if (invoice.payment_link) {
      const supported = await Linking.canOpenURL(invoice.payment_link);
      if (supported) {
        await Linking.openURL(invoice.payment_link);
        return;
      }
    }

    const instructions = accounts.length
      ? accounts.map((account) => `${account.label}\n${account.bank_name} · ${account.account_number}\n${account.account_name}${account.payment_note ? `\n${account.payment_note}` : ''}`).join('\n\n')
      : 'No active payment link or bank account instructions are attached yet.';

    Alert.alert('Payment Options', instructions);
  };

  const openReceipt = async (tx: TransactionRow | null) => {
    const savedReceipt = tx ? receipts.find((receipt) => receipt.transaction_id === tx.id) : null;
    const receiptUrl = tx?.receipt_url || savedReceipt?.pdf_url || null;
    if (!receiptUrl) {
      Alert.alert('Receipt Unavailable', 'A receipt has not been generated for this transaction yet.');
      return;
    }
    const supported = await Linking.canOpenURL(receiptUrl);
    if (supported) await Linking.openURL(receiptUrl);
  };

  const updateTransactionStatus = async (tx: TransactionRow, status: string, refundReason?: string) => {
    const payload: any = {
      payment_status: status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'success') payload.paid_at = new Date().toISOString();
    if (status === 'refunded') {
      payload.refunded_at = new Date().toISOString();
      payload.refund_reason = refundReason ?? 'Manual refund';
    }

    try {
      await paymentService.updatePaymentTransaction(tx.id, payload);
    } catch (e: any) {
      Alert.alert('Transaction', e?.message ?? 'Update failed');
      return;
    }

    if (tx.invoice_id) {
      const invoiceStatus = status === 'success' ? 'paid' : status === 'refunded' ? 'sent' : null;
      if (invoiceStatus) {
        try {
          await paymentService.patchInvoice(tx.invoice_id, {
            status: invoiceStatus,
            payment_transaction_id: status === 'refunded' ? null : tx.id,
            updated_at: new Date().toISOString(),
          });
        } catch {
          /* best-effort link to invoice */
        }
      }
    }

    await load();
  };
  const markPaid = async (invoice: InvoiceRow) => {
    Alert.alert('Mark Invoice Paid', `Confirm ${invoice.invoice_number} as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await paymentService.markAsPaid(invoice.id);
            await load();
            setSelectedInvoice((current) => (current?.id === invoice.id ? { ...current, status: 'paid' } : current));
          } catch (error: any) {
            Alert.alert('Invoice', error.message);
          }
        },
      },
    ]);
  };

  const openAccountEditor = (account?: PaymentAccount) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        label: account.label,
        bank_name: account.bank_name,
        account_number: account.account_number,
        account_name: account.account_name,
        account_type: account.account_type,
        owner_type: account.owner_type,
        payment_note: account.payment_note ?? '',
        school_id: account.school_id ?? '',
        is_active: true,
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        label: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        account_type: 'savings',
        owner_type: isSchool ? 'school' : 'rillcod',
        payment_note: '',
        school_id: isSchool ? profile?.school_id ?? '' : '',
        is_active: true,
      });
    }
    setShowAccountModal(true);
  };

  const saveAccount = async () => {
    if (!accountForm.label.trim() || !accountForm.bank_name.trim() || !accountForm.account_number.trim() || !accountForm.account_name.trim()) {
      Alert.alert('Validation', 'Label, bank, account number, and account name are required.');
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        label: accountForm.label.trim(),
        bank_name: accountForm.bank_name.trim(),
        account_number: accountForm.account_number.trim(),
        account_name: accountForm.account_name.trim(),
        account_type: accountForm.account_type,
        owner_type: accountForm.owner_type,
        payment_note: accountForm.payment_note.trim() || null,
        school_id: accountForm.owner_type === 'school' ? accountForm.school_id || profile?.school_id || null : null,
        is_active: accountForm.is_active,
        created_by: profile?.id ?? null,
      };

      if (editingAccount) {
        await paymentService.updatePaymentAccount(editingAccount.id, payload);
      } else {
        await paymentService.insertPaymentAccount(payload as PaymentAccountInsert);
      }

      setShowAccountModal(false);
      setEditingAccount(null);
      await load();
    } catch (error: any) {
      Alert.alert('Payment account', error?.message ?? 'Could not save account.');
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (account: PaymentAccount) => {
    Alert.alert('Delete account', `Remove ${account.label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentService.deletePaymentAccount(account.id);
          } catch (e: any) {
            Alert.alert('Payment account', e?.message ?? 'Delete failed');
            return;
          }
          await load();
        },
      },
    ]);
  };

  const updateInvoiceStatus = async (invoice: InvoiceRow, status: InvoiceStatus) => {
    try {
      await paymentService.updateInvoiceStatus(invoice.id, status);
      await load();
      setSelectedInvoice((current) => (current?.id === invoice.id ? { ...current, status } : current));
    } catch (error: any) {
      Alert.alert('Invoice', error.message);
    }
  };

  const updateReceiptItem = (index: number, patch: Partial<ReceiptItem>) => {
    setReceiptForm((current) => {
      const items = [...current.items];
      const next = { ...items[index], ...patch };
      next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
      items[index] = next;
      return { ...current, items };
    });
  };

  const addReceiptItem = () => {
    setReceiptForm((current) => ({
      ...current,
      items: [...current.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const removeReceiptItem = (index: number) => {
    setReceiptForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const buildReceiptHtml = (receipt: {
    receipt_number: string;
    amount: number;
    currency: string;
    issued_at: string | null;
    metadata: any;
    school_name?: string | null;
    student_name?: string | null;
  }) => {
    const items: ReceiptItem[] = Array.isArray(receipt.metadata?.items) ? receipt.metadata.items : [];
    const rows = items.length
      ? items
          .map(
            (item) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;">${item.description}</td>
                <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:center;">${item.quantity}</td>
                <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:right;">${formatMoney(item.unit_price, receipt.currency)}</td>
                <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:right;">${formatMoney(item.total, receipt.currency)}</td>
              </tr>`
          )
          .join('')
      : '<tr><td colspan="4" style="padding:12px 0;color:#6d7c93;">No receipt items recorded.</td></tr>';

    return `
      <html>
        <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #172439;">
          <h1 style="margin-bottom:4px;">Receipt ${receipt.receipt_number}</h1>
          <p style="margin-top:0;color:#6d7c93;">${receipt.student_name || receipt.school_name || receipt.metadata?.payer_name || 'Payment receipt'}</p>
          <p><strong>Issued:</strong> ${formatDate(receipt.issued_at)}</p>
          <p><strong>Payment Date:</strong> ${receipt.metadata?.payment_date ?? 'N/A'}</p>
          <p><strong>Method:</strong> ${(receipt.metadata?.payment_method ?? 'bank_transfer').toUpperCase()}</p>
          <p><strong>Reference:</strong> ${receipt.metadata?.reference ?? 'N/A'}</p>
          <table style="width:100%; border-collapse:collapse; margin-top:24px;">
            <thead>
              <tr>
                <th style="text-align:left; padding-bottom:10px;">Item</th>
                <th style="text-align:center; padding-bottom:10px;">Qty</th>
                <th style="text-align:right; padding-bottom:10px;">Unit</th>
                <th style="text-align:right; padding-bottom:10px;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <h2 style="text-align:right; margin-top:24px;">Total: ${formatMoney(receipt.amount, receipt.currency)}</h2>
          ${receipt.metadata?.notes ? `<p><strong>Notes:</strong> ${receipt.metadata.notes}</p>` : ''}
        </body>
      </html>`;
  };

  const exportReceiptPdf = async (receipt: ReceiptRow) => {
    setExporting(true);
    try {
      const schoolName = schools.find((school) => school.id === receipt.school_id)?.name ?? null;
      const studentName = students.find((student) => student.id === receipt.student_id)?.full_name ?? null;
      const html = buildReceiptHtml({
        ...receipt,
        school_name: schoolName,
        student_name: studentName,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Receipt Exported', uri);
      }
    } catch (error: any) {
      Alert.alert('Receipt', error?.message ?? 'Could not generate receipt PDF.');
    } finally {
      setExporting(false);
    }
  };

  const saveReceipt = async () => {
    const validItems = receiptForm.items.filter((item) => item.description.trim() && item.unit_price > 0);
    if (validItems.length === 0) {
      Alert.alert('Receipt builder', 'Add at least one valid line item.');
      return;
    }
    if (receiptForm.payer_type === 'school' && !receiptForm.school_id) {
      Alert.alert('Receipt builder', 'Choose a school receipt target.');
      return;
    }
    if (receiptForm.payer_type === 'student' && !receiptForm.student_id) {
      Alert.alert('Receipt builder', 'Choose a student receipt target.');
      return;
    }

    const amount = validItems.reduce((sum, item) => sum + item.total, 0);
    const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}`;

    setSavingReceipt(true);
    try {
      const receiptRow: ReceiptInsert = {
        receipt_number: receiptNumber,
        amount,
        currency: 'NGN',
        school_id: receiptForm.payer_type === 'school' ? receiptForm.school_id : null,
        student_id: receiptForm.payer_type === 'student' ? receiptForm.student_id : null,
        transaction_id: receiptForm.transaction_id || selectedTransaction?.id || null,
        metadata: {
          payer_type: receiptForm.payer_type,
          payer_name:
            receiptForm.payer_type === 'school'
              ? schools.find((school) => school.id === receiptForm.school_id)?.name ?? null
              : students.find((student) => student.id === receiptForm.student_id)?.full_name ?? null,
          payment_method: receiptForm.payment_method,
          payment_date: receiptForm.payment_date,
          reference: receiptForm.reference || receiptNumber,
          received_by: receiptForm.received_by || profile?.full_name || 'Accounts Team',
          notes: receiptForm.notes || null,
          items: validItems,
          deposit_account: accounts[0]
            ? {
                bank_name: accounts[0].bank_name,
                account_number: accounts[0].account_number,
                account_name: accounts[0].account_name,
              }
            : null,
        },
      };
      await paymentService.insertReceipt(receiptRow);

      setShowReceiptModal(false);
      setSelectedTransaction(null);
      setReceiptForm({
        payer_type: 'school',
        school_id: '',
        student_id: '',
        transaction_id: '',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString().split('T')[0],
        reference: '',
        received_by: '',
        notes: '',
        items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
      });
      await load();
    } catch (error: any) {
      Alert.alert('Receipt builder', error?.message ?? 'Could not save receipt.');
    } finally {
      setSavingReceipt(false);
    }
  };

  const saveBulkReceipts = async () => {
    const eligible = transactions.filter((tx) => {
      const hasReceipt = receipts.some((receipt) => receipt.transaction_id === tx.id);
      return !hasReceipt && (tx.payment_status === 'success' || tx.payment_status === 'completed');
    });

    if (!eligible.length) {
      Alert.alert('Bulk receipts', 'There are no successful transactions waiting for receipts.');
      return;
    }

    setSavingReceipt(true);
    try {
      const rows = eligible.map((tx, index) => ({
        receipt_number: `RCPT-${Date.now().toString(36).toUpperCase()}-${index + 1}`,
        amount: tx.amount,
        currency: tx.currency,
        school_id: tx.school_id,
        student_id: tx.portal_user_id,
        transaction_id: tx.id,
        metadata: {
          payer_type: tx.school_id ? 'school' : 'student',
          payment_method: tx.payment_method ?? 'bank_transfer',
          payment_date: (tx.paid_at ?? tx.created_at ?? new Date().toISOString()).split('T')[0],
          reference: tx.transaction_reference ?? null,
          received_by: profile?.full_name || 'Accounts Team',
          notes: 'Generated from bulk receipts.',
          items: [
            {
              description: 'Bulk payment receipt',
              quantity: 1,
              unit_price: tx.amount,
              total: tx.amount,
            },
          ],
        },
      }));

      await paymentService.insertReceipts(rows as ReceiptInsert[]);
      Alert.alert('Bulk receipts', `${rows.length} receipts generated.`);
      await load();
    } catch (error: any) {
      Alert.alert('Bulk receipts', error?.message ?? 'Could not generate bulk receipts.');
    } finally {
      setSavingReceipt(false);
    }
  };

  const deleteReceipt = async (receipt: ReceiptRow) => {
    Alert.alert('Delete receipt', `Delete ${receipt.receipt_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentService.deleteReceipt(receipt.id);
          } catch (e: any) {
            Alert.alert('Receipt', e?.message ?? 'Delete failed');
            return;
          }
          await load();
        },
      },
    ]);
  };

  const exportInvoice = async (invoice: InvoiceRow) => {
    setExporting(true);
    try {
      const transaction = findTransaction(invoice.id);
      const rows = invoice.items.length
        ? invoice.items
            .map(
              (item) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;">${item.description}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:center;">${item.quantity}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:right;">${formatMoney(item.unit_price, invoice.currency)}</td>
                  <td style="padding:8px 0;border-bottom:1px solid #d7e0ec;text-align:right;">${formatMoney(item.total, invoice.currency)}</td>
                </tr>`
            )
            .join('')
        : '<tr><td colspan="4" style="padding:12px 0;color:#6d7c93;">No line items recorded.</td></tr>';

      const accountRows = accounts.length
        ? accounts
            .map(
              (account) => `
                <div style="margin-bottom:10px;padding:12px;border:1px solid #d7e0ec;border-radius:12px;">
                  <strong>${account.label}</strong><br />
                  ${account.bank_name} · ${account.account_number}<br />
                  ${account.account_name}
                  ${account.payment_note ? `<br /><span style="color:#6d7c93;">${account.payment_note}</span>` : ''}
                </div>`
            )
            .join('')
        : '<p style="color:#6d7c93;">No bank account instructions configured.</p>';

      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #172439;">
            <h1 style="margin-bottom:4px;">Invoice ${invoice.invoice_number}</h1>
            <p style="margin-top:0;color:#6d7c93;">${invoice.portal_users?.full_name || invoice.schools?.name || 'Billing Record'}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
            <p><strong>Created:</strong> ${formatDate(invoice.created_at)}</p>
            <p><strong>Due:</strong> ${formatDate(invoice.due_date)}</p>
            ${invoice.payment_link ? `<p><strong>Paystack:</strong> ${invoice.payment_link}</p>` : ''}
            ${transaction ? `<p><strong>Transaction:</strong> ${(transaction.payment_method ?? 'pending').toUpperCase()} · ${(transaction.payment_status ?? 'pending').toUpperCase()} · ${transaction.transaction_reference ?? 'N/A'}</p>` : ''}
            <table style="width:100%; border-collapse:collapse; margin-top:24px;">
              <thead>
                <tr>
                  <th style="text-align:left; padding-bottom:10px;">Item</th>
                  <th style="text-align:center; padding-bottom:10px;">Qty</th>
                  <th style="text-align:right; padding-bottom:10px;">Unit</th>
                  <th style="text-align:right; padding-bottom:10px;">Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <h2 style="text-align:right; margin-top:24px;">Total: ${formatMoney(invoice.amount, invoice.currency)}</h2>
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
            <hr style="margin:24px 0;" />
            <h3>Payment Instructions</h3>
            ${accountRows}
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Invoice Exported', uri);
      }
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message ?? 'Could not generate the invoice PDF.');
    } finally {
      setExporting(false);
    }
  };

  const renderInvoiceCards = () => {
    if (!filteredInvoices.length) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyCode, { color: colors.textMuted }]}>PM</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No invoices match this filter.</Text>
        </View>
      );
    }

    return filteredInvoices.map((invoice, index) => {
      const target = invoice.portal_users?.full_name || invoice.schools?.name || 'Billing record';
      const statusColor = getStatusColor(invoice.status);
      const tx = findTransaction(invoice.id);
      return (
        <MotiView key={invoice.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 24 }}>
          <TouchableOpacity activeOpacity={0.92} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setSelectedInvoice(invoice)}>
            <View style={styles.cardHeader}>
              <View style={[styles.codePill, { backgroundColor: colors.primaryPale }]}> 
                <Text style={[styles.codeText, { color: colors.primary }]}>{invoice.school_id ? 'SCH' : 'INV'}</Text>
                <Text style={[styles.codeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{target.toUpperCase()}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '14', borderColor: statusColor + '35' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{invoice.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{invoice.items[0]?.description || invoice.notes || 'Billing invoice'}</Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>{invoice.invoice_number}</Text>
              </View>
              <Text style={[styles.cardAmount, { color: colors.textPrimary }]}>{formatMoney(invoice.amount, invoice.currency)}</Text>
            </View>

            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>CREATED {formatDate(invoice.created_at)}</Text>
              <Text style={[styles.cardMeta, { color: invoice.status === 'overdue' ? colors.error : colors.textMuted }]}>DUE {formatDate(invoice.due_date)}</Text>
              <Text style={[styles.cardMeta, { color: tx ? colors.success : colors.primary }]}>{tx ? `TX ${(tx.payment_status ?? 'pending').toUpperCase()}` : invoice.payment_link ? 'PAYSTACK' : 'BANK'}</Text>
            </View>
          </TouchableOpacity>
        </MotiView>
      );
    });
  };

  const renderTransactionCards = () => {
    if (!filteredTransactions.length) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyCode, { color: colors.textMuted }]}>TX</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions available yet.</Text>
        </View>
      );
    }

    return filteredTransactions.map((tx, index) => {
      const linkedInvoice = invoices.find((invoice) => invoice.id === tx.invoice_id);
      const txColor = getStatusColor(tx.payment_status);
      const linkedReceipt = receipts.find((receipt) => receipt.transaction_id === tx.id);
      return (
        <MotiView key={tx.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 20 }}>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
            <View style={styles.cardHeader}>
              <Text style={[styles.transactionTitle, { color: colors.textPrimary }]} numberOfLines={1}>{tx.transaction_reference || 'PAYMENT TRANSACTION'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: txColor + '14', borderColor: txColor + '35' }]}>
                <Text style={[styles.statusText, { color: txColor }]}>{(tx.payment_status ?? 'pending').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{(tx.payment_method ?? 'paystack').toUpperCase()} PAYMENT</Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={2}>{linkedInvoice?.invoice_number || 'No linked invoice'}</Text>
              </View>
              <Text style={[styles.cardAmount, { color: colors.textPrimary }]}>{formatMoney(tx.amount, tx.currency)}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>CREATED {formatDate(tx.created_at)}</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>PAID {formatDate(tx.paid_at)}</Text>
              <TouchableOpacity onPress={() => openReceipt(tx)} disabled={!tx.receipt_url}>
                <Text style={[styles.cardMeta, { color: tx.receipt_url ? colors.primary : colors.textMuted }]}>{tx.receipt_url ? 'RECEIPT' : 'NO RECEIPT'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>GATEWAY {tx.external_transaction_id ?? 'N/A'}</Text>
              {tx.refunded_at ? <Text style={[styles.cardMeta, { color: colors.error }]}>REFUNDED {formatDate(tx.refunded_at)}</Text> : null}
              {linkedReceipt ? <Text style={[styles.cardMeta, { color: colors.success }]}>{linkedReceipt.receipt_number}</Text> : null}
            </View>
            {canManage ? (
              <View style={styles.adminActionsRow}>
                {(tx.payment_status === 'pending' || tx.payment_status === 'processing') ? (
                  <TouchableOpacity style={[styles.manageBtn, { backgroundColor: colors.success, borderColor: colors.success }]} onPress={() => updateTransactionStatus(tx, 'success')}>
                    <Text style={styles.manageBtnPrimaryText}>APPROVE</Text>
                  </TouchableOpacity>
                ) : null}
                {(tx.payment_status === 'success' || tx.payment_status === 'completed') ? (
                  <TouchableOpacity
                    style={[styles.manageBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => {
                      setSelectedTransaction(tx);
                      setReceiptForm((current) => ({
                        ...current,
                        payer_type: tx.school_id ? 'school' : 'student',
                        school_id: tx.school_id ?? '',
                        student_id: tx.portal_user_id ?? '',
                        transaction_id: tx.id,
                        payment_method: tx.payment_method ?? 'bank_transfer',
                        payment_date: (tx.paid_at ?? tx.created_at ?? new Date().toISOString()).split('T')[0],
                        reference: tx.transaction_reference ?? '',
                      }));
                      setShowReceiptModal(true);
                    }}
                  >
                    <Text style={styles.manageBtnPrimaryText}>{linkedReceipt ? 'REISSUE RECEIPT' : 'ISSUE RECEIPT'}</Text>
                  </TouchableOpacity>
                ) : null}
                {(tx.payment_status === 'success' || tx.payment_status === 'completed') ? (
                  <TouchableOpacity style={[styles.manageBtn, { backgroundColor: colors.bgCard, borderColor: colors.error }]} onPress={() => updateTransactionStatus(tx, 'refunded', 'Manual refund')}>
                    <Text style={[styles.manageBtnPrimaryText, { color: colors.error }]}>REFUND</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </MotiView>
      );
    });
  };

  const renderAccounts = () => {
    if (!accounts.length) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyCode, { color: colors.textMuted }]}>AC</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No payment accounts configured yet.</Text>
        </View>
      );
    }

    return accounts.map((account, index) => (
      <MotiView key={account.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 20 }}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}>
            <Text style={[styles.transactionTitle, { color: colors.textPrimary }]} numberOfLines={1}>{account.label.toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: colors.primaryPale, borderColor: colors.primaryGlow }]}> 
              <Text style={[styles.statusText, { color: colors.primary }]}>{account.owner_type.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{account.bank_name}</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{account.account_name}</Text>
          <Text style={[styles.accountNumber, { color: colors.textPrimary }]}>{account.account_number}</Text>
          {account.payment_note ? <Text style={[styles.accountNote, { color: colors.textMuted }]}>{account.payment_note}</Text> : null}
        </View>
      </MotiView>
    ));
  };
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={canManage ? 'PAYMENTS HUB' : 'BILLING'} onBack={() => navigation.goBack()} />

      {canManage ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.BulkPayments)}
            style={[styles.manageBtn, { backgroundColor: colors.bgCard, borderColor: colors.primary, alignSelf: 'flex-start' }]}
          >
            <Text style={[styles.manageBtnPrimaryText, { color: colors.primary }]}>BULK PAYMENTS WIZARD</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.warning }]}>OUTSTANDING</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatMoney(stats.outstandingAmount, stats.currency)}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>Open invoices</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.success }]}>COLLECTED</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatMoney(stats.paidAmount, stats.currency)}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>Paid invoices</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.primary }]}>PAYSTACK</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{stats.successTransactions}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>{stats.overdueCount} overdue</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.error }]}>REFUNDS</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{stats.refundedTransactions}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>Finance reversals</Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
        <Text style={[styles.searchLabel, { color: colors.primary }]}>FIND</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search invoice, recipient, transaction..." placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {[
          { key: 'invoices', label: 'INVOICES' },
          { key: 'transactions', label: 'TRANSACTIONS' },
          { key: 'receipts', label: 'RECEIPTS' },
          { key: 'accounts', label: 'ACCOUNTS' },
        ].map((item) => (
          <TouchableOpacity key={item.key} onPress={() => setTab(item.key as BillingTab)} style={[
            styles.filterChip,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
            tab === item.key && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
          ]}>
            <Text style={[styles.filterText, { color: tab === item.key ? colors.primary : colors.textMuted }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {canManage && (tab === 'accounts' || tab === 'receipts') ? (
        <View style={styles.adminActionsRow}>
          {tab === 'accounts' ? (
            <TouchableOpacity style={[styles.manageBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => openAccountEditor()}>
              <Text style={styles.manageBtnPrimaryText}>ADD ACCOUNT</Text>
            </TouchableOpacity>
          ) : null}
          {tab === 'receipts' ? (
            <>
              <TouchableOpacity style={[styles.manageBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setShowReceiptModal(true)}>
                <Text style={styles.manageBtnPrimaryText}>ISSUE RECEIPT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.manageBtn, { backgroundColor: colors.bgCard, borderColor: colors.primary }]} onPress={saveBulkReceipts} disabled={savingReceipt}>
                <Text style={[styles.manageBtnPrimaryText, { color: colors.primary }]}>{savingReceipt ? 'RUNNING...' : 'BULK RECEIPTS'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {tab === 'invoices' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {[
            { key: 'all', label: 'ALL' },
            { key: 'sent', label: 'SENT' },
            { key: 'paid', label: 'PAID' },
            { key: 'overdue', label: 'OVERDUE' },
            { key: 'draft', label: 'DRAFT' },
          ].map((item) => (
            <TouchableOpacity key={item.key} onPress={() => setStatusFilter(item.key as 'all' | InvoiceStatus)} style={[
              styles.filterChip,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              statusFilter === item.key && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
            ]}>
              <Text style={[styles.filterText, { color: statusFilter === item.key ? colors.primary : colors.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loaderText, { color: colors.textMuted }]}>Loading billing workspace...</Text>
        </View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {tab === 'invoices' ? renderInvoiceCards() : null}
          {tab === 'transactions' ? renderTransactionCards() : null}
          {tab === 'receipts'
            ? filteredReceipts.map((receipt, index) => {
                const schoolName = schools.find((school) => school.id === receipt.school_id)?.name ?? null;
                const studentName = students.find((student) => student.id === receipt.student_id)?.full_name ?? null;
                return (
                  <MotiView key={receipt.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 24 }}>
                    <TouchableOpacity
                      activeOpacity={0.92}
                      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                      onPress={() => exportReceiptPdf(receipt)}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.codePill, { backgroundColor: colors.primaryPale }]}>
                          <Text style={[styles.codeText, { color: colors.primary }]}>RCT</Text>
                          <Text style={[styles.codeLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                            {(studentName || schoolName || 'PAYMENT RECEIPT').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardBody}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{receipt.receipt_number}</Text>
                          <Text style={[styles.cardSub, { color: colors.textMuted }]}>{receipt.metadata?.reference ?? 'Manual receipt'}</Text>
                        </View>
                        <Text style={[styles.cardAmount, { color: colors.textPrimary }]}>{formatMoney(receipt.amount, receipt.currency || 'NGN')}</Text>
                      </View>
                      <View style={styles.cardMetaRow}>
                        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>ISSUED {formatDate(receipt.issued_at)}</Text>
                        <Text style={[styles.cardMeta, { color: colors.primary }]}>{receipt.student_id ? 'INDIVIDUAL' : 'SCHOOL'}</Text>
                        {canManage ? (
                          <TouchableOpacity onPress={() => deleteReceipt(receipt)}>
                            <Text style={[styles.cardMeta, { color: colors.error }]}>DELETE</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </MotiView>
                );
              })
            : null}
          {tab === 'accounts' ? renderAccounts() : null}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <Modal visible={!!selectedInvoice} animationType="slide" transparent onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            {selectedInvoice ? (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalEyebrow, { color: colors.primary }]}>PAYMENT VIEW</Text>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedInvoice.invoice_number}</Text>
                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>{selectedInvoice.portal_users?.full_name || selectedInvoice.schools?.name || 'Billing record'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={[styles.closeBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                    <Text style={[styles.heroStatus, { color: getStatusColor(selectedInvoice.status) }]}>{selectedInvoice.status.toUpperCase()}</Text>
                    <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>{formatMoney(selectedInvoice.amount, selectedInvoice.currency)}</Text>
                    <Text style={[styles.heroMeta, { color: colors.textMuted }]}>CREATED {formatDate(selectedInvoice.created_at)}</Text>
                    <Text style={[styles.heroMeta, { color: selectedInvoice.status === 'overdue' ? colors.error : colors.textMuted }]}>DUE {formatDate(selectedInvoice.due_date)}</Text>
                    <Text style={[styles.heroMeta, { color: selectedInvoice.payment_link ? colors.primary : colors.textMuted }]}>{selectedInvoice.payment_link ? 'PAYSTACK CHECKOUT READY' : 'BANK PAYMENT FLOW ACTIVE'}</Text>
                  </View>

                  <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>LINE ITEMS</Text>
                    {selectedInvoice.items.length ? selectedInvoice.items.map((item, index) => (
                      <View key={`${selectedInvoice.id}-${index}`} style={[styles.lineRow, { borderBottomColor: colors.border }]}> 
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{item.description}</Text>
                          <Text style={[styles.lineMeta, { color: colors.textMuted }]}>{item.quantity} x {formatMoney(item.unit_price, selectedInvoice.currency)}</Text>
                        </View>
                        <Text style={[styles.lineAmount, { color: colors.textPrimary }]}>{formatMoney(item.total, selectedInvoice.currency)}</Text>
                      </View>
                    )) : <Text style={[styles.sectionBody, { color: colors.textMuted }]}>No line items were recorded on this invoice.</Text>}
                  </View>

                  {selectedInvoice.notes ? (
                    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTES</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{selectedInvoice.notes}</Text>
                    </View>
                  ) : null}

                  {findTransaction(selectedInvoice.id) ? (
                    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PAYSTACK / TRANSACTION</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>METHOD: {(findTransaction(selectedInvoice.id)?.payment_method ?? 'pending').toUpperCase()}</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>STATUS: {(findTransaction(selectedInvoice.id)?.payment_status ?? 'pending').toUpperCase()}</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>REFERENCE: {findTransaction(selectedInvoice.id)?.transaction_reference ?? 'N/A'}</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>PAID AT: {formatDate(findTransaction(selectedInvoice.id)?.paid_at ?? null)}</Text>
                    </View>
                  ) : null}

                  {accounts.length ? (
                    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>BANK PAYMENT OPTIONS</Text>
                      {accounts.map((account) => (
                        <View key={account.id} style={[styles.bankCard, { borderColor: colors.border }]}> 
                          <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{account.label}</Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{account.bank_name} · {account.account_number}</Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{account.account_name}</Text>
                          {account.payment_note ? <Text style={[styles.bankNote, { color: colors.textMuted }]}>{account.payment_note}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[styles.actionsRow, { borderTopColor: colors.border }]}> 
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} disabled={exporting} onPress={() => exportInvoice(selectedInvoice)}>
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>{exporting ? 'EXPORTING...' : 'PRINT PDF'}</Text>
                  </TouchableOpacity>

                  {!canManage && selectedInvoice.status !== 'paid' ? (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => openPayment(selectedInvoice)}>
                      <Text style={styles.actionPrimaryText}>{selectedInvoice.payment_link ? 'PAY WITH PAYSTACK' : 'PAYMENT INFO'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {findTransaction(selectedInvoice.id)?.receipt_url ? (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => openReceipt(findTransaction(selectedInvoice.id))}>
                      <Text style={[styles.actionText, { color: colors.primary }]}>OPEN RECEIPT</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canManage && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' ? (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success, borderColor: colors.success }]} onPress={() => markPaid(selectedInvoice)}>
                      <Text style={styles.actionPrimaryText}>MARK PAID</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canManage && selectedInvoice.status === 'draft' ? (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => updateInvoiceStatus(selectedInvoice, 'sent')}>
                      <Text style={styles.actionPrimaryText}>SEND INVOICE</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canManage && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'paid' ? (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.error }]} onPress={() => updateInvoiceStatus(selectedInvoice, 'cancelled')}>
                      <Text style={[styles.actionText, { color: colors.error }]}>CANCEL</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showAccountModal} animationType="slide" transparent onRequestClose={() => setShowAccountModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalEyebrow, { color: colors.primary }]}>ACCOUNT MANAGER</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{editingAccount ? 'Edit account' : 'New payment account'}</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Control the bank instructions mobile users will see.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAccountModal(false)} style={[styles.closeBtn, { borderColor: colors.border }]}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {[
                { key: 'label', label: 'LABEL', placeholder: 'School collections' },
                { key: 'bank_name', label: 'BANK', placeholder: 'Bank name' },
                { key: 'account_number', label: 'ACCOUNT NUMBER', placeholder: '0123456789' },
                { key: 'account_name', label: 'ACCOUNT NAME', placeholder: 'Rillcod Technologies' },
              ].map((field) => (
                <View key={field.key}>
                  <Text style={[styles.formLabel, { color: colors.textMuted }]}>{field.label}</Text>
                  <TextInput
                    value={(accountForm as any)[field.key]}
                    onChangeText={(value) => setAccountForm((current) => ({ ...current, [field.key]: value }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  />
                </View>
              ))}

              <View>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>OWNER</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                  {[
                    { key: 'rillcod', label: 'RILLCOD' },
                    { key: 'school', label: 'SCHOOL' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setAccountForm((current) => ({ ...current, owner_type: item.key, school_id: item.key === 'school' ? current.school_id || profile?.school_id || '' : '' }))}
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.bgCard, borderColor: colors.border },
                        accountForm.owner_type === item.key && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.filterText, { color: accountForm.owner_type === item.key ? colors.primary : colors.textMuted }]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>ACCOUNT TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                  {['savings', 'current'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setAccountForm((current) => ({ ...current, account_type: item }))}
                      style={[
                        styles.filterChip,
                        { backgroundColor: colors.bgCard, borderColor: colors.border },
                        accountForm.account_type === item && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.filterText, { color: accountForm.account_type === item ? colors.primary : colors.textMuted }]}>{item.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={[styles.formLabel, { color: colors.textMuted }]}>PAYMENT NOTE</Text>
                <TextInput
                  value={accountForm.payment_note}
                  onChangeText={(value) => setAccountForm((current) => ({ ...current, payment_note: value }))}
                  placeholder="Tell users how to describe or confirm payment."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.formInput, styles.formArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
                />
              </View>
            </ScrollView>

            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              {editingAccount ? (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.error }]} onPress={() => { setShowAccountModal(false); deleteAccount(editingAccount); }}>
                  <Text style={[styles.actionText, { color: colors.error }]}>DELETE</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setShowAccountModal(false)}>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={saveAccount} disabled={savingAccount}>
                <Text style={styles.actionPrimaryText}>{savingAccount ? 'SAVING...' : editingAccount ? 'UPDATE' : 'SAVE ACCOUNT'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showReceiptModal} animationType="slide" transparent onRequestClose={() => setShowReceiptModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalEyebrow, { color: colors.primary }]}>RECEIPT BUILDER</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Issue receipt</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>Create receipts for schools or individual learners.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)} style={[styles.closeBtn, { borderColor: colors.border }]}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.formLabel, { color: colors.textMuted }]}>TARGET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                {[
                  { key: 'school', label: 'SCHOOL' },
                  { key: 'student', label: 'INDIVIDUAL' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setReceiptForm((current) => ({ ...current, payer_type: item.key as ReceiptPayerType, school_id: '', student_id: '' }))}
                    style={[
                      styles.filterChip,
                      { backgroundColor: colors.bgCard, borderColor: colors.border },
                      receiptForm.payer_type === item.key && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: receiptForm.payer_type === item.key ? colors.primary : colors.textMuted }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {receiptForm.payer_type === 'school' ? (
                <>
                  <Text style={[styles.formLabel, { color: colors.textMuted }]}>SCHOOL</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                    {schools.map((school) => (
                      <TouchableOpacity
                        key={school.id}
                        onPress={() => setReceiptForm((current) => ({ ...current, school_id: school.id }))}
                        style={[
                          styles.filterChip,
                          { backgroundColor: colors.bgCard, borderColor: colors.border },
                          receiptForm.school_id === school.id && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[styles.filterText, { color: receiptForm.school_id === school.id ? colors.primary : colors.textMuted }]}>{school.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={[styles.formLabel, { color: colors.textMuted }]}>STUDENT</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                    {students.map((student) => (
                      <TouchableOpacity
                        key={student.id}
                        onPress={() => setReceiptForm((current) => ({ ...current, student_id: student.id }))}
                        style={[
                          styles.filterChip,
                          { backgroundColor: colors.bgCard, borderColor: colors.border },
                          receiptForm.student_id === student.id && { backgroundColor: colors.primaryPale, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[styles.filterText, { color: receiptForm.student_id === student.id ? colors.primary : colors.textMuted }]}>{student.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[styles.formLabel, { color: colors.textMuted }]}>PAYMENT METHOD</Text>
              <TextInput value={receiptForm.payment_method} onChangeText={(value) => setReceiptForm((current) => ({ ...current, payment_method: value }))} placeholder="bank_transfer" placeholderTextColor={colors.textMuted} style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
              <Text style={[styles.formLabel, { color: colors.textMuted }]}>PAYMENT DATE</Text>
              <TextInput value={receiptForm.payment_date} onChangeText={(value) => setReceiptForm((current) => ({ ...current, payment_date: value }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
              <Text style={[styles.formLabel, { color: colors.textMuted }]}>REFERENCE</Text>
              <TextInput value={receiptForm.reference} onChangeText={(value) => setReceiptForm((current) => ({ ...current, reference: value }))} placeholder="Transaction or teller reference" placeholderTextColor={colors.textMuted} style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
              <Text style={[styles.formLabel, { color: colors.textMuted }]}>RECEIVED BY</Text>
              <TextInput value={receiptForm.received_by} onChangeText={(value) => setReceiptForm((current) => ({ ...current, received_by: value }))} placeholder="Accounts officer" placeholderTextColor={colors.textMuted} style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />

              <View style={styles.lineBuilderHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>RECEIPT ITEMS</Text>
                <TouchableOpacity onPress={addReceiptItem}>
                  <Text style={[styles.addLineText, { color: colors.primary }]}>+ Add line</Text>
                </TouchableOpacity>
              </View>
              {receiptForm.items.map((item, index) => (
                <View key={`receipt-item-${index}`} style={[styles.builderCard, { borderColor: colors.border }]}>
                  <TextInput value={item.description} onChangeText={(value) => updateReceiptItem(index, { description: value })} placeholder="Description" placeholderTextColor={colors.textMuted} style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
                  <View style={styles.builderRow}>
                    <TextInput value={String(item.quantity)} onChangeText={(value) => updateReceiptItem(index, { quantity: Number(value || 0) })} keyboardType="number-pad" placeholder="Qty" placeholderTextColor={colors.textMuted} style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
                    <TextInput value={String(item.unit_price)} onChangeText={(value) => updateReceiptItem(index, { unit_price: Number(value || 0) })} keyboardType="number-pad" placeholder="Unit price" placeholderTextColor={colors.textMuted} style={[styles.formInput, styles.builderHalf, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
                  </View>
                  <View style={styles.builderFooter}>
                    <Text style={[styles.lineTotalLabel, { color: colors.textMuted }]}>TOTAL</Text>
                    <Text style={[styles.lineTotalValue, { color: colors.textPrimary }]}>{formatMoney(item.total, 'NGN')}</Text>
                  </View>
                  {receiptForm.items.length > 1 ? (
                    <TouchableOpacity onPress={() => removeReceiptItem(index)}>
                      <Text style={[styles.removeLineText, { color: colors.error }]}>Remove line</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              <Text style={[styles.formLabel, { color: colors.textMuted }]}>NOTES</Text>
              <TextInput value={receiptForm.notes} onChangeText={(value) => setReceiptForm((current) => ({ ...current, notes: value }))} multiline placeholder="Optional receipt note" placeholderTextColor={colors.textMuted} style={[styles.formInput, styles.formArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} />
            </ScrollView>

            <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setShowReceiptModal(false)}>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>CLOSE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={saveReceipt} disabled={savingReceipt}>
                <Text style={styles.actionPrimaryText}>{savingReceipt ? 'SAVING...' : 'ISSUE RECEIPT'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    adminActionsRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
    manageBtn: { minHeight: 44, borderWidth: 1, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    manageBtnPrimaryText: { color: colors.white100, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    summaryCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
    summaryLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginBottom: 8 },
    summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
    summaryMeta: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 10 },
    searchLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    tabsRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm, gap: SPACING.sm },
    filtersRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
    filterChip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
    filterText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loaderText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
    card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
    codePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, flex: 1, marginRight: SPACING.sm },
    codeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    codeLabel: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
    statusBadge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4 },
    statusText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wider },
    cardBody: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
    cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, lineHeight: 20 },
    cardSub: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    cardAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, textAlign: 'right' },
    cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    cardMeta: { fontFamily: FONT_FAMILY.body, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
    transactionTitle: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: LETTER_SPACING.wide },
    accountNumber: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, letterSpacing: LETTER_SPACING.wider, marginTop: 4 },
    accountNote: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: 11, lineHeight: 18 },
    emptyWrap: { alignItems: 'center', paddingVertical: 72, gap: 10 },
    emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
    emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,22,36,0.68)', justifyContent: 'flex-end' },
    modalCard: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.xl, borderBottomWidth: 1 },
    modalEyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginBottom: 8 },
    modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    modalSub: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    closeBtn: { width: 40, height: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
    modalBody: { padding: SPACING.xl, gap: SPACING.lg },
    heroCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
    heroStatus: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginBottom: 8 },
    heroAmount: { fontFamily: FONT_FAMILY.display, fontSize: 28, marginBottom: 8 },
    heroMeta: { marginTop: 2, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    sectionCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
    sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: LETTER_SPACING.wider, marginBottom: SPACING.md },
    sectionBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, lineHeight: 20 },
    formLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginBottom: 8 },
    formInput: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    formArea: { minHeight: 88, textAlignVertical: 'top' },
    lineBuilderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    addLineText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: LETTER_SPACING.wide },
    builderCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
    builderRow: { flexDirection: 'row', gap: SPACING.sm },
    builderHalf: { flex: 1 },
    builderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    lineTotalLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    lineTotalValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
    removeLineText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11 },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    lineTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13 },
    lineMeta: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: 11 },
    lineAmount: { fontFamily: FONT_FAMILY.display, fontSize: 14 },
    bankCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
    bankNote: { marginTop: 6, fontFamily: FONT_FAMILY.body, fontSize: 11, lineHeight: 18 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, padding: SPACING.xl, borderTopWidth: 1 },
    actionButton: { minHeight: 48, minWidth: 120, flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    actionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    actionPrimaryText: { color: colors.white100, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
  });

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
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { paymentService } from '../../services/payment.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { shareCsv } from '../../lib/csv';

type PaymentStatus = 'success' | 'completed' | 'pending' | 'processing' | 'failed' | 'refunded';

type TransactionRow = {
  id: string;
  amount: number;
  currency: string;
  external_transaction_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_gateway_response: any;
  transaction_reference: string | null;
  created_at: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  invoice_id: string | null;
  school_id: string | null;
  portal_user_id: string | null;
  courses: { title: string | null } | null;
  schools: { name: string | null } | null;
  portal_users: { full_name: string | null; email: string | null } | null;
  invoices: { invoice_number: string | null } | null;
};

type ReceiptRow = {
  id: string;
  receipt_number: string;
  amount: number;
  currency: string | null;
  issued_at: string | null;
  pdf_url: string | null;
  school_id: string | null;
  student_id: string | null;
  transaction_id: string | null;
  metadata: any;
};

function formatMoney(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB') : 'N/A';
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  paystack: 'Paystack',
  stripe: 'Stripe',
  cash: 'Cash',
  pos: 'POS',
  cheque: 'Cheque',
  online: 'Online',
};

export default function TransactionsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    received_by: profile?.full_name ?? '',
    reference: '',
    notes: '',
  });

  const isAdmin = profile?.role === 'admin';
  const isSchool = profile?.role === 'school';
  const canView = isAdmin || isSchool;

  const load = useCallback(async () => {
    if (!profile || !canView) {
      setTransactions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await paymentService.listFinanceConsoleTransactionsWithJoins({
        schoolId: isSchool && profile.school_id ? profile.school_id : undefined,
      });
      const receiptRows = await paymentService.listReceiptsForFinanceConsole(200);
      setTransactions(
        ((data ?? []) as any[]).map((tx) => ({
          id: tx.id,
          amount: Number(tx.amount ?? 0),
          currency: tx.currency ?? 'NGN',
          external_transaction_id: tx.external_transaction_id ?? null,
          payment_method: tx.payment_method ?? null,
          payment_status: tx.payment_status ?? 'pending',
          payment_gateway_response: tx.payment_gateway_response ?? null,
          transaction_reference: tx.transaction_reference ?? null,
          created_at: tx.created_at ?? null,
          paid_at: tx.paid_at ?? null,
          receipt_url: tx.receipt_url ?? null,
          refund_reason: tx.refund_reason ?? null,
          refunded_at: tx.refunded_at ?? null,
          invoice_id: tx.invoice_id ?? null,
          school_id: tx.school_id ?? null,
          portal_user_id: tx.portal_user_id ?? null,
          courses: tx.courses ?? null,
          schools: tx.schools ?? null,
          portal_users: tx.portal_users ?? null,
          invoices: tx.invoices ?? null,
        }))
      );
      setReceipts((receiptRows ?? []) as ReceiptRow[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView, isSchool, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTransactions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const displayName = tx.portal_users?.full_name || tx.schools?.name || tx.invoices?.invoice_number || '';
      const statusMatch =
        statusFilter === 'all' ||
        tx.payment_status === statusFilter ||
        (statusFilter === 'completed' && tx.payment_status === 'success');
      const queryMatch =
        !search ||
        (tx.transaction_reference ?? '').toLowerCase().includes(search) ||
        (tx.payment_method ?? '').toLowerCase().includes(search) ||
        displayName.toLowerCase().includes(search);
      return statusMatch && queryMatch;
    });
  }, [query, statusFilter, transactions]);

  const stats = useMemo(() => {
    const completed = transactions.filter((tx) => tx.payment_status === 'success' || tx.payment_status === 'completed');
    return {
      total: transactions.length,
      completed: completed.length,
      revenue: completed.reduce((sum, tx) => sum + tx.amount, 0),
      pending: transactions.filter((tx) => tx.payment_status === 'pending' || tx.payment_status === 'processing').length,
      refunded: transactions.filter((tx) => tx.payment_status === 'refunded').length,
      receipts: receipts.length,
    };
  }, [receipts.length, transactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const statusTone = useCallback((status: string | null | undefined) => {
    if (status === 'success' || status === 'completed') return colors.success;
    if (status === 'failed') return colors.error;
    if (status === 'refunded') return colors.info;
    return colors.warning;
  }, [colors]);

  const openReceipt = useCallback(async (tx: TransactionRow) => {
    const savedReceipt = receipts.find((item) => item.transaction_id === tx.id);
    const receiptLink = savedReceipt?.pdf_url ?? tx.receipt_url;
    if (!receiptLink) {
      Alert.alert('Receipt Unavailable', 'This transaction does not have a receipt file yet.');
      return;
    }
    const supported = await Linking.canOpenURL(receiptLink);
    if (supported) await Linking.openURL(receiptLink);
  }, [receipts]);

  const updateTransactionStatus = useCallback(async (
    tx: TransactionRow,
    status: PaymentStatus,
    extras?: { refund_reason?: string | null }
  ) => {
    await paymentService.financeApplyTransactionStatus({
      transactionId: tx.id,
      invoiceId: tx.invoice_id,
      status,
      refundReason: extras?.refund_reason ?? undefined,
    });

    await load();
  }, [load]);

  const approveTransaction = useCallback(async (tx: TransactionRow) => {
    if (!isAdmin) return;

    Alert.alert('Approve Transaction', `Mark ${tx.transaction_reference ?? 'this transaction'} as successful?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setApprovingId(tx.id);
          try {
            await updateTransactionStatus(tx, 'success');
          } finally {
            setApprovingId(null);
          }
        },
      },
    ]);
  }, [isAdmin, updateTransactionStatus]);

  const markRefunded = useCallback((tx: TransactionRow) => {
    if (!isAdmin) return;
    Alert.prompt?.(
      'Refund reason',
      'Why is this transaction being refunded?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async (value?: string) => {
            await updateTransactionStatus(tx, 'refunded', { refund_reason: value || 'Manual refund' });
          },
        },
      ],
      'plain-text'
    );
    if (!(Alert as any).prompt) {
      Alert.alert('Refund Transaction', 'Mark this transaction as refunded?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            await updateTransactionStatus(tx, 'refunded', { refund_reason: 'Manual refund' });
          },
        },
      ]);
    }
  }, [isAdmin, updateTransactionStatus]);

  const issueReceipt = useCallback(async () => {
    if (!selectedTransaction || !profile) return;
    setSavingReceipt(true);
    try {
      const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}`;
      const existingReceipt = receipts.find((item) => item.transaction_id === selectedTransaction.id);
      if (existingReceipt) {
        setShowReceiptModal(false);
        await openReceipt(selectedTransaction);
        return;
      }

      await paymentService.insertReceipt({
        receipt_number: receiptNumber,
        amount: selectedTransaction.amount,
        currency: selectedTransaction.currency,
        school_id: selectedTransaction.school_id,
        student_id: selectedTransaction.portal_user_id,
        transaction_id: selectedTransaction.id,
        metadata: {
          payer_name: selectedTransaction.portal_users?.full_name || selectedTransaction.schools?.name || 'Client',
          payer_type: selectedTransaction.school_id ? 'school' : 'student',
          payment_method: selectedTransaction.payment_method,
          payment_date: receiptForm.payment_date,
          reference: receiptForm.reference || selectedTransaction.transaction_reference || receiptNumber,
          received_by: receiptForm.received_by || profile.full_name || 'Accounts Team',
          notes: receiptForm.notes || null,
          items: [
            {
              description: selectedTransaction.invoices?.invoice_number || selectedTransaction.courses?.title || 'Payment settlement',
              quantity: 1,
              unit_price: selectedTransaction.amount,
              total: selectedTransaction.amount,
            },
          ],
        },
      });

      setShowReceiptModal(false);
      setReceiptForm({
        payment_date: new Date().toISOString().split('T')[0],
        received_by: profile.full_name ?? '',
        reference: '',
        notes: '',
      });
      await load();
    } catch (error: any) {
      Alert.alert('Receipt', error?.message ?? 'Could not issue receipt.');
    } finally {
      setSavingReceipt(false);
    }
  }, [load, openReceipt, profile, receiptForm, receipts, selectedTransaction]);

  const exportTransactionsCsv = useCallback(async () => {
    if (filteredTransactions.length === 0) {
      Alert.alert('Export', 'No transactions in the current filter.');
      return;
    }
    const rows: string[][] = [
      [
        'id',
        'amount',
        'currency',
        'payment_status',
        'payment_method',
        'transaction_reference',
        'created_at',
        'paid_at',
        'payer',
        'school',
        'invoice',
      ],
      ...filteredTransactions.map((tx) => [
        tx.id,
        String(tx.amount),
        tx.currency,
        tx.payment_status ?? '',
        tx.payment_method ?? '',
        tx.transaction_reference ?? '',
        tx.created_at ?? '',
        tx.paid_at ?? '',
        tx.portal_users?.full_name ?? '',
        tx.schools?.name ?? '',
        tx.invoices?.invoice_number ?? '',
      ]),
    ];
    try {
      await shareCsv('transactions-export.csv', rows);
    } catch (e: any) {
      Alert.alert('Export', e?.message ?? 'Could not share CSV.');
    }
  }, [filteredTransactions]);

  const deleteTransaction = useCallback((tx: TransactionRow) => {
    if (!isAdmin) return;
    Alert.alert('Delete Transaction', `Delete ${tx.transaction_reference ?? 'this transaction'}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await paymentService.financeDeleteTransactionCascade({
            transactionId: tx.id,
            invoiceId: tx.invoice_id,
          });
          setSelectedTransaction(null);
          await load();
        },
      },
    ]);
  }, [isAdmin, load]);

  if (!canView) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Transactions"
          subtitle="Staff finance workspace"
          onBack={() => navigation.goBack()}
          rightAction={{ label: 'CSV', onPress: () => void exportTransactionsCsv() }}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>This screen is available to admin and school accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Transactions"
        subtitle="Payment records and approval history"
        onBack={() => navigation.goBack()}
        rightAction={{ label: 'CSV', onPress: () => void exportTransactionsCsv() }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statRow}>
          <StatCard label="Total" value={String(stats.total)} tone={colors.textPrimary} styles={styles} />
          <StatCard label="Revenue" value={formatMoney(stats.revenue)} tone={colors.success} styles={styles} />
          <StatCard label="Completed" value={String(stats.completed)} tone={colors.success} styles={styles} />
          <StatCard label="Pending" value={String(stats.pending)} tone={colors.warning} styles={styles} />
          <StatCard label="Refunded" value={String(stats.refunded)} tone={colors.error} styles={styles} />
          <StatCard label="Receipts" value={String(stats.receipts)} tone={colors.info} styles={styles} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by reference, payer, invoice"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'completed', 'pending', 'processing', 'failed', 'refunded'] as const).map((status) => {
            const active = statusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterPill, active && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterText, active && { color: colors.primary }]}>{status === 'all' ? 'All' : status}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyText}>Adjust the filters or wait for new payments to arrive.</Text>
          </View>
        ) : (
          filteredTransactions.map((tx) => {
            const expanded = expandedId === tx.id;
            const tone = statusTone(tx.payment_status);
            const title = tx.portal_users?.full_name || tx.schools?.name || tx.invoices?.invoice_number || 'Unknown payer';

            return (
              <View key={tx.id} style={styles.card}>
                <TouchableOpacity style={styles.cardTop} activeOpacity={0.84} onPress={() => { setExpandedId(expanded ? null : tx.id); setSelectedTransaction(tx); }}>
                  <View style={[styles.statusDot, { backgroundColor: tone }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>{title}</Text>
                      <Text style={[styles.statusBadge, { color: tone, borderColor: tone + '40', backgroundColor: tone + '14' }]}>
                        {(tx.payment_status ?? 'pending').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta}>
                      {METHOD_LABELS[tx.payment_method ?? ''] ?? (tx.payment_method ?? 'Payment')} · {tx.transaction_reference ?? 'No reference'}
                    </Text>
                    <Text style={styles.cardDate}>{formatDate(tx.created_at)}</Text>
                  </View>
                  <View style={styles.cardAmountWrap}>
                    <Text style={styles.cardAmount}>{formatMoney(tx.amount, tx.currency)}</Text>
                    <Text style={styles.openHint}>{expanded ? 'Hide' : 'Open'}</Text>
                  </View>
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.detailWrap}>
                    <DetailItem label="Payer" value={title} styles={styles} />
                    <DetailItem label="Invoice" value={tx.invoices?.invoice_number ?? 'N/A'} styles={styles} />
                    <DetailItem label="Course" value={tx.courses?.title ?? 'N/A'} styles={styles} />
                    <DetailItem label="Reference" value={tx.transaction_reference ?? 'N/A'} styles={styles} />
                    <DetailItem label="Gateway Ref" value={tx.external_transaction_id ?? 'N/A'} styles={styles} />
                    <DetailItem label="Created" value={formatDate(tx.created_at)} styles={styles} />
                    <DetailItem label="Paid At" value={formatDate(tx.paid_at)} styles={styles} />
                    <DetailItem label="Refunded At" value={formatDate(tx.refunded_at)} styles={styles} />
                    <DetailItem label="Refund Reason" value={tx.refund_reason ?? 'N/A'} styles={styles} />

                    {tx.payment_gateway_response ? (
                      <DetailItem label="Gateway Response" value={JSON.stringify(tx.payment_gateway_response)} styles={styles} />
                    ) : null}

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.secondaryBtn} onPress={() => openReceipt(tx)}>
                        <Text style={styles.secondaryBtnText}>Open Receipt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => {
                          setSelectedTransaction(tx);
                          setReceiptForm((current) => ({
                            ...current,
                            reference: tx.transaction_reference ?? '',
                            payment_date: (tx.paid_at ?? tx.created_at ?? new Date().toISOString()).split('T')[0],
                          }));
                          setShowReceiptModal(true);
                        }}
                      >
                        <Text style={styles.secondaryBtnText}>{receipts.find((item) => item.transaction_id === tx.id) ? 'View / Refresh Receipt' : 'Issue Receipt'}</Text>
                      </TouchableOpacity>
                      {tx.invoice_id ? (
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate(ROUTES.Invoices)}>
                          <Text style={styles.secondaryBtnText}>Open Invoices</Text>
                        </TouchableOpacity>
                      ) : null}
                      {isAdmin && (tx.payment_status === 'pending' || tx.payment_status === 'processing') ? (
                        <TouchableOpacity
                          style={[styles.primaryBtn, approvingId === tx.id && styles.btnDisabled]}
                          onPress={() => approveTransaction(tx)}
                          disabled={approvingId === tx.id}
                        >
                          <Text style={styles.primaryBtnText}>{approvingId === tx.id ? 'Approving...' : 'Approve Payment'}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {isAdmin && (tx.payment_status === 'success' || tx.payment_status === 'completed') ? (
                        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.error }]} onPress={() => markRefunded(tx)}>
                          <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Mark Refunded</Text>
                        </TouchableOpacity>
                      ) : null}
                      {isAdmin ? (
                        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.error }]} onPress={() => deleteTransaction(tx)}>
                          <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showReceiptModal} animationType="slide" transparent onRequestClose={() => setShowReceiptModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>TRANSACTION RECEIPT</Text>
                <Text style={styles.modalTitle}>{selectedTransaction?.transaction_reference ?? 'Issue receipt'}</Text>
              </View>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowReceiptModal(false)}>
                <Text style={styles.closeModalText}>X</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <DetailItem label="Payer" value={selectedTransaction?.portal_users?.full_name || selectedTransaction?.schools?.name || 'Client'} styles={styles} />
              <DetailItem label="Amount" value={selectedTransaction ? formatMoney(selectedTransaction.amount, selectedTransaction.currency) : 'N/A'} styles={styles} />
              <TextInput
                value={receiptForm.payment_date}
                onChangeText={(value) => setReceiptForm((current) => ({ ...current, payment_date: value }))}
                placeholder="Payment date"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
              />
              <TextInput
                value={receiptForm.reference}
                onChangeText={(value) => setReceiptForm((current) => ({ ...current, reference: value }))}
                placeholder="Reference"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
              />
              <TextInput
                value={receiptForm.received_by}
                onChangeText={(value) => setReceiptForm((current) => ({ ...current, received_by: value }))}
                placeholder="Received by"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
              />
              <TextInput
                value={receiptForm.notes}
                onChangeText={(value) => setReceiptForm((current) => ({ ...current, notes: value }))}
                placeholder="Notes"
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, styles.modalArea]}
                multiline
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowReceiptModal(false)}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={issueReceipt} disabled={savingReceipt}>
                <Text style={styles.primaryBtnText}>{savingReceipt ? 'Saving...' : 'Save Receipt'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, tone, styles }: { label: string; value: string; tone: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: tone }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailItem({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statCard: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { marginTop: 6, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchWrap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md },
  searchInput: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary, minHeight: 50 },
  filterRow: { gap: SPACING.sm, paddingBottom: SPACING.xs },
  filterPill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  filterText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  loaderWrap: { paddingVertical: SPACING['3xl'], alignItems: 'center', justifyContent: 'center' },
  emptyState: { marginTop: SPACING.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  cardTitle: { flexShrink: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wider },
  cardMeta: { marginTop: 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  cardDate: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  openHint: { marginTop: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  detailWrap: { borderTopWidth: 1, borderTopColor: colors.border, padding: SPACING.lg, gap: SPACING.md },
  detailItem: { gap: 4 },
  detailLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  detailValue: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  primaryBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: colors.primary },
  primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.white100, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  secondaryBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  secondaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  btnDisabled: { opacity: 0.6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,22,36,0.7)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalEyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.primary, letterSpacing: LETTER_SPACING.wider, marginBottom: 6 },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  closeModalBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeModalText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: colors.textSecondary },
  modalBody: { padding: SPACING.xl, gap: SPACING.md },
  modalInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
  modalArea: { minHeight: 96, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.xl, borderTopWidth: 1, borderTopColor: colors.border },
});

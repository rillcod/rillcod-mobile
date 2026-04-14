import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/payment.service';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';
import { usePaystack } from '../../hooks/usePaystack';
import { BankTransferProofActions } from '../../components/payment/BankTransferProofActions';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  payment_link: string | null;
  school_id?: string | null;
  items: { description: string; amount: number; qty?: number }[] | null;
  created_at: string;
}

type PayAcc = {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  owner_type: string;
  school_id: string | null;
};

function bankAccountsForInvoice(all: PayAcc[], schoolId: string | null | undefined) {
  return all.filter(
    (a) => a.owner_type === 'rillcod' || a.owner_type === 'global' || (schoolId && a.school_id === schoolId),
  );
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_status: string | null;
  transaction_reference: string | null;
  payment_date: string | null;
  currency: string | null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: currency || 'NGN', minimumFractionDigits: 0,
  }).format(amount);
}

const STATUS_COLOR: Record<string, string> = {
  paid: COLORS.success,
  pending: COLORS.warning,
  overdue: COLORS.error,
  draft: COLORS.textMuted,
};

export default function ParentInvoicesScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { studentId: paramStudentId, studentName } = route.params ?? {};
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [userId, setUserId] = useState<string | null>(null);
  const [payAccounts, setPayAccounts] = useState<PayAcc[]>([]);

  const load = useCallback(async () => {
    try {
      let studentId = paramStudentId as string | undefined;
      if (!studentId && profile?.email) {
        studentId = (await studentService.getFirstStudentRegistrationIdForParentEmail(profile.email)) ?? undefined;
      }
      if (!studentId) {
        setInvoices([]);
        setPayments([]);
        setUserId(null);
        setPayAccounts([]);
        return;
      }

      const portalUserId = await studentService.getPortalUserIdForStudentRegistration(studentId);
      setUserId(portalUserId);

      const [invoiceRows, paymentRows] = await Promise.all([
        portalUserId ? paymentService.listInvoicesForPortalUser(portalUserId) : Promise.resolve([]),
        portalUserId
          ? paymentService.listTransactions({
              role: 'parent',
              userId: profile?.id ?? '',
              schoolId: profile?.school_id,
              forStudentIds: [portalUserId],
            })
          : Promise.resolve([]),
      ]);

      const invs = (invoiceRows as Invoice[]) ?? [];
      setInvoices(invs);
      setPayments(
        ((paymentRows ?? []) as any[]).map((row) => ({
          id: row.id,
          amount: Number(row.amount ?? 0),
          payment_method: row.payment_method ?? null,
          payment_status: row.payment_status ?? null,
          transaction_reference: row.transaction_reference ?? null,
          payment_date: row.paid_at ?? row.created_at ?? null,
          currency: row.currency ?? 'NGN',
        })),
      );

      let merged: PayAcc[] = [];
      if (portalUserId) {
        const schoolIds = [...new Set(invs.map((r) => r.school_id).filter(Boolean))] as string[];
        const lists = await Promise.all([
          paymentService.listPaymentAccounts({ isAdmin: false, schoolId: null }),
          ...schoolIds.map((sid) => paymentService.listPaymentAccounts({ isAdmin: false, schoolId: sid })),
        ]);
        const byId = new Map<string, PayAcc>();
        for (const list of lists) {
          for (const raw of list ?? []) {
            const a = raw as PayAcc;
            byId.set(a.id, a);
          }
        }
        merged = [...byId.values()];
      }
      setPayAccounts(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paramStudentId, profile?.email, profile?.id, profile?.school_id]);

  const loadRef = React.useRef(load);
  loadRef.current = load;
  const { startCheckoutForInvoice, loading: paystackLoading, PaystackCheckoutPortal } = usePaystack({
    onFulfilled: () => {
      void loadRef.current();
    },
  });

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const totalOwed = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const totalPaid = payments
    .filter((p) => {
      const status = String(p.payment_status ?? '').toLowerCase();
      return status === 'completed' || status === 'success';
    })
    .reduce((s, p) => s + p.amount, 0);
  const currency = invoices[0]?.currency ?? 'NGN';

  const handlePay = (inv: Invoice) => {
    const st = (inv.status || '').toLowerCase();
    const unpaid = st !== 'paid' && st !== 'cancelled';
    const ngn = (inv.currency || 'NGN').toUpperCase() === 'NGN';
    if (unpaid && ngn && userId) {
      void startCheckoutForInvoice(inv.id);
      return;
    }
    if (inv.payment_link) {
      Alert.alert(
        `Pay Invoice #${inv.invoice_number}`,
        `Amount: ${formatCurrency(inv.amount, inv.currency)}\n\nYou will be redirected to complete payment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pay Now', onPress: () => Linking.openURL(inv.payment_link!) },
        ],
      );
    } else {
      Alert.alert(
        'Bank transfer',
        'Use the bank details on this invoice below. After you pay, upload a photo of your receipt — it is saved securely — then send it to Rillcod on WhatsApp from the app.',
      );
    }
  };

  return (
    <>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => goBackOrTo(navigation, ROUTES.PeopleHub)} color={COLORS.textPrimary} style={styles.backBtn} />
        <View>
          <Text style={styles.title}>Invoices & Payments</Text>
          {studentName && <Text style={styles.subtitle}>{studentName}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Summary row */}
          {!loading && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: COLORS.error + '33' }]}>
                <Text style={styles.summaryLabel}>Outstanding</Text>
                <Text style={[styles.summaryValue, { color: COLORS.error }]}>{formatCurrency(totalOwed, currency)}</Text>
              </View>
              <View style={[styles.summaryCard, { borderColor: COLORS.success + '33' }]}>
                <Text style={styles.summaryLabel}>Total Paid</Text>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>{formatCurrency(totalPaid, 'NGN')}</Text>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['invoices', 'payments'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'invoices' ? `Invoices (${invoices.length})` : `Payments (${payments.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
            }
          >
            {activeTab === 'invoices' && (
              <>
                {invoices.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>💰</Text>
                    <Text style={styles.emptyTitle}>No invoices yet</Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {invoices.map((inv, i) => {
                      const st = (inv.status || '').toLowerCase();
                      const isPayable =
                        st !== 'paid' &&
                        st !== 'cancelled' &&
                        (inv.currency || 'NGN').toUpperCase() === 'NGN' &&
                        Boolean(userId);
                      const showBankTransfer = st !== 'paid' && st !== 'cancelled';
                      const bankLines = bankAccountsForInvoice(payAccounts, inv.school_id ?? null);
                      const statusColor = STATUS_COLOR[inv.status] ?? COLORS.textMuted;
                      return (
                        <MotiView
                          key={inv.id}
                          from={{ opacity: 0, translateY: 10 }}
                          animate={{ opacity: 1, translateY: 0 }}
                          transition={{ delay: i * 50 }}
                          style={styles.invoiceCard}
                        >
                          <View style={styles.invoiceTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.invoiceNum}>Invoice #{inv.invoice_number}</Text>
                              <Text style={styles.invoiceDate}>
                                {new Date(inv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={styles.invoiceAmount}>{formatCurrency(inv.amount, inv.currency)}</Text>
                              <View style={[styles.statusBadge, { borderColor: statusColor + '55', backgroundColor: statusColor + '22' }]}>
                                <Text style={[styles.statusText, { color: statusColor }]}>{inv.status}</Text>
                              </View>
                            </View>
                          </View>

                          {Array.isArray(inv.items) && inv.items.length > 0 && (
                            <View style={styles.itemsBox}>
                              {inv.items.map((item, idx) => (
                                <View key={idx} style={styles.lineItem}>
                                  <Text style={styles.lineItemDesc}>{item.description}{item.qty && item.qty > 1 ? ` × ${item.qty}` : ''}</Text>
                                  <Text style={styles.lineItemAmt}>{formatCurrency(item.amount, inv.currency)}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {inv.notes && <Text style={styles.invoiceNotes}>{inv.notes}</Text>}

                          {showBankTransfer ? (
                            <View style={styles.smartPayHint}>
                              <Text style={styles.smartPayTitle}>Smart payment</Text>
                              <Text style={styles.smartPayBody}>
                                {isPayable
                                  ? 'Pay instantly with Paystack, or transfer to the bank account below and upload proof — both routes notify Rillcod for reconciliation.'
                                  : 'Pay by bank transfer using the details below, then upload proof (card checkout is only available for NGN invoices linked to your child’s portal account).'}
                              </Text>
                            </View>
                          ) : null}

                          {isPayable && (
                            <TouchableOpacity
                              style={[styles.payBtn, paystackLoading && { opacity: 0.7 }]}
                              onPress={() => handlePay(inv)}
                              disabled={paystackLoading}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.payBtnText}>💳  Pay with Paystack {formatCurrency(inv.amount, inv.currency)}</Text>
                            </TouchableOpacity>
                          )}

                          {showBankTransfer && bankLines.length > 0 ? (
                            <View style={styles.bankBlock}>
                              <Text style={styles.bankBlockTitle}>Pay by transfer (company / school)</Text>
                              {bankLines.map((a) => (
                                <View key={a.id} style={styles.bankLine}>
                                  <Text style={styles.bankLabel}>{a.label}</Text>
                                  <Text style={styles.bankMeta}>
                                    {a.bank_name} · {a.account_number}
                                  </Text>
                                  <Text style={styles.bankMeta}>{a.account_name}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          {showBankTransfer && profile?.id ? (
                            <BankTransferProofActions
                              invoiceId={inv.id}
                              invoiceNumber={inv.invoice_number}
                              amount={inv.amount}
                              currency={inv.currency}
                              onRecorded={() => {
                                setRefreshing(true);
                                void load();
                              }}
                            />
                          ) : null}

                          {inv.status === 'paid' && (
                            <View style={styles.paidRow}>
                              <Text style={styles.paidText}>✓  Paid — Receipt auto-issued</Text>
                            </View>
                          )}
                        </MotiView>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {activeTab === 'payments' && (
              <>
                {payments.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>✅</Text>
                    <Text style={styles.emptyTitle}>No payment records</Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {payments.map((pay, i) => (
                      <MotiView
                        key={pay.id}
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 40 }}
                        style={styles.paymentRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payDate}>
                            {pay.payment_date
                              ? new Date(pay.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </Text>
                          <Text style={styles.payMethod}>{(pay.payment_method ?? 'unknown').replace('_', ' ')}</Text>
                          {pay.transaction_reference && <Text style={styles.payRef}>Ref: {pay.transaction_reference}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.payAmount}>{formatCurrency(pay.amount, pay.currency ?? 'NGN')}</Text>
                          <View style={[
                            styles.statusBadge,
                            String(pay.payment_status ?? '').toLowerCase() === 'completed' || String(pay.payment_status ?? '').toLowerCase() === 'success'
                              ? { borderColor: COLORS.success + '55', backgroundColor: COLORS.success + '22' }
                              : { borderColor: COLORS.warning + '55', backgroundColor: COLORS.warning + '22' },
                          ]}>
                            <Text style={[styles.statusText, { color: String(pay.payment_status ?? '').toLowerCase() === 'completed' || String(pay.payment_status ?? '').toLowerCase() === 'success' ? COLORS.success : COLORS.warning }]}>
                              {(pay.payment_status ?? 'pending')}
                            </Text>
                          </View>
                        </View>
                      </MotiView>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
    <PaystackCheckoutPortal />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md },
  backBtn: { padding: SPACING.xs },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  summaryRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.base, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.sm },
  tab: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabTextActive: { color: COLORS.primaryLight },
  scroll: { padding: SPACING.base, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  list: { gap: SPACING.md },
  invoiceCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.md },
  invoiceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  invoiceNum: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  invoiceDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  invoiceAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  itemsBox: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, overflow: 'hidden' },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  lineItemDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  lineItemAmt: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  invoiceNotes: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  payBtn: { paddingVertical: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' },
  payBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  paidText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.success, textTransform: 'uppercase', letterSpacing: 0.5 },
  paymentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md },
  payDate: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  payMethod: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize', marginTop: 2 },
  payRef: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  payAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  smartPayHint: {
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.primary + '10',
  },
  smartPayTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  smartPayBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },
  bankBlock: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  bankBlockTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bankLine: { marginBottom: SPACING.sm },
  bankLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  bankMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  payment_link: string | null;
  items: { description: string; amount: number; qty?: number }[] | null;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  transaction_reference: string | null;
  payment_date: string | null;
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
  const { studentId, studentName } = route.params ?? {};
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .maybeSingle();

      setUserId(student?.user_id ?? null);

      const [invRes, payRes] = await Promise.all([
        student?.user_id
          ? supabase
              .from('invoices')
              .select('id, invoice_number, amount, currency, status, due_date, notes, payment_link, items, created_at')
              .eq('portal_user_id', student.user_id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('payments')
          .select('id, amount, payment_method, payment_status, transaction_reference, payment_date')
          .eq('student_id', studentId)
          .order('payment_date', { ascending: false })
          .limit(30),
      ]);

      setInvoices((invRes as any).data ?? []);
      setPayments((payRes as any).data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [studentId]);

  const totalOwed = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const totalPaid = payments.filter(p => p.payment_status === 'completed').reduce((s, p) => s + p.amount, 0);
  const currency = invoices[0]?.currency ?? 'NGN';

  const handlePay = (inv: Invoice) => {
    if (inv.payment_link) {
      Alert.alert(
        `Pay Invoice #${inv.invoice_number}`,
        `Amount: ${formatCurrency(inv.amount, inv.currency)}\n\nYou will be redirected to Paystack to complete payment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pay Now', onPress: () => Linking.openURL(inv.payment_link!) },
        ],
      );
    } else {
      Alert.alert('Payment', 'Contact your school admin for payment details. Send proof of transfer to get your receipt.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
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
                      const isPayable = inv.status === 'pending' || inv.status === 'overdue';
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

                          {isPayable && (
                            <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(inv)} activeOpacity={0.85}>
                              <Text style={styles.payBtnText}>💳  Pay {formatCurrency(inv.amount, inv.currency)}</Text>
                            </TouchableOpacity>
                          )}

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
                          <Text style={styles.payMethod}>{pay.payment_method.replace('_', ' ')}</Text>
                          {pay.transaction_reference && <Text style={styles.payRef}>Ref: {pay.transaction_reference}</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.payAmount}>{formatCurrency(pay.amount, 'NGN')}</Text>
                          <View style={[
                            styles.statusBadge,
                            pay.payment_status === 'completed'
                              ? { borderColor: COLORS.success + '55', backgroundColor: COLORS.success + '22' }
                              : { borderColor: COLORS.warning + '55', backgroundColor: COLORS.warning + '22' },
                          ]}>
                            <Text style={[styles.statusText, { color: pay.payment_status === 'completed' ? COLORS.success : COLORS.warning }]}>
                              {pay.payment_status}
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
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
});

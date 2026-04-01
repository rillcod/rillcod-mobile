import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, ScrollView, TextInput, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string | null;
  created_at: string | null;
  notes: string | null;
  school_id: string | null;
  portal_user_id: string | null;
  payment_link: string | null;
  payment_transaction_id: string | null;
  items: InvoiceItem[];
  schools: { name: string | null } | null;
  portal_users: { full_name: string | null; email?: string | null } | null;
}

interface PaymentAccount {
  id: string;
  label: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  owner_type: string;
  payment_note: string | null;
  school_id: string | null;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function parseInvoiceItems(value: unknown): InvoiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      description: typeof item?.description === 'string' ? item.description : 'Payment',
      quantity: typeof item?.quantity === 'number' ? item.quantity : Number(item?.quantity ?? 1) || 1,
      unit_price: typeof item?.unit_price === 'number' ? item.unit_price : Number(item?.unit_price ?? 0) || 0,
      total: typeof item?.total === 'number'
        ? item.total
        : (Number(item?.quantity ?? 1) || 1) * (Number(item?.unit_price ?? 0) || 0),
    }))
    .filter((item) => item.description || item.total > 0);
}

export default function InvoicesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

  const isAdmin = profile?.role === 'admin';
  const isSchool = profile?.role === 'school';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id, invoice_number, amount, currency, status, due_date, created_at, notes,
          school_id, portal_user_id, payment_link, payment_transaction_id, items,
          schools(name),
          portal_users(full_name, email)
        `);

      if (isSchool && profile.school_id) {
        query = query.eq('school_id', profile.school_id);
      } else if (!isAdmin && !isSchool) {
        query = query.eq('portal_user_id', profile.id);
      }

      const [{ data: invoiceData }, { data: accountData }] = await Promise.all([
        query.order('created_at', { ascending: false }),
        isAdmin
          ? supabase
              .from('payment_accounts')
              .select('id, label, bank_name, account_number, account_name, account_type, owner_type, payment_note, school_id')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
          : supabase
              .from('payment_accounts')
              .select('id, label, bank_name, account_number, account_name, account_type, owner_type, payment_note, school_id')
              .eq('is_active', true)
              .or(profile.school_id ? `school_id.eq.${profile.school_id},owner_type.eq.global,owner_type.eq.rillcod` : 'owner_type.eq.global,owner_type.eq.rillcod')
              .order('created_at', { ascending: false }),
      ]);

      setInvoices(
        ((invoiceData ?? []) as any[]).map((invoice) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount ?? 0,
          currency: invoice.currency ?? 'NGN',
          status: (invoice.status ?? 'sent') as InvoiceStatus,
          due_date: invoice.due_date ?? null,
          created_at: invoice.created_at ?? null,
          notes: invoice.notes ?? null,
          school_id: invoice.school_id ?? null,
          portal_user_id: invoice.portal_user_id ?? null,
          payment_link: invoice.payment_link ?? null,
          payment_transaction_id: invoice.payment_transaction_id ?? null,
          items: parseInvoiceItems(invoice.items),
          schools: invoice.schools ?? null,
          portal_users: invoice.portal_users ?? null,
        }))
      );

      setPaymentAccounts((accountData ?? []) as PaymentAccount[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isSchool, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const target = invoice.portal_users?.full_name || invoice.schools?.name || '';
      const firstItem = invoice.items[0]?.description ?? '';
      const matchesSearch =
        !query ||
        invoice.invoice_number.toLowerCase().includes(query) ||
        target.toLowerCase().includes(query) ||
        firstItem.toLowerCase().includes(query);
      const matchesStatus = filter === 'all' || invoice.status === filter;
      return matchesSearch && matchesStatus;
    });
  }, [filter, invoices, search]);

  const stats = useMemo(() => {
    const outstanding = invoices.filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue');
    return {
      outstandingAmount: outstanding.reduce((sum, invoice) => sum + invoice.amount, 0),
      outstandingCount: outstanding.length,
      paidCount: invoices.filter((invoice) => invoice.status === 'paid').length,
      overdueCount: invoices.filter((invoice) => invoice.status === 'overdue').length,
      currency: invoices[0]?.currency ?? 'NGN',
    };
  }, [invoices]);

  const filters: { key: 'all' | InvoiceStatus; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'sent', label: 'SENT' },
    { key: 'paid', label: 'PAID' },
    { key: 'overdue', label: 'OVERDUE' },
    { key: 'draft', label: 'DRAFT' },
  ];

  const getStatusColor = (status: InvoiceStatus) => {
    if (status === 'paid') return colors.success;
    if (status === 'overdue') return colors.error;
    if (status === 'cancelled') return colors.textMuted;
    if (status === 'draft') return colors.warning;
    return colors.primary;
  };

  const openInvoice = (invoice: Invoice) => {
    light();
    setSelectedInvoice(invoice);
  };

  const markInvoicePaid = async (invoice: Invoice) => {
    Alert.alert('Mark Invoice Paid', `Confirm ${invoice.invoice_number} as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const { error } = await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoice.id);
          if (!error) {
            await load();
            setSelectedInvoice((current) => (current?.id === invoice.id ? { ...invoice, status: 'paid' } : current));
          }
        },
      },
    ]);
  };

  const printInvoice = async (invoice: Invoice) => {
    setExporting(true);
    try {
      const itemRows = invoice.items.length > 0
        ? invoice.items.map((item) => `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.unit_price, invoice.currency)}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.total, invoice.currency)}</td>
            </tr>
          `).join('')
        : `<tr><td colspan="4" style="padding: 12px 0; color: #64748b;">No line items recorded.</td></tr>`;

      const accountsHtml = paymentAccounts.length > 0
        ? paymentAccounts.map((account) => `
            <div style="margin-bottom: 10px;">
              <strong>${account.label}</strong><br />
              ${account.bank_name} · ${account.account_number}<br />
              ${account.account_name}${account.payment_note ? `<br /><span style="color:#64748b;">${account.payment_note}</span>` : ''}
            </div>
          `).join('')
        : '<p style="color:#64748b;">No payment account instructions available.</p>';

      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a;">
            <h1 style="margin-bottom: 4px;">Invoice ${invoice.invoice_number}</h1>
            <p style="margin-top: 0; color: #64748b;">${invoice.portal_users?.full_name || invoice.schools?.name || 'Billing Record'}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
            <p><strong>Date:</strong> ${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-GB') : 'N/A'}</p>
            <p><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'N/A'}</p>
            <table style="width:100%; border-collapse: collapse; margin-top: 24px;">
              <thead>
                <tr>
                  <th style="text-align:left; padding-bottom: 10px;">Item</th>
                  <th style="text-align:center; padding-bottom: 10px;">Qty</th>
                  <th style="text-align:right; padding-bottom: 10px;">Unit Price</th>
                  <th style="text-align:right; padding-bottom: 10px;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <h2 style="text-align:right; margin-top: 24px;">Total: ${formatMoney(invoice.amount, invoice.currency)}</h2>
            ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
            <hr style="margin: 24px 0;" />
            <h3>Payment Instructions</h3>
            ${accountsHtml}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Invoice Ready', uri);
      }
    } catch (error: any) {
      Alert.alert('Print Failed', error?.message ?? 'Could not generate invoice PDF.');
    } finally {
      setExporting(false);
    }
  };

  const openPayment = async (invoice: Invoice) => {
    if (invoice.payment_link) {
      const supported = await Linking.canOpenURL(invoice.payment_link);
      if (supported) {
        await Linking.openURL(invoice.payment_link);
        return;
      }
    }
    const instructions = paymentAccounts.length > 0
      ? paymentAccounts
          .map((account) => `${account.label}\n${account.bank_name} · ${account.account_number}\n${account.account_name}${account.payment_note ? `\n${account.payment_note}` : ''}`)
          .join('\n\n')
      : 'No payment link is attached yet. Please contact the accounts team for payment instructions.';
    Alert.alert('Payment Instructions', instructions);
  };

  const renderItem = ({ item, index }: { item: Invoice; index: number }) => {
    const statusColor = getStatusColor(item.status);
    const targetName = item.portal_users?.full_name || item.schools?.name || 'Billing Record';
    const previewTitle = item.items[0]?.description || item.notes || 'Invoice';

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35 }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openInvoice(item)}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.targetBadge, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.targetIcon, { color: colors.primary }]}>{item.school_id ? 'SC' : 'ST'}</Text>
              <Text style={[styles.targetText, { color: colors.textSecondary }]} numberOfLines={1}>
                {targetName.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '15', borderColor: statusColor + '35' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.invTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {previewTitle}
              </Text>
              <Text style={[styles.invNumber, { color: colors.textMuted }]}>{item.invoice_number}</Text>
            </View>
            <Text style={[styles.amount, { color: colors.textPrimary }]}>{formatMoney(item.amount, item.currency)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>DATE: {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : 'N/A'}</Text>
            {item.due_date ? (
              <Text style={[styles.meta, { color: item.status === 'overdue' ? colors.error : colors.textMuted }]}>DUE: {new Date(item.due_date).toLocaleDateString('en-GB')}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.textMuted }]}>ITEMS: {item.items.length}</Text>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={isAdmin ? 'FINANCE CENTRE' : 'MY INVOICES'} onBack={() => navigation.goBack()} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.warning }]}>OUTSTANDING</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatMoney(stats.outstandingAmount, stats.currency)}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>{stats.outstandingCount} open invoices</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.success }]}>SETTLED</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.paidCount}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>fully paid</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.error }]}>OVERDUE</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.overdueCount}</Text>
          <Text style={[styles.statMeta, { color: colors.textMuted }]}>needs action</Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.searchIcon}>S</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice number or recipient..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.textPrimary }]}
        />
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((entry) => (
            <TouchableOpacity
              key={entry.key}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                filter === entry.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
              ]}
              onPress={() => {
                setFilter(entry.key);
                light();
              }}
            >
              <Text style={[styles.chipText, { color: filter === entry.key ? colors.primary : colors.textMuted }]}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>0</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No invoices found</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selectedInvoice} animationType="slide" transparent onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            {selectedInvoice ? (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalEyebrow, { color: colors.primary }]}>INVOICE VIEW</Text>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selectedInvoice.invoice_number}</Text>
                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                      {selectedInvoice.portal_users?.full_name || selectedInvoice.schools?.name || 'Billing Record'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={[styles.closeBtn, { borderColor: colors.border }]}> 
                    <Text style={[styles.closeText, { color: colors.textSecondary }]}>X</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <View style={[styles.detailHero, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                    <Text style={[styles.detailStatus, { color: getStatusColor(selectedInvoice.status) }]}>
                      {selectedInvoice.status.toUpperCase()}
                    </Text>
                    <Text style={[styles.detailAmount, { color: colors.textPrimary }]}>
                      {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
                    </Text>
                    <Text style={[styles.detailMeta, { color: colors.textMuted }]}> 
                      CREATED {selectedInvoice.created_at ? new Date(selectedInvoice.created_at).toLocaleDateString('en-GB') : 'N/A'}
                    </Text>
                    {selectedInvoice.due_date ? (
                      <Text style={[styles.detailMeta, { color: selectedInvoice.status === 'overdue' ? colors.error : colors.textMuted }]}> 
                        DUE {new Date(selectedInvoice.due_date).toLocaleDateString('en-GB')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>LINE ITEMS</Text>
                    {selectedInvoice.items.length === 0 ? (
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>No line items recorded.</Text>
                    ) : (
                      selectedInvoice.items.map((item, index) => (
                        <View key={`${selectedInvoice.id}-${index}`} style={[styles.lineItem, { borderBottomColor: colors.border }]}> 
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{item.description}</Text>
                            <Text style={[styles.lineMeta, { color: colors.textMuted }]}> 
                              {item.quantity} x {formatMoney(item.unit_price, selectedInvoice.currency)}
                            </Text>
                          </View>
                          <Text style={[styles.lineTotal, { color: colors.textPrimary }]}>
                            {formatMoney(item.total, selectedInvoice.currency)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  {selectedInvoice.notes ? (
                    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>NOTES</Text>
                      <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{selectedInvoice.notes}</Text>
                    </View>
                  ) : null}

                  {paymentAccounts.length > 0 ? (
                    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.bgCard }]}> 
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PAYMENT ACCOUNTS</Text>
                      {paymentAccounts.map((account) => (
                        <View key={account.id} style={[styles.accountCard, { borderColor: colors.border }]}> 
                          <Text style={[styles.lineTitle, { color: colors.textPrimary }]}>{account.label}</Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>
                            {account.bank_name} · {account.account_number}
                          </Text>
                          <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{account.account_name}</Text>
                          {account.payment_note ? (
                            <Text style={[styles.accountNote, { color: colors.textMuted }]}>{account.payment_note}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[styles.actionBar, { borderTopColor: colors.border }]}> 
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => printInvoice(selectedInvoice)}
                    disabled={exporting}
                  >
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                      {exporting ? 'EXPORTING...' : 'PRINT PDF'}
                    </Text>
                  </TouchableOpacity>

                  {!isAdmin && selectedInvoice.status !== 'paid' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => openPayment(selectedInvoice)}
                    >
                      <Text style={styles.actionPrimaryText}>
                        {selectedInvoice.payment_link ? 'OPEN PAYMENT' : 'PAYMENT INFO'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {isAdmin && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.success, borderColor: colors.success }]}
                      onPress={() => markInvoicePaid(selectedInvoice)}
                    >
                      <Text style={styles.actionPrimaryText}>MARK PAID</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md },
  statLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 6 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md },
  statMeta: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  searchIcon: { fontFamily: FONT_FAMILY.mono, fontSize: 12 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: 13 },
  filters: { marginBottom: SPACING.lg },
  filterRow: { paddingHorizontal: SPACING.xl, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1 },
  chipText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  list: { paddingHorizontal: SPACING.xl, gap: SPACING.md, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg, gap: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, flex: 1, marginRight: SPACING.sm },
  targetIcon: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1 },
  targetText: { flex: 1, fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.xs, borderWidth: 1 },
  badgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md },
  invTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 14, lineHeight: 20 },
  invNumber: { fontFamily: FONT_FAMILY.mono, fontSize: 10, marginTop: 5 },
  amount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, textAlign: 'right' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  meta: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 0.8 },
  empty: { alignItems: 'center', paddingTop: 96, gap: 12 },
  emptyIcon: { fontFamily: FONT_FAMILY.display, fontSize: 42 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.xl, borderBottomWidth: 1, alignItems: 'flex-start' },
  modalEyebrow: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  modalSub: { fontFamily: FONT_FAMILY.body, fontSize: 12, marginTop: 4 },
  closeBtn: { width: 40, height: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
  modalScroll: { padding: SPACING.xl, gap: SPACING.lg },
  detailHero: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg },
  detailStatus: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  detailAmount: { fontFamily: FONT_FAMILY.display, fontSize: 28, marginBottom: 8 },
  detailMeta: { fontFamily: FONT_FAMILY.body, fontSize: 12, marginTop: 2 },
  section: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, letterSpacing: LETTER_SPACING.wide, marginBottom: SPACING.md },
  sectionBody: { fontFamily: FONT_FAMILY.body, fontSize: 12, lineHeight: 20 },
  lineItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  lineTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 13 },
  lineMeta: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 4 },
  lineTotal: { fontFamily: FONT_FAMILY.display, fontSize: 14 },
  accountCard: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
  accountNote: { fontFamily: FONT_FAMILY.body, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  actionBar: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.xl, borderTopWidth: 1 },
  actionBtn: { flex: 1, minHeight: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  actionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  actionPrimaryText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
});

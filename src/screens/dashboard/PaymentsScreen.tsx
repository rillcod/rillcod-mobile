import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
  student_name: string | null;
  school_name: string | null;
  description: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; code: string }> = {
  paid: { color: COLORS.success, code: 'PD' },
  pending: { color: COLORS.warning, code: 'PN' },
  overdue: { color: COLORS.error, code: 'OD' },
  draft: { color: COLORS.textMuted, code: 'DR' },
  cancelled: { color: COLORS.error, code: 'CX' },
};

function formatAmount(amount: number, currency = 'NGN') {
  if (currency === 'NGN') return `NGN ${amount.toLocaleString()}`;
  if (currency === 'USD') return `$${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
}

export default function PaymentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({ paid: 0, pending: 0, overdue: 0 });

  const isStudent = profile?.role === 'student';

  const load = useCallback(async () => {
    let query = supabase
      .from('invoices')
      .select('id, invoice_number, amount, currency, status, due_date, created_at, description, student_name, school_name')
      .order('created_at', { ascending: false })
      .limit(100);

    if (isStudent && profile?.id) {
      query = query.eq('student_id', profile.id);
    }

    const { data } = await query;
    const list = (data ?? []) as Invoice[];
    setInvoices(list);
    setTotals({
      paid: list.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
      pending: list.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0),
      overdue: list.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + item.amount, 0),
    });
    setLoading(false);
  }, [isStudent, profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    return invoices.filter((item) => item.status === statusFilter);
  }, [invoices, statusFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.warning} size="large" />
        <Text style={styles.loadText}>Loading billing records...</Text>
      </View>
    );
  }

  const filters = ['all', 'paid', 'pending', 'overdue', 'draft'];

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Payments"
        subtitle={`${invoices.length} invoices in billing records`}
        onBack={() => navigation.goBack()}
        colors={COLORS}
      />

      <View style={styles.summaryRow}>
        {[
          { label: 'Paid', value: totals.paid, color: COLORS.success },
          { label: 'Pending', value: totals.pending, color: COLORS.warning },
          { label: 'Overdue', value: totals.overdue, color: COLORS.error },
        ].map((item) => (
          <View key={item.label} style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: item.color }]}>
              {item.value > 0 ? `NGN ${item.value.toLocaleString()}` : 'NGN 0'}
            </Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setStatusFilter(filter)}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
              {filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.warning} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyCode}>PM</Text>
            <Text style={styles.emptyText}>No invoices match this filter.</Text>
          </View>
        ) : (
          filtered.map((invoice, index) => {
            const cfg = STATUS_CONFIG[invoice.status] ?? { color: COLORS.textMuted, code: 'IV' };
            return (
              <MotiView
                key={invoice.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 35 }}
              >
                <View style={styles.card}>
                  <LinearGradient colors={[cfg.color + '0F', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTop}>
                    <View style={[styles.codeBox, { backgroundColor: cfg.color + '16', borderColor: cfg.color + '30' }]}>
                      <Text style={[styles.codeText, { color: cfg.color }]}>{cfg.code}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.invoiceRow}>
                        <Text style={styles.invoiceNo}>{invoice.invoice_number || 'Invoice'}</Text>
                        <Text style={[styles.amount, { color: cfg.color }]}>{formatAmount(invoice.amount, invoice.currency)}</Text>
                      </View>
                      {invoice.description ? <Text style={styles.description}>{invoice.description}</Text> : null}
                      {invoice.student_name ? <Text style={styles.metaLine}>Student: {invoice.student_name}</Text> : null}
                      {invoice.school_name ? <Text style={styles.metaLine}>School: {invoice.school_name}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.cardBottom}>
                    <Text style={styles.dateText}>
                      Created {new Date(invoice.created_at).toLocaleDateString('en-GB')}
                      {invoice.due_date ? ` · Due ${new Date(invoice.due_date).toLocaleDateString('en-GB')}` : ''}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.color + '18' }]}>
                      <Text style={[styles.statusText, { color: cfg.color }]}>{invoice.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </MotiView>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm },
  summaryLabel: {
    marginTop: 4,
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  filterRow: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
  },
  filterChipActive: {
    backgroundColor: COLORS.warning + '14',
    borderColor: COLORS.warning + '50',
  },
  filterChipText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    letterSpacing: LETTER_SPACING.wider,
  },
  filterChipTextActive: { color: COLORS.warning },
  list: { paddingHorizontal: SPACING.xl },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  codeBox: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.wider,
  },
  cardBody: { flex: 1, gap: 4 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  invoiceNo: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  amount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  description: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  metaLine: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dateText: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    letterSpacing: LETTER_SPACING.wide,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});


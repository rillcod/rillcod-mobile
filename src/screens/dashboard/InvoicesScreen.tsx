import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Invoice {
  id: string;
  invoice_number: string;
  title: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  description: string | null;
}

function statusStyle(status: Invoice['status']): { bg: string; text: string; border: string } {
  switch (status) {
    case 'paid': return { bg: COLORS.success + '22', text: COLORS.success, border: COLORS.success + '55' };
    case 'pending': return { bg: COLORS.warning + '22', text: COLORS.warning, border: COLORS.warning + '55' };
    case 'overdue': return { bg: COLORS.error + '22', text: COLORS.error, border: COLORS.error + '55' };
    default: return { bg: COLORS.textMuted + '22', text: COLORS.textMuted, border: COLORS.border };
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function InvoicesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, amount, currency, status, due_date, paid_date, created_at, description')
        .eq('portal_user_id', profile.id)
        .order('created_at', { ascending: false });
      setInvoices((data ?? []) as Invoice[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter(inv => filter === 'all' || inv.status === filter);
  const totalDue = invoices.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const defaultCurrency = invoices[0]?.currency ?? 'NGN';

  const filters: { key: typeof filter; label: string; emoji: string }[] = [
    { key: 'all', label: 'All', emoji: '📋' },
    { key: 'pending', label: 'Pending', emoji: '⏳' },
    { key: 'overdue', label: 'Overdue', emoji: '🚨' },
    { key: 'paid', label: 'Paid', emoji: '✅' },
  ];

  const renderItem = ({ item, index }: { item: Invoice; index: number }) => {
    const ss = statusStyle(item.status);
    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 50 }}
      >
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invTitle}>{item.title ?? 'Tuition Invoice'}</Text>
              <Text style={styles.invNumber}>#{item.invoice_number}</Text>
            </View>
            <View>
              <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
              <View style={[styles.badge, { backgroundColor: ss.bg, borderColor: ss.border }]}>
                <Text style={[styles.badgeText, { color: ss.text }]}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            {item.due_date && (
              <Text style={[styles.meta, item.status === 'overdue' && { color: COLORS.error }]}>
                📅 Due: {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
            {item.paid_date && (
              <Text style={[styles.meta, { color: COLORS.success }]}>
                ✅ Paid: {new Date(item.paid_date).toLocaleDateString('en-GB')}
              </Text>
            )}
          </View>

          {item.description && (
            <Text style={styles.desc}>{item.description}</Text>
          )}

          {['pending', 'overdue'].includes(item.status) && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Alert.alert('Pay Invoice', `Contact your school admin to pay ${item.invoice_number}`)}
            >
              <Text style={styles.payBtnText}>Pay Now →</Text>
            </TouchableOpacity>
          )}
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Invoices</Text>
      </View>

      {/* Outstanding balance */}
      {totalDue > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.alertBanner}
        >
          <Text style={styles.alertText}>
            🚨 Outstanding Balance: {formatMoney(totalDue, defaultCurrency)}
          </Text>
        </MotiView>
      )}

      {/* Filters */}
      <View style={styles.filters}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.emoji} {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyText}>No invoices found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  alertBanner: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.error + '22',
    borderWidth: 1,
    borderColor: COLORS.error + '55',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  alertText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.error },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  chipActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  chipTextActive: { color: COLORS.primaryLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  invTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  invNumber: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, textAlign: 'right' },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  badgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  desc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' },
  payBtn: {
    backgroundColor: COLORS.primaryPale,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  payBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
});

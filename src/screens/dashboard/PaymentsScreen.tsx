import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
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
  created_at: string;
  student_name: string | null;
  school_name: string | null;
  description: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; emoji: string }> = {
  paid: { color: COLORS.success, emoji: '✅' },
  pending: { color: COLORS.warning, emoji: '⏳' },
  overdue: { color: COLORS.error, emoji: '⚠️' },
  draft: { color: COLORS.textMuted, emoji: '📝' },
  cancelled: { color: COLORS.error, emoji: '✕' },
};

function formatAmount(amount: number, currency: string = 'NGN') {
  return `${currency} ${amount.toLocaleString()}`;
}

export default function PaymentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filtered, setFiltered] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({ paid: 0, pending: 0, overdue: 0 });

  const isStudent = profile?.role === 'student';
  const role = profile?.role as string | undefined;

  const load = useCallback(async () => {
    let q = supabase
      .from('invoices')
      .select('id, invoice_number, amount, currency, status, due_date, created_at, description, student_name, school_name')
      .order('created_at', { ascending: false })
      .limit(100);

    if (isStudent) q = q.eq('student_id', profile!.id);

    const { data } = await q;
    if (data) {
      const inv = data as Invoice[];
      setInvoices(inv);
      setFiltered(inv);

      const paid = inv.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
      const pending = inv.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
      const overdue = inv.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
      setTotals({ paid, pending, overdue });
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (statusFilter === 'all') { setFiltered(invoices); return; }
    setFiltered(invoices.filter(i => i.status === statusFilter));
  }, [statusFilter, invoices]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadText}>Loading payments…</Text>
      </View>
    );
  }

  const FILTERS = ['all', 'paid', 'pending', 'overdue', 'draft'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>{invoices.length} invoices</Text>
        </View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Paid', value: totals.paid, color: COLORS.success },
          { label: 'Pending', value: totals.pending, color: COLORS.warning },
          { label: 'Overdue', value: totals.overdue, color: COLORS.error },
        ].map((s, i) => (
          <MotiView key={s.label} from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 80 }} style={styles.summaryCard}>
            <LinearGradient colors={[s.color + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={[styles.summaryAmount, { color: s.color }]}>
              {s.value > 0 ? `₦${(s.value / 1000).toFixed(0)}k` : '₦0'}
            </Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </MotiView>
        ))}
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setStatusFilter(f)}
            style={[styles.filterPill, statusFilter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>💰</Text>
            <Text style={styles.emptyText}>No invoices found.</Text>
          </View>
        ) : (
          filtered.map((inv, i) => {
            const cfg = STATUS_CONFIG[inv.status] ?? { color: COLORS.textMuted, emoji: '📄' };
            return (
              <MotiView key={inv.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                <View style={styles.card}>
                  <LinearGradient colors={[cfg.color + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardLeft}>
                    <Text style={{ fontSize: 28 }}>{cfg.emoji}</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.invoiceNumber}>{inv.invoice_number || 'Invoice'}</Text>
                      <Text style={[styles.amount, { color: cfg.color }]}>{formatAmount(inv.amount, inv.currency)}</Text>
                    </View>
                    {inv.description ? <Text style={styles.desc} numberOfLines={1}>{inv.description}</Text> : null}
                    {inv.student_name ? <Text style={styles.meta}>👤 {inv.student_name}</Text> : null}
                    {inv.school_name ? <Text style={styles.meta}>🏫 {inv.school_name}</Text> : null}
                    <View style={styles.cardBottom}>
                      <Text style={styles.date}>{new Date(inv.created_at).toLocaleDateString('en-GB')}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{inv.status}</Text>
                      </View>
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

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center', gap: 3, overflow: 'hidden' },
  summaryAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  filters: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.gold },

  list: { paddingHorizontal: SPACING.xl },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm },
  cardLeft: { alignItems: 'center', justifyContent: 'center', width: 40 },
  cardContent: { flex: 1, gap: 3 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNumber: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  amount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base },
  desc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  date: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

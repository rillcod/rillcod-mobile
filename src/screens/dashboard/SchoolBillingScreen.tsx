import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePaystack } from '../../hooks/usePaystack';
import { paymentService } from '../../services/payment.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ROUTES } from '../../navigation/routes';
import type { RootStackParamList } from '../../navigation/types';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'SchoolBilling'>;

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string;

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string | null;
  status: InvoiceStatus | null;
  due_date: string | null;
  created_at: string | null;
  portal_user_id: string | null;
  schools: { name: string | null } | null;
  portal_users: { full_name: string | null; email: string | null } | null;
};

function formatMoney(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function isPayable(row: InvoiceRow): boolean {
  const st = (row.status || '').toLowerCase();
  if (st === 'paid' || st === 'cancelled') return false;
  const cur = (row.currency || 'NGN').toUpperCase();
  if (cur !== 'NGN') return false;
  return Boolean(row.portal_users?.email?.trim());
}

export default function SchoolBillingScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id || !profile.role) return;
    if (profile.role === 'school' || profile.role === 'admin') {
      await paymentService.autoMarkOverdueInvoices({
        role: profile.role,
        schoolId: profile.school_id,
      });
    }
    const rows = await paymentService.listInvoices({
      role: profile.role,
      userId: profile.id,
      schoolId: profile.school_id,
    });
    setInvoices((rows ?? []) as InvoiceRow[]);
  }, [profile?.id, profile?.role, profile?.school_id]);

  const loadRef = React.useRef(load);
  loadRef.current = load;
  const { startCheckoutForInvoice, loading: paystackLoading, PaystackCheckoutPortal } = usePaystack({
    onFulfilled: () => {
      void loadRef.current();
    },
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await load();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const stats = useMemo(() => {
    let outstanding = 0;
    let openCount = 0;
    let overdueCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const inv of invoices) {
      const st = (inv.status || '').toLowerCase();
      if (st === 'paid' || st === 'cancelled') continue;
      openCount += 1;
      outstanding += Number(inv.amount) || 0;
      if (st === 'overdue' || (inv.due_date && inv.due_date < today)) {
        overdueCount += 1;
      }
    }
    return { outstanding, openCount, overdueCount };
  }, [invoices]);

  const recent = useMemo(() => invoices.slice(0, 15), [invoices]);

  if (loading) {
    return (
      <>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </SafeAreaView>
        <PaystackCheckoutPortal />
      </>
    );
  }

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="School billing"
        subtitle={profile?.school_name || profile?.full_name || undefined}
        onBack={() => navigation.goBack()}
        rightAction={{
          label: 'Hub',
          onPress: () => navigation.navigate(ROUTES.Payments),
          color: colors.warning,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={[styles.statCard, { borderColor: colors.warning + '55' }]}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>{formatMoney(stats.outstanding)}</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 40 }} style={[styles.statCard, { borderColor: colors.primary + '55' }]}>
            <Text style={styles.statLabel}>Open invoices</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.openCount}</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 80 }} style={[styles.statCard, { borderColor: colors.error + '55' }]}>
            <Text style={styles.statLabel}>Overdue</Text>
            <Text style={[styles.statValue, { color: colors.error }]}>{stats.overdueCount}</Text>
          </MotiView>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
            onPress={() => navigation.navigate(ROUTES.Invoices)}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Invoices</Text>
            <Text style={[styles.actionBtnHint, { color: colors.textMuted }]}>Create and edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
            onPress={() => navigation.navigate(ROUTES.Transactions)}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Transactions</Text>
            <Text style={[styles.actionBtnHint, { color: colors.textMuted }]}>Ledger</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent invoices</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Collect with Paystack opens the payer checkout in the browser. Ensure the billed user has an email on file.
        </Text>

        {recent.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No invoices yet.</Text>
          </View>
        ) : (
          recent.map((row, i) => (
            <MotiView
              key={row.id}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: i * 40 }}
              style={[styles.invoiceCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
            >
              <View style={styles.invoiceTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invNum, { color: colors.textPrimary }]}>{row.invoice_number}</Text>
                  <Text style={[styles.invName, { color: colors.textMuted }]} numberOfLines={1}>
                    {row.portal_users?.full_name || '—'}
                  </Text>
                </View>
                <Text style={[styles.invAmount, { color: colors.textPrimary }]}>
                  {formatMoney(row.amount, row.currency || 'NGN')}
                </Text>
              </View>
              <View style={styles.invoiceMeta}>
                <Text style={[styles.badge, { color: colors.textMuted, borderColor: colors.borderLight }]}>
                  {(row.status || '—').toString()}
                </Text>
                {row.due_date ? (
                  <Text style={[styles.due, { color: colors.textMuted }]}>Due {row.due_date}</Text>
                ) : null}
              </View>
              {isPayable(row) ? (
                <TouchableOpacity
                  style={[styles.payBtn, { backgroundColor: colors.primary, opacity: paystackLoading ? 0.7 : 1 }]}
                  onPress={() => startCheckoutForInvoice(row.id)}
                  disabled={paystackLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.payBtnText}>Collect with Paystack</Text>
                </TouchableOpacity>
              ) : (row.status || '').toLowerCase() !== 'paid' &&
                (row.status || '').toLowerCase() !== 'cancelled' &&
                !row.portal_users?.email?.trim() ? (
                <Text style={[styles.payHint, { color: colors.textMuted }]}>
                  Add payer email on the invoice recipient to enable Paystack.
                </Text>
              ) : null}
            </MotiView>
          ))
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
    <PaystackCheckoutPortal />
    </>
  );
}

function getStyles(
  colors: { bg: string; bgCard: string; border: string; borderLight: string; textPrimary: string; textMuted: string; primary: string; warning: string; error: string },
  _isDark: boolean,
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { justifyContent: 'center', alignItems: 'center' },
    scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    statCard: {
      flex: 1,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.sm,
      minWidth: 0,
    },
    statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
    statValue: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.md, marginTop: 4 },
    actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    actionBtn: {
      flex: 1,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
    },
    actionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
    actionBtnHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 2 },
    sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.lg, marginBottom: 4 },
    sectionHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginBottom: SPACING.md, lineHeight: 18 },
    empty: {
      borderWidth: 1,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    invoiceCard: {
      borderWidth: 1,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    invoiceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    invNum: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
    invName: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 2 },
    invAmount: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
    invoiceMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
    badge: {
      fontFamily: FONT_FAMILY.bodyMed,
      fontSize: FONT_SIZE.xs,
      textTransform: 'capitalize',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
    },
    due: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    payBtn: {
      marginTop: SPACING.md,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
    },
    payBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },
    payHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: SPACING.sm },
  });
}

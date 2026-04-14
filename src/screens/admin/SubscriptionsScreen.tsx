import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { subscriptionService } from '../../services/subscription.service';
import { SPACING, RADIUS } from '../../constants/spacing';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';

type SubStatus = 'active' | 'cancelled' | 'expired' | 'suspended';

interface Subscription {
  id: string;
  school_id: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  status: SubStatus;
  end_date: string | null;
  schools?: { name: string } | null;
}

const STATUS_CONFIG: Record<SubStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelled: { label: 'Cancelled', color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
  expired: { label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

/**
 * SubscriptionsScreen - Premium mobile port of the admin subscription manager.
 */
export default function SubscriptionsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SubStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscriptionService.listAllSubscriptions(50);
      setSubs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSubs = subs.filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesSearch =
      !searchText ||
      s.plan_name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.schools?.name?.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    active: subs.filter((s) => s.status === 'active').length,
    mrr: subs
      .filter((s) => s.status === 'active')
      .reduce((acc, s) => {
        const amt = s.amount || 0;
        return acc + (s.billing_cycle === 'monthly' ? amt : s.billing_cycle === 'quarterly' ? amt / 3 : amt / 12);
      }, 0),
  };

  const renderStat = (label: string, value: string | number, icon: any, color: string) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item, index }: { item: Subscription; index: number }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.expired;
    const nextBillIso = subscriptionService.computeNextBillingDate(item);
    const nextBill = nextBillIso
      ? new Date(nextBillIso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    const runAction = async (action: 'renew' | 'suspend' | 'activate' | 'cancel') => {
      setActingId(item.id);
      try {
        if (action === 'renew') {
          await subscriptionService.renewSubscriptionCycle(item.id, item);
        } else if (action === 'cancel') {
          await subscriptionService.cancelSubscription(item.id);
        } else if (action === 'suspend') {
          await subscriptionService.setSubscriptionStatus(item.id, 'suspended');
        } else {
          await subscriptionService.setSubscriptionStatus(item.id, 'active');
        }
        await load();
      } catch (err: any) {
        Alert.alert('Subscription action', err?.message ?? 'Could not complete action.');
      } finally {
        setActingId(null);
      }
    };

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 50 }}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.schoolRow}>
            <View style={styles.schoolAvatar}>
              <Ionicons name="business" size={14} color={colors.primary} />
            </View>
            <Text style={styles.schoolName}>{item.schools?.name || 'Unknown School'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View>
            <Text style={styles.planName}>{item.plan_name}</Text>
            <Text style={styles.planType}>
              {item.billing_cycle} · {item.currency} {item.amount?.toLocaleString()}
            </Text>
            <Text style={styles.planType}>Next cycle: {nextBill}</Text>
          </View>
          {item.end_date && (
            <View style={styles.expiryBox}>
              <Text style={styles.expiryLabel}>Expires</Text>
              <Text style={styles.expiryDate}>
                {new Date(item.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => runAction('renew')}
            disabled={actingId === item.id}
            style={[styles.actionBtn, { borderColor: colors.primary }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>{actingId === item.id ? '...' : 'Renew cycle'}</Text>
          </TouchableOpacity>
          {item.status !== 'suspended' ? (
            <TouchableOpacity
              onPress={() => runAction('suspend')}
              disabled={actingId === item.id}
              style={[styles.actionBtn, { borderColor: '#f59e0b' }]}
            >
              <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>Suspend</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => runAction('activate')}
              disabled={actingId === item.id}
              style={[styles.actionBtn, { borderColor: '#10b981' }]}
            >
              <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Activate</Text>
            </TouchableOpacity>
          )}
          {item.status !== 'cancelled' ? (
            <TouchableOpacity
              onPress={() => runAction('cancel')}
              disabled={actingId === item.id}
              style={[styles.actionBtn, { borderColor: colors.error }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Subscriptions"
        subtitle="School billing & quotas"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsRow}>
          {renderStat('Active Plans', stats.active, 'card-outline', colors.primary)}
          {renderStat('Est. MRR', `₦${Math.round(stats.mrr).toLocaleString()}`, 'trending-up', '#10b981')}
        </View>

        {/* Filters */}
        <View style={styles.filterBar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search school or plan..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
            {(['all', 'active', 'suspended', 'expired'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={[
                  styles.filterPill,
                  statusFilter === s && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.filterText, statusFilter === s && { color: '#fff' }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : filteredSubs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>No subscriptions found</Text>
          </View>
        ) : (
          filteredSubs.map((item, index) => (
            <React.Fragment key={item.id}>{renderItem({ item, index })}</React.Fragment>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => Alert.alert('Coming Soon', 'Subscription creation is being ported to mobile.')}
      >
        <Ionicons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: SPACING.xl, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xl },
    statCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE.base,
      color: colors.textPrimary,
    },
    statLabel: {
      fontFamily: FONT_FAMILY.body,
      fontSize: 10,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    filterBar: { marginBottom: SPACING.lg, gap: SPACING.sm },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      height: 48,
    },
    searchInput: {
      flex: 1,
      marginLeft: SPACING.sm,
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
      color: colors.textPrimary,
    },
    statusFilters: { flexDirection: 'row' },
    filterPill: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SPACING.xs,
      backgroundColor: colors.bgCard,
    },
    filterText: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    schoolRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    schoolAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    schoolName: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: FONT_SIZE.sm,
      color: colors.textPrimary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    statusText: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 10,
      textTransform: 'uppercase',
    },
    cardBody: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    actionRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.md, flexWrap: 'wrap' },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      backgroundColor: colors.bg,
    },
    actionBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    planName: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE.base,
      color: colors.textPrimary,
    },
    planType: {
      fontFamily: FONT_FAMILY.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    expiryBox: { alignItems: 'flex-end' },
    expiryLabel: {
      fontFamily: FONT_FAMILY.body,
      fontSize: 9,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    expiryDate: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 12,
      color: colors.textPrimary,
    },
    emptyContainer: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.5,
    },
    emptyText: {
      marginTop: SPACING.md,
      fontFamily: FONT_FAMILY.bodyBold,
      color: colors.textMuted,
    },
    fab: {
      position: 'absolute',
      right: SPACING.xl,
      bottom: SPACING.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
    },
  });

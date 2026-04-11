import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { schoolService } from '../../services/school.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

interface School {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  status: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  approved: COLORS.success,
  pending: COLORS.warning,
  rejected: COLORS.error,
};

export default function SchoolsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const canOpenApprovals = isAdmin || isTeacher;
  const [schools, setSchools] = useState<School[]>([]);
  const [filtered, setFiltered] = useState<School[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => ({
    total: schools.length,
    approved: schools.filter((school) => school.status === 'approved').length,
    pending: schools.filter((school) => school.status === 'pending').length,
    rejected: schools.filter((school) => school.status === 'rejected').length,
  }), [schools]);

  const load = useCallback(async () => {
    try {
      const data = await schoolService.listSchoolsForAdminScreen(100);
      setSchools(data as School[]);
      setFiltered(data as School[]);
    } catch (e) {
      console.warn('SchoolsScreen load', e);
      setSchools([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = schools;
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.state ?? '').toLowerCase().includes(q) ||
        (s.contact_person ?? '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, statusFilter, schools]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = async (s: School) => {
    Alert.alert('Delete School', `Permanently remove ${s.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await schoolService.deleteSchool(s.id);
            load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not remove school');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
        <Text style={styles.loadText}>Loading schools...</Text>
      </View>
    );
  }

  const FILTERS = ['all', 'approved', 'pending', 'rejected'];

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Schools"
        subtitle={`${schools.length} partner schools`}
        onBack={() => goBackOrTo(navigation, ROUTES.PeopleHub)}
        secondaryAction={canOpenApprovals ? { label: 'Approvals', onPress: () => navigation.navigate(ROUTES.Approvals) } : undefined}
        primaryAction={isAdmin ? { label: 'Add', onPress: () => navigation.navigate(ROUTES.AddSchool) } : undefined}
        colors={COLORS}
      />

      <View style={styles.summaryStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{stats.approved}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{stats.pending}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchLabel}>Find</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search schools or contacts"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setStatusFilter(f)} style={[styles.filterPill, statusFilter === f && styles.filterActive]}>
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.info} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyCode}>SC</Text>
            <Text style={styles.emptyText}>No schools found.</Text>
          </View>
        ) : (
          filtered.map((s, i) => (
            <MotiView
              key={s.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', delay: i * 40 }}
            >
              <TouchableOpacity style={styles.card} activeOpacity={0.82} onPress={() => navigation.navigate(ROUTES.SchoolDetail, { schoolId: s.id })}>
                <LinearGradient colors={[COLORS.info + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={styles.cardTop}>
                  <View style={styles.schoolIcon}><Text style={styles.schoolIconText}>SC</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                    {s.state ? <Text style={styles.cardMeta}>{s.state}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[s.status] ?? COLORS.textMuted) + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] ?? COLORS.textMuted }]}>{s.status.toUpperCase()}</Text>
                  </View>
                  {isAdmin ? (
                    <TouchableOpacity onPress={() => handleDelete(s)} style={styles.actionIcon}><Text style={styles.actionIconText}>DEL</Text></TouchableOpacity>
                  ) : null}
                </View>
                {(s.contact_person || s.email || s.phone) ? (
                  <View style={styles.cardDetails}>
                    {s.contact_person ? <Text style={styles.detailText}>{s.contact_person}</Text> : null}
                    {s.email ? <Text style={styles.detailText}>{s.email}</Text> : null}
                    {s.phone ? <Text style={styles.detailText}>{s.phone}</Text> : null}
                  </View>
                ) : null}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => navigation.navigate(ROUTES.SchoolDetail, { schoolId: s.id })} style={styles.cardAction}>
                    <Text style={styles.cardActionText}>Open</Text>
                  </TouchableOpacity>
                  {isAdmin ? (
                    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.AddSchool, { schoolId: s.id })} style={styles.cardAction}>
                      <Text style={styles.cardActionText}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canOpenApprovals && s.status === 'pending' ? (
                    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.Approvals)} style={styles.cardActionPrimary}>
                      <Text style={styles.cardActionPrimaryText}>Review</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            </MotiView>
          ))
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
  summaryStrip: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  summaryLabel: { marginTop: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, textTransform: 'uppercase' },
  filters: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterActive: { backgroundColor: COLORS.info + '20', borderColor: COLORS.info },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: LETTER_SPACING.wide },
  filterTextActive: { color: COLORS.info },
  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  schoolIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.info + '15', alignItems: 'center', justifyContent: 'center' },
  schoolIconText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: COLORS.info, letterSpacing: LETTER_SPACING.wide },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
  cardDetails: { gap: 3, paddingLeft: 52 },
  detailText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, paddingLeft: 52, paddingTop: 2 },
  cardAction: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  cardActionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  cardActionPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.info,
  },
  cardActionPrimaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  actionIcon: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.error + '11', marginLeft: 8 },
  actionIconText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: COLORS.error, letterSpacing: LETTER_SPACING.wide },
});

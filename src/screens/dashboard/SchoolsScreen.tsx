import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface School {
  id: string;
  school_name: string;
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
  const [schools, setSchools] = useState<School[]>([]);
  const [filtered, setFiltered] = useState<School[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('schools')
      .select('id, school_name, contact_person, email, phone, address, state, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) { setSchools(data as School[]); setFiltered(data as School[]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = schools;
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.school_name.toLowerCase().includes(q) ||
        (s.state ?? '').toLowerCase().includes(q) ||
        (s.contact_person ?? '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, statusFilter, schools]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
        <Text style={styles.loadText}>Loading schools…</Text>
      </View>
    );
  }

  const FILTERS = ['all', 'approved', 'pending', 'rejected'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Schools</Text>
          <Text style={styles.subtitle}>{schools.length} partner schools</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => navigation.navigate('AddSchool')} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search schools…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter pills */}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.info} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🏫</Text>
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
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('SchoolDetail', { schoolId: s.id })}>
                <LinearGradient colors={[COLORS.info + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={styles.cardTop}>
                  <View style={styles.schoolIcon}>
                    <Text style={{ fontSize: 22 }}>🏫</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{s.school_name}</Text>
                    {s.state ? <Text style={styles.cardMeta}>📍 {s.state}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[s.status] ?? COLORS.textMuted) + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[s.status] ?? COLORS.textMuted }]}>
                      {s.status}
                    </Text>
                  </View>
                </View>
                {(s.contact_person || s.email || s.phone) ? (
                  <View style={styles.cardDetails}>
                    {s.contact_person ? <Text style={styles.detailText}>👤 {s.contact_person}</Text> : null}
                    {s.email ? <Text style={styles.detailText}>✉️ {s.email}</Text> : null}
                    {s.phone ? <Text style={styles.detailText}>📞 {s.phone}</Text> : null}
                  </View>
                ) : null}
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

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },

  filters: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterActive: { backgroundColor: COLORS.info + '20', borderColor: COLORS.info },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.info },

  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  schoolIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.info + '15', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  cardDetails: { gap: 3, paddingLeft: 52 },
  detailText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.info, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
});

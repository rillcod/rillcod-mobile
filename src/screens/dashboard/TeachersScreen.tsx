import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform, Alert,
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

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
}

function Avatar({ name }: { name: string }) {
  return (
    <LinearGradient colors={[COLORS.info, '#1e3a8a']} style={styles.avatar}>
      <Text style={styles.avatarText}>{(name || '?')[0].toUpperCase()}</Text>
    </LinearGradient>
  );
}

export default function TeachersScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filtered, setFiltered] = useState<Teacher[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const stats = useMemo(() => ({
    total: teachers.length,
    live: teachers.filter((teacher) => teacher.is_active).length,
    offline: teachers.filter((teacher) => !teacher.is_active).length,
    assigned: teachers.filter((teacher) => !!teacher.school_name).length,
  }), [teachers]);

  const load = useCallback(async () => {
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email, phone, school_name, is_active, created_at')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isAdmin && profile?.school_id) {
      q = q.eq('school_id', profile.school_id);
    }

    const { data } = await q;
    if (data) {
      setTeachers(data as Teacher[]);
      setFiltered(data as Teacher[]);
    }
    setLoading(false);
  }, [profile, isAdmin]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(teachers);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(teachers.filter((t) =>
      t.full_name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.school_name ?? '').toLowerCase().includes(q)
    ));
  }, [search, teachers]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = async (t: Teacher) => {
    Alert.alert('Delete Teacher', `Permanently remove ${t.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('portal_users').delete().eq('id', t.id);
          if (!error) load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
        <Text style={styles.loadText}>Loading teachers...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Teachers"
        subtitle={`${teachers.length} active records`}
        onBack={() => navigation.goBack()}
        secondaryAction={isAdmin ? { label: 'Bulk', onPress: () => navigation.navigate('BulkRegister') } : undefined}
        primaryAction={isAdmin ? { label: 'Add', onPress: () => navigation.navigate('AddTeacher') } : undefined}
        colors={COLORS}
      />

      <View style={styles.summaryStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{stats.live}</Text>
          <Text style={styles.summaryLabel}>Live</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.info }]}>{stats.assigned}</Text>
          <Text style={styles.summaryLabel}>Assigned</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchLabel}>Find</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search teachers or schools"
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

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.info} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyCode}>TC</Text>
            <Text style={styles.emptyText}>No teachers found.</Text>
          </View>
        ) : (
          filtered.map((t, i) => (
            <MotiView
              key={t.id}
              from={{ opacity: 0, translateX: -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', delay: i * 40 }}
            >
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardMain} activeOpacity={0.82} onPress={() => navigation.navigate('TeacherDetail', { teacherId: t.id })}>
                  <LinearGradient colors={[COLORS.info + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <Avatar name={t.full_name} />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardName} numberOfLines={1}>{t.full_name}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{t.email}</Text>
                    {t.phone ? <Text style={styles.cardPhone}>{t.phone}</Text> : null}
                    {t.school_name ? (
                      <View style={styles.schoolChip}><Text style={styles.schoolChipText}>{t.school_name}</Text></View>
                    ) : null}
                  </View>
                  <View style={styles.actions}>
                    <View style={[styles.statusPill, { backgroundColor: t.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
                      <Text style={[styles.statusPillText, { color: t.is_active ? COLORS.success : COLORS.error }]}>{t.is_active ? 'LIVE' : 'OFF'}</Text>
                    </View>
                    {isAdmin ? (
                      <TouchableOpacity onPress={() => handleDelete(t)} style={styles.actionIcon}><Text style={styles.actionIconText}>DEL</Text></TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => navigation.navigate('TeacherDetail', { teacherId: t.id })} style={styles.cardAction}>
                    <Text style={styles.cardActionText}>Open</Text>
                  </TouchableOpacity>
                  {isAdmin ? (
                    <TouchableOpacity onPress={() => navigation.navigate('AddTeacher', { teacherId: t.id })} style={styles.cardAction}>
                      <Text style={styles.cardActionText}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
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
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, textTransform: 'uppercase' },
  list: { paddingHorizontal: SPACING.xl },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  cardMain: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.white100 },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardPhone: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  schoolChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  schoolChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  actions: { alignItems: 'flex-end', gap: 8 },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: 60, paddingBottom: SPACING.md },
  cardAction: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  cardActionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  statusPillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  actionIcon: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.error + '11' },
  actionIconText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: COLORS.error, letterSpacing: LETTER_SPACING.wide },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

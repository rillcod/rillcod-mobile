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
    <LinearGradient colors={['#7c3aed', '#4c1d95']} style={styles.avatar}>
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
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(teachers); return; }
    const q = search.toLowerCase();
    setFiltered(teachers.filter(t =>
      t.full_name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.school_name ?? '').toLowerCase().includes(q)
    ));
  }, [search, teachers]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <Text style={styles.loadText}>Loading teachers…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Teachers</Text>
          <Text style={styles.subtitle}>{teachers.length} total</Text>
        </View>
        {isAdmin && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => navigation.navigate('BulkRegister')} style={[styles.addBtn, { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border }]}>
              <Text style={[styles.addBtnText, { color: COLORS.textSecondary }]}>📋 Bulk</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AddTeacher')} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search teachers…"
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

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>👩‍🏫</Text>
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
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('TeacherDetail', { teacherId: t.id })}>
                <LinearGradient colors={['#7c3aed10', 'transparent']} style={StyleSheet.absoluteFill} />
                <Avatar name={t.full_name} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>{t.full_name}</Text>
                  <Text style={styles.cardEmail} numberOfLines={1}>{t.email}</Text>
                  {t.phone ? <Text style={styles.cardPhone}>{t.phone}</Text> : null}
                  {t.school_name ? (
                    <View style={styles.schoolChip}>
                      <Text style={styles.schoolChipText}>🏫 {t.school_name}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.statusDot, { backgroundColor: t.is_active ? COLORS.success : COLORS.error }]} />
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
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },

  list: { paddingHorizontal: SPACING.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.white100 },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardPhone: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  schoolChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  schoolChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  statusDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
});

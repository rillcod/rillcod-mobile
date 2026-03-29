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
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Student {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
  section_class: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  true: COLORS.success,
  false: COLORS.error,
};

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <LinearGradient
      colors={[color, color + '80']}
      style={styles.avatar}
    >
      <Text style={styles.avatarText}>{(name || '?')[0].toUpperCase()}</Text>
    </LinearGradient>
  );
}

export default function StudentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const isAdmin = profile?.role === 'admin';
  const canAdd = isAdmin || profile?.role === 'teacher';

  const load = useCallback(async () => {
    let q = supabase
      .from('portal_users')
      .select('id, full_name, email, school_name, is_active, created_at, section_class')
      .eq('role', 'student')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isAdmin && profile?.school_id) {
      q = q.eq('school_id', profile.school_id);
    }

    const { data, count } = await q;
    if (data) {
      setStudents(data as Student[]);
      setFiltered(data as Student[]);
      setTotal(count ?? data.length);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(students);
    } else {
      const q = search.toLowerCase();
      setFiltered(students.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.school_name ?? '').toLowerCase().includes(q)
      ));
    }
  }, [search, students]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.admin} size="large" />
        <Text style={styles.loadText}>Loading students…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.subtitle}>{total} registered</Text>
        </View>
        {canAdd && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => navigation.navigate('BulkRegister')} style={[styles.addBtn, { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border }]}>
              <Text style={[styles.addBtnText, { color: COLORS.textSecondary }]}>📋 Bulk</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AddStudent')} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email or school…"
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.admin} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>{search ? 'No students match your search.' : 'No students found.'}</Text>
          </View>
        ) : (
          filtered.map((s, i) => (
            <MotiView
              key={s.id}
              from={{ opacity: 0, translateX: -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', delay: i * 40 }}
            >
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })}>
                <LinearGradient
                  colors={[COLORS.admin + '08', 'transparent']}
                  style={StyleSheet.absoluteFill}
                />
                <Avatar name={s.full_name} color={COLORS.admin} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>{s.full_name}</Text>
                  <Text style={styles.cardEmail} numberOfLines={1}>{s.email}</Text>
                  <View style={styles.cardMeta}>
                    {s.school_name ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>🏫 {s.school_name}</Text>
                      </View>
                    ) : null}
                    {s.section_class ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>📚 {s.section_class}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.statusDot, { backgroundColor: s.is_active ? COLORS.success : COLORS.error }]} />
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
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  metaChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  metaChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  statusDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.admin, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

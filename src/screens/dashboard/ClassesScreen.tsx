import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  teacher_name: string | null;
  student_count: number;
  school_name: string | null;
  created_at: string;
}

const CLASS_COLORS = [COLORS.admin, '#7c3aed', COLORS.info, COLORS.success, COLORS.gold, COLORS.accent];

export default function ClassesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [filtered, setFiltered] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isTeacher = profile?.role === 'teacher';

  const load = useCallback(async () => {
    let q = supabase
      .from('classes')
      .select('id, name, description, school_name, created_at, portal_users:teacher_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (isTeacher) q = q.eq('teacher_id', profile!.id);
    else if (profile?.school_id) q = q.eq('school_id', profile.school_id);

    const { data } = await q;
    if (data) {
      const items: ClassItem[] = (data as any[]).map(c => ({
        ...c,
        teacher_name: c.portal_users?.full_name ?? null,
        student_count: 0,
      }));

      // Fetch real student counts in parallel
      if (items.length > 0) {
        const counts = await Promise.all(
          items.map(c =>
            supabase.from('class_enrollments').select('id', { count: 'exact', head: true }).eq('class_id', c.id)
          )
        );
        counts.forEach((res, i) => { items[i].student_count = res.count ?? 0; });
      }

      setClasses(items);
      setFiltered(items);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(classes); return; }
    const q = search.toLowerCase();
    setFiltered(classes.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.teacher_name ?? '').toLowerCase().includes(q) ||
      (c.school_name ?? '').toLowerCase().includes(q)
    ));
  }, [search, classes]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <Text style={styles.loadText}>Loading classes…</Text>
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
          <Text style={styles.title}>{isTeacher ? 'My Classes' : 'Classes'}</Text>
          <Text style={styles.subtitle}>{classes.length} total</Text>
        </View>
        {(profile?.role === 'admin' || profile?.role === 'teacher') && (
          <TouchableOpacity onPress={() => navigation.navigate('AddClass')} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search classes…"
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
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyText}>No classes found.</Text>
          </View>
        ) : (
          filtered.map((c, i) => {
            const color = CLASS_COLORS[i % CLASS_COLORS.length];
            return (
              <MotiView key={c.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('ClassDetail', { classId: c.id })}>
                  <LinearGradient colors={[color + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={[styles.colorBar, { backgroundColor: color }]} />
                  <View style={styles.cardContent}>
                    <Text style={styles.className}>{c.name}</Text>
                    {c.description ? <Text style={styles.classDesc} numberOfLines={2}>{c.description}</Text> : null}
                    <View style={styles.metaRow}>
                      {c.teacher_name ? <Text style={styles.meta}>👩‍🏫 {c.teacher_name}</Text> : null}
                      {c.school_name ? <Text style={styles.meta}>🏫 {c.school_name}</Text> : null}
                    </View>
                  </View>
                  <View style={[styles.arrow, { borderColor: color + '50' }]}>
                    <Text style={[styles.arrowText, { color }]}>›</Text>
                  </View>
                </TouchableOpacity>
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
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, overflow: 'hidden' },
  colorBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: SPACING.md, gap: 4 },
  className: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  classDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: 4 },
  meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  arrow: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  arrowText: { fontSize: 20 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
});

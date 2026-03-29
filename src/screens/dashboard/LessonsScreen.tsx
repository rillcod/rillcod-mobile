import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Lesson {
  id: string;
  title: string;
  type: string | null;
  course_id: string | null;
  content: any;
  is_published: boolean;
  created_at: string;
  created_by: string | null;
  courses?: { title: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  academic: COLORS.info,
  project: COLORS.accent,
  interactive: '#7c3aed',
  video: COLORS.error,
};
const TYPE_EMOJIS: Record<string, string> = {
  academic: '📖', project: '🔬', interactive: '🎮', video: '🎬',
};

export default function LessonsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filtered, setFiltered] = useState<Lesson[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    let q = supabase
      .from('lessons')
      .select('id, title, type, course_id, is_published, created_at, created_by, courses(title)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isStaff) q = q.eq('is_published', true);
    if (profile?.role === 'teacher' && profile.id) q = q.eq('created_by', profile.id);

    const { data, error } = await q;
    if (error) console.warn('lessons:', error.message);
    if (data) { setLessons(data as any); setFiltered(data as any); }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = lessons;
    if (typeFilter !== 'all') list = list.filter(l => l.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.title.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [search, typeFilter, lessons]);

  const togglePublish = async (lesson: Lesson) => {
    const next = !lesson.is_published;
    await supabase.from('lessons').update({ is_published: next }).eq('id', lesson.id);
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_published: next } : l));
  };

  const types = ['all', 'academic', 'project', 'interactive', 'video'];
  const published = lessons.filter(l => l.is_published).length;

  if (loading) return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Lessons</Text>
          <Text style={styles.subtitle}>{lessons.length} lessons · {published} published</Text>
        </View>
        {isStaff && (
          <TouchableOpacity
            onPress={() => Alert.alert('Create Lesson', 'Use the web dashboard to create AI-powered lessons with full editor.')}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm }}>
          {types.map(t => {
            const active = typeFilter === t;
            const col = TYPE_COLORS[t] || COLORS.primary;
            return (
              <TouchableOpacity key={t} onPress={() => setTypeFilter(t)}
                style={[styles.typeChip, active && { backgroundColor: col + '22', borderColor: col }]}>
                <Text style={{ fontSize: 14 }}>{t === 'all' ? '📚' : TYPE_EMOJIS[t] || '📖'}</Text>
                <Text style={[styles.typeChipText, active && { color: col }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search lessons…" placeholderTextColor={COLORS.textMuted}
          value={search} onChangeText={setSearch} />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 40 }}>📖</Text>
            <Text style={styles.emptyText}>No lessons found.</Text>
            {isStaff && <Text style={styles.emptyHint}>Create lessons from the web dashboard for rich AI-powered content.</Text>}
          </View>
        ) : filtered.map((l, i) => {
          const tc = TYPE_COLORS[l.type || ''] || COLORS.textMuted;
          return (
            <MotiView key={l.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 30 }}>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => Alert.alert(l.title, 'Full lesson viewer available in the web app.')}
              >
                <LinearGradient colors={[tc + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{TYPE_EMOJIS[l.type || ''] || '📖'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{l.title}</Text>
                      {(l.courses as any)?.title && (
                        <Text style={styles.cardCourse}>📚 {(l.courses as any).title}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: SPACING.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                    {l.type && (
                      <View style={[styles.typeBadge, { backgroundColor: tc + '22', borderColor: tc + '44' }]}>
                        <Text style={[styles.typeBadgeText, { color: tc }]}>{l.type}</Text>
                      </View>
                    )}
                    <View style={[styles.publishBadge, { backgroundColor: l.is_published ? COLORS.success + '22' : COLORS.warning + '22' }]}>
                      <Text style={[styles.publishBadgeText, { color: l.is_published ? COLORS.success : COLORS.warning }]}>
                        {l.is_published ? '✓ Published' : '⏸ Draft'}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(l.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </Text>
                  </View>
                </View>
                {isStaff && (
                  <TouchableOpacity onPress={() => togglePublish(l)} style={styles.toggleBtn}>
                    <Text style={styles.toggleBtnText}>{l.is_published ? '⏸' : '▶'}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </MotiView>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#fff' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  typeChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },
  list: { paddingHorizontal: SPACING.xl },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden', gap: SPACING.sm },
  cardTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: 20 },
  cardCourse: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 3 },
  typeBadge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  publishBadge: { borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  publishBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  dateText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  toggleBtn: { width: 32, height: 32, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleBtnText: { fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  emptyHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type ContentType = 'video' | 'document' | 'presentation' | 'interactive' | 'image';

const TYPE_COLORS: Record<string, string> = {
  video:        '#ef4444',
  document:     '#3b82f6',
  presentation: '#f59e0b',
  interactive:  '#10b981',
  image:        '#8b5cf6',
};

const TYPE_ICONS: Record<string, string> = {
  video:        '🎬',
  document:     '📄',
  presentation: '📊',
  interactive:  '💻',
  image:        '🖼️',
};

const ALL_TYPES: ContentType[] = ['video', 'document', 'presentation', 'interactive', 'image'];

interface ContentItem {
  id: string;
  title: string;
  type: string;
  url: string | null;
  metadata: any;
  created_at: string;
  usage_count: number | null;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LibraryScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('content_library')
        .select('id, title, type, url, metadata, created_at, usage_count')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as ContentItem[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = items.filter(i => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || i.type === filterType;
    return matchSearch && matchType;
  });

  const renderItem = ({ item, index }: { item: ContentItem; index: number }) => {
    const color = TYPE_COLORS[item.type] ?? COLORS.textMuted;
    const icon = TYPE_ICONS[item.type] ?? '📁';
    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35, type: 'timing', duration: 280 }}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            if (item.url) {
              Alert.alert(item.title, `URL: ${item.url}\n\nOpen this link in a browser to access this resource.`);
            } else {
              Alert.alert('No URL', 'This content item has no associated URL.');
            }
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.typeBox, { backgroundColor: `${color}20` }]}>
            <Text style={styles.typeIcon}>{icon}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <View style={[styles.typePill, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.typePillText, { color }]}>{item.type}</Text>
              </View>
              <Text style={styles.usageText}>
                {item.usage_count ?? 0} {(item.usage_count ?? 0) === 1 ? 'use' : 'uses'}
              </Text>
            </View>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Library</Text>
        {isStaff && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert('Add Content', 'This feature is available in the web app.\n\nVisit: app.rillcod.com/dashboard/library')}
          >
            <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search library..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterScroll}>
        {['all', ...ALL_TYPES].map(t => {
          const active = filterType === t;
          const color = t === 'all' ? COLORS.primary : (TYPE_COLORS[t] ?? COLORS.textMuted);
          return (
            <TouchableOpacity
              key={t}
              style={[styles.filterTab, active && { backgroundColor: `${color}20`, borderColor: color }]}
              onPress={() => setFilterType(t)}
            >
              {t !== 'all' && <Text style={styles.filterIcon}>{TYPE_ICONS[t]}</Text>}
              <Text style={[styles.filterText, active && { color }]}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          <Text style={{ color: COLORS.textPrimary, fontFamily: FONT_FAMILY.bodySemi }}>{filtered.length}</Text>
          {' '}item{filtered.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No content found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your search or filter</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40, paddingTop: SPACING.xs }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  addBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  addBtnInner: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.base, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 14, marginRight: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  clearBtn: { fontSize: 14, color: COLORS.textMuted, padding: 4 },
  filterScroll: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm, flexWrap: 'wrap' },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  filterIcon: { fontSize: 12 },
  filterText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  statsRow: { paddingHorizontal: SPACING.base, marginBottom: SPACING.sm },
  statsText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.md },
  typeBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typePill: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  usageText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  itemTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 4 },
  itemDate: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  cardArrow: { fontSize: 20, color: COLORS.textMuted },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { libraryService } from '../../services/library.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

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
  rating_average: number | null;
  rating_count: number | null;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeUrl(url: string): string {
  const value = url.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export default function LibraryScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [ratingModalItem, setRatingModalItem] = useState<ContentItem | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      const data = await libraryService.listContent({
        role: profile?.role,
        schoolId: profile?.school_id,
      });
      setItems(
        ((data ?? []) as any[]).map((item) => ({
          id: item.id,
          title: item.title,
          type: item.content_type ?? 'document',
          url: item.files?.public_url ?? null,
          metadata: { description: item.description ?? null, tags: item.tags ?? [] },
          created_at: item.created_at ?? new Date().toISOString(),
          usage_count: item.usage_count ?? 0,
          rating_average: typeof item.rating_average === 'number' ? item.rating_average : null,
          rating_count: typeof item.rating_count === 'number' ? item.rating_count : null,
        })) as ContentItem[]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openContentItem = async (item: ContentItem) => {
    if (!item.url) {
      Alert.alert('No URL', 'This content item has no associated URL.');
      return;
    }
    try {
      const target = normalizeUrl(item.url);
      const supported = await Linking.canOpenURL(target);
      if (!supported) {
        Alert.alert('Cannot open', 'This resource link is not valid on this device.');
        return;
      }
      await Linking.openURL(target);
    } catch {
      Alert.alert('Open failed', 'Could not open this resource. Please try again.');
    }
  };

  const submitRating = async (stars: number) => {
    if (!profile?.id || !ratingModalItem) return;
    setRatingBusy(true);
    try {
      await libraryService.rateContent(profile.id, ratingModalItem.id, stars);
      setRatingModalItem(null);
      await load();
    } catch (e: any) {
      Alert.alert('Could not save rating', e?.message ?? 'Try again.');
    } finally {
      setRatingBusy(false);
    }
  };

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
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardMainPress}
            onPress={() => void openContentItem(item)}
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
              <Text style={styles.ratingLine}>
                {item.rating_average != null && item.rating_count != null && item.rating_count > 0
                  ? `★ ${item.rating_average.toFixed(1)} · ${item.rating_count} rating${item.rating_count === 1 ? '' : 's'}`
                  : 'No ratings yet'}
              </Text>
              <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
          {profile?.id ? (
            <TouchableOpacity style={styles.ratePill} onPress={() => setRatingModalItem(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.rateLinkText}>Rate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
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

      <Modal visible={!!ratingModalItem} transparent animationType="fade" onRequestClose={() => setRatingModalItem(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => !ratingBusy && setRatingModalItem(null)}>
          <TouchableOpacity style={[styles.modalCard, { borderColor: COLORS.border, backgroundColor: COLORS.bgCard }]} activeOpacity={1} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
              Rate “{ratingModalItem?.title ?? ''}”
            </Text>
            <Text style={[styles.modalHint, { color: COLORS.textMuted }]}>Tap a score (1–5). This updates the library average.</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.starBtn, { borderColor: COLORS.primary }]}
                  disabled={ratingBusy}
                  onPress={() => submitRating(n)}
                >
                  <Text style={[styles.starBtnText, { color: COLORS.primary }]}>{n}★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCancel} disabled={ratingBusy} onPress={() => setRatingModalItem(null)}>
              <Text style={{ color: COLORS.textMuted, fontFamily: FONT_FAMILY.bodySemi }}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm, paddingLeft: SPACING.md, paddingRight: SPACING.sm, marginBottom: SPACING.sm, gap: SPACING.sm },
  cardMainPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  typeBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typePill: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  usageText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  itemTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 4 },
  ratingLine: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.warning, marginBottom: 2 },
  itemDate: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  ratePill: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 10 },
  rateLinkText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primary },
  cardArrow: { fontSize: 20, color: COLORS.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg, gap: SPACING.sm },
  modalTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.md },
  modalHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  starRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  starBtn: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  starBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  modalCancel: { alignItems: 'center', marginTop: SPACING.md },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type NewsletterStatus = 'draft' | 'published';
type FilterTab = 'all' | 'draft' | 'published';

interface Newsletter {
  id: string;
  title: string;
  content: string;
  status: NewsletterStatus;
  created_at: string;
  published_at: string | null;
  author_id: string | null;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NewslettersScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const load = useCallback(async () => {
    try {
      let query = supabase
        .from('newsletters')
        .select('id, title, content, status, created_at, published_at, author_id')
        .order('created_at', { ascending: false });

      // School sees newsletters for their school; admin sees all
      if (profile?.role === 'school' && profile.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNewsletters((data ?? []) as Newsletter[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleDelete = (item: Newsletter) => {
    Alert.alert(
      'Delete Newsletter',
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('newsletters').delete().eq('id', item.id);
            if (error) { Alert.alert('Error', error.message); return; }
            setNewsletters(prev => prev.filter(n => n.id !== item.id));
          },
        },
      ]
    );
  };

  const handleSave = async (publish: boolean) => {
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    if (!formContent.trim()) { Alert.alert('Validation', 'Content is required'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('newsletters').insert({
        title: formTitle.trim(),
        content: formContent.trim(),
        status: publish ? 'published' : 'draft',
        author_id: profile?.id,
        school_id: profile?.school_id || null,
        published_at: publish ? now : null,
        created_at: now,
      });
      if (error) throw error;
      setShowModal(false);
      setFormTitle(''); setFormContent('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = newsletters.filter(n => {
    if (filter === 'draft') return n.status === 'draft';
    if (filter === 'published') return n.status === 'published';
    return true;
  });

  const total = newsletters.length;
  const published = newsletters.filter(n => n.status === 'published').length;
  const drafts = newsletters.filter(n => n.status === 'draft').length;

  const renderItem = ({ item, index }: { item: Newsletter; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 35, type: 'timing', duration: 260 }}
    >
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => isStaff && handleDelete(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: item.status === 'published' ? COLORS.success : COLORS.warning }
            ]}>
              {item.status === 'published' ? '● Published' : '◐ Draft'}
            </Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.published_at ?? item.created_at)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardContent} numberOfLines={2}>{item.content}</Text>
        {isStaff && <Text style={styles.hintText}>Long press to delete</Text>}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Newsletters</Text>
        {isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
              <Text style={styles.addBtnText}>+ New</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total', value: total, color: COLORS.textPrimary },
          { label: 'Published', value: published, color: COLORS.success },
          { label: 'Drafts', value: drafts, color: COLORS.warning },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'published', 'draft'] as FilterTab[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📰</Text>
          <Text style={styles.emptyTitle}>No newsletters yet</Text>
          <Text style={styles.emptySubtitle}>
            {isStaff ? 'Create a newsletter to communicate with students' : 'No newsletters have been published yet'}
          </Text>
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

      {/* New Newsletter Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Newsletter</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Newsletter title"
                placeholderTextColor={COLORS.textMuted}
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <Text style={styles.label}>Content *</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your newsletter content here..."
                placeholderTextColor={COLORS.textMuted}
                value={formContent}
                onChangeText={setFormContent}
                multiline
                numberOfLines={8}
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBtn}
                  onPress={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={COLORS.warning} />
                    : <Text style={styles.draftBtnText}>Save Draft</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => handleSave(true)}
                  disabled={saving}
                >
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.publishBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.publishBtnText}>Publish</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display },
  statLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primaryLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  statusBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  cardDate: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  cardTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: 6 },
  cardContent: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, lineHeight: 20 },
  hintText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'right' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  contentInput: { minHeight: 200, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  draftBtn: { flex: 1.2, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.warning, alignItems: 'center', justifyContent: 'center' },
  draftBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.warning },
  publishBtn: { flex: 1.5, borderRadius: RADIUS.lg, overflow: 'hidden' },
  publishBtnInner: { padding: SPACING.md, alignItems: 'center' },
  publishBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

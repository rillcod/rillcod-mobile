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

const LANG_COLORS: Record<string, string> = {
  python:     '#3b82f6',
  javascript: '#f59e0b',
  html:       '#ef4444',
  css:        '#8b5cf6',
  java:       '#f97316',
  other:      COLORS.textMuted,
};

const LANG_ICONS: Record<string, string> = {
  python: '🐍', javascript: '⚡', html: '🌐', css: '🎨', java: '☕', other: '📄',
};

const LANGUAGES = ['Python', 'JavaScript', 'HTML', 'CSS', 'Java', 'Other'];

interface VaultItem {
  id: string;
  user_id: string;
  title: string;
  language: string;
  code: string;
  description: string | null;
  tags: string[] | null;
  created_at: string;
  expanded?: boolean;
}

export default function VaultScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLang, setFormLang] = useState('Python');
  const [formTags, setFormTags] = useState('');
  const [formCode, setFormCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('vault_items')
        .select('id, user_id, title, language, code, description, tags, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(((data ?? []) as VaultItem[]).map(i => ({ ...i, expanded: false })));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleExpand = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, expanded: !i.expanded } : i));
  };

  const handleDelete = (item: VaultItem) => {
    Alert.alert(
      'Delete Snippet',
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('vault_items').delete().eq('id', item.id);
            if (error) { Alert.alert('Error', error.message); return; }
            setItems(prev => prev.filter(i => i.id !== item.id));
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    if (!formCode.trim()) { Alert.alert('Validation', 'Code is required'); return; }
    setSaving(true);
    try {
      const tagsArr = formTags.trim()
        ? formTags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      const { error } = await supabase.from('vault_items').insert({
        user_id: profile?.id,
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        language: formLang.toLowerCase(),
        tags: tagsArr.length > 0 ? tagsArr : null,
        code: formCode.trim(),
      });
      if (error) throw error;
      setShowModal(false);
      setFormTitle(''); setFormDesc(''); setFormLang('Python'); setFormTags(''); setFormCode('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const uniqueLangs = new Set(items.map(i => i.language)).size;
  const codePreview = (code: string) => code.split('\n').slice(0, 3).join('\n');

  const renderItem = ({ item, index }: { item: VaultItem; index: number }) => {
    const lang = item.language?.toLowerCase() ?? 'other';
    const color = LANG_COLORS[lang] ?? COLORS.textMuted;
    const icon = LANG_ICONS[lang] ?? '📄';

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 40, type: 'timing', duration: 280 }}
      >
        <TouchableOpacity
          style={styles.card}
          onLongPress={() => handleDelete(item)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.langBadge, { backgroundColor: `${color}20` }]}>
              <Text style={styles.langIcon}>{icon}</Text>
              <Text style={[styles.langText, { color }]}>{item.language}</Text>
            </View>
            <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.expandBtn}>
              <Text style={styles.expandBtnText}>{item.expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 4).map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Code preview */}
          <View style={styles.codePreview}>
            <Text style={styles.codeText}>
              {item.expanded ? item.code : codePreview(item.code)}
            </Text>
          </View>
          {!item.expanded && item.code.split('\n').length > 3 && (
            <Text style={styles.moreLines}>+{item.code.split('\n').length - 3} more lines</Text>
          )}

          <Text style={styles.hintText}>Long press to delete</Text>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vault</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
            <Text style={styles.addBtnText}>+ Save</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{items.length}</Text>
          <Text style={styles.statLabel}>Snippets</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.info }]}>{uniqueLangs}</Text>
          <Text style={styles.statLabel}>Languages</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyTitle}>Your vault is empty</Text>
          <Text style={styles.emptySubtitle}>Save code snippets to access them anytime</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40, paddingTop: SPACING.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Save Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Save Snippet</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Fibonacci sequence" placeholderTextColor={COLORS.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="Short description" placeholderTextColor={COLORS.textMuted}
                value={formDesc} onChangeText={setFormDesc} />

              <Text style={styles.label}>Language</Text>
              <View style={styles.langPillsRow}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.langPill, formLang === l && styles.langPillActive]}
                    onPress={() => setFormLang(l)}
                  >
                    <Text style={[styles.langPillText, formLang === l && styles.langPillTextActive]}>
                      {LANG_ICONS[l.toLowerCase()] ?? '📄'} {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Tags (comma-separated)</Text>
              <TextInput style={styles.input} placeholder="e.g. recursion, math, beginner" placeholderTextColor={COLORS.textMuted}
                value={formTags} onChangeText={setFormTags} />

              <Text style={styles.label}>Code *</Text>
              <TextInput style={[styles.input, styles.codeInput]} placeholder="# Paste your code here..." placeholderTextColor={COLORS.textMuted}
                value={formCode} onChangeText={setFormCode} multiline numberOfLines={6} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Save</Text>}
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
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display, color: COLORS.textPrimary },
  statLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  langBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  langIcon: { fontSize: 14 },
  langText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  expandBtn: { padding: 4 },
  expandBtnText: { fontSize: 12, color: COLORS.textMuted },
  itemTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: 4 },
  itemDesc: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  tagChip: { backgroundColor: COLORS.white05, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  tagText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  codePreview: { backgroundColor: '#0a0a14', borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  codeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.mono, color: '#a8ff78', lineHeight: 18 },
  moreLines: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 4, paddingLeft: SPACING.sm },
  hintText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 8, textAlign: 'right' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '95%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  codeInput: { minHeight: 140, textAlignVertical: 'top', fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm, backgroundColor: '#0a0a14' },
  langPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  langPill: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  langPillActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  langPillText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  langPillTextActive: { color: COLORS.primaryLight, fontFamily: FONT_FAMILY.bodySemi },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

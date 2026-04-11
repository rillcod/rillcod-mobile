import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { vaultService } from '../../services/vault.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

const LANG_COLORS: Record<string, string> = {
  python: '#3b82f6',
  javascript: '#f59e0b',
  html: '#ef4444',
  css: '#8b5cf6',
  java: '#f97316',
  typescript: '#06b6d4',
  sql: '#10b981',
  bash: '#94a3b8',
  other: COLORS.textMuted,
};

const LANG_ICONS: Record<string, string> = {
  python: 'PY',
  javascript: 'JS',
  html: 'HT',
  css: 'CS',
  java: 'JV',
  typescript: 'TS',
  sql: 'SQ',
  bash: 'SH',
  other: 'SN',
};

const LANGUAGES = ['Python', 'JavaScript', 'HTML', 'CSS', 'Java', 'TypeScript', 'SQL', 'Bash', 'Other'];

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
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLang, setFormLang] = useState('Python');
  const [formTags, setFormTags] = useState('');
  const [formCode, setFormCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await vaultService.listVaultItemsForUser(profile.id);
      setItems(((data ?? []) as VaultItem[]).map((item) => ({ ...item, expanded: false })));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load vault items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const passLanguage = languageFilter === 'all' || item.language?.toLowerCase() === languageFilter;
      const haystack = `${item.title} ${item.description ?? ''} ${(item.tags ?? []).join(' ')} ${item.language}`.toLowerCase();
      const passSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return passLanguage && passSearch;
    });
  }, [items, languageFilter, search]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormLang('Python');
    setFormTags('');
    setFormCode('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item: VaultItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDesc(item.description ?? '');
    setFormLang(item.language ? item.language.charAt(0).toUpperCase() + item.language.slice(1) : 'Other');
    setFormTags((item.tags ?? []).join(', '));
    setFormCode(item.code);
    setShowModal(true);
  };

  const toggleExpand = (id: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, expanded: !item.expanded } : item));
  };

  const handleDelete = (item: VaultItem) => {
    Alert.alert(
      'Delete snippet',
      `Delete "${item.title}" from your vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vaultService.deleteVaultItem(item.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Delete failed');
              return;
            }
            setItems((prev) => prev.filter((entry) => entry.id !== item.id));
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!profile?.id) {
      Alert.alert('Profile required', 'Your account profile is not ready yet.');
      return;
    }
    if (!formTitle.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    if (!formCode.trim()) {
      Alert.alert('Validation', 'Code is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: profile.id,
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        language: formLang.toLowerCase(),
        tags: formTags.trim() ? formTags.split(',').map((tag) => tag.trim()).filter(Boolean) : null,
        code: formCode.trim(),
      };
      await vaultService.upsertVaultItem({ editingId, payload });
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save snippet.');
    } finally {
      setSaving(false);
    }
  };

  const codePreview = (code: string) => code.split('\n').slice(0, 5).join('\n');
  const uniqueLangs = new Set(items.map((item) => item.language)).size;
  const totalLines = items.reduce((sum, item) => sum + item.code.split('\n').length, 0);

  const renderItem = ({ item, index }: { item: VaultItem; index: number }) => {
    const lang = item.language?.toLowerCase() ?? 'other';
    const color = LANG_COLORS[lang] ?? COLORS.textMuted;
    const icon = LANG_ICONS[lang] ?? 'SN';
    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35, type: 'timing', duration: 260 }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.langBadge, { backgroundColor: `${color}18` }]}>
              <Text style={[styles.langBadgeText, { color }]}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.language} · {new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>{item.expanded ? '?' : '?'}</Text>
            </TouchableOpacity>
          </View>

          {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}

          {(item.tags ?? []).length > 0 ? (
            <View style={styles.tagsRow}>
              {(item.tags ?? []).slice(0, 4).map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.codePreview}>
            <Text style={styles.codeText}>{item.expanded ? item.code : codePreview(item.code)}</Text>
          </View>
          {!item.expanded && item.code.split('\n').length > 5 ? <Text style={styles.moreLines}>+{item.code.split('\n').length - 5} more lines</Text> : null}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerAction} onPress={() => openEdit(item)}>
              <Text style={styles.footerActionText}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerAction} onPress={() => toggleExpand(item.id)}>
              <Text style={styles.footerActionText}>{item.expanded ? 'COLLAPSE' : 'EXPAND'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerAction, styles.footerActionDanger]} onPress={() => handleDelete(item)}>
              <Text style={styles.footerActionDangerText}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <Text style={styles.headerTitle}>Vault</Text>
        <TouchableOpacity style={styles.headerAction} onPress={openCreate}>
          <Text style={styles.headerActionText}>NEW</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['rgba(122,6,6,0.16)', 'rgba(122,6,6,0.04)']} style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>PERSONAL CODE LIBRARY</Text>
              <Text style={styles.heroTitle}>Keep reusable snippets ready on mobile.</Text>
              <Text style={styles.heroText}>Vault now works like a real snippet library: search, filter, edit, expand, and maintain your code collection from your phone.</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{items.length}</Text>
                  <Text style={styles.statLabel}>Snippets</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{uniqueLangs}</Text>
                  <Text style={styles.statLabel}>Languages</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{totalLines}</Text>
                  <Text style={styles.statLabel}>Code Lines</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>?</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search title, tags, or language"
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, languageFilter === 'all' && styles.filterChipActive]} onPress={() => setLanguageFilter('all')}>
                <Text style={[styles.filterChipText, languageFilter === 'all' && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {[...new Set(items.map((item) => item.language?.toLowerCase()).filter(Boolean))].map((language) => (
                <TouchableOpacity key={language} style={[styles.filterChip, languageFilter === language && styles.filterChipActive]} onPress={() => setLanguageFilter(language)}>
                  <Text style={[styles.filterChipText, languageFilter === language && styles.filterChipTextActive]}>{language}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <View style={styles.centerLoad}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : null}

            {!loading && filteredItems.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>??</Text>
                <Text style={styles.emptyTitle}>No snippets found</Text>
                <Text style={styles.emptySubtitle}>{items.length === 0 ? 'Start your mobile vault with your first snippet.' : 'Try another search or language filter.'}</Text>
              </View>
            ) : null}
          </>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <LinearGradient colors={COLORS.gradPrimary} style={styles.fabInner}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingId ? 'Edit Snippet' : 'Save Snippet'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Debounce function" placeholderTextColor={COLORS.textMuted} value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="Short note about this snippet" placeholderTextColor={COLORS.textMuted} value={formDesc} onChangeText={setFormDesc} />

              <Text style={styles.label}>Language</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languagePickRow}>
                {LANGUAGES.map((language) => (
                  <TouchableOpacity key={language} style={[styles.languagePick, formLang === language && styles.languagePickActive]} onPress={() => setFormLang(language)}>
                    <Text style={[styles.languagePickText, formLang === language && styles.languagePickTextActive]}>{language}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Tags</Text>
              <TextInput style={styles.input} placeholder="comma, separated, tags" placeholderTextColor={COLORS.textMuted} value={formTags} onChangeText={setFormTags} />

              <Text style={styles.label}>Code *</Text>
              <TextInput style={[styles.input, styles.codeInput]} placeholder="# Paste your code here" placeholderTextColor={COLORS.textMuted} value={formCode} onChangeText={setFormCode} multiline numberOfLines={8} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Save'}</Text>}
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
  list: { paddingHorizontal: SPACING.base, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  headerAction: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.primaryPale },
  headerActionText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primaryLight },
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.borderGlow, padding: SPACING.xl, marginBottom: SPACING.md },
  heroEyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, letterSpacing: 1.4, marginBottom: 8 },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 8 },
  heroText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, textTransform: 'uppercase' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  searchIcon: { fontSize: 14, color: COLORS.textMuted },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, paddingVertical: 12 },
  filterRow: { gap: 8, paddingBottom: 8, marginBottom: SPACING.sm },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  filterChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  filterChipTextActive: { color: COLORS.primaryLight },
  centerLoad: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  langBadge: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  langBadgeText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi },
  itemTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  itemMeta: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 2 },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: COLORS.textMuted, fontSize: 11 },
  itemDesc: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 19 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  tagChip: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  codePreview: { backgroundColor: '#0a0a14', borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  codeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.mono, color: '#a8ff78', lineHeight: 18 },
  moreLines: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm },
  footerAction: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05, paddingHorizontal: 10, paddingVertical: 6 },
  footerActionText: { fontSize: 10, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted, letterSpacing: 0.8 },
  footerActionDanger: { borderColor: COLORS.error + '44', backgroundColor: COLORS.error + '18' },
  footerActionDangerText: { fontSize: 10, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.error, letterSpacing: 0.8 },
  fab: { position: 'absolute', right: SPACING.base, bottom: 30, borderRadius: RADIUS.full, overflow: 'hidden', elevation: 8 },
  fabInner: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '94%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  languagePickRow: { gap: 8, paddingBottom: 4, marginBottom: SPACING.sm },
  languagePick: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 8 },
  languagePickActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  languagePickText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  languagePickTextActive: { color: COLORS.primaryLight },
  codeInput: { minHeight: 170, textAlignVertical: 'top', fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm, backgroundColor: '#0a0a14' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});



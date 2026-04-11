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
import { engageService } from '../../services/engage.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

interface EngagePost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  code_snippet: string | null;
  likes: number;
  created_at: string;
  portal_users?: { full_name: string; role: string } | null;
  codeExpanded?: boolean;
}

type FilterType = 'all' | 'discussions' | 'code';

const ROLE_COLORS: Record<string, string> = {
  admin: COLORS.admin,
  teacher: COLORS.teacher,
  student: COLORS.student,
  school: COLORS.school,
  parent: COLORS.accent,
};

const STARTER_PROMPTS = [
  'What are you building this week at Rillcod?',
  'Share one coding bug you solved today.',
  'Post a code snippet you are proud of and explain it.',
  'What STEM idea would you love to turn into a real product?',
  'Which lesson or mission helped you most this week?',
];

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function EngageScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<EngagePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCode, setFormCode] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await engageService.listEngagePostsWithAuthors(100);
      setPosts(((data ?? []) as any[]).map((post) => ({ ...post, codeExpanded: false })));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load community posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const passType = filter === 'all'
        ? true
        : filter === 'code'
          ? !!post.code_snippet
          : !post.code_snippet;
      const haystack = `${post.title} ${post.content} ${post.portal_users?.full_name ?? ''} ${post.portal_users?.role ?? ''}`.toLowerCase();
      const passSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return passType && passSearch;
    });
  }, [filter, posts, search]);

  const totalCodePosts = posts.filter((post) => !!post.code_snippet).length;

  const toggleCode = (id: string) => {
    setPosts((prev) => prev.map((post) => post.id === id ? { ...post, codeExpanded: !post.codeExpanded } : post));
  };

  const handleLike = async (post: EngagePost) => {
    const nextLikes = (post.likes ?? 0) + 1;
    setPosts((prev) => prev.map((item) => item.id === post.id ? { ...item, likes: nextLikes } : item));
    await engageService.incrementPostLikes(post.id, nextLikes);
  };

  const handleDelete = (post: EngagePost) => {
    Alert.alert(
      'Delete post',
      `Delete "${post.title}" from Engage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await engageService.deleteEngagePost(post.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Delete failed');
              return;
            }
            setPosts((prev) => prev.filter((item) => item.id !== post.id));
          },
        },
      ]
    );
  };

  const handlePost = async () => {
    if (!profile?.id || !profile.full_name) {
      Alert.alert('Profile required', 'Your account profile is not ready yet.');
      return;
    }
    if (!formTitle.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    if (!formContent.trim()) {
      Alert.alert('Validation', 'Content is required');
      return;
    }
    setSaving(true);
    try {
      await engageService.insertEngagePost({
        user_id: profile.id,
        author_name: profile.full_name,
        title: formTitle.trim(),
        content: formContent.trim(),
        code_snippet: formCode.trim() || null,
        language: formCode.trim() ? 'text' : null,
        likes: 0,
      });
      setShowModal(false);
      setFormTitle('');
      setFormContent('');
      setFormCode('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not publish post.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }: { item: EngagePost; index: number }) => {
    const author = item.portal_users as any;
    const initial = author?.full_name?.charAt(0).toUpperCase() ?? '?';
    const roleColor = ROLE_COLORS[author?.role] ?? COLORS.textMuted;
    const isOwner = profile?.id === item.user_id;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35, type: 'timing', duration: 260 }}
      >
        <TouchableOpacity activeOpacity={0.9} style={styles.card} onLongPress={() => isOwner && handleDelete(item)}>
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: `${roleColor}18` }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>{initial}</Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{author?.full_name ?? 'Unknown user'}</Text>
              <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
            </View>
            {author?.role ? (
              <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
                <Text style={[styles.roleText, { color: roleColor }]}>{String(author.role).toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.postTitle}>{item.title}</Text>
          <Text style={styles.postContent}>{item.content}</Text>

          {item.code_snippet ? (
            <>
              <TouchableOpacity onPress={() => toggleCode(item.id)} style={styles.codeToggle}>
                <Text style={styles.codeToggleText}>{item.codeExpanded ? 'Hide code' : 'Show code snippet'}</Text>
              </TouchableOpacity>
              {item.codeExpanded ? (
                <View style={styles.codeBlock}>
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <Text style={styles.codeText}>{item.code_snippet}</Text>
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.footerChip} onPress={() => handleLike(item)}>
              <Text style={styles.footerChipText}>?? {item.likes ?? 0}</Text>
            </TouchableOpacity>
            {item.code_snippet ? (
              <View style={styles.footerChipMuted}>
                <Text style={styles.footerChipMutedText}>CODE SHARE</Text>
              </View>
            ) : (
              <View style={styles.footerChipMuted}>
                <Text style={styles.footerChipMutedText}>DISCUSSION</Text>
              </View>
            )}
            {isOwner ? (
              <Text style={styles.ownerHint}>Long press to delete</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <Text style={styles.headerTitle}>Engage</Text>
        <TouchableOpacity style={styles.headerAction} onPress={() => setShowModal(true)}>
          <Text style={styles.headerActionText}>POST</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['rgba(122,6,6,0.16)', 'rgba(122,6,6,0.04)']} style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>COMMUNITY HUB</Text>
              <Text style={styles.heroTitle}>Share projects, code, and questions from mobile.</Text>
              <Text style={styles.heroText}>Use Engage to post progress updates, ask for help, share snippets, and keep the academy community active.</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{posts.length}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{totalCodePosts}</Text>
                  <Text style={styles.statLabel}>Code Shares</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{posts.reduce((sum, item) => sum + Number(item.likes ?? 0), 0)}</Text>
                  <Text style={styles.statLabel}>Reactions</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>?</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search posts, people, or topics"
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <View style={styles.filterRow}>
              {(['all', 'discussions', 'code'] as FilterType[]).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterTab, filter === value && styles.filterTabActive]}
                  onPress={() => setFilter(value)}
                >
                  <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                    {value === 'all' ? 'All' : value === 'discussions' ? 'Discussions' : 'Code'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRow}>
              {STARTER_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.promptCard}
                  onPress={() => {
                    setFormTitle('Community post');
                    setFormContent(prompt);
                    setShowModal(true);
                  }}
                >
                  <Text style={styles.promptCardText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <View style={styles.centerLoad}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : null}

            {!loading && filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>??</Text>
                <Text style={styles.emptyTitle}>No posts found</Text>
                <Text style={styles.emptySubtitle}>Start the conversation or adjust your search and filter.</Text>
              </View>
            ) : null}
          </>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <LinearGradient colors={COLORS.gradPrimary} style={styles.fabInner}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Engage Post</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="Post title" placeholderTextColor={COLORS.textMuted} value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Content *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Share your idea, win, challenge, or question" placeholderTextColor={COLORS.textMuted} value={formContent} onChangeText={setFormContent} multiline numberOfLines={5} />

              <Text style={styles.label}>Code Snippet</Text>
              <TextInput style={[styles.input, styles.codeInput]} placeholder="# Optional code snippet" placeholderTextColor={COLORS.textMuted} value={formCode} onChangeText={setFormCode} multiline numberOfLines={5} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handlePost} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Publish</Text>}
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
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterTabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  filterText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primaryLight },
  promptRow: { gap: 10, paddingBottom: 8, marginBottom: SPACING.sm },
  promptCard: { width: 220, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard, padding: SPACING.md },
  promptCardText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 19 },
  centerLoad: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.display },
  authorInfo: { flex: 1 },
  authorName: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  timestamp: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  roleBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 10, fontFamily: FONT_FAMILY.bodySemi },
  postTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 6 },
  postContent: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, lineHeight: 20 },
  codeToggle: { marginTop: SPACING.sm, paddingVertical: 4 },
  codeToggleText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.info },
  codeBlock: { backgroundColor: '#0a0a14', borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  codeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.mono, color: '#a8ff78', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACING.sm },
  footerChip: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.primaryPale, borderWidth: 1, borderColor: COLORS.primary },
  footerChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primaryLight },
  footerChipMuted: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border },
  footerChipMutedText: { fontSize: 10, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted, letterSpacing: 0.8 },
  ownerHint: { marginLeft: 'auto', fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  fab: { position: 'absolute', right: SPACING.base, bottom: 30, borderRadius: RADIUS.full, overflow: 'hidden', elevation: 8 },
  fabInner: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  codeInput: { minHeight: 110, textAlignVertical: 'top', fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm, backgroundColor: '#0a0a14' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

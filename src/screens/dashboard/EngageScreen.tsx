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
  admin: COLORS.admin, teacher: COLORS.teacher, student: COLORS.student, school: COLORS.school,
};

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
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCode, setFormCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('engage_posts')
        .select('id, user_id, title, content, code_snippet, likes, created_at, portal_users!engage_posts_user_id_fkey(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setPosts(((data ?? []) as any[]).map(p => ({ ...p, codeExpanded: false })));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleLike = async (post: EngagePost) => {
    const newLikes = (post.likes ?? 0) + 1;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    await supabase.from('engage_posts').update({ likes: newLikes }).eq('id', post.id);
  };

  const toggleCode = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, codeExpanded: !p.codeExpanded } : p));
  };

  const handlePost = async () => {
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    if (!formContent.trim()) { Alert.alert('Validation', 'Content is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('engage_posts').insert({
        user_id: profile?.id,
        title: formTitle.trim(),
        content: formContent.trim(),
        code_snippet: formCode.trim() || null,
        likes: 0,
      });
      if (error) throw error;
      setShowModal(false);
      setFormTitle(''); setFormContent(''); setFormCode('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = posts.filter(p => {
    if (filter === 'code') return !!p.code_snippet;
    if (filter === 'discussions') return !p.code_snippet;
    return true;
  });

  const renderItem = ({ item, index }: { item: EngagePost; index: number }) => {
    const author = item.portal_users as any;
    const initial = author?.full_name?.charAt(0).toUpperCase() ?? '?';
    const roleColor = ROLE_COLORS[author?.role] ?? COLORS.textMuted;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 40, type: 'timing', duration: 280 }}
      >
        <View style={styles.card}>
          {/* Author row */}
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: `${roleColor}20` }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>{initial}</Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{author?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
            </View>
            {author?.role && (
              <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20` }]}>
                <Text style={[styles.roleText, { color: roleColor }]}>{author.role}</Text>
              </View>
            )}
          </View>

          {/* Content */}
          <Text style={styles.postTitle}>{item.title}</Text>
          <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>

          {/* Code snippet */}
          {item.code_snippet && (
            <TouchableOpacity onPress={() => toggleCode(item.id)} style={styles.codeToggle}>
              <Text style={styles.codeToggleText}>{item.codeExpanded ? '▲ Hide code' : '▼ Show code'}</Text>
            </TouchableOpacity>
          )}
          {item.codeExpanded && item.code_snippet && (
            <View style={styles.codeBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <Text style={styles.codeText}>{item.code_snippet}</Text>
              </ScrollView>
            </View>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item)}>
              <Text style={styles.likeIcon}>❤️</Text>
              <Text style={styles.likeCount}>{item.likes ?? 0}</Text>
            </TouchableOpacity>
            {item.code_snippet && (
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeText}>{'</>'}  Code</Text>
              </View>
            )}
          </View>
        </View>
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
        <Text style={styles.headerTitle}>Engage</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{posts.length}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'discussions', 'code'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'discussions' ? '💬 Discussions' : '</> Code'}
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
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to start a discussion!</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 100, paddingTop: SPACING.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <LinearGradient colors={COLORS.gradPrimary} style={styles.fabInner}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Post Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Post</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="Post title" placeholderTextColor={COLORS.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Content *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Share your thoughts..." placeholderTextColor={COLORS.textMuted}
                value={formContent} onChangeText={setFormContent} multiline numberOfLines={4} />

              <Text style={styles.label}>Code Snippet (optional)</Text>
              <TextInput style={[styles.input, styles.codeInput]} placeholder="# Paste your code here..." placeholderTextColor={COLORS.textMuted}
                value={formCode} onChangeText={setFormCode} multiline numberOfLines={4} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handlePost} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Post</Text>}
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
  countBadge: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border },
  countText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
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
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.display },
  authorInfo: { flex: 1 },
  authorName: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary },
  timestamp: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  roleBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  postTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: 6 },
  postContent: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, lineHeight: 20 },
  codeToggle: { marginTop: SPACING.sm, paddingVertical: 4 },
  codeToggleText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.info },
  codeBlock: { backgroundColor: '#0a0a14', borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  codeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.mono, color: '#a8ff78', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.md },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeIcon: { fontSize: 14 },
  likeCount: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary },
  codeBadge: { backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  codeBadgeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.mono, color: COLORS.info },
  fab: { position: 'absolute', bottom: 32, right: SPACING.base, borderRadius: RADIUS.full, overflow: 'hidden', elevation: 8 },
  fabInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  codeInput: { minHeight: 100, textAlignVertical: 'top', fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm, backgroundColor: '#0a0a14' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

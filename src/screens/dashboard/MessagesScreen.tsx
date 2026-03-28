import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Thread {
  id: string;
  subject: string | null;
  last_message: string | null;
  last_message_at: string;
  is_read: boolean;
  other_user_name: string;
  other_user_role: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender_name?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadThreads = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, subject, content, sender_id, recipient_id, is_read, created_at')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!data) return;

      // Group into threads by "other user"
      const seen = new Set<string>();
      const result: Thread[] = [];
      for (const m of data) {
        const otherId = m.sender_id === profile.id ? m.recipient_id : m.sender_id;
        if (seen.has(otherId)) continue;
        seen.add(otherId);
        result.push({
          id: otherId,
          subject: m.subject,
          last_message: m.content,
          last_message_at: m.created_at,
          is_read: m.recipient_id === profile.id ? m.is_read : true,
          other_user_name: otherId.slice(0, 8),
          other_user_role: 'user',
        });
      }

      // Enrich with user names
      if (result.length > 0) {
        const { data: users } = await supabase
          .from('portal_users')
          .select('id, full_name, role')
          .in('id', result.map(r => r.id));
        const umap: Record<string, any> = {};
        (users ?? []).forEach(u => { umap[u.id] = u; });
        result.forEach(r => {
          if (umap[r.id]) {
            r.other_user_name = umap[r.id].full_name ?? r.other_user_name;
            r.other_user_role = umap[r.id].role ?? 'user';
          }
        });
      }

      setThreads(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  const loadMessages = useCallback(async (otherId: string) => {
    if (!profile) return;
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, created_at')
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${profile.id})`
      )
      .order('created_at', { ascending: true })
      .limit(60);
    setMessages(data ?? []);
    // Mark as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', profile.id)
      .eq('sender_id', otherId);
  }, [profile]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread || !profile) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: activeThread.id,
      content: newMsg.trim(),
      subject: activeThread.subject ?? null,
      is_read: false,
    });
    setSending(false);
    if (!error) {
      setNewMsg('');
      loadMessages(activeThread.id);
    }
  };

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = (t: Thread) => {
    setActiveThread(t);
    loadMessages(t.id);
  };

  const roleColor = (role: string) => {
    if (role === 'admin') return COLORS.admin;
    if (role === 'teacher') return COLORS.teacher;
    if (role === 'school') return COLORS.school;
    return COLORS.textMuted;
  };

  // ── Thread list view ─────────────────────────────────────────────────────
  if (!activeThread) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={i => i.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadThreads(); }}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item, index }) => (
              <MotiView
                from={{ opacity: 0, translateX: -12 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ delay: index * 40 }}
              >
                <TouchableOpacity
                  style={[styles.threadCard, !item.is_read && styles.unreadCard]}
                  onPress={() => openThread(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.threadAvatar, { backgroundColor: roleColor(item.other_user_role) + '33' }]}>
                    <Text style={[styles.threadAvatarText, { color: roleColor(item.other_user_role) }]}>
                      {item.other_user_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.threadTopRow}>
                      <Text style={styles.threadName}>{item.other_user_name}</Text>
                      <Text style={styles.threadTime}>{timeAgo(item.last_message_at)}</Text>
                    </View>
                    {item.subject && <Text style={styles.threadSubject}>{item.subject}</Text>}
                    <Text style={styles.threadPreview} numberOfLines={1}>
                      {item.last_message ?? ''}
                    </Text>
                  </View>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              </MotiView>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Message thread view ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Thread header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveThread(null)} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{activeThread.other_user_name}</Text>
            <Text style={[styles.subtitle, { color: roleColor(activeThread.other_user_role) }]}>
              {activeThread.other_user_role}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === profile?.id;
            return (
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                  {item.content}
                </Text>
                <Text style={styles.bubbleTime}>{timeAgo(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Start the conversation...</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.msgInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={newMsg}
            onChangeText={setNewMsg}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!newMsg.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMsg.trim() || sending}
          >
            <Text style={styles.sendIcon}>{sending ? '⏳' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textTransform: 'capitalize', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: 20 },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
  },
  unreadCard: { borderColor: COLORS.primaryLight + '55' },
  threadAvatar: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  threadTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  threadTime: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  threadSubject: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight, marginTop: 1 },
  threadPreview: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  msgList: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: 20 },
  bubble: {
    maxWidth: '75%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, lineHeight: FONT_SIZE.base * 1.5 },
  bubbleTextMine: { color: COLORS.white100 },
  bubbleTextOther: { color: COLORS.textPrimary },
  bubbleTime: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.white40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  msgInput: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18, color: COLORS.white100 },
});

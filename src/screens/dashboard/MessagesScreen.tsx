import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
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

interface Contact {
  id: string;
  full_name: string;
  role: string;
}

interface MessageItem {
  id: string;
  message: string;
  sender_id: string | null;
  created_at: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'now';
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
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const roleTargets = useMemo(() => {
    if (!profile?.role) return [];
    return profile.role === 'parent'
      ? ['teacher', 'school', 'admin']
      : profile.role === 'student'
        ? ['teacher', 'admin']
        : profile.role === 'teacher'
          ? ['student', 'parent', 'school', 'admin']
          : profile.role === 'school'
            ? ['teacher', 'admin', 'parent']
            : ['teacher', 'school', 'parent', 'student'];
  }, [profile?.role]);

  const loadThreads = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, subject, message, sender_id, recipient_id, is_read, created_at')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(80);

      const raw = data ?? [];
      const grouped = new Map<string, Thread>();
      raw.forEach((item: any) => {
        const otherId = item.sender_id === profile.id ? item.recipient_id : item.sender_id;
        if (!otherId || grouped.has(otherId)) return;
        grouped.set(otherId, {
          id: otherId,
          subject: item.subject,
          last_message: item.message,
          last_message_at: item.created_at ?? new Date().toISOString(),
          is_read: item.recipient_id === profile.id ? !!item.is_read : true,
          other_user_name: 'User',
          other_user_role: 'user',
        });
      });

      const baseThreads = Array.from(grouped.values());
      if (baseThreads.length > 0) {
        const { data: users } = await supabase
          .from('portal_users')
          .select('id, full_name, role')
          .in('id', baseThreads.map((item) => item.id));
        const userMap = new Map((users ?? []).map((user: any) => [user.id, user]));
        baseThreads.forEach((thread) => {
          const user = userMap.get(thread.id);
          if (user) {
            thread.other_user_name = user.full_name ?? 'User';
            thread.other_user_role = user.role ?? 'user';
          }
        });
      }

      setThreads(baseThreads);

      const { data: suggestedContacts } = await supabase
        .from('portal_users')
        .select('id, full_name, role')
        .neq('id', profile.id)
        .in('role', roleTargets)
        .limit(20);
      setContacts((suggestedContacts ?? []) as Contact[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, roleTargets]);

  const loadMessages = useCallback(async (otherId: string) => {
    if (!profile) return;
    const { data } = await supabase
      .from('messages')
      .select('id, message, sender_id, created_at')
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${profile.id})`)
      .order('created_at', { ascending: true })
      .limit(120);
    setMessages((data as MessageItem[]) ?? []);
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', profile.id)
      .eq('sender_id', otherId)
      .eq('is_read', false);
  }, [profile]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread || !profile) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: activeThread.id,
      message: newMsg.trim(),
      subject: activeThread.subject ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSending(false);
    if (!error) {
      setNewMsg('');
      loadMessages(activeThread.id);
      loadThreads();
    }
  };

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = (thread: Thread) => {
    setActiveThread(thread);
    loadMessages(thread.id);
  };

  const openContact = (contact: Contact) => {
    const existing = threads.find((thread) => thread.id === contact.id);
    if (existing) return openThread(existing);
    setActiveThread({
      id: contact.id,
      subject: null,
      last_message: null,
      last_message_at: new Date().toISOString(),
      is_read: true,
      other_user_name: contact.full_name,
      other_user_role: contact.role,
    });
    setMessages([]);
  };

  const roleColor = (role: string) => {
    if (role === 'admin') return colors.admin;
    if (role === 'teacher') return colors.teacher;
    if (role === 'school') return colors.school;
    if (role === 'parent') return colors.warning;
    return colors.textMuted;
  };

  const filteredThreads = threads.filter((thread) => {
    const haystack = `${thread.other_user_name} ${thread.other_user_role} ${thread.subject ?? ''} ${thread.last_message ?? ''}`.toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  const filteredContacts = contacts.filter((contact) => {
    const haystack = `${contact.full_name} ${contact.role}`.toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  });

  if (!activeThread) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>?</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search threads or contacts"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={filteredThreads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadThreads(); }} tintColor={colors.primary} />}
            renderItem={({ item, index }) => (
              <MotiView from={{ opacity: 0, translateX: -12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 40 }}>
                <TouchableOpacity style={[styles.threadCard, !item.is_read && styles.unreadCard]} onPress={() => openThread(item)} activeOpacity={0.8}>
                  <View style={[styles.threadAvatar, { backgroundColor: `${roleColor(item.other_user_role)}33` }]}>
                    <Text style={[styles.threadAvatarText, { color: roleColor(item.other_user_role) }]}>{item.other_user_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.threadTopRow}>
                      <Text style={styles.threadName}>{item.other_user_name}</Text>
                      <Text style={styles.threadTime}>{timeAgo(item.last_message_at)}</Text>
                    </View>
                    {!!item.subject && <Text style={[styles.threadSubject, { color: colors.primary }]}>{item.subject}</Text>}
                    <Text style={styles.threadPreview} numberOfLines={1}>{item.last_message ?? ''}</Text>
                  </View>
                  {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              </MotiView>
            )}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No messages yet</Text></View>}
            ListHeaderComponent={
              filteredContacts.length > 0 ? (
                <View style={styles.contactsSection}>
                  <Text style={styles.contactsTitle}>Quick Contacts</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsRow}>
                    {filteredContacts.slice(0, 8).map((contact) => (
                      <TouchableOpacity key={contact.id} style={styles.contactCard} activeOpacity={0.85} onPress={() => openContact(contact)}>
                        <View style={[styles.contactAvatar, { backgroundColor: `${roleColor(contact.role)}22` }]}>
                          <Text style={[styles.contactAvatarText, { color: roleColor(contact.role) }]}>{contact.full_name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.contactName} numberOfLines={1}>{contact.full_name}</Text>
                        <Text style={[styles.contactRole, { color: roleColor(contact.role) }]}>{contact.role}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveThread(null)} style={styles.backBtn}>
            <Text style={styles.backIcon}>?</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{activeThread.other_user_name}</Text>
            <Text style={[styles.subtitle, { color: roleColor(activeThread.other_user_role) }]}>{activeThread.other_user_role}</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === profile?.id;
            return (
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, !isMine && { borderColor: colors.border }]}>
                <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>{item.message}</Text>
                <Text style={[styles.bubbleTime, { color: isMine ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Start the conversation...</Text></View>}
        />

        <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
          <TextInput
            style={[styles.msgInput, { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Type a message"
            placeholderTextColor={colors.textMuted}
            value={newMsg}
            onChangeText={setNewMsg}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }, (!newMsg.trim() || sending) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!newMsg.trim() || sending}>
            <Text style={styles.sendIcon}>{sending ? '...' : '?'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: colors.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: colors.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textTransform: 'capitalize', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: 20 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: { fontSize: 12, color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, paddingVertical: 11 },
  contactsSection: { marginBottom: SPACING.md },
  contactsTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.sm },
  contactsRow: { gap: SPACING.sm, paddingBottom: 4 },
  contactCard: { width: 110, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6 },
  contactAvatar: { width: 42, height: 42, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  contactName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: colors.textPrimary, textAlign: 'center' },
  contactRole: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },
  threadCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.base, gap: SPACING.md, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, backgroundColor: colors.bgCard },
  unreadCard: { borderColor: `${colors.primary}55` },
  threadAvatar: { width: 46, height: 46, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  threadAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  threadTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  threadTime: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
  threadSubject: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, marginTop: 1 },
  threadPreview: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textMuted, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: RADIUS.full },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: colors.textMuted },
  msgList: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: 20 },
  bubble: { maxWidth: '75%', padding: SPACING.md, borderRadius: RADIUS.lg, gap: 4 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.bgCard, borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, lineHeight: FONT_SIZE.base * 1.5 },
  bubbleTextMine: { color: colors.white100 },
  bubbleTextOther: { color: colors.textPrimary },
  bubbleTime: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.base, borderTopWidth: 1, gap: SPACING.sm },
  msgInput: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18, color: colors.white100 },
});

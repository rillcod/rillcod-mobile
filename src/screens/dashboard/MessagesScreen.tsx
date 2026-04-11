import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { chatService } from '../../services/chat.service';
import { announcementService, type AnnouncementBoardRow } from '../../services/announcement.service';
import { templateService } from '../../services/template.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type Tab = 'inbox' | 'directory' | 'board';

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
  subject?: string | null;
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

export default function MessagesScreenV2({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const listRef = useRef<FlatList>(null);

  const [tab, setTab] = useState<Tab>('inbox');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [threadSubject, setThreadSubject] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [posting, setPosting] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const roleTargets = useMemo(() => {
    if (!profile?.role) return [];
    return profile.role === 'parent'
      ? ['teacher', 'school', 'admin']
      : profile.role === 'student'
        ? ['teacher', 'admin', 'school']
        : profile.role === 'teacher'
          ? ['student', 'parent', 'school', 'admin']
          : profile.role === 'school'
            ? ['teacher', 'admin', 'parent', 'student']
            : ['teacher', 'school', 'parent', 'student'];
  }, [profile?.role]);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [rawMessages, contactRows, boardRows] = await Promise.all([
        chatService.listMailboxPreview(profile.id, 120),
        chatService.listDirectoryContacts(profile.id, roleTargets, 40),
        announcementService.listActiveForBoard({
          isAdmin: profile.role === 'admin',
          schoolId: profile.school_id ?? null,
          limit: 50,
        }),
      ]);
      const grouped = new Map<string, Thread>();
      rawMessages.forEach((item) => {
        const otherId = item.sender_id === profile.id ? item.recipient_id : item.sender_id;
        if (!otherId || grouped.has(otherId)) return;
        grouped.set(otherId, {
          id: otherId,
          subject: item.subject ?? null,
          last_message: item.message ?? null,
          last_message_at: item.created_at ?? new Date().toISOString(),
          is_read: item.recipient_id === profile.id ? !!item.is_read : true,
          other_user_name: 'User',
          other_user_role: 'user',
        });
      });

      const baseThreads = Array.from(grouped.values());
      if (baseThreads.length > 0) {
        const users = await chatService.lookupUsersByIds(baseThreads.map((item) => item.id));
        const userMap = new Map(users.map((user) => [user.id, user]));
        baseThreads.forEach((thread) => {
          const user = userMap.get(thread.id);
          if (user) {
            thread.other_user_name = user.full_name ?? 'User';
            thread.other_user_role = user.role ?? 'user';
          }
        });
      }

      const visibleAnnouncements = boardRows.filter((item) => {
        if (!item.target_audience || item.target_audience === 'all') return true;
        return item.target_audience === profile.role;
      });

      setThreads(baseThreads);
      setContacts(contactRows as Contact[]);
      setAnnouncements(visibleAnnouncements);
    } catch (e: any) {
      Alert.alert('Messages', e?.message ?? 'Could not refresh your inbox.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, roleTargets]);

  const loadMessages = useCallback(async (otherId: string) => {
    if (!profile) return;
    try {
      const rows = (await chatService.fetchThreadAscending(profile.id, otherId, 160)) as MessageItem[];
      setMessages(rows);
      const firstSubject = rows.find((item) => item.subject)?.subject ?? '';
      setThreadSubject(firstSubject);
      await chatService.markUnreadFromSenderRead(profile.id, otherId);
    } catch (e: any) {
      Alert.alert('Conversation', e?.message ?? 'Could not load messages.');
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const openThread = (thread: Thread) => {
    setActiveThread(thread);
    setThreadSubject(thread.subject ?? '');
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
    setThreadSubject('');
    setTab('inbox');
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread || !profile) return;
    setSending(true);
    try {
      const now = new Date().toISOString();
      await chatService.insertMessage({
        sender_id: profile.id,
        recipient_id: activeThread.id,
        message: newMsg.trim(),
        subject: threadSubject.trim() || activeThread.subject || null,
        is_read: false,
        created_at: now,
        updated_at: now,
      });
      setNewMsg('');
      await loadMessages(activeThread.id);
      await load();
    } catch (e: any) {
      Alert.alert('Send failed', e?.message ?? 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const applyAnnouncementTemplate = async () => {
    try {
      const composed = await templateService.compose('board_announcement', 'email', {
        school_name: profile?.school_name ?? 'Our school',
        author: profile?.full_name ?? 'Team',
      });
      if (composed.subject) setAnnouncementTitle(composed.subject);
      setAnnouncementContent(composed.content);
    } catch {
      Alert.alert(
        'Template',
        'No active email template named "board_announcement" in notification_templates. Add one in the database to use this shortcut.',
      );
    }
  };

  const postAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementContent.trim() || !profile || !isStaff) return;
    setPosting(true);
    try {
      await announcementService.createAnnouncement(
        {
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          target_audience: announcementAudience,
          school_id: profile.role === 'school' ? profile.school_id ?? null : null,
          is_active: true,
        },
        profile.id,
      );
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementAudience('all');
      await load();
    } catch (e: any) {
      Alert.alert('Board', e?.message ?? 'Could not post announcement.');
    } finally {
      setPosting(false);
    }
  };

  const filteredThreads = useMemo(() => {
    const value = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const haystack = `${thread.other_user_name} ${thread.other_user_role} ${thread.subject ?? ''} ${thread.last_message ?? ''}`.toLowerCase();
      return !value || haystack.includes(value);
    });
  }, [search, threads]);

  const filteredContacts = useMemo(() => {
    const value = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const haystack = `${contact.full_name} ${contact.role}`.toLowerCase();
      return !value || haystack.includes(value);
    });
  }, [contacts, search]);

  const filteredAnnouncements = useMemo(() => {
    const value = search.trim().toLowerCase();
    return announcements.filter((item) => {
      const haystack = `${item.title} ${item.content} ${item.target_audience ?? ''}`.toLowerCase();
      return !value || haystack.includes(value);
    });
  }, [announcements, search]);

  const unreadCount = threads.filter((thread) => !thread.is_read).length;

  if (activeThread) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={activeThread.other_user_name.toUpperCase()} onBack={() => setActiveThread(null)} />

        <View style={styles.threadMetaCard}>
          <Text style={styles.threadRole}>{activeThread.other_user_role.toUpperCase()}</Text>
          <Text style={styles.threadSubjectText}>{threadSubject.trim() ? threadSubject : 'General conversation'}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, { color: mine ? colors.white100 : colors.textPrimary }]}>{item.message}</Text>
                <Text style={[styles.bubbleTime, { color: mine ? colors.white100 : colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
              </View>
            );
          }}
        />

        <View style={styles.composerWrap}>
          <TextInput
            value={threadSubject}
            onChangeText={setThreadSubject}
            placeholder="Subject"
            placeholderTextColor={colors.textMuted}
            style={styles.subjectInput}
          />
          <View style={styles.messageRow}>
            <TextInput
              value={newMsg}
              onChangeText={setNewMsg}
              placeholder="Write a message"
              placeholderTextColor={colors.textMuted}
              style={styles.messageInput}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending}>
              <Text style={styles.sendBtnText}>{sending ? '...' : 'SEND'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="MESSAGES HUB" onBack={() => navigation.goBack()} />

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{threads.length}</Text>
          <Text style={styles.summaryLabel}>Threads</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{announcements.length}</Text>
          <Text style={styles.summaryLabel}>Board</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search threads, contacts, or board posts"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {[
          { key: 'inbox', label: 'INBOX' },
          { key: 'directory', label: 'DIRECTORY' },
          { key: 'board', label: 'BOARD' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tabChip, tab === item.key && styles.tabChipActive]}
            onPress={() => setTab(item.key as Tab)}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        >
          {tab === 'inbox' ? (
            filteredThreads.length ? (
              filteredThreads.map((item, index) => (
                <MotiView key={item.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 24 }}>
                  <TouchableOpacity style={[styles.threadCard, !item.is_read && styles.threadUnread]} onPress={() => openThread(item)}>
                    <View style={styles.threadTop}>
                      <Text style={styles.threadName}>{item.other_user_name}</Text>
                      <Text style={styles.threadTime}>{timeAgo(item.last_message_at)}</Text>
                    </View>
                    <Text style={styles.threadRole}>{item.other_user_role.toUpperCase()}</Text>
                    {item.subject ? <Text style={styles.threadSubjectText}>{item.subject}</Text> : null}
                    <Text style={styles.threadPreview} numberOfLines={2}>{item.last_message ?? 'No messages yet'}</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No threads yet</Text>
                <Text style={styles.emptyText}>Open a contact from the directory to start a conversation.</Text>
              </View>
            )
          ) : null}

          {tab === 'directory' ? (
            filteredContacts.length ? (
              filteredContacts.map((item, index) => (
                <MotiView key={item.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 20 }}>
                  <TouchableOpacity style={styles.contactCard} onPress={() => openContact(item)}>
                    <Text style={styles.contactName}>{item.full_name}</Text>
                    <Text style={styles.contactRole}>{item.role.toUpperCase()}</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No contacts found</Text>
                <Text style={styles.emptyText}>Try a different search or wait for more users to be assigned.</Text>
              </View>
            )
          ) : null}

          {tab === 'board' ? (
            <>
              {isStaff ? (
                <View style={styles.boardComposer}>
                  <Text style={styles.sectionTitle}>POST ANNOUNCEMENT</Text>
                  <TextInput
                    value={announcementTitle}
                    onChangeText={setAnnouncementTitle}
                    placeholder="Announcement title"
                    placeholderTextColor={colors.textMuted}
                    style={styles.subjectInput}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.audienceRow}>
                    {['all', 'student', 'teacher', 'school', 'parent'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.tabChip, announcementAudience === item && styles.tabChipActive]}
                        onPress={() => setAnnouncementAudience(item)}
                      >
                        <Text style={[styles.tabText, announcementAudience === item && styles.tabTextActive]}>{item.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TextInput
                    value={announcementContent}
                    onChangeText={setAnnouncementContent}
                    placeholder="Write an update for your audience"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.messageInput, styles.announcementInput]}
                  />
                  <TouchableOpacity style={styles.secondaryBtn} onPress={applyAnnouncementTemplate}>
                    <Text style={styles.secondaryBtnText}>LOAD TEMPLATE (board_announcement)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sendBtn} onPress={postAnnouncement} disabled={posting}>
                    <Text style={styles.sendBtnText}>{posting ? 'POSTING...' : 'POST TO BOARD'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {filteredAnnouncements.length ? (
                filteredAnnouncements.map((item, index) => (
                  <MotiView key={item.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 24 }}>
                    <View style={styles.announcementCard}>
                      <View style={styles.threadTop}>
                        <Text style={styles.threadName}>{item.title}</Text>
                        <Text style={styles.threadTime}>{timeAgo(item.created_at)}</Text>
                      </View>
                      <Text style={styles.threadRole}>{(item.target_audience ?? 'all').toUpperCase()}</Text>
                      <Text style={styles.threadPreview}>{item.content}</Text>
                    </View>
                  </MotiView>
                ))
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>Board is quiet</Text>
                  <Text style={styles.emptyText}>Announcements and school-wide updates will appear here.</Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    summaryCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, backgroundColor: colors.bgCard, padding: SPACING.md },
    summaryValue: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    summaryLabel: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginTop: 4 },
    searchWrap: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    searchInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    tabRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
    tabChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
    tabChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
    tabText: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    tabTextActive: { color: colors.primary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollBody: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, gap: SPACING.sm },
    threadCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: 6 },
    threadUnread: { borderColor: colors.primaryGlow, backgroundColor: colors.primaryPale },
    threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, alignItems: 'center' },
    threadName: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, flex: 1 },
    threadTime: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    threadRole: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    threadSubjectText: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
    threadPreview: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    contactCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: 4 },
    contactName: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    contactRole: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    boardComposer: { borderWidth: 1, borderColor: colors.primaryGlow, backgroundColor: colors.primaryPale, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm },
    sectionTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: LETTER_SPACING.wider },
    audienceRow: { gap: SPACING.sm },
    announcementCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: 8 },
    emptyWrap: { paddingVertical: 70, alignItems: 'center', gap: SPACING.sm },
    emptyTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    emptyText: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textAlign: 'center' },
    chatList: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
    bubble: { maxWidth: '84%', borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, marginBottom: SPACING.sm },
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
    bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
    bubbleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    bubbleTime: { marginTop: 6, fontFamily: FONT_FAMILY.body, fontSize: 10 },
    threadMetaCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
    composerWrap: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, gap: SPACING.sm },
    subjectInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
    messageInput: { flex: 1, minHeight: 52, maxHeight: 130, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
    announcementInput: { minHeight: 120 },
    secondaryBtn: {
      minHeight: 44,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    secondaryBtnText: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wider },
    sendBtn: { minWidth: 92, minHeight: 48, borderRadius: RADIUS.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    sendBtnText: { color: colors.white100, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
  });

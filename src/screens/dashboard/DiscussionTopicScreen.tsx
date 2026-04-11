import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { discussionService } from '../../services/discussion.service';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type ReplyRow = {
  id: string;
  content: string;
  created_at: string | null;
  created_by: string | null;
  portal_users?: { full_name: string | null; avatar_url: string | null; role: string | null } | null;
};

export default function DiscussionTopicScreen({ navigation, route }: any) {
  const { topicId, topicTitle } = route.params as { topicId: string; topicTitle?: string };
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [topic, setTopic] = useState<{ title: string; content: string; is_locked: boolean | null } | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!topicId) return;
    try {
      const { topic: t, replies: r } = await discussionService.getTopicDetail(topicId);
      setTopic({
        title: t.title,
        content: t.content,
        is_locked: t.is_locked ?? null,
      });
      setReplies((r as ReplyRow[]) ?? []);
    } catch (e: any) {
      Alert.alert('Topic', e?.message ?? 'Could not load discussion.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [topicId, navigation]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const sendReply = async () => {
    if (!profile?.id) {
      Alert.alert('Reply', 'Sign in to reply.');
      return;
    }
    if (topic?.is_locked) {
      Alert.alert('Reply', 'This topic is locked.');
      return;
    }
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      await discussionService.createReply(topicId, profile.id, text);
      setReplyText('');
      await load();
    } catch (e: any) {
      Alert.alert('Reply', e?.message ?? 'Could not post reply.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScreenHeader
        title={topicTitle || topic?.title || 'Topic'}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {topic ? (
              <View style={[styles.op, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.opTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                <Text style={[styles.opBody, { color: colors.textSecondary }]}>{topic.content}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Replies ({replies.length})</Text>
            {replies.map((item) => (
              <View key={item.id} style={[styles.reply, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.replyAuthor, { color: colors.primary }]}>
                  {item.portal_users?.full_name?.trim() || 'Member'}
                </Text>
                <Text style={[styles.replyBody, { color: colors.textPrimary }]}>{item.content}</Text>
                <Text style={[styles.replyTime, { color: colors.textMuted }]}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                </Text>
              </View>
            ))}

            {topic?.is_locked ? (
              <Text style={[styles.locked, { color: colors.warning }]}>This topic is locked.</Text>
            ) : null}
          </ScrollView>

          {!topic?.is_locked ? (
            <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
              <TextInput
                placeholder="Write a reply…"
                placeholderTextColor={colors.textMuted}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                style={[styles.replyInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
              />
              <TouchableOpacity
                onPress={sendReply}
                disabled={sending || !replyText.trim()}
                style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sending || !replyText.trim() ? 0.5 : 1 }]}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: { bg: string }) =>
  StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: SPACING.xl, paddingBottom: 120, gap: SPACING.md },
    op: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm },
    opTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
    opBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 22 },
    sectionLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.8, marginTop: SPACING.sm },
    reply: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4 },
    replyAuthor: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs },
    replyBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    replyTime: { fontFamily: FONT_FAMILY.mono, fontSize: 9 },
    locked: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.md },
    composer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    replyInput: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      minHeight: 44,
      maxHeight: 100,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
      textAlignVertical: 'top',
    },
    sendBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: SPACING.xl,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
    },
    sendBtnText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  });

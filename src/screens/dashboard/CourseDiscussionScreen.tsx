import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
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
import { ROUTES } from '../../navigation/routes';

type TopicRow = {
  id: string;
  title: string;
  content: string;
  created_at: string | null;
  is_pinned: boolean | null;
  is_locked: boolean | null;
  portal_users?: { full_name: string | null; avatar_url: string | null } | null;
};

export default function CourseDiscussionScreen({ navigation, route }: any) {
  const { courseId, courseTitle } = route.params as { courseId: string; courseTitle?: string };
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!courseId) return;
    try {
      const data = await discussionService.listTopics(courseId);
      setTopics((data as TopicRow[]) ?? []);
    } catch (e: any) {
      Alert.alert('Discussions', e?.message ?? 'Could not load topics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const submitTopic = async () => {
    if (!profile?.id) {
      Alert.alert('Discussions', 'Sign in to start a topic.');
      return;
    }
    const title = newTitle.trim();
    const content = newBody.trim();
    if (!title || !content) {
      Alert.alert('Discussions', 'Add a title and message.');
      return;
    }
    setPosting(true);
    try {
      await discussionService.createTopic(courseId, profile.id, title, content);
      setComposerOpen(false);
      setNewTitle('');
      setNewBody('');
      await load();
    } catch (e: any) {
      Alert.alert('Discussions', e?.message ?? 'Could not create topic.');
    } finally {
      setPosting(false);
    }
  };

  if (!courseId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Discussions" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted }}>No course selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScreenHeader
        title={courseTitle ? `Forum · ${courseTitle}` : 'Course forum'}
        subtitle="Ask questions and share ideas"
        onBack={() => navigation.goBack()}
        rightAction={{
          label: '+ Topic',
          onPress: () => setComposerOpen(true),
          color: colors.primary,
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No topics yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Start the first discussion for this course.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
              onPress={() =>
                navigation.navigate(ROUTES.DiscussionTopic, {
                  topicId: item.id,
                  topicTitle: item.title,
                })
              }
            >
              <View style={styles.cardTop}>
                {item.is_pinned ? (
                  <Text style={[styles.pill, { color: colors.warning }]}>Pinned</Text>
                ) : null}
                {item.is_locked ? (
                  <Text style={[styles.pill, { color: colors.textMuted }]}>Locked</Text>
                ) : null}
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={2}>
                {item.content}
              </Text>
              <Text style={[styles.cardAuthor, { color: colors.textSecondary }]}>
                {item.portal_users?.full_name?.trim() || 'Member'} ·{' '}
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New topic</Text>
            <TextInput
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            />
            <TextInput
              placeholder="What would you like to discuss?"
              placeholderTextColor={colors.textMuted}
              value={newBody}
              onChangeText={setNewBody}
              multiline
              style={[styles.input, styles.textArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setComposerOpen(false)} style={[styles.btnGhost, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary, fontFamily: FONT_FAMILY.bodySemi }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitTopic}
                disabled={posting}
                style={[styles.btnPrimary, { backgroundColor: colors.primary, opacity: posting ? 0.7 : 1 }]}
              >
                {posting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: { bg: string }) =>
  StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.md },
    empty: { paddingVertical: SPACING['3xl'], alignItems: 'center' },
    emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginBottom: SPACING.sm },
    emptySub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textAlign: 'center', maxWidth: 280 },
    card: {
      borderWidth: 1,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    cardTop: { flexDirection: 'row', gap: SPACING.sm },
    pill: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 0.5 },
    cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    cardMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    cardAuthor: { fontFamily: FONT_FAMILY.mono, fontSize: 10, marginTop: SPACING.xs },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCard: {
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.xl,
      gap: SPACING.md,
    },
    modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    input: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.base,
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
    btnGhost: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: RADIUS.md,
      borderWidth: 1,
    },
    btnPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: RADIUS.md,
    },
    btnPrimaryText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  });

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { newsletterService } from '../../services/newsletter.service';
import { callAI } from '../../lib/openrouter';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type NewsletterStatus = 'draft' | 'published';
type FilterTab = 'all' | 'draft' | 'published';
type AudienceType = 'all' | 'students' | 'teachers' | 'schools' | 'parents';

type Newsletter = {
  id: string;
  title: string;
  content: string;
  status: NewsletterStatus;
  created_at: string | null;
  published_at: string | null;
  image_url: string | null;
  author_id: string | null;
  school_id?: string | null;
};

const AUDIENCE_OPTIONS: { key: AudienceType; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'students', label: 'Students' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'schools', label: 'Schools' },
  { key: 'parents', label: 'Parents' },
];

const AI_TONES = ['professional', 'energetic', 'visionary'] as const;

function formatDate(value: string | null) {
  if (!value) return 'Draft';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractAiPayload(raw: string): { title: string; content: string } | null {
  try {
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed?.title === 'string' && typeof parsed?.content === 'string') {
      return {
        title: parsed.title.trim(),
        content: parsed.content.trim(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export default function NewslettersScreenV2({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [deliveryMap, setDeliveryMap] = useState<Record<string, { total: number; viewed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [activeNewsletter, setActiveNewsletter] = useState<Newsletter | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<(typeof AI_TONES)[number]>('professional');
  const [targetAudience, setTargetAudience] = useState<AudienceType>('all');
  const [form, setForm] = useState({ title: '', content: '' });

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isStaff) {
        const rows = (await newsletterService.listNewslettersForStaff({
          schoolId: profile.role === 'school' ? profile.school_id : undefined,
          limit: 120,
        })) as Newsletter[];
        setNewsletters(rows);

        if (rows.length > 0) {
          const ids = rows.map((item) => item.id);
          setDeliveryMap(await newsletterService.aggregateDeliveryStatsByNewsletterIds(ids));
        } else {
          setDeliveryMap({});
        }
      } else {
        const { newsletters: items } = await newsletterService.loadPublishedNewslettersForReader(profile.id);
        setNewsletters(items as Newsletter[]);
        setDeliveryMap({});
      }
    } catch (error: any) {
      Alert.alert('Newsletters', error?.message ?? 'Could not load newsletters.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setActiveNewsletter(null);
    setForm({ title: '', content: '' });
    setAiTopic('');
    setTargetAudience('all');
    setShowEditor(true);
  };

  const openEdit = (item: Newsletter) => {
    setActiveNewsletter(item);
    setForm({ title: item.title, content: item.content });
    setAiTopic(item.title);
    setShowEditor(true);
  };

  const openRead = (item: Newsletter) => {
    setActiveNewsletter(item);
    setShowReader(true);
    // Mark individual newsletter as viewed when student opens it
    if (!isStaff && profile?.id && item.id) {
      newsletterService.markNewsletterViewedByUser(item.id, profile.id).catch(() => {});
    }
  };

  const saveDraft = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('Validation', 'Title and content are required.');
      return;
    }

    setSaving(true);
    try {
      await newsletterService.upsertNewsletterDraft({
        id: activeNewsletter?.id,
        title: form.title.trim(),
        content: form.content.trim(),
        authorId: profile?.id ?? null,
        schoolId: profile?.role === 'school' ? profile.school_id ?? null : null,
      });

      setShowEditor(false);
      await load();
    } catch (error: any) {
      Alert.alert('Draft', error?.message ?? 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  };

  const publishNewsletter = async () => {
    const newsletterId = activeNewsletter?.id;
    if (!newsletterId) {
      Alert.alert('Publish', 'Save this newsletter first before publishing it.');
      return;
    }

    setPublishing(true);
    try {
      const count = await newsletterService.publishNewsletterToAudience({
        newsletterId,
        schoolScopeId: profile?.role === 'school' ? profile.school_id : undefined,
        audience: targetAudience,
      });

      Alert.alert('Published', `Newsletter delivered to ${count} recipients.`);
      setShowEditor(false);
      await load();
    } catch (error: any) {
      if (error?.message === 'NO_RECIPIENTS') {
        Alert.alert('Publish', 'No recipients matched this audience.');
      } else {
        Alert.alert('Publish', error?.message ?? 'Could not publish newsletter.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const deleteNewsletter = (item: Newsletter) => {
    Alert.alert('Delete newsletter', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await newsletterService.deleteNewsletter(item.id);
          } catch (err: any) {
            Alert.alert('Delete', err?.message ?? 'Delete failed');
            return;
          }
          if (activeNewsletter?.id === item.id) setActiveNewsletter(null);
          await load();
        },
      },
    ]);
  };

  const refineWithAI = async () => {
    if (!form.content.trim()) {
      Alert.alert('Refine', 'Write some content first before refining.');
      return;
    }
    setRefining(true);
    try {
      const response = await callAI({
        temperature: 0.55,
        maxTokens: 800,
        messages: [
          {
            role: 'system',
            content:
              'You are a school newsletter editor. Improve the given newsletter content: fix grammar, improve clarity, add polish, and structure with clear paragraphs. Keep the same tone and facts. Return only the improved content as plain text — no JSON, no extra commentary.',
          },
          {
            role: 'user',
            content: `Refine this newsletter content:\n\nTitle: ${form.title}\n\nContent:\n${form.content}`,
          },
        ],
      });
      setForm((curr) => ({ ...curr, content: response.trim() }));
    } catch (error: any) {
      Alert.alert('Refine', error?.message ?? 'Could not refine content.');
    } finally {
      setRefining(false);
    }
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) {
      Alert.alert('AI Builder', 'Enter a topic first.');
      return;
    }

    setGenerating(true);
    try {
      const response = await callAI({
        temperature: 0.65,
        maxTokens: 900,
        messages: [
          {
            role: 'system',
            content:
              'You create polished school newsletters for Rillcod Academy. Return only compact JSON with keys "title" and "content". Use British English, clear sections, short paragraphs, and a warm but professional voice.',
          },
          {
            role: 'user',
            content: `Create a newsletter for "${aiTopic.trim()}". Tone: ${aiTone}. Audience: ${targetAudience}. Context role: ${profile?.role ?? 'staff'}. Include a strong title, a short opening, 3 to 5 concise sections, and a clear closing call-to-action. Return JSON only.`,
          },
        ],
      });

      const payload = extractAiPayload(response);
      if (!payload) throw new Error('AI returned an invalid newsletter format.');

      setForm({
        title: payload.title,
        content: payload.content,
      });
    } catch (error: any) {
      Alert.alert('AI Builder', error?.message ?? 'Could not generate newsletter draft.');
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return newsletters.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter;
      const matchesQuery =
        !needle ||
        item.title.toLowerCase().includes(needle) ||
        item.content.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, newsletters, query]);

  const stats = useMemo(() => {
    const published = newsletters.filter((item) => item.status === 'published').length;
    const drafts = newsletters.filter((item) => item.status === 'draft').length;
    const delivered = Object.values(deliveryMap).reduce((sum, item) => sum + item.total, 0);
    return { total: newsletters.length, drafts, published, delivered };
  }, [deliveryMap, newsletters]);

  const renderCard = ({ item, index }: { item: Newsletter; index: number }) => {
    const delivery = deliveryMap[item.id];
    const isPublished = item.status === 'published';
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 35 }}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.card}
          onPress={() => (isStaff ? openEdit(item) : openRead(item))}
          onLongPress={() => isStaff && deleteNewsletter(item)}
        >
          <View style={styles.cardTop}>
            <View style={[styles.statusBadge, isPublished ? styles.statusPublished : styles.statusDraft]}>
              <Text style={[styles.statusText, { color: isPublished ? colors.success : colors.warning }]}>
                {isPublished ? 'PUBLISHED' : 'DRAFT'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.published_at ?? item.created_at)}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardBody} numberOfLines={4}>{item.content}</Text>
          {isStaff ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {delivery ? `${delivery.total} delivered` : item.status === 'published' ? 'No delivery record' : 'Draft only'}
              </Text>
              {delivery ? <Text style={styles.metaText}>{delivery.viewed} viewed</Text> : null}
            </View>
          ) : null}
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={isStaff ? 'NEWSLETTERS HUB' : 'NEWSLETTERS'} onBack={() => navigation.goBack()} />

      <View style={styles.summaryRow}>
        {[
          { label: 'Total', value: stats.total },
          { label: 'Published', value: stats.published },
          { label: isStaff ? 'Delivered' : 'Drafts', value: isStaff ? stats.delivered : stats.drafts },
        ].map((item) => (
          <View key={item.label} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isStaff ? 'Search titles, drafts, delivery history...' : 'Search newsletters'}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {isStaff ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
            <Text style={styles.primaryBtnText}>+ NEW</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'published', 'draft'] as FilterTab[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No newsletters yet</Text>
              <Text style={styles.emptyText}>
                {isStaff ? 'Create a draft or publish an AI-assisted newsletter from mobile.' : 'No newsletters have been delivered to you yet.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showEditor} animationType="slide" transparent onRequestClose={() => setShowEditor(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>NEWSLETTER BUILDER</Text>
                <Text style={styles.modalTitle}>{activeNewsletter ? 'Edit newsletter' : 'Create newsletter'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditor(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.aiCard}>
                <Text style={styles.sectionTitle}>AI DRAFTING</Text>
                <TextInput
                  value={aiTopic}
                  onChangeText={setAiTopic}
                  placeholder="Topic or campaign goal"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {AI_TONES.map((tone) => (
                    <TouchableOpacity key={tone} style={[styles.pill, aiTone === tone && styles.pillActive]} onPress={() => setAiTone(tone)}>
                      <Text style={[styles.pillText, aiTone === tone && styles.pillTextActive]}>{tone.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.primaryWideBtn} onPress={generateWithAI} disabled={generating}>
                  <Text style={styles.primaryBtnText}>{generating ? 'GENERATING...' : 'GENERATE WITH AI'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>TITLE</Text>
              <TextInput
                value={form.title}
                onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
                placeholder="Newsletter title"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>CONTENT</Text>
              <TextInput
                value={form.content}
                onChangeText={(value) => setForm((current) => ({ ...current, content: value }))}
                placeholder="Write or refine your newsletter"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.input, styles.textarea]}
              />

              <TouchableOpacity style={[styles.secondaryBtn, { minHeight: 42 }]} onPress={refineWithAI} disabled={refining}>
                <Text style={styles.secondaryBtnText}>{refining ? 'REFINING...' : '✦ REFINE WITH AI'}</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>PUBLISH AUDIENCE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {AUDIENCE_OPTIONS.map((item) => (
                  <TouchableOpacity key={item.key} style={[styles.pill, targetAudience === item.key && styles.pillActive]} onPress={() => setTargetAudience(item.key)}>
                    <Text style={[styles.pillText, targetAudience === item.key && styles.pillTextActive]}>{item.label.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveDraft} disabled={saving}>
                <Text style={styles.secondaryBtnText}>{saving ? 'SAVING...' : 'SAVE DRAFT'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryWideBtn, !activeNewsletter?.id && styles.primaryWideBtnDisabled]} onPress={publishNewsletter} disabled={!activeNewsletter?.id || publishing}>
                <Text style={styles.primaryBtnText}>{publishing ? 'PUBLISHING...' : 'PUBLISH'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showReader} animationType="slide" transparent onRequestClose={() => setShowReader(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>NEWSLETTER</Text>
                <Text style={styles.modalTitle}>{activeNewsletter?.title ?? 'Newsletter'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReader(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>X</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.readerDate}>{formatDate(activeNewsletter?.published_at ?? activeNewsletter?.created_at ?? null)}</Text>
              <Text style={styles.readerText}>{activeNewsletter?.content ?? ''}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    summaryCard: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md },
    summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
    summaryLabel: { marginTop: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.textMuted, letterSpacing: LETTER_SPACING.wider },
    searchWrap: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
    searchInput: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    primaryBtn: { minWidth: 84, borderRadius: RADIUS.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    primaryBtnText: { color: colors.white100, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    filterRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
    filterChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
    filterChipActive: { backgroundColor: colors.primaryPale, borderColor: colors.primary },
    filterText: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    filterTextActive: { color: colors.primary },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    statusBadge: { borderRadius: RADIUS.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    statusPublished: { backgroundColor: colors.success + '14', borderColor: colors.success + '40' },
    statusDraft: { backgroundColor: colors.warning + '14', borderColor: colors.warning + '40' },
    statusText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    dateText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
    cardTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, lineHeight: 22 },
    cardBody: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
    metaText: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
    emptyWrap: { paddingVertical: 80, alignItems: 'center', gap: SPACING.sm },
    emptyTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    emptyText: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,17,28,0.7)', justifyContent: 'flex-end' },
    modalCard: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalEyebrow: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginBottom: 6 },
    modalTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
    modalBody: { padding: SPACING.xl, gap: SPACING.md },
    aiCard: { borderWidth: 1, borderColor: colors.primaryGlow, backgroundColor: colors.primaryPale, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
    sectionTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: LETTER_SPACING.wider },
    fieldLabel: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
    textarea: { minHeight: 180, textAlignVertical: 'top' },
    pillRow: { gap: SPACING.sm },
    pill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
    pillText: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wide },
    pillTextActive: { color: colors.primary },
    actionRow: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.xl, borderTopWidth: 1, borderTopColor: colors.border },
    secondaryBtn: { flex: 1, minHeight: 48, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    primaryWideBtn: { flex: 1, minHeight: 48, borderRadius: RADIUS.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    primaryWideBtnDisabled: { opacity: 0.55 },
    readerDate: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    readerText: { color: colors.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, lineHeight: 24 },
  });

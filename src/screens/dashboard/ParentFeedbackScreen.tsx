import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { feedbackService } from '../../services/feedback.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

type FeedbackStatus = 'pending' | 'reviewed' | 'actioned';

type FeedbackRow = {
  id: string;
  created_at: string;
  category: string;
  rating: number | null;
  message: string;
  is_anonymous: boolean;
  status: FeedbackStatus;
  parent_name: string | null;
  parent_email: string | null;
  school_name: string | null;
};

const CATEGORIES = [
  'General Experience',
  "Child's Progress",
  'Teacher Communication',
  'School Environment',
  'Admin & Support',
  'Curriculum & Courses',
  'Portal & Technology',
  'Other',
];

export default function ParentFeedbackScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const isParent = profile?.role === 'parent';
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const isSchool = profile?.role === 'school';
  const canSubmit = isParent;
  const canReview = isAdmin || isTeacher || isSchool;

  const [loading, setLoading] = useState(canReview);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [filter, setFilter] = useState<'all' | FeedbackStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    rating: 0,
    message: '',
    is_anonymous: false,
  });

  const loadFeedback = useCallback(async () => {
    if (!canReview || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const rows = (await feedbackService.listParentFeedbackForStaff({
        statusFilter: filter,
        limit: 100,
      })) as FeedbackRow[];

      if ((isTeacher || isSchool) && profile.school_name) {
        setFeedback(rows.filter((row) => row.school_name === profile.school_name));
      } else {
        setFeedback(rows);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canReview, filter, isSchool, isTeacher, profile]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeedback();
  }, [loadFeedback]);

  const submitFeedback = useCallback(async () => {
    const message = form.message.trim();
    if (!profile || !canSubmit) return;
    if (!message) {
      Alert.alert('Feedback Required', 'Please write your feedback before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackService.submitParentFeedback({
        portal_user_id: profile.id,
        category: form.category,
        rating: form.rating > 0 ? form.rating : null,
        message,
        is_anonymous: form.is_anonymous,
        status: 'pending',
      });

      setForm({ category: CATEGORIES[0], rating: 0, message: '', is_anonymous: false });
      Alert.alert('Feedback Sent', 'Your feedback has been submitted successfully.');
    } catch (error: any) {
      Alert.alert('Submission Failed', error?.message ?? 'Unable to submit feedback right now.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, profile]);

  const updateStatus = useCallback(async (id: string, status: FeedbackStatus) => {
    setUpdatingId(id);
    try {
      await feedbackService.updateParentFeedbackStatus(id, status);

      setFeedback((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message ?? 'Unable to update the feedback status.');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const stats = useMemo(() => ({
    total: feedback.length,
    pending: feedback.filter((item) => item.status === 'pending').length,
    reviewed: feedback.filter((item) => item.status === 'reviewed').length,
    avgRating: feedback.filter((item) => item.rating).length > 0
      ? (
          feedback.filter((item) => item.rating).reduce((sum, item) => sum + (item.rating ?? 0), 0) /
          feedback.filter((item) => item.rating).length
        ).toFixed(1)
      : 'N/A',
  }), [feedback]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Parent Feedback"
        subtitle={canSubmit ? 'Share your experience' : 'Review parent feedback'}
        onBack={() => goBackOrTo(navigation, ROUTES.PeopleHub)}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={canReview ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {canSubmit ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Share Your Feedback</Text>
            <Text style={styles.sectionSub}>Your feedback helps improve the experience across the platform.</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {CATEGORIES.map((category) => {
                  const active = form.category === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryPill, active && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
                      onPress={() => setForm((current) => ({ ...current, category }))}
                    >
                      <Text style={[styles.categoryText, active && { color: colors.primary }]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Rating</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= form.rating;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.ratingChip, active && { borderColor: colors.gold, backgroundColor: colors.goldGlow }]}
                      onPress={() => setForm((current) => ({ ...current, rating: value }))}
                    >
                      <Text style={[styles.ratingText, active && { color: colors.gold }]}>{value}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={styles.messageInput}
                multiline
                value={form.message}
                onChangeText={(message) => setForm((current) => ({ ...current, message }))}
                placeholder="Share your thoughts, suggestions, or concerns..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchBody}>
                <Text style={styles.switchTitle}>Submit Anonymously</Text>
                <Text style={styles.switchText}>Your name will not appear in staff review.</Text>
              </View>
              <Switch
                value={form.is_anonymous}
                onValueChange={(is_anonymous) => setForm((current) => ({ ...current, is_anonymous }))}
                thumbColor={colors.white100}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <TouchableOpacity style={[styles.primaryBtn, submitting && styles.btnDisabled]} onPress={submitFeedback} disabled={submitting}>
              <Text style={styles.primaryBtnText}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canReview ? (
          <>
            <View style={styles.statRow}>
              <StatCard label="Total" value={String(stats.total)} styles={styles} />
              <StatCard label="Pending" value={String(stats.pending)} styles={styles} />
              <StatCard label="Reviewed" value={String(stats.reviewed)} styles={styles} />
              <StatCard label="Avg Rating" value={stats.avgRating} styles={styles} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'pending', 'reviewed', 'actioned'] as const).map((value) => {
                const active = filter === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.categoryPill, active && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
                    onPress={() => setFilter(value)}
                  >
                    <Text style={[styles.categoryText, active && { color: colors.primary }]}>{value}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : feedback.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No feedback yet</Text>
                <Text style={styles.emptyText}>Parent feedback submissions will appear here once they are sent.</Text>
              </View>
            ) : (
              feedback.map((item) => (
                <View key={item.id} style={styles.feedbackCard}>
                  <View style={styles.feedbackTop}>
                    <View style={styles.feedbackMeta}>
                      <Text style={styles.feedbackCategory}>{item.category}</Text>
                      <Text style={styles.feedbackDate}>{new Date(item.created_at).toLocaleString('en-GB')}</Text>
                    </View>
                    <Text style={[styles.statusBadge, statusStyle(item.status, colors)]}>{item.status.toUpperCase()}</Text>
                  </View>

                  <Text style={styles.feedbackMessage}>{item.message}</Text>

                  <View style={styles.infoGrid}>
                    <InfoItem label="Parent" value={item.parent_name ?? 'Anonymous'} styles={styles} />
                    <InfoItem label="Email" value={item.parent_email ?? 'Hidden'} styles={styles} />
                    <InfoItem label="School" value={item.school_name ?? 'N/A'} styles={styles} />
                    <InfoItem label="Rating" value={item.rating ? `${item.rating}/5` : 'N/A'} styles={styles} />
                  </View>

                  <View style={styles.actionRow}>
                    {(['pending', 'reviewed', 'actioned'] as const).map((value) => (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.statusBtn,
                          item.status === value && { borderColor: colors.primary, backgroundColor: colors.primaryPale },
                          updatingId === item.id && styles.btnDisabled,
                        ]}
                        onPress={() => updateStatus(item.id, value)}
                        disabled={updatingId === item.id}
                      >
                        <Text style={[styles.statusBtnText, item.status === value && { color: colors.primary }]}>
                          {updatingId === item.id && item.status !== value ? 'Updating...' : value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}

        {!canSubmit && !canReview ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Access Restricted</Text>
            <Text style={styles.emptyText}>This screen is available to parent, teacher, and admin accounts only.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoItem({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function statusStyle(status: FeedbackStatus, colors: any) {
  if (status === 'reviewed') return { color: colors.info, borderColor: colors.info + '40', backgroundColor: colors.info + '14' };
  if (status === 'actioned') return { color: colors.success, borderColor: colors.success + '40', backgroundColor: colors.success + '14' };
  return { color: colors.warning, borderColor: colors.warning + '40', backgroundColor: colors.warning + '14' };
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  formCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  sectionSub: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20, color: colors.textSecondary },
  fieldWrap: { gap: SPACING.sm },
  fieldLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  categoryRow: { gap: SPACING.sm },
  categoryPill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  categoryText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  ratingRow: { flexDirection: 'row', gap: SPACING.sm },
  ratingChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  ratingText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  messageInput: { minHeight: 140, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.lg, padding: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.lg, padding: SPACING.md },
  switchBody: { flex: 1, gap: 4 },
  switchTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  switchText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textSecondary },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: colors.primary },
  primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.white100, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  btnDisabled: { opacity: 0.65 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statCard: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  statLabel: { marginTop: 6, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  filterRow: { gap: SPACING.sm, paddingBottom: SPACING.xs },
  loaderWrap: { paddingVertical: SPACING['3xl'], alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  feedbackCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
  feedbackTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  feedbackMeta: { flex: 1 },
  feedbackCategory: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  feedbackDate: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wider },
  feedbackMessage: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  infoItem: { minWidth: '47%', gap: 4 },
  infoLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  infoValue: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  statusBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
});

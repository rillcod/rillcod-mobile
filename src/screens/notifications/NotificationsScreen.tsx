import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notification.service';
import { preferenceService } from '../../services/preference.service';
import { dashboardService } from '../../services/dashboard.service';
import { announcementService } from '../../services/announcement.service';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

type NotificationFilter = 'all' | 'unread' | 'info' | 'warning' | 'success' | 'error';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean | null;
  created_at: string | null;
  action_url: string | null;
}

interface NotificationPreferences {
  portal_user_id: string | null;
  push_enabled: boolean | null;
  email_enabled: boolean | null;
  sms_enabled: boolean | null;
  announcement_notifications: boolean | null;
  grade_notifications: boolean | null;
}

type InboxAnnouncement = {
  id: string;
  title: string;
  content: string;
  created_at: string | null;
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreenV2() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const canGoBack = typeof (navigation as any).canGoBack === 'function' && (navigation as any).canGoBack();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    portal_user_id: null,
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    announcement_notifications: true,
    grade_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [inboxAnnouncements, setInboxAnnouncements] = useState<InboxAnnouncement[]>([]);
  const [inboxAnnReadIds, setInboxAnnReadIds] = useState<Set<string>>(() => new Set());
  const [inboxAnnDetail, setInboxAnnDetail] = useState<InboxAnnouncement | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [rows, prefs, ann, readAnn] = await Promise.all([
        notificationService.listNotifications(profile.id, 80),
        preferenceService.getPreferences(profile.id),
        dashboardService.listAnnouncementsForAudience({
          role: profile.role,
          schoolId: profile.school_id ?? null,
          limit: 24,
        }),
        announcementService.listReadAnnouncementIds(profile.id).catch(() => [] as string[]),
      ]);

      setNotifications(
        (rows as any[]).map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type ?? null,
          is_read: n.is_read ?? null,
          created_at: n.created_at ?? null,
          action_url: n.action_url ?? null,
        })),
      );
      setPreferences({
        portal_user_id: profile.id,
        push_enabled: prefs.push_enabled,
        email_enabled: prefs.email_enabled,
        sms_enabled: prefs.sms_enabled,
        announcement_notifications: prefs.announcement_notifications,
        grade_notifications: prefs.grade_notifications,
      });
      setInboxAnnouncements(
        (ann ?? []).map((a) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          created_at: a.created_at,
        })),
      );
      setInboxAnnReadIds(new Set(Array.isArray(readAnn) ? readAnn.filter(Boolean) : []));
    } catch {
      // keep prior state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const unreadAnnouncementCount = useMemo(
    () => inboxAnnouncements.filter((a) => !inboxAnnReadIds.has(a.id)).length,
    [inboxAnnouncements, inboxAnnReadIds],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((item) => !item.is_read);
    return notifications.filter((item) => item.type === filter);
  }, [filter, notifications]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!profile || key === 'portal_user_id') return;
    setSavingPref(key);
    const prev = preferences;
    setPreferences({ ...preferences, portal_user_id: profile.id, [key]: value });
    try {
      await preferenceService.updatePreferences(profile.id, { [key]: value });
    } catch {
      setPreferences(prev);
    } finally {
      setSavingPref(null);
    }
  };

  const markAllRead = async () => {
    if (!profile || unreadCount === 0) return;
    try {
      await notificationService.markAllAsRead(profile.id);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const markAllAnnouncementsRead = async () => {
    if (!profile || unreadAnnouncementCount === 0) return;
    try {
      for (const a of inboxAnnouncements) {
        if (!inboxAnnReadIds.has(a.id)) {
          await announcementService.markAnnouncementRead(profile.id, a.id);
        }
      }
      setInboxAnnReadIds(new Set(inboxAnnouncements.map((x) => x.id)));
    } catch {
      /* ignore */
    }
  };

  const markOneAnnouncementRead = async (row: InboxAnnouncement) => {
    if (!profile) return;
    try {
      await announcementService.markAnnouncementRead(profile.id, row.id);
      setInboxAnnReadIds((prev) => new Set(prev).add(row.id));
      setInboxAnnDetail(null);
    } catch {
      /* ignore */
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await notificationService.markAsRead(item.id);
        setNotifications((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)));
      } catch {
        /* ignore */
      }
    }

    if (item.action_url && /^https?:\/\//i.test(item.action_url)) {
      const supported = await Linking.canOpenURL(item.action_url);
      if (supported) await Linking.openURL(item.action_url);
    }
  };

  const typeColor = (type: string | null) => {
    if (type === 'success') return colors.success;
    if (type === 'warning') return colors.warning;
    if (type === 'error') return colors.error;
    if (type === 'payment') return colors.school;
    return colors.primary;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />

      <View style={styles.header}>
        <View style={styles.headerMain}>
          {canGoBack ? (
            <IconBackButton
              onPress={() => (navigation as any).goBack()}
              color={colors.textPrimary}
            />
          ) : null}
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Alerts</Text>
            <Text style={styles.headerSub}>
              {unreadCount} unread system alerts
              {unreadAnnouncementCount > 0 ? ` · ${unreadAnnouncementCount} unread posts` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} disabled={!unreadCount}>
          <Text style={styles.markAllText}>MARK ALL READ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
      >
        {inboxAnnouncements.length > 0 ? (
          <View style={[styles.prefCard, { marginBottom: SPACING.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.prefTitle}>Announcements</Text>
              {unreadAnnouncementCount > 0 ? (
                <TouchableOpacity onPress={() => void markAllAnnouncementsRead()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.primary, letterSpacing: 0.5 }}>MARK ALL READ</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={[styles.prefHint, { marginBottom: SPACING.md }]}>
              Official posts from your school or admin — same feed as home. Tap to read fully; read items stay listed here.
            </Text>
            {inboxAnnouncements.map((a) => {
              const unread = !inboxAnnReadIds.has(a.id);
              const accent = unread ? colors.primary : colors.textMuted;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.annCard, { borderColor: accent + (unread ? '66' : '33'), backgroundColor: colors.bg }]}
                  onPress={() => setInboxAnnDetail(a)}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[styles.cardTitle, unread && styles.cardTitleUnread, { flex: 1 }]}>{a.title}</Text>
                    <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: accent }}>{unread ? 'NEW' : 'READ'}</Text>
                  </View>
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {a.content}
                  </Text>
                  <Text style={styles.cardTime}>{timeAgo(a.created_at)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <Text style={[styles.prefTitle, { marginBottom: SPACING.sm, paddingHorizontal: 2 }]}>System alerts</Text>
        <Text style={[styles.prefHint, { marginBottom: SPACING.md, paddingHorizontal: 2 }]}>
          Automated notices (grades, billing, etc.). Use filters below to narrow the list.
        </Text>

        <View style={styles.summaryRow}>
          {[
            { label: 'All', value: notifications.length },
            { label: 'Unread', value: unreadCount },
            { label: 'Priority', value: notifications.filter((item) => ['warning', 'error'].includes(item.type ?? '')).length },
          ].map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'unread', 'info', 'warning', 'success', 'error'] as NotificationFilter[]).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredNotifications.length ? (
          filteredNotifications.map((notification, index) => {
            const accent = typeColor(notification.type);
            return (
              <MotiView key={notification.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 24 }}>
                <TouchableOpacity style={[styles.card, !notification.is_read && { borderColor: accent + '60' }]} onPress={() => openNotification(notification)}>
                  <View style={styles.cardTop}>
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    <Text style={[styles.cardType, { color: accent }]}>{(notification.type ?? 'info').toUpperCase()}</Text>
                    <Text style={styles.cardTime}>{timeAgo(notification.created_at)}</Text>
                  </View>
                  <Text style={[styles.cardTitle, !notification.is_read && styles.cardTitleUnread]}>{notification.title}</Text>
                  <Text style={styles.cardBody}>{notification.message}</Text>
                  {notification.action_url ? <Text style={styles.cardLink}>OPEN LINK</Text> : null}
                </TouchableOpacity>
              </MotiView>
            );
          })
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>No system alerts match this filter right now.</Text>
          </View>
        )}

        <View style={[styles.prefCard, { marginTop: SPACING.lg }]}>
          <Text style={styles.prefTitle}>Delivery preferences</Text>
          {[
            { key: 'push_enabled', label: 'Push Alerts' },
            { key: 'email_enabled', label: 'Email Updates' },
            { key: 'sms_enabled', label: 'SMS Alerts' },
            { key: 'announcement_notifications', label: 'Announcements' },
            { key: 'grade_notifications', label: 'Grade Reports' },
          ].map((item) => (
            <View key={item.key} style={styles.prefRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefLabel}>{item.label}</Text>
                <Text style={styles.prefHint}>{savingPref === item.key ? 'Saving...' : 'Control how this reaches you'}</Text>
              </View>
              <Switch
                value={Boolean((preferences as any)[item.key])}
                onValueChange={(value) => updatePreference(item.key as keyof NotificationPreferences, value)}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={Boolean((preferences as any)[item.key]) ? colors.primary : '#f4f3f4'}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!inboxAnnDetail} transparent animationType="fade" onRequestClose={() => setInboxAnnDetail(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
          <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, padding: SPACING.lg, maxHeight: '88%' }}>
            <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: 6 }}>ANNOUNCEMENT</Text>
            <Text style={{ fontFamily: FONT_FAMILY.display, fontSize: 20, color: colors.textPrimary, marginBottom: SPACING.md }}>{inboxAnnDetail?.title}</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator>
              <Text style={{ fontFamily: FONT_FAMILY.body, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{inboxAnnDetail?.content}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                onPress={() => setInboxAnnDetail(null)}
              >
                <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: colors.textSecondary }}>CLOSE</Text>
              </TouchableOpacity>
              {inboxAnnDetail && !inboxAnnReadIds.has(inboxAnnDetail.id) ? (
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: RADIUS.full, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={() => void markOneAnnouncementRead(inboxAnnDetail)}
                >
                  <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: '#fff' }}>MARK AS READ</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.md },
    headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minWidth: 0 },
    headerTitles: { flex: 1, minWidth: 0 },
    headerTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
    headerSub: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wide },
    markAllBtn: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.primary, borderRadius: RADIUS.full, backgroundColor: colors.primaryPale },
    markAllText: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    summaryCard: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md },
    summaryValue: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    summaryLabel: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginTop: 4 },
    filterRow: { paddingBottom: SPACING.md, gap: SPACING.sm },
    filterChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
    filterText: { color: colors.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    filterTextActive: { color: colors.primary },
    scroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, gap: SPACING.sm },
    prefCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.sm },
    prefTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, marginBottom: SPACING.sm },
    prefRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
    prefLabel: { color: colors.textPrimary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
    prefHint: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, marginTop: 2 },
    center: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cardType: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    cardTime: { marginLeft: 'auto', color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    cardTitle: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, marginBottom: 4 },
    cardTitleUnread: { color: colors.textPrimary },
    cardBody: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    cardLink: { color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginTop: 10 },
    emptyWrap: { paddingVertical: 70, alignItems: 'center', gap: SPACING.sm },
    emptyTitle: { color: colors.textPrimary, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    emptyText: { color: colors.textMuted, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textAlign: 'center' },
    annCard: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      gap: 6,
    },
  });

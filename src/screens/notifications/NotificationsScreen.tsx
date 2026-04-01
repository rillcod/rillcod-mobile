import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean | null;
  created_at: string | null;
  action_url: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { light } = useHaptics();
  const styles = getStyles(colors);

  const TYPE_META: Record<string, { icon: string; color: string }> = {
    announcement: { icon: 'A', color: colors.info },
    assignment: { icon: 'W', color: colors.primary },
    grade: { icon: 'G', color: colors.warning },
    payment: { icon: 'P', color: colors.success },
    approval: { icon: 'O', color: colors.success },
    system: { icon: 'S', color: colors.textMuted },
    default: { icon: 'N', color: colors.primary },
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, is_read, created_at, action_url')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications((data as NotificationItem[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const markAllRead = async () => {
    if (!profile || unreadCount === 0) return;
    await light();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      <LinearGradient colors={['#0d0510', colors.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} unread</Text>}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            {[0, 1, 2, 3].map((i) => (
              <MotiView key={i} from={{ opacity: 0.3 }} animate={{ opacity: 0.7 }} transition={{ type: 'timing', duration: 800, loop: true, delay: i * 150 }} style={styles.skeleton} />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>N</Text>
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptySub}>No notifications yet. Check back later.</Text>
          </MotiView>
        ) : (
          notifications.map((notification, index) => {
            const meta = TYPE_META[notification.type ?? ''] ?? TYPE_META.default;
            return (
              <MotiView key={notification.id} from={{ opacity: 0, translateX: -16 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'spring', delay: index * 40, damping: 22 }} style={[styles.card, !notification.is_read && { borderColor: `${colors.primary}40` }]}>
                <TouchableOpacity activeOpacity={0.82} onPress={() => { markRead(notification.id); light(); }} style={styles.cardInner}>
                  <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                  {!notification.is_read && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
                  <MotiView animate={{ backgroundColor: `${meta.color}20` }} style={styles.iconWrap}>
                    <Text style={[styles.iconText, { color: meta.color }]}>{meta.icon}</Text>
                  </MotiView>
                  <View style={styles.content}>
                    <Text style={[styles.notifTitle, !notification.is_read && styles.notifTitleUnread]} numberOfLines={1}>{notification.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{notification.message}</Text>
                    <Text style={[styles.notifTime, { color: meta.color }]}>{timeAgo(notification.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              </MotiView>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: colors.textPrimary, marginBottom: 2 },
  headerSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.primary },
  markAllBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: `${colors.primary}16`, borderRadius: RADIUS.full, borderWidth: 1, borderColor: `${colors.primary}40` },
  markAllText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: colors.primary },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: 40 },
  loadingWrap: { gap: 12, marginTop: 8 },
  skeleton: { height: 80, borderRadius: RADIUS.xl, backgroundColor: colors.bgCard },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.lg, color: colors.primary, fontFamily: FONT_FAMILY.display },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary, marginBottom: SPACING.sm },
  emptySub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textMuted, textAlign: 'center' },
  card: { borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 10, ...SHADOW.sm },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, gap: SPACING.md },
  unreadDot: { position: 'absolute', top: 14, left: 10, width: 6, height: 6, borderRadius: 3 },
  iconWrap: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: 18, fontFamily: FONT_FAMILY.display },
  content: { flex: 1 },
  notifTitle: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: colors.textSecondary, marginBottom: 3 },
  notifTitleUnread: { fontFamily: FONT_FAMILY.bodySemi, color: colors.textPrimary },
  notifBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textMuted, lineHeight: FONT_SIZE.sm * 1.5, marginBottom: 5 },
  notifTime: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide },
});

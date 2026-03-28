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
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  announcement: { icon: '📢', color: COLORS.info },
  assignment:   { icon: '📝', color: '#7c3aed' },
  grade:        { icon: '🏆', color: COLORS.gold },
  payment:      { icon: '💳', color: COLORS.success },
  approval:     { icon: '✅', color: COLORS.success },
  system:       { icon: '⚙️', color: COLORS.textMuted },
  default:      { icon: '🔔', color: COLORS.primaryLight },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const { light } = useHaptics();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadData = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data as Notification[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const markAllRead = async () => {
    if (!profile || unreadCount === 0) return;
    await light();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      {/* Header */}
      <LinearGradient colors={['#0d0510', COLORS.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} unread</Text>
            )}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            {[0, 1, 2, 3].map(i => (
              <MotiView
                key={i}
                from={{ opacity: 0.3 }}
                animate={{ opacity: 0.7 }}
                transition={{ type: 'timing', duration: 800, loop: true, delay: i * 150 }}
                style={styles.skeleton}
              />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.emptyWrap}
          >
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptySub}>No notifications yet. Check back later.</Text>
          </MotiView>
        ) : (
          notifications.map((n, i) => {
            const meta = TYPE_META[n.type ?? ''] ?? TYPE_META.default;
            return (
              <MotiView
                key={n.id}
                from={{ opacity: 0, translateX: -16 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', delay: i * 40, damping: 22 }}
                style={[styles.card, !n.is_read && styles.cardUnread]}
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => { markRead(n.id); light(); }}
                  style={styles.cardInner}
                >
                  <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />

                  {/* Unread indicator */}
                  {!n.is_read && (
                    <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />
                  )}

                  {/* Icon */}
                  <MotiView
                    animate={{ backgroundColor: meta.color + '20' }}
                    style={styles.iconWrap}
                  >
                    <Text style={styles.iconText}>{meta.icon}</Text>
                  </MotiView>

                  {/* Content */}
                  <View style={styles.content}>
                    <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                    <Text style={[styles.notifTime, { color: meta.color }]}>{timeAgo(n.created_at)}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  headerSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryLight,
  },
  markAllBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryPale,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primaryMid + '40',
  },
  markAllText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryLight,
  },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: 40 },
  loadingWrap: { gap: 12, marginTop: 8 },
  skeleton: {
    height: 80,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
  },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.lg },
  emptyTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  card: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    ...SHADOW.sm,
  },
  cardUnread: {
    borderColor: COLORS.primaryMid + '40',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 22 },
  content: { flex: 1 },
  notifTitle: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  notifTitleUnread: {
    fontFamily: FONT_FAMILY.bodySemi,
    color: COLORS.textPrimary,
  },
  notifBody: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: FONT_SIZE.sm * 1.5,
    marginBottom: 5,
  },
  notifTime: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
  },
});

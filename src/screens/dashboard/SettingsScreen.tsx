import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { notificationPreferencesService } from '../../services/notification-preferences.service';

interface SettingItem {
  icon: string;
  label: string;
  description?: string;
  type: 'toggle' | 'link' | 'destructive';
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

type NotifPrefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  assignment_reminders: boolean;
  grade_notifications: boolean;
  announcement_notifications: boolean;
  discussion_replies: boolean;
  marketing_emails: boolean;
};

const NOTIF_DEFAULTS: NotifPrefs = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  assignment_reminders: true,
  grade_notifications: true,
  announcement_notifications: true,
  discussion_replies: true,
  marketing_emails: false,
};

export default function SettingsScreen({ navigation }: any) {
  const { profile, signOut, loading: authLoading } = useAuth();
  const [notif, setNotif] = useState<NotifPrefs>(NOTIF_DEFAULTS);
  const prefsHydrating = useRef(true);
  const [darkMode, setDarkMode] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    prefsHydrating.current = true;
    (async () => {
      if (!profile?.id) {
        prefsHydrating.current = false;
        return;
      }
      try {
        const row = await notificationPreferencesService.getForUser(profile.id);
        if (cancelled) return;
        if (row) {
          setNotif({
            push_enabled: row.push_enabled ?? NOTIF_DEFAULTS.push_enabled,
            email_enabled: row.email_enabled ?? NOTIF_DEFAULTS.email_enabled,
            sms_enabled: row.sms_enabled ?? NOTIF_DEFAULTS.sms_enabled,
            assignment_reminders: row.assignment_reminders ?? NOTIF_DEFAULTS.assignment_reminders,
            grade_notifications: row.grade_notifications ?? NOTIF_DEFAULTS.grade_notifications,
            announcement_notifications: row.announcement_notifications ?? NOTIF_DEFAULTS.announcement_notifications,
            discussion_replies: row.discussion_replies ?? NOTIF_DEFAULTS.discussion_replies,
            marketing_emails: row.marketing_emails ?? NOTIF_DEFAULTS.marketing_emails,
          });
        } else {
          setNotif(NOTIF_DEFAULTS);
        }
      } catch {
        if (!cancelled) setNotif(NOTIF_DEFAULTS);
      } finally {
        if (!cancelled) prefsHydrating.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (prefsHydrating.current || !profile?.id) return;
    const t = setTimeout(() => {
      notificationPreferencesService.upsertForUser(profile.id, notif).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [notif, profile?.id]);

  const sendPasswordReset = async () => {
    const email = profile?.email?.trim().toLowerCase();
    if (!email) {
      Alert.alert('Missing email', 'This account does not have a valid email address.');
      return;
    }

    setResettingPassword(true);
    const { error } = await authService.resetPasswordForEmail(email);
    setResettingPassword(false);

    if (error) {
      Alert.alert('Reset failed', error.message);
      return;
    }

    Alert.alert('Reset link sent', `A password reset link has been sent to ${email}.`);
  };

  const confirmSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);

  const sections: SettingSection[] = [
    {
      title: 'Notifications',
      items: [
        {
          icon: '🔔',
          label: 'Push Notifications',
          description: 'Receive alerts on your device',
          type: 'toggle',
          value: notif.push_enabled,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, push_enabled: v })),
        },
        {
          icon: '📧',
          label: 'Email Notifications',
          description: 'Get updates via email',
          type: 'toggle',
          value: notif.email_enabled,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, email_enabled: v })),
        },
        {
          icon: '💬',
          label: 'SMS (optional)',
          description: 'Text messages when enabled by your school',
          type: 'toggle',
          value: notif.sms_enabled,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, sms_enabled: v })),
        },
        {
          icon: '📋',
          label: 'Assignment reminders',
          description: 'Due dates and submission nudges',
          type: 'toggle',
          value: notif.assignment_reminders,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, assignment_reminders: v })),
        },
        {
          icon: '📊',
          label: 'Grade notifications',
          description: 'When work is graded',
          type: 'toggle',
          value: notif.grade_notifications,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, grade_notifications: v })),
        },
        {
          icon: '📣',
          label: 'Announcements',
          description: 'School-wide and role notices',
          type: 'toggle',
          value: notif.announcement_notifications,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, announcement_notifications: v })),
        },
        {
          icon: '💭',
          label: 'Discussion replies',
          description: 'Replies on course discussions',
          type: 'toggle',
          value: notif.discussion_replies,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, discussion_replies: v })),
        },
        {
          icon: '✨',
          label: 'Product updates',
          description: 'Tips and occasional marketing',
          type: 'toggle',
          value: notif.marketing_emails,
          onToggle: (v: boolean) => setNotif((p) => ({ ...p, marketing_emails: v })),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: '🌙',
          label: 'Dark Mode',
          description: 'Use dark color scheme',
          type: 'toggle',
          value: darkMode,
          onToggle: setDarkMode,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: '🔑',
          label: 'Change Password',
          description: resettingPassword ? 'Sending reset link...' : profile?.email ?? 'Uses your account email',
          type: 'link',
          onPress: () => Alert.alert('Change Password', 'A password reset link will be sent to ' + profile?.email, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send Link', onPress: sendPasswordReset },
          ]),
        },
        {
          icon: '🌐',
          label: 'Language',
          description: 'English',
          type: 'link',
          onPress: () => Alert.alert('Language', 'More languages coming soon.'),
        },
        {
          icon: '🛡️',
          label: 'Privacy & Data',
          type: 'link',
          onPress: () => Linking.openURL('https://rillcod.com/privacy-policy'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: '❓',
          label: 'Help Center',
          type: 'link',
          onPress: () => Linking.openURL('https://rillcod.com/faq'),
        },
        {
          icon: '💬',
          label: 'Contact Support',
          type: 'link',
          onPress: () => Linking.openURL('mailto:support@rillcod.com'),
        },
        {
          icon: '⭐',
          label: 'Rate the App',
          type: 'link',
          onPress: () => Alert.alert('Rate Us', 'Thank you for using Rillcod Academy!'),
        },
        {
          icon: '📋',
          label: 'Terms of Service',
          type: 'link',
          onPress: () => Linking.openURL('https://rillcod.com/terms-of-service'),
        },
      ],
    },
    {
      title: 'Danger Zone',
      items: [
        {
          icon: '🚪',
          label: 'Sign Out',
          description: authLoading ? 'Signing out...' : 'End this session on this device',
          type: 'destructive',
          onPress: confirmSignOut,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.header}
        >
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <Text style={styles.title}>Settings</Text>
        </MotiView>

        {/* Profile summary */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 80 }}
          style={styles.profileCard}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.full_name ?? 'User'}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: COLORS.primaryPale }]}>
            <Text style={styles.roleText}>{profile?.role}</Text>
          </View>
        </MotiView>

        {/* Settings sections */}
        {sections.map((section, si) => (
          <MotiView
            key={section.title}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 100 + si * 60 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.settingRow,
                    ii < section.items.length - 1 && styles.settingRowBorder,
                  ]}
                  onPress={item.type !== 'toggle' ? item.onPress : undefined}
                  activeOpacity={item.type !== 'toggle' ? 0.7 : 1}
                >
                  <Text style={styles.rowIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.rowLabel,
                      item.type === 'destructive' && { color: COLORS.error },
                    ]}>
                      {item.label}
                    </Text>
                    {item.description && (
                      <Text style={styles.rowDesc}>{item.description}</Text>
                    )}
                  </View>
                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={item.value ? COLORS.primaryLight : COLORS.textMuted}
                    />
                  )}
                  {item.type === 'link' && (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </MotiView>
        ))}

        <Text style={styles.version}>Rillcod Academy v1.0.0 · © 2025 Rillcod</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.primaryLight,
  },
  profileName: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  roleText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    gap: SPACING.md,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIcon: { fontSize: 20 },
  rowLabel: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  rowDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textMuted,
  },
  version: {
    textAlign: 'center',
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
});

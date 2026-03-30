import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

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

export default function SettingsScreen({ navigation }: any) {
  const { profile, signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  // AI config (admin only)
  const [aiKey, setAiKey] = useState('');
  const [aiKeyMasked, setAiKeyMasked] = useState(true);
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyLoaded, setAiKeyLoaded] = useState(false);
  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    if (!isStaff) return;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openrouter_api_key')
      .single()
      .then(({ data }) => {
        setAiKey(data?.value ?? '');
        setAiKeyLoaded(true);
      });
  }, [isAdmin]);

  const saveAiKey = async () => {
    const key = aiKey.trim();
    if (!key) { Alert.alert('Empty key', 'Please enter your OpenRouter API key.'); return; }
    setAiKeySaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'openrouter_api_key', value: key }, { onConflict: 'key' });
    setAiKeySaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'AI API key updated successfully.');
  };

  const sections: SettingSection[] = [
    {
      title: 'Notifications',
      items: [
        {
          icon: '🔔',
          label: 'Push Notifications',
          description: 'Receive alerts on your device',
          type: 'toggle',
          value: pushEnabled,
          onToggle: setPushEnabled,
        },
        {
          icon: '📧',
          label: 'Email Notifications',
          description: 'Get updates via email',
          type: 'toggle',
          value: emailEnabled,
          onToggle: setEmailEnabled,
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
          type: 'link',
          onPress: () => Alert.alert('Change Password', 'A password reset link will be sent to ' + profile?.email, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send Link', onPress: () => {} },
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
          type: 'destructive',
          onPress: () =>
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]),
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
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

        {/* AI Configuration — admin & teacher */}
        {isStaff && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 400 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>AI Configuration</Text>
            <View style={styles.sectionCard}>
              <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
                <Text style={styles.rowLabel}>OpenRouter API Key</Text>
                <Text style={[styles.rowDesc, { marginBottom: 4 }]}>
                  Required to power the AI Tutor, Content Creator, and Code Assistant.{'\n'}
                  Get your free key at openrouter.ai
                </Text>
                {!aiKeyLoaded ? (
                  <ActivityIndicator color={COLORS.primaryLight} size="small" />
                ) : (
                  <>
                    <View style={styles.aiKeyRow}>
                      <TextInput
                        style={styles.aiKeyInput}
                        value={aiKey}
                        onChangeText={setAiKey}
                        placeholder="sk-or-v1-..."
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry={aiKeyMasked}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity onPress={() => setAiKeyMasked(v => !v)} style={styles.aiKeyToggle}>
                        <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>{aiKeyMasked ? '👁' : '🙈'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.saveKeyBtn, aiKeySaving && { opacity: 0.6 }]}
                      onPress={saveAiKey}
                      disabled={aiKeySaving}
                    >
                      {aiKeySaving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.saveKeyText}>Save API Key</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </MotiView>
        )}

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
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
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
  aiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  aiKeyInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  aiKeyToggle: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  saveKeyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveKeyText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: '#fff',
  },
});

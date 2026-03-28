import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { PremiumInput } from '../../components/ui/PremiumInput';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Administrator', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  teacher: { label: 'Instructor',    color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
  student: { label: 'Student',       color: COLORS.primaryLight, bg: COLORS.primaryPale },
  school:  { label: 'School Partner',color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
};

export default function ProfileScreen({ navigation }: any) {
  const { profile, signOut, refreshProfile } = useAuth();
  const { success: hapticSuccess, error: hapticError, light } = useHaptics();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  const badge = ROLE_BADGE[profile?.role ?? 'student'] ?? ROLE_BADGE.student;
  const initials = (profile?.full_name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to update your profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploadingPhoto(true);
      await light();

      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `avatar_${profile?.id}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase
        .from('portal_users')
        .update({ profile_image_url: urlData.publicUrl })
        .eq('id', profile!.id);

      await refreshProfile();
      await hapticSuccess();
      Alert.alert('Photo Updated', 'Your profile photo has been updated successfully.');
    } catch (err: any) {
      await hapticError();
      Alert.alert('Upload Failed', err.message || 'Could not update photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Full name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('portal_users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile!.id);

      if (error) throw error;
      await refreshProfile();
      await hapticSuccess();
      setEditing(false);
    } catch (err: any) {
      await hapticError();
      Alert.alert('Save Failed', err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
    setBio(profile?.bio ?? '');
    setEditing(false);
    light();
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => { await hapticError(); signOut(); },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <LinearGradient
          colors={['#1a0505', '#2d0a0a', COLORS.bg]}
          style={styles.hero}
        >
          {/* Glow orb */}
          <MotiView
            from={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{ type: 'timing', duration: 800 }}
            style={styles.heroGlow}
          />

          {/* Avatar */}
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 100 }}
            style={styles.avatarContainer}
          >
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} disabled={uploadingPhoto}>
              <View style={styles.avatarRing}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryMid, '#2d0a0a']}
                  style={StyleSheet.absoluteFill}
                />
                {profile?.profile_image_url ? (
                  <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* Camera badge */}
              <MotiView
                animate={{ scale: uploadingPhoto ? [1, 1.15, 1] : 1 }}
                transition={{ type: 'timing', loop: uploadingPhoto }}
                style={styles.cameraBadge}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14 }}>📷</Text>
                )}
              </MotiView>
            </TouchableOpacity>
          </MotiView>

          {/* Name & role */}
          <MotiText
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 200 }}
            style={styles.heroName}
          >
            {profile?.full_name ?? 'User'}
          </MotiText>

          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 320 }}
            style={[styles.roleBadge, { backgroundColor: badge.bg }]}
          >
            <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </MotiView>

          {profile?.school_name && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', delay: 420 }}
              style={styles.schoolRow}
            >
              <Text style={styles.schoolText}>🏫 {profile.school_name}</Text>
            </MotiView>
          )}
        </LinearGradient>

        {/* Status chip */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', delay: 480 }}
          style={styles.statusChipRow}
        >
          <View style={[
            styles.statusChip,
            { backgroundColor: profile?.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)' },
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: profile?.is_active ? '#34d399' : '#f59e0b' },
            ]} />
            <Text style={[styles.statusText, { color: profile?.is_active ? '#34d399' : '#f59e0b' }]}>
              {profile?.is_active ? 'Account Active' : 'Pending Approval'}
            </Text>
          </View>
        </MotiView>

        {/* Info / Edit Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', delay: 540 }}
          style={styles.card}
        >
          <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cardInner}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('profile.info')}</Text>
              {!editing && (
                <TouchableOpacity
                  onPress={() => { setEditing(true); light(); }}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>✏️ {t('profile.edit')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <>
                <PremiumInput
                  label={t('fields.fullName')}
                  icon="👤"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  autoCapitalize="words"
                />
                <PremiumInput
                  label={t('fields.phone')}
                  icon="📱"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+234 800 000 0000"
                  keyboardType="phone-pad"
                />
                <PremiumInput
                  label={t('profile.bio')}
                  icon="📝"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself..."
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.editActions}>
                  <View style={{ flex: 1 }}>
                    <PremiumButton
                      label={t('common.save')}
                      onPress={saveProfile}
                      loading={saving}
                      disabled={saving}
                    />
                  </View>
                  <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {[
                  { icon: '✉️', label: t('fields.email'), value: profile?.email },
                  { icon: '📱', label: t('fields.phone'), value: profile?.phone || '—' },
                  { icon: '📝', label: t('profile.bio'), value: profile?.bio || '—' },
                ].map((row, i, arr) => (
                  <View key={i} style={[styles.infoRow, i < arr.length - 1 && styles.infoRowBorder]}>
                    <Text style={styles.infoIcon}>{row.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={styles.infoValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </MotiView>

        {/* Quick links */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', delay: 640 }}
          style={styles.card}
        >
          <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cardInner}>
            <Text style={styles.cardTitle}>{t('profile.account')}</Text>
            {[
              { icon: '🔔', label: t('profile.notifications'), onPress: () => navigation?.navigate('Settings') },
              { icon: '🌍', label: t('profile.language'), onPress: () => navigation?.navigate('Settings') },
              { icon: '🔒', label: t('profile.changePassword'), onPress: () => navigation?.navigate('Settings') },
              { icon: '📋', label: t('profile.terms'), onPress: () => navigation?.navigate('Settings') },
              { icon: '⭐', label: t('profile.rateApp'), onPress: () => navigation?.navigate('Settings') },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={i}
                onPress={() => { item.onPress(); light(); }}
                activeOpacity={0.7}
                style={[styles.linkRow, i < arr.length - 1 && styles.infoRowBorder]}
              >
                <Text style={styles.linkIcon}>{item.icon}</Text>
                <Text style={styles.linkLabel}>{item.label}</Text>
                <Text style={styles.linkChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </MotiView>

        {/* Sign Out */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', delay: 720 }}
          style={{ paddingHorizontal: SPACING.xl, paddingBottom: 48 }}
        >
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(122,6,6,0.2)', 'rgba(122,6,6,0.1)']}
              style={styles.signOutGrad}
            >
              <Text style={styles.signOutText}>🚪 {t('profile.signOut')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.version}>Rillcod Academy v1.0.0 · © 2026 Rillcod Technologies Ltd.</Text>
        </MotiView>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: SPACING['2xl'],
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primaryGlow,
  },
  avatarContainer: { marginBottom: SPACING.base },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    overflow: 'hidden',
    ...SHADOW.glow(COLORS.primaryGlow),
  },
  avatar: { width: 94, height: 94, borderRadius: 47 },
  avatarFallback: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  heroName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  roleBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginBottom: 8,
  },
  roleBadgeText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  schoolRow: { marginTop: 4 },
  schoolText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  statusChipRow: {
    alignItems: 'center',
    marginTop: -SPACING.base,
    marginBottom: SPACING.base,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
  },
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.base,
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.md,
  },
  cardInner: { padding: SPACING.lg },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  editBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    backgroundColor: COLORS.primaryPale,
    borderRadius: RADIUS.full,
  },
  editBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryLight,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoIcon: { fontSize: 18, marginTop: 1 },
  infoLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  editActions: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  linkIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  linkLabel: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  linkChevron: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textMuted,
  },
  signOutBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(122,6,6,0.4)',
    marginBottom: SPACING.lg,
  },
  signOutGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.base,
  },
  signOutText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: '#ef4444',
    letterSpacing: LETTER_SPACING.wide,
  },
  version: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    opacity: 0.4,
  },
});

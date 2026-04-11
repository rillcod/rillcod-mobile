import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { dashboardService } from '../../services/dashboard.service';
import { assignmentService } from '../../services/assignment.service';
import { gamificationService } from '../../services/gamification.service';
import { schoolService } from '../../services/school.service';
import { studentService } from '../../services/student.service';
import { teacherService } from '../../services/teacher.service';
import { courseService } from '../../services/course.service';
import { badgeService } from '../../services/badge.service';
import { uploadToR2, mimeFromExt } from '../../lib/r2';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { PremiumInput } from '../../components/ui/PremiumInput';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import { ROUTES, type StackRouteName } from '../../navigation/routes';
import { IconBackButton } from '../../components/ui/IconBackButton';

type EarnedBadgeRow = { earned_at: string | null; badges: { name?: string | null } | null };

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Administrator', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  teacher: { label: 'Instructor',    color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)' },
  student: { label: 'Student',       color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  school:  { label: 'School Partner',color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
};

export default function ProfileScreen({ navigation }: any) {
  const { profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  const { success: hapticSuccess, error: hapticError, light } = useHaptics();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [stats, setStats] = useState<Array<{ label: string; value: string }>>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadgeRow[]>([]);
  const [pointHistory, setPointHistory] = useState<
    Array<{ id: string; points: number; activity_type: string; description: string | null; created_at: string | null }>
  >([]);

  const badge = ROLE_BADGE[profile?.role ?? 'student'] ?? ROLE_BADGE.student;
  const initials = (profile?.full_name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const quickActions = useMemo((): { label: string; route: StackRouteName }[] => {
    if (profile?.role === 'admin') {
      return [
        { label: 'Schools', route: ROUTES.Schools },
        { label: 'Programs', route: ROUTES.Programs },
        { label: 'Newsletters', route: ROUTES.Newsletters },
        { label: 'Messages', route: ROUTES.Messages },
      ];
    }
    if (profile?.role === 'teacher') {
      return [
        { label: 'Lessons', route: ROUTES.Lessons },
        { label: 'Assignments', route: ROUTES.Assignments },
        { label: 'Messages', route: ROUTES.Messages },
        { label: 'Reports', route: ROUTES.Reports },
      ];
    }
    if (profile?.role === 'school') {
      return [
        { label: 'Students', route: ROUTES.Students },
        { label: 'Teachers', route: ROUTES.Teachers },
        { label: 'Payments', route: ROUTES.Payments },
        { label: 'Messages', route: ROUTES.Messages },
      ];
    }
    if (profile?.role === 'student') {
      return [
        { label: 'Lessons', route: ROUTES.Lessons },
        { label: 'Assignments', route: ROUTES.Assignments },
        { label: 'Grades', route: ROUTES.Grades },
        { label: 'Messages', route: ROUTES.Messages },
      ];
    }
    return [
      { label: 'MyChildren', route: ROUTES.MyChildren },
      { label: 'Grades', route: ROUTES.ParentGrades },
      { label: 'Invoices', route: ROUTES.ParentInvoices },
      { label: 'Messages', route: ROUTES.Messages },
    ];
  }, [profile?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileStats() {
      if (!profile) {
        setStats([]);
        return;
      }

      try {
        if (profile.role === 'admin') {
          const stats = await dashboardService.getAdminStats(colors);
          if (!cancelled) setStats(stats.map(s => ({ label: s.label, value: String(s.value) })));
          return;
        }

        if (profile.role === 'teacher') {
          const { stats: teaStats } = await dashboardService.getTeacherDashboardData(profile.id, colors);
          if (!cancelled) setStats(teaStats.map(s => ({ label: s.label, value: String(s.value) })));
          return;
        }

        if (profile.role === 'school' && profile.school_id) {
          const stats = await dashboardService.getSchoolDashboardData(profile.school_id, colors);
          if (!cancelled) setStats(stats.map(s => ({ label: s.label, value: String(s.value) })));
          return;
        }

        if (profile.role === 'student') {
          const [progress, subsCount, points] = await Promise.all([
            courseService.listCourses({ role: 'student', userId: profile.id }),
            assignmentService.countSubmissionsForPortalUser(profile.id),
            gamificationService.getUserLevel(profile.id)
          ]);

          if (!cancelled) {
            setStats([
              { label: 'COURSES', value: String(progress.length) },
              { label: 'SUBMISSIONS', value: String(subsCount) },
              { label: 'LVL', value: String(points.level) },
              { label: 'XP', value: String(points.total_points) },
            ]);
          }
          return;
        }

        // Parent Logic
        const { stats: parStats } = await dashboardService.getParentDashboardData(profile.email || '', colors);
        if (!cancelled) setStats(parStats.map(s => ({ label: s.label, value: String(s.value) })));

      } catch (err) {
        console.error('Profile Stats Error:', err);
        if (!cancelled) setStats([]);
      }
    }

    loadProfileStats();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.id) {
        setEarnedBadges([]);
        return;
      }
      try {
        const rows = await badgeService.getPlayerBadges(profile.id);
        if (!cancelled) setEarnedBadges((rows ?? []) as EarnedBadgeRow[]);
      } catch {
        if (!cancelled) setEarnedBadges([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;
    if (profile?.role !== 'student' || !profile?.id) {
      setPointHistory([]);
      return;
    }
    (async () => {
      try {
        const rows = await gamificationService.listRecentPointTransactions(profile.id, 14);
        if (!cancelled) setPointHistory(rows);
      } catch {
        if (!cancelled) setPointHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.role, profile?.id]);

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
      const key = `avatars/avatar_${profile?.id}_${Date.now()}.${ext}`;
      const contentType = mimeFromExt(ext);

      const publicUrl = await uploadToR2(asset.uri, key, contentType);

      await studentService.updateStudent(profile!.id, { profile_image_url: publicUrl });

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
      await studentService.updateStudent(profile!.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      });
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
          onPress: () => {
            void light();
            // Defer past Alert dismissal so navigation/auth state updates reliably (esp. Android).
            setTimeout(() => {
              void signOut();
            }, 0);
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero Header */}
        <LinearGradient
          colors={isDark ? ['#050505', '#0a0a0a', colors.bg] : ['#f1f5f9', '#f8fafc', colors.bg]}
          style={styles.hero}
        >
          {typeof navigation?.canGoBack === 'function' && navigation.canGoBack() ? (
            <IconBackButton
              onPress={() => navigation.goBack()}
              color={colors.textPrimary}
              style={styles.heroBack}
            />
          ) : null}
          {/* Ambient Glow */}
          <MotiView
            from={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.15, scale: 1.2 }}
            transition={{ type: 'timing', duration: 1500, loop: true }}
            style={[styles.heroGlow, { backgroundColor: colors.primary }]}
          />

          {/* Avatar Section */}
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 100 }}
            style={styles.avatarContainer}
          >
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} disabled={uploadingPhoto}>
              <View style={styles.avatarRing}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryMid, colors.border]}
                  style={StyleSheet.absoluteFill}
                />
                {profile?.profile_image_url ? (
                  <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarInitials, { color: '#fff' }]}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* Camera badge */}
              <MotiView
                animate={{ scale: uploadingPhoto ? [1, 1.15, 1] : 1 }}
                transition={{ type: 'timing', loop: uploadingPhoto }}
                style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.bg }]}
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
            style={[styles.heroName, { color: colors.textPrimary }]}
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
              <Text style={[styles.schoolText, { color: colors.textMuted }]}>🏫 {profile.school_name}</Text>
            </MotiView>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Status chip */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 480 }}
            style={styles.statusChipRow}
          >
            <View style={[
              styles.statusChip,
              { backgroundColor: profile?.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(249,115,22,0.1)' },
              { borderColor: profile?.is_active ? 'rgba(52,211,153,0.2)' : 'rgba(249,115,22,0.2)' },
              { borderWidth: 1 }
            ]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: profile?.is_active ? '#34d399' : '#f97316' },
              ]} />
              <Text style={[styles.statusText, { color: profile?.is_active ? '#34d399' : '#f97316' }]}>
                {profile?.is_active ? 'Account Verified' : 'Pending Approval'}
              </Text>
            </View>
          </MotiView>

          {stats.length ? (
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 520 }}
              style={styles.statsWrap}
            >
              {stats.map((item) => (
                <View key={item.label} style={[styles.statsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.statsValue, { color: colors.textPrimary }]}>{item.value}</Text>
                  <Text style={[styles.statsLabel, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </MotiView>
          ) : null}

          {earnedBadges.length > 0 ? (
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 540 }}
              style={styles.card}
            >
              <View style={styles.cardInner}>
                <Text style={[styles.cardTitle, { color: colors.textSecondary, marginBottom: SPACING.sm }]}>Badges</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {earnedBadges.map((row, bi) => {
                    const name = row.badges?.name ?? 'Badge';
                    return (
                      <View
                        key={`${bi}-${name}`}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: RADIUS.full,
                          backgroundColor: colors.primaryPale,
                          borderWidth: 1,
                          borderColor: colors.primaryGlow,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontFamily: FONT_FAMILY.bodyBold, fontSize: 10 }}>{name}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </MotiView>
          ) : null}

          {profile?.role === 'student' && pointHistory.length > 0 ? (
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 550 }}
              style={styles.card}
            >
              <View style={styles.cardInner}>
                <Text style={[styles.cardTitle, { color: colors.textSecondary, marginBottom: SPACING.sm }]}>Recent XP</Text>
                <View style={{ gap: 10 }}>
                  {pointHistory.map((row) => (
                    <View
                      key={row.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontFamily: FONT_FAMILY.bodySemi, fontSize: 12, color: colors.textPrimary }}>
                          {row.description || row.activity_type.replace(/_/g, ' ')}
                        </Text>
                        <Text style={{ fontFamily: FONT_FAMILY.body, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                          {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONT_FAMILY.display, fontSize: 14, color: colors.success }}>
                        +{row.points}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </MotiView>
          ) : null}

          <MotiView
            from={{ opacity: 0, translateY: 18 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 560 }}
            style={styles.card}
          >
            <View style={styles.cardInner}>
              <Text style={[styles.cardTitle, { color: colors.textSecondary, marginBottom: SPACING.md }]}>Quick Actions</Text>
              <View style={styles.quickGrid}>
                {quickActions.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.quickCard, { backgroundColor: colors.primaryPale, borderColor: colors.primaryGlow }]}
                    onPress={() => { navigation?.navigate(item.route); light(); }}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.quickLabel, { color: colors.primary }]}>{item.label.toUpperCase()}</Text>
                    <Text style={[styles.quickHint, { color: colors.textMuted }]}>Open workspace</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </MotiView>

          {/* Info / Edit Card */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 540 }}
            style={styles.card}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('profile.info')}</Text>
                {!editing && (
                  <TouchableOpacity
                    onPress={() => { setEditing(true); light(); }}
                    style={[styles.editBtn, { backgroundColor: colors.primary + '20' }]}
                  >
                    <Text style={[styles.editBtnText, { color: colors.primary }]}>✏️ {t('profile.edit')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editing ? (
                <View style={styles.editForm}>
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
                    <TouchableOpacity onPress={cancelEdit} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                      <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  {[
                    { icon: '✉️', label: t('fields.email'), value: profile?.email },
                    { icon: '📱', label: t('fields.phone'), value: profile?.phone || '—' },
                    { icon: '📝', label: t('profile.bio'), value: profile?.bio || '—' },
                  ].map((row, i, arr) => (
                    <View key={i} style={[styles.infoRow, i < arr.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                      <Text style={styles.infoIconText}>{row.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{row.label}</Text>
                        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </MotiView>

          {/* Quick links & Settings */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 640 }}
            style={styles.card}
          >
            <View style={styles.cardInner}>
              <Text style={[styles.cardTitle, { color: colors.textSecondary, marginBottom: SPACING.md }]}>{t('profile.account')}</Text>
              
              {/* Theme Toggle Button */}
              <View style={[styles.linkRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <Text style={styles.linkIconText}>{isDark ? '🌙' : '☀️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
                  <Text style={[styles.linkSublabel, { color: colors.textMuted }]}>Toggle visual experience</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={() => { toggleTheme(); light(); }}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={isDark ? colors.primary : '#f4f3f4'}
                />
              </View>

              {[
                { icon: '🔔', label: t('profile.notifications'), onPress: () => navigation?.navigate(ROUTES.Settings) },
                { icon: '🌍', label: t('profile.language'), onPress: () => navigation?.navigate(ROUTES.Settings) },
                { icon: '🔒', label: t('profile.changePassword'), onPress: () => navigation?.navigate(ROUTES.Settings) },
                { icon: '📋', label: t('profile.terms'), onPress: () => navigation?.navigate(ROUTES.Settings) },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { item.onPress(); light(); }}
                  activeOpacity={0.7}
                  style={[styles.linkRow, i < arr.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                >
                  <Text style={styles.linkIconText}>{item.icon}</Text>
                  <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.linkChevronText, { color: colors.textMuted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </MotiView>

          {/* Sign Out */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', delay: 720 }}
            style={styles.footer}
          >
            <TouchableOpacity onPress={handleSignOut} disabled={authLoading} style={[styles.signOutBtn, { borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1 }, authLoading && { opacity: 0.6 }]} activeOpacity={0.8}>
              <LinearGradient
                colors={['rgba(239,68,68,0.1)', 'transparent']}
                style={styles.signOutGrad}
              >
                <Text style={styles.signOutText}>🚪 {authLoading ? 'Signing Out...' : t('profile.signOut')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.version, { color: colors.textMuted }]}>
              Rillcod Academy v1.1.0 · Industrial OS-1
            </Text>
          </MotiView>
        </View>

      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: SPACING['2xl'],
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBack: {
    position: 'absolute',
    left: SPACING.md,
    top: Platform.OS === 'ios' ? 52 : 40,
    zIndex: 4,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.1,
  },
  avatarContainer: { marginBottom: SPACING.base },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    overflow: 'hidden',
  },
  avatar: { width: 98, height: 98, borderRadius: 49 },
  avatarFallback: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  heroName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    marginBottom: 6,
    textAlign: 'center',
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
  roleBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginBottom: 8,
  },
  roleBadgeText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs - 1,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  schoolRow: { marginTop: 4 },
  schoolText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
  },
  statusChipRow: {
    alignItems: 'center',
    marginTop: -SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  statsCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  statsValue: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    marginBottom: 4,
  },
  statsLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    letterSpacing: LETTER_SPACING.wider,
    textTransform: 'uppercase',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs - 1,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.bgCard,
    borderRadius: RADIUS.md, // Industrial / Sharp look from constants
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInner: { padding: SPACING.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quickCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  quickLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: 6,
  },
  quickHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.ultra,
  },
  editBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  editBtnText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  infoIconText: { fontSize: 20, marginTop: 2 },
  infoLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.widest,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.md,
  },
  editForm: { gap: SPACING.md },
  editActions: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  linkIconText: { fontSize: 20, width: 28, textAlign: 'center' },
  linkLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.base,
  },
  linkSublabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    marginTop: 1,
  },
  linkChevronText: {
    fontSize: 24,
    fontWeight: '300',
  },
  footer: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  signOutBtn: {
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  signOutGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  signOutText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.base,
    color: '#ef4444',
    letterSpacing: LETTER_SPACING.widest,
    textTransform: 'uppercase',
  },
  version: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 9,
    textAlign: 'center',
    opacity: 0.5,
    letterSpacing: 1,
  },
});

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { PremiumInput } from '../../components/ui/PremiumInput';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Register'> };

const ENROLLMENT_OPTIONS = [
  { value: 'in_person', emoji: '🏫', label: t('enrollment.in_person'), desc: 'Attend our physical centre' },
  { value: 'online', emoji: '💻', label: t('enrollment.online'), desc: 'Learn from anywhere' },
  { value: 'school', emoji: '🤝', label: t('enrollment.school'), desc: 'Via school partnership' },
  { value: 'bootcamp', emoji: '⚡', label: t('enrollment.bootcamp'), desc: 'Intensive short program' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { success: hapticSuccess, error: hapticError, light } = useHaptics();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [enrollmentType, setEnrollmentType] = useState('in_person');
  const [schoolName, setSchoolName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [courseInterest, setCourseInterest] = useState('');

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password || password.length < 6) e.password = 'Min. 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const goNext = async () => {
    if (!validateStep1()) { await hapticError(); return; }
    await light();
    setStep(2);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (authErr || !authData.user) {
        await hapticError();
        Alert.alert('Registration Failed', authErr?.message || 'Could not create account.');
        return;
      }

      const uid = authData.user.id;

      await Promise.all([
        supabase.from('portal_users').insert({
          id: uid,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role: 'student',
          phone: phone.trim() || null,
          enrollment_type: enrollmentType,
          school_name: schoolName.trim() || null,
          is_active: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        supabase.from('students').insert({
          full_name: fullName.trim(),
          student_email: email.trim().toLowerCase(),
          parent_name: parentName.trim() || null,
          parent_phone: parentPhone.trim() || null,
          grade_level: gradeLevel.trim() || null,
          school_name: schoolName.trim() || null,
          course_interest: courseInterest.trim() || null,
          enrollment_type: enrollmentType,
          status: 'pending',
          user_id: uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ]);

      await hapticSuccess();
      Alert.alert(
        '🎉 Registration Complete!',
        'Your Rillcod account has been submitted. You will receive a confirmation once approved.',
        [{ text: 'Sign In', onPress: () => navigation.replace('Login') }]
      );
    } catch (err: any) {
      await hapticError();
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      <View style={styles.glow} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => step === 2 ? setStep(1) : navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>{step === 2 ? t('auth.back') : t('auth.toLogin')}</Text>
            </TouchableOpacity>

            <Text style={styles.pageTitle}>
              {step === 1 ? t('auth.registerTitle') : t('auth.step2')}
            </Text>
            <Text style={styles.pageSub}>
              {step === 1 ? t('auth.registerSub') : 'Tell us about your enrollment'}
            </Text>

            {/* Step progress bar */}
            <View style={styles.progressTrack}>
              <MotiView
                animate={{ width: `${step * 50}%` }}
                transition={{ type: 'spring', damping: 20 }}
                style={styles.progressFill}
              />
            </View>
            <Text style={styles.stepLabel}>
              {t('auth.stepOf').replace('{n}', String(step))} — {step === 1 ? t('auth.step1') : t('auth.step2')}
            </Text>
          </View>

          {/* Card */}
          <MotiView
            key={`step-${step}`}
            from={{ opacity: 0, translateX: step === 1 ? -30 : 30 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            style={styles.card}
          >
            <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>

              {step === 1 ? (
                <>
                  <PremiumInput label={t('fields.fullName')} icon="👤" value={fullName} onChangeText={setFullName} placeholder="e.g. Chioma Okafor" autoCapitalize="words" error={errors.fullName} />
                  <PremiumInput label={t('fields.email')} icon="✉️" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} />
                  <PremiumInput label={`${t('fields.phone')} ${t('fields.optional')}`} icon="📱" value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboardType="phone-pad" />
                  <PremiumInput label={t('fields.password')} icon="🔐" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secure error={errors.password} />
                  <PremiumInput label={t('fields.confirmPassword')} icon="🔑" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" secure error={errors.confirmPassword} />
                  <PremiumButton label={t('auth.next')} onPress={goNext} />
                </>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>{t('fields.enrollmentType')}</Text>
                  <View style={styles.enrollGrid}>
                    {ENROLLMENT_OPTIONS.map(opt => {
                      const active = enrollmentType === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => { setEnrollmentType(opt.value); light(); }}
                          activeOpacity={0.8}
                          style={{ width: '48%' }}
                        >
                          <MotiView
                            animate={{
                              borderColor: active ? COLORS.primary : COLORS.border,
                              backgroundColor: active ? COLORS.primaryPale : COLORS.bgCard,
                              scale: active ? 1.02 : 1,
                            }}
                            transition={{ type: 'timing', duration: 180 }}
                            style={styles.enrollCard}
                          >
                            <Text style={styles.enrollEmoji}>{opt.emoji}</Text>
                            <Text style={[styles.enrollLabel, active && styles.enrollLabelActive]}>{opt.label}</Text>
                            <Text style={styles.enrollDesc}>{opt.desc}</Text>
                          </MotiView>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <PremiumInput label={t('fields.schoolName')} icon="🏫" value={schoolName} onChangeText={setSchoolName} placeholder="e.g. Rillcod Academy" />
                  <PremiumInput label={t('fields.gradeLevel')} icon="📚" value={gradeLevel} onChangeText={setGradeLevel} placeholder="e.g. JSS 2 / Grade 9" />
                  <PremiumInput label={t('fields.courseInterest')} icon="🧠" value={courseInterest} onChangeText={setCourseInterest} placeholder="e.g. Python, Robotics, AI" />
                  <PremiumInput label={t('fields.parentName')} icon="👨‍👩‍👧" value={parentName} onChangeText={setParentName} placeholder="Parent/Guardian full name" />
                  <PremiumInput label={t('fields.parentPhone')} icon="📞" value={parentPhone} onChangeText={setParentPhone} placeholder="+234 800 000 0000" keyboardType="phone-pad" />

                  <PremiumButton label={t('auth.register')} onPress={handleRegister} loading={loading} disabled={loading} />
                </>
              )}
            </View>
          </MotiView>

          <Text style={styles.footer}>© 2026 Rillcod Technologies Ltd.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.primaryGlow,
    opacity: 0.5,
  },
  scroll: { flexGrow: 1, padding: SPACING.xl, paddingTop: Platform.OS === 'ios' ? 70 : 50 },
  header: { marginBottom: SPACING.xl },
  backBtn: { marginBottom: SPACING.base },
  backText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryLight,
    letterSpacing: LETTER_SPACING.wide,
  },
  pageTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  pageSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.base,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.full,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  stepLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.md,
  },
  cardInner: { padding: SPACING.xl },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: SPACING.md,
  },
  enrollGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SPACING.lg },
  enrollCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
  },
  enrollEmoji: { fontSize: 24, marginBottom: 2 },
  enrollLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  enrollLabelActive: { color: COLORS.primaryLight },
  enrollDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
  footer: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xl,
    opacity: 0.5,
  },
});

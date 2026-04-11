import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { PremiumInput } from '../../components/ui/PremiumInput';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ROUTES } from '../../navigation/routes';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

const PLATFORM_PILLS = ['STEM Robotics', 'Digital Learning', 'School LMS'] as const;

export default function LoginScreen({ navigation }: Props) {
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const updateEmail = (value: string) => {
    setEmail(value);
    setErrors(prev => ({ ...prev, email: undefined, password: undefined }));
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setErrors(prev => ({ ...prev, password: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      setErrors({ password: error });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <OfflineBanner />

      {/* Top accent bar */}
      <LinearGradient
        colors={COLORS.gradPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentBar}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Header — logo + name + platform pills */}
          <MotiView
            from={{ opacity: 0, translateY: -16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 80, damping: 18 }}
            style={styles.header}
          >
            <View style={styles.logoRow}>
              <View style={styles.logoWrap}>
                <Image
                  source={require('../../../assets/rillcod-icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandName}>{t('app.loginBrandName')}</Text>
                <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
              </View>
            </View>

            <View style={styles.pillRow}>
              {PLATFORM_PILLS.map((pill) => (
                <View key={pill} style={styles.pill}>
                  <Text style={styles.pillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </MotiView>

          {/* Sign-in card */}
          <MotiView
            from={{ opacity: 0, translateY: 24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 200, damping: 20 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sign In to Your Portal</Text>
              <Text style={styles.cardSub}>Access your dashboard with your assigned credentials</Text>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardBody}>
              <PremiumInput
                label="Email Address"
                value={email}
                onChangeText={updateEmail}
                placeholder="name@institution.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                error={errors.email}
              />

              <PremiumInput
                label="Password"
                value={password}
                onChangeText={updatePassword}
                placeholder="Enter your password"
                secure
                autoComplete="password"
                error={errors.password}
              />

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => navigation.navigate(ROUTES.ForgotPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <PremiumButton
                label={t('auth.signIn')}
                onPress={handleLogin}
                loading={loading || authLoading}
                disabled={loading || authLoading}
              />
            </View>
          </MotiView>

          {/* Registration section */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', delay: 380, duration: 400 }}
            style={styles.registerSection}
          >
            <View style={styles.registerDividerRow}>
              <View style={styles.registerLine} />
              <Text style={styles.registerDividerText}>New to Rillcod?</Text>
              <View style={styles.registerLine} />
            </View>

            <View style={styles.registerCards}>
              <TouchableOpacity
                style={styles.regCard}
                onPress={() => navigation.navigate(ROUTES.PublicStudentRegistration)}
                activeOpacity={0.82}
              >
                <LinearGradient
                  colors={[COLORS.student + '18', COLORS.student + '08']}
                  style={styles.regCardGrad}
                >
                  <View style={[styles.regCardIcon, { backgroundColor: COLORS.student + '20' }]}>
                    <Text style={[styles.regCardIconText, { color: COLORS.student }]}>S</Text>
                  </View>
                  <Text style={[styles.regCardLabel, { color: COLORS.student }]}>Student Enrolment</Text>
                  <Text style={styles.regCardDesc}>Register as a learner</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.regCard}
                onPress={() => navigation.navigate(ROUTES.PublicSchoolRegistration)}
                activeOpacity={0.82}
              >
                <LinearGradient
                  colors={[COLORS.school + '18', COLORS.school + '08']}
                  style={styles.regCardGrad}
                >
                  <View style={[styles.regCardIcon, { backgroundColor: COLORS.school + '20' }]}>
                    <Text style={[styles.regCardIconText, { color: COLORS.school }]}>P</Text>
                  </View>
                  <Text style={[styles.regCardLabel, { color: COLORS.school }]}>School Partnership</Text>
                  <Text style={styles.regCardDesc}>Partner with Rillcod</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* Trust strip */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', delay: 520, duration: 400 }}
            style={styles.trustStrip}
          >
            {[
              { label: 'SSL Secured', detail: '256-bit encryption' },
              { label: 'ISO Compliant', detail: 'Data privacy' },
              { label: 'Always-On', detail: '99.9% uptime' },
            ].map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <View style={styles.trustDot} />
                <View>
                  <Text style={styles.trustLabel}>{item.label}</Text>
                  <Text style={styles.trustDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </MotiView>

          <Text style={styles.footer}>© 2026 Rillcod Technologies Ltd. · All rights reserved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING['2xl'],
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: SPACING['3xl'],
  },

  /* ── Header ── */
  header: {
    marginBottom: SPACING['2xl'],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    marginBottom: SPACING.md,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    padding: 4,
    ...SHADOW.sm,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
  brandTagline: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  pill: {
    backgroundColor: COLORS.primaryPale,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    letterSpacing: LETTER_SPACING.wide,
  },

  /* ── Sign-in card ── */
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING['2xl'],
    ...SHADOW.md,
  },
  cardHeader: {
    padding: SPACING['2xl'],
    paddingBottom: SPACING.lg,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.sm * 1.6,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING['2xl'],
  },
  cardBody: {
    padding: SPACING['2xl'],
    paddingTop: SPACING.xl,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: SPACING.xl,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },

  /* ── Registration section ── */
  registerSection: {
    marginBottom: SPACING['2xl'],
  },
  registerDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  registerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  registerDividerText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  registerCards: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  regCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regCardGrad: {
    padding: SPACING.base,
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  regCardIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  regCardIconText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.md,
  },
  regCardLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    lineHeight: FONT_SIZE.sm * 1.4,
  },
  regCardDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  /* ── Trust strip ── */
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.xl,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  trustLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  trustDetail: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  footer: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    opacity: 0.6,
  },
});

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { BlurView } from 'expo-blur';
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

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
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
      Alert.alert('Sign In Failed', error.includes('Invalid') ? 'Incorrect email or password.' : error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      {/* Ambient glows */}
      <View style={[styles.glow1]} />
      <View style={[styles.glow2]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 100 }}
            style={styles.brand}
          >
            <View style={styles.logoWrap}>
              <Image source={require('../../../assets/rillcod-icon.png')} style={styles.logo} resizeMode="cover" />
            </View>
            <MotiText style={styles.brandName}>{t('app.name')}</MotiText>
            <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
          </MotiView>

          {/* Card */}
          <MotiView
            from={{ opacity: 0, translateY: 30 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 250, damping: 20 }}
            style={styles.card}
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>

              <Text style={styles.cardTitle}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.cardSub}>{t('auth.signInPortal')}</Text>

              <View style={styles.divider} />

              <PremiumInput
                label={t('fields.email')}
                icon="✉️"
                value={email}
                onChangeText={setEmail}
                placeholder="yourname@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
              />

              <PremiumInput
                label={t('fields.password')}
                icon="🔐"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secure
                error={errors.password}
              />

              <TouchableOpacity style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>

              <PremiumButton
                label={t('auth.signIn')}
                onPress={handleLogin}
                loading={loading || authLoading}
                disabled={loading || authLoading}
              />

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{t('auth.or')}</Text>
                <View style={styles.orLine} />
              </View>

              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                  style={styles.registerGrad}
                >
                  <Text style={styles.registerText}>{t('auth.createAccount')}</Text>
                  <Text style={styles.registerArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Public registration links */}
              <View style={styles.publicLinksWrap}>
                <Text style={styles.publicLinksTitle}>New to Rillcod?</Text>
                <View style={styles.publicLinksRow}>
                  <TouchableOpacity
                    style={styles.publicLinkBtn}
                    onPress={() => (navigation as any).navigate('PublicStudentRegistration')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.publicLinkEmoji}>🎓</Text>
                    <Text style={styles.publicLinkLabel}>Student{'\n'}Enrolment</Text>
                  </TouchableOpacity>
                  <View style={styles.publicLinkSep} />
                  <TouchableOpacity
                    style={styles.publicLinkBtn}
                    onPress={() => (navigation as any).navigate('PublicSchoolRegistration')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.publicLinkEmoji}>🏫</Text>
                    <Text style={styles.publicLinkLabel}>School{'\n'}Partnership</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </MotiView>

          {/* Trust badges */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', delay: 600 }}
            style={styles.trustRow}
          >
            {['🔒 Secure Login', '🌍 Global Platform', '🏆 Award-Winning'].map((b, i) => (
              <View key={i} style={styles.trustBadge}>
                <Text style={styles.trustText}>{b}</Text>
              </View>
            ))}
          </MotiView>

          <Text style={styles.footer}>© 2026 Rillcod Technologies Ltd.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  glow1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.primaryGlow,
    opacity: 0.6,
  },
  glow2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(91,33,182,0.1)',
    opacity: 0.8,
  },
  scroll: { flexGrow: 1, padding: SPACING.xl, paddingTop: Platform.OS === 'ios' ? 56 : 40 },
  brand: { alignItems: 'center', marginBottom: SPACING.xl },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOW.glow(COLORS.primaryGlow),
  },
  logo: { width: 80, height: 80 },
  brandName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.tight,
  },
  brandTagline: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.ultra,
    marginTop: 4,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.lg,
  },
  cardInner: { padding: SPACING.lg },
  cardTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -6, marginBottom: SPACING.lg },
  forgotText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryLight,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: SPACING.lg },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  registerBtn: { borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  registerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.base,
    gap: 8,
  },
  registerText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  registerArrow: { fontSize: FONT_SIZE.base, color: COLORS.primaryLight },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
  },
  trustBadge: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  footer: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.5,
  },
  publicLinksWrap: {
    marginTop: SPACING.base,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  publicLinksTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  publicLinksRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  publicLinkBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  publicLinkEmoji: { fontSize: 28 },
  publicLinkLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  publicLinkSep: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
});

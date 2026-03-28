import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import PremiumButton from '../../components/ui/PremiumButton';
import PremiumInput from '../../components/ui/PremiumInput';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'rillcod://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Back */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to Login</Text>
          </TouchableOpacity>

          {/* Logo mark */}
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16 }}
            style={styles.logoWrap}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>R</Text>
            </View>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 120 }}
            style={styles.content}
          >
            {!sent ? (
              <>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                <View style={styles.form}>
                  <PremiumInput
                    label="Email Address"
                    icon="✉️"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="your@email.com"
                  />

                  <PremiumButton
                    label="Send Reset Link"
                    onPress={handleReset}
                    loading={loading}
                    variant="primary"
                    size="lg"
                  />
                </View>
              </>
            ) : (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Link Sent!</Text>
                <Text style={styles.successText}>
                  We sent a password reset link to{'\n'}
                  <Text style={{ color: COLORS.primaryLight }}>{email}</Text>
                  {'\n\n'}Check your inbox and spam folder.
                </Text>
                <PremiumButton
                  label="Back to Login"
                  onPress={() => navigation.replace('Login')}
                  variant="secondary"
                  size="md"
                />
              </View>
            )}
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  backBtn: { paddingTop: SPACING.md, paddingBottom: SPACING.base },
  backText: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
  },
  logoWrap: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.lg },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  logoText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.white100,
  },
  content: { flex: 1 },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: FONT_SIZE.base * 1.6,
    marginBottom: SPACING['2xl'],
  },
  form: { gap: SPACING.base },
  successBox: {
    alignItems: 'center',
    gap: SPACING.base,
    marginTop: SPACING.xl,
  },
  successIcon: { fontSize: 60, marginBottom: SPACING.sm },
  successTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
  },
  successText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: FONT_SIZE.base * 1.6,
    marginBottom: SPACING.base,
  },
});

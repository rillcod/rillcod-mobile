import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { IconBackButton } from './IconBackButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: { label: string; onPress: () => void; color?: string };
  showLogo?: boolean;
  accentColor?: string;
}

export function ScreenHeader({ title, subtitle, onBack, rightAction, showLogo = false, accentColor }: Props) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const resolvedAccent = accentColor ?? colors.primary;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['rgba(240,138,75,0.16)', 'rgba(23,27,34,0)'] : ['rgba(198,93,46,0.12)', 'rgba(255,253,252,0)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.row}>
        {onBack ? (
          <IconBackButton onPress={onBack} color={colors.textPrimary} size={22} style={styles.backBtn} />
        ) : showLogo ? (
          <View style={styles.logoWrap}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
        ) : null}

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {rightAction ? (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={[styles.rightBtn, { borderColor: (rightAction.color ?? resolvedAccent) + '40', backgroundColor: (rightAction.color ?? resolvedAccent) + '14' }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.rightBtnText, { color: rightAction.color ?? resolvedAccent }]}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : <View style={styles.rightPlaceholder} />}
      </View>

      <View style={[styles.accentLine, { backgroundColor: resolvedAccent }]} />
    </View>
  );
}

const getStyles = (colors: { bgCard: string; border: string; textPrimary: string; textMuted: string; borderLight: string }, isDark: boolean) => StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.xs,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  logo: { width: 34, height: 34 },
  titleWrap: { flex: 1 },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: colors.textPrimary,
    letterSpacing: LETTER_SPACING.tight,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: colors.textMuted,
    marginTop: 3,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
  rightBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexShrink: 0,
  },
  rightBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
  },
  rightPlaceholder: { width: 36 },
  accentLine: {
    height: 2,
    width: 42,
    borderRadius: 1,
    marginTop: 4,
  },
});

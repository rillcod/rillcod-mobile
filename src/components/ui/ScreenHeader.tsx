import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
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

export function ScreenHeader({ title, subtitle, onBack, rightAction, showLogo = false, accentColor = COLORS.primary }: Props) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(122,6,6,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : showLogo ? (
          <View style={styles.logoWrap}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={styles.logo} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {rightAction ? (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={[styles.rightBtn, { borderColor: (rightAction.color ?? accentColor) + '50', backgroundColor: (rightAction.color ?? accentColor) + '15' }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.rightBtnText, { color: rightAction.color ?? accentColor }]}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : <View style={styles.rightPlaceholder} />}
      </View>

      <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 0 : SPACING.xs,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backArrow: { fontSize: 18, color: COLORS.textPrimary, lineHeight: 22 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  logo: { width: 36, height: 36 },
  titleWrap: { flex: 1 },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: LETTER_SPACING.wide,
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
    width: 32,
    borderRadius: 1,
    marginTop: 2,
  },
});

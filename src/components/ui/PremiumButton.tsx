import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { RADIUS, SHADOW } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

interface PremiumButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const GRADIENTS = {
  primary: COLORS.gradPrimary,
  secondary: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as string[],
  ghost: ['transparent', 'transparent'] as string[],
  gold: COLORS.gradGold,
};

export function PremiumButton({
  label, onPress, loading, disabled, variant = 'primary',
  size = 'lg', style, textStyle, icon,
}: PremiumButtonProps) {
  const { medium, success } = useHaptics();

  const handlePress = async () => {
    if (variant === 'primary') await medium();
    else await success();
    onPress();
  };

  const heights = { sm: 44, md: 50, lg: 58 };
  const fontSizes = { sm: FONT_SIZE.sm, md: FONT_SIZE.base, lg: FONT_SIZE.md };

  return (
    <MotiView
      animate={{ scale: disabled ? 0.98 : 1, opacity: disabled ? 0.55 : 1 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[styles.wrapper, style]}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={{ borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.glow(COLORS.primaryGlow) }}
      >
        <LinearGradient
          colors={GRADIENTS[variant] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.btn,
            { height: heights[size] },
            variant === 'secondary' && styles.btnSecondary,
            variant === 'ghost' && styles.btnGhost,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              {icon}
              <Text style={[
                styles.label,
                { fontSize: fontSizes[size] },
                variant === 'secondary' && styles.labelSecondary,
                variant === 'ghost' && styles.labelGhost,
                textStyle,
              ]}>
                {label}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  label: {
    color: COLORS.white100,
    fontFamily: FONT_FAMILY.display,
    letterSpacing: LETTER_SPACING.wide,
  },
  labelSecondary: { color: COLORS.textPrimary },
  labelGhost: { color: COLORS.primaryLight },
});

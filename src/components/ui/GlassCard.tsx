import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../constants/colors';
import { RADIUS, SHADOW } from '../../constants/spacing';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  noBorder?: boolean;
  glow?: string;
}

export function GlassCard({ children, style, intensity = 18, noBorder, glow }: GlassCardProps) {
  return (
    <View style={[
      styles.wrapper,
      !noBorder && styles.border,
      glow ? SHADOW.glow(glow) : SHADOW.sm,
      style,
    ]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  border: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

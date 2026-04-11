import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from './IconBackButton';

interface AdminCollectionHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  colors: {
    textPrimary: string;
    textMuted: string;
    textSecondary: string;
    border: string;
    bgCard: string;
    primary: string;
    white100: string;
  };
}

export function AdminCollectionHeader({
  title,
  subtitle,
  onBack,
  primaryAction,
  secondaryAction,
  colors,
}: AdminCollectionHeaderProps) {
  return (
    <View style={styles.header}>
      <IconBackButton
        onPress={onBack}
        color={colors.textPrimary}
        style={[styles.backBtn, { borderColor: colors.border }]}
      />

      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>

      <View style={styles.actionsWrap}>
        {secondaryAction ? (
          <TouchableOpacity onPress={secondaryAction.onPress} style={[styles.secondaryBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{secondaryAction.label}</Text>
          </TouchableOpacity>
        ) : null}

        {primaryAction ? (
          <TouchableOpacity onPress={primaryAction.onPress} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryBtnText, { color: colors.white100 }]}>{primaryAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
  },
  subtitle: {
    marginTop: 2,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    letterSpacing: LETTER_SPACING.wide,
    textTransform: 'uppercase',
  },
});

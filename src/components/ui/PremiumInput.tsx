import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, TextInputProps,
} from 'react-native';
import { MotiView } from 'moti';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS } from '../../constants/spacing';

interface PremiumInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: string;
  secure?: boolean;
  hint?: string;
}

export function PremiumInput({
  label, error, icon, secure, hint, style, ...rest
}: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {icon ? `${icon}  ` : ''}{label}
      </Text>

      <MotiView
        animate={{
          borderColor: error
            ? COLORS.error
            : focused
              ? COLORS.primaryMid
              : COLORS.border,
          backgroundColor: focused
            ? 'rgba(122,6,6,0.06)'
            : COLORS.bgCard,
        }}
        transition={{ type: 'timing', duration: 180 }}
        style={styles.inputWrap}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          selectionColor={COLORS.primaryLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure && !showPw}
          {...rest}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eye}>
            <Text style={styles.eyeText}>{showPw ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </MotiView>

      {error && (
        <MotiView
          from={{ opacity: 0, translateY: -4 }}
          animate={{ opacity: 1, translateY: 0 }}
        >
          <Text style={styles.error}>⚠ {error}</Text>
        </MotiView>
      )}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  eye: { paddingRight: 14, paddingLeft: 6 },
  eyeText: { fontSize: 16 },
  error: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: 6,
  },
  hint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 6,
  },
});

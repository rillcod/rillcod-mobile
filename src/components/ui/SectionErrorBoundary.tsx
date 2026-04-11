import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';

interface Props {
  children: React.ReactNode;
  sectionName?: string;
  /** Optional hook for crash reporting (non-blocking). */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

function SectionErrorFallback({
  sectionName,
  onRetry,
}: {
  sectionName?: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.bgCard,
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Section temporarily unavailable</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {sectionName
          ? `“${sectionName}” could not be displayed.`
          : 'This section could not be displayed.'}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Try loading this section again"
      >
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn(`SectionErrorBoundary(${this.props.sectionName ?? 'unknown'})`, error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SectionErrorFallback sectionName={this.props.sectionName} onRetry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    padding: SPACING.base,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  title: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
  },
  body: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.sm,
  },
  retryText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: '#fff',
  },
});

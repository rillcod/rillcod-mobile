import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type Role = 'admin' | 'teacher' | 'school' | 'student' | 'parent';

interface RoleGuardProps {
  allow: Role[];
  children: React.ReactNode;
  navigation?: any;
}

/**
 * RoleGuard — wraps screen content and shows an access-denied view
 * if the current user's role is not in the `allow` list.
 *
 * Usage:
 *   <RoleGuard allow={['admin']} navigation={navigation}>
 *     <AdminContent />
 *   </RoleGuard>
 */
export function RoleGuard({ allow, children, navigation }: RoleGuardProps) {
  const { profile } = useAuth();
  const role = profile?.role as Role | undefined;

  if (!role || !allow.includes(role)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.error} accessibilityLabel="Restricted" />
          </View>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.sub}>
            This section is available to {allow.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' / ')} accounts only.
          </Text>
          <Text style={styles.roleText}>
            Your current role: <Text style={styles.roleHighlight}>{role?.toUpperCase() ?? 'UNKNOWN'}</Text>
          </Text>
          {navigation && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: FONT_SIZE.sm * 1.6,
  },
  roleText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  roleHighlight: {
    fontFamily: FONT_FAMILY.bodySemi,
    color: COLORS.primary,
  },
  backBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING['2xl'],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  backBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: COLORS.white100,
  },
});

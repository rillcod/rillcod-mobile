import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface MenuItem {
  emoji: string;
  label: string;
  description: string;
  screen: string;
  params?: any;
  color: string;
  roles?: string[];
}

const MENU_SECTIONS = [
  {
    title: 'Academics',
    items: [
      { emoji: '📝', label: 'Assignments', description: 'View & submit assignments', screen: 'Assignments', color: COLORS.info, roles: ['student'] },
      { emoji: '📊', label: 'My Grades', description: 'Progress reports & scores', screen: 'Grades', color: COLORS.success, roles: ['student'] },
      { emoji: '🏆', label: 'Certificates', description: 'Your earned certificates', screen: 'Certificates', color: COLORS.gold, roles: ['student'] },
      { emoji: '🎯', label: 'Attendance', description: 'View attendance records', screen: 'Assignments', color: COLORS.warning, roles: ['student'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { emoji: '💰', label: 'Invoices', description: 'Fees & payment history', screen: 'Invoices', color: COLORS.warning },
    ],
  },
  {
    title: 'Communication',
    items: [
      { emoji: '💬', label: 'Messages', description: 'Chat with teachers & staff', screen: 'Messages', color: COLORS.info },
    ],
  },
  {
    title: 'Parent Portal',
    items: [
      { emoji: '👨‍👩‍👧‍👦', label: 'My Children', description: "View children's progress", screen: 'MyChildren', color: COLORS.accentLight, roles: ['parent'] },
    ],
  },
  {
    title: 'Account',
    items: [
      { emoji: '⚙️', label: 'Settings', description: 'App preferences & account', screen: 'Settings', color: COLORS.textSecondary },
    ],
  },
];

export default function MoreScreen({ navigation }: any) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';

  const visibleSections = MENU_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !item.roles || item.roles.includes(role)),
  })).filter(section => section.items.length > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.header}
        >
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle}>All features and tools</Text>
        </MotiView>

        {/* Sections */}
        {visibleSections.map((section, si) => (
          <MotiView
            key={section.title}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: si * 60 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => navigation.navigate(item.screen, item.params)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.color + '22' }]}>
                    <Text style={styles.icon}>{item.emoji}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDesc} numberOfLines={1}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </MotiView>
        ))}

        {/* Branding footer */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 500 }}
          style={styles.brandFooter}
        >
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>R</Text>
          </View>
          <Text style={styles.brandName}>Rillcod Academy</Text>
          <Text style={styles.brandTagline}>Empowering Future Leaders Through Code</Text>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  section: {
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  menuItem: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.xs + 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  icon: { fontSize: 22 },
  menuLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  menuDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  brandFooter: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  brandLogo: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  brandLogoText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.white100,
  },
  brandName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
  },
  brandTagline: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { getPortalSectionsForRole, type PortalMenuItem } from '../../config/portalSections';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  teacher: 'Teacher Workspace',
  school: 'School Partner',
  student: 'Student Workspace',
  parent: 'Parent Portal',
};

export default function MoreScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [search, setSearch] = React.useState('');

  const role = profile?.role ?? 'student';
  const sections = getPortalSectionsForRole(role);
  const query = search.trim().toLowerCase();

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!query) return true;
        return item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
      }),
    }))
    .filter((section) => section.items.length > 0);

  const featuredItems = filteredSections.flatMap((section) => section.items.filter((item) => item.featured)).slice(0, 4);
  const totalItems = filteredSections.reduce((count, section) => count + section.items.length, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0, translateY: -12 }} animate={{ opacity: 1, translateY: 0 }} style={styles.hero}>
          <LinearGradient colors={['rgba(244,164,98,0.12)', 'rgba(244,164,98,0.03)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>Workspace Hub</Text>
              <Text style={styles.title}>Everything in one place.</Text>
              <Text style={styles.subtitle}>{ROLE_LABELS[role] ?? 'Portal'} with organized access to tools, reports, communication, and setup.</Text>
            </View>
            <View style={styles.rolePill}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{ROLE_LABELS[role] ?? 'Portal'}</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>Search</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Find a tool or page"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearBtn}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{filteredSections.length}</Text>
              <Text style={styles.metaLabel}>Sections</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{totalItems}</Text>
              <Text style={styles.metaLabel}>Tools</Text>
            </View>
          </View>
        </MotiView>

        {featuredItems.length > 0 && (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Top Actions</Text>
              <Text style={styles.blockHint}>Most used</Text>
            </View>
            <View style={styles.featuredGrid}>
              {featuredItems.map((item, index) => (
                <PortalCard key={`${item.screen}-${index}`} item={item} onPress={() => navigation.navigate(item.screen)} featured />
              ))}
            </View>
          </View>
        )}

        {filteredSections.map((section, sectionIndex) => (
          <MotiView
            key={section.title}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 80 + sectionIndex * 60 }}
            style={styles.block}
          >
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{section.title}</Text>
              <Text style={styles.blockHint}>{section.items.length} items</Text>
            </View>
            <View style={styles.listWrap}>
              {section.items.map((item, itemIndex) => (
                <PortalRow key={`${item.screen}-${itemIndex}`} item={item} onPress={() => navigation.navigate(item.screen)} />
              ))}
            </View>
          </MotiView>
        ))}

        {filteredSections.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyText}>Try a different keyword or clear the search to view your full workspace.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PortalCard({ item, onPress, featured = false }: { item: PortalMenuItem; onPress: () => void; featured?: boolean }) {
  return (
    <TouchableOpacity style={[styles.featuredCard, featured && styles.featuredCardWide]} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.glyphBox, { backgroundColor: item.color + '18', borderColor: item.color + '33' }]}>
        <Text style={[styles.glyphText, { color: item.color }]}>{item.glyph}</Text>
      </View>
      <Text style={styles.featuredLabel}>{item.label}</Text>
      <Text style={styles.featuredDesc} numberOfLines={2}>{item.description}</Text>
    </TouchableOpacity>
  );
}

function PortalRow({ item, onPress }: { item: PortalMenuItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.rowCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.rowGlyph, { backgroundColor: item.color + '18', borderColor: item.color + '33' }]}>
        <Text style={[styles.rowGlyphText, { color: item.color }]}>{item.glyph}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.label}</Text>
        <Text style={styles.rowDesc}>{item.description}</Text>
      </View>
      <Text style={styles.rowArrow}>Open</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 28 },
  hero: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    gap: SPACING.lg,
  },
  heroTop: { gap: SPACING.base },
  eyebrow: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.ultra,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
    letterSpacing: LETTER_SPACING.tight,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
    maxWidth: 520,
  },
  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  roleText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 50,
  },
  searchIcon: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },
  clearBtn: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  metaRow: { flexDirection: 'row', gap: SPACING.md },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  metaValue: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
  },
  metaLabel: {
    marginTop: 4,
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.widest,
  },
  block: { marginTop: SPACING.xl },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  blockTitle: {
    fontFamily: FONT_FAMILY.displayMed,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
  },
  blockHint: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  featuredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  featuredCard: {
    width: (Dimensions.get('window').width - SPACING.xl * 2 - SPACING.md) / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    minHeight: 150,
  },
  featuredCardWide: {
    justifyContent: 'space-between',
  },
  glyphBox: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  glyphText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.md,
    letterSpacing: LETTER_SPACING.wider,
  },
  featuredLabel: {
    fontFamily: FONT_FAMILY.displayMed,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  featuredDesc: {
    marginTop: 6,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  listWrap: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  rowGlyph: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowGlyphText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.wider,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  rowDesc: {
    marginTop: 2,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  rowArrow: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  emptyState: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING['2xl'],
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: FONT_FAMILY.displayMed,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

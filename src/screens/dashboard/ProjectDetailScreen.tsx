import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { projectService } from '../../services/project.service';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type LabProjectDetail = {
  id: string;
  title: string;
  language: string;
  code: string | null;
  blocks_xml: string | null;
  preview_url: string | null;
  assignment_id: string | null;
  lesson_id: string | null;
  updated_at: string | null;
  portal_users?: { full_name: string | null } | null;
};

type PortfolioProjectDetail = {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  project_url: string | null;
  image_url: string | null;
  category: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  portal_users?: { full_name: string | null } | null;
};

type ProjectMode = 'lab' | 'portfolio';

export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [mode, setMode] = useState<ProjectMode | null>(null);
  const [labProject, setLabProject] = useState<LabProjectDetail | null>(null);
  const [portfolioProject, setPortfolioProject] = useState<PortfolioProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    try {
      const lab = await projectService.getLabProjectById(projectId);
      if (lab) {
        setMode('lab');
        setLabProject(lab as LabProjectDetail);
        setPortfolioProject(null);
        return;
      }

      const portfolio = await projectService.getPortfolioProjectById(projectId);
      if (portfolio) {
        setMode('portfolio');
        setPortfolioProject(portfolio as PortfolioProjectDetail);
        setLabProject(null);
        return;
      }

      setMode(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const openUrl = useCallback(async (url: string | null | undefined, label: string) => {
    if (!url) {
      Alert.alert('Unavailable', `${label} is not attached to this project yet.`);
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unavailable', 'This link cannot be opened on the device.');
      return;
    }
    await Linking.openURL(url);
  }, []);

  const copyCode = useCallback(async () => {
    if (!labProject?.code) {
      Alert.alert('Unavailable', 'No saved code is attached to this project.');
      return;
    }
    await Share.share({ message: labProject.code });
  }, [labProject?.code]);

  const shareProject = useCallback(async () => {
    const shareText = mode === 'portfolio'
      ? `${portfolioProject?.title}\n${portfolioProject?.description ?? ''}\n${portfolioProject?.project_url ?? ''}`
      : `${labProject?.title}\n${labProject?.preview_url ?? ''}\n${labProject?.code ?? ''}`;
    await Share.share({ message: shareText });
  }, [labProject, mode, portfolioProject]);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!mode) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={projectTitle || 'Project'} onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Project not found</Text>
          <Text style={styles.emptyText}>This project could not be loaded from the current mobile data source.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const title = mode === 'portfolio' ? portfolioProject?.title : labProject?.title;
  const subtitle = mode === 'portfolio'
    ? `${portfolioProject?.category ?? 'Portfolio'} · ${portfolioProject?.portal_users?.full_name ?? 'Student project'}`
    : `${labProject?.language?.toUpperCase() ?? 'Lab'} · ${labProject?.portal_users?.full_name ?? 'Lab project'}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title ?? projectTitle ?? 'Project'} subtitle={subtitle} onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {mode === 'portfolio' ? (
          <>
            {portfolioProject?.image_url ? (
              <View style={styles.bannerWrap}>
                <Image source={{ uri: portfolioProject.image_url }} style={styles.bannerImage} resizeMode="cover" />
                <LinearGradient colors={['rgba(12,22,36,0.05)', 'rgba(12,22,36,0.8)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bannerOverlay}>
                  {portfolioProject.is_featured ? (
                    <View style={styles.featuredPill}>
                      <Text style={styles.featuredText}>Featured</Text>
                    </View>
                  ) : null}
                  <Text style={styles.bannerTitle}>{portfolioProject.title}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.descriptionText}>{portfolioProject?.description || 'No project description added yet.'}</Text>
              <Text style={styles.metaText}>
                {portfolioProject?.category} · Updated {new Date(portfolioProject?.updated_at ?? portfolioProject?.created_at ?? Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>

            {portfolioProject?.tags && portfolioProject.tags.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View style={styles.tagRow}>
                  {portfolioProject.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => openUrl(portfolioProject?.project_url, 'Project link')}>
                <Text style={styles.primaryBtnText}>Open Project Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={shareProject}>
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lab Summary</Text>
              <Text style={styles.descriptionText}>
                {labProject?.preview_url
                  ? 'This lab project includes a live preview link and saved code.'
                  : 'This lab project is stored in the coding studio and can be reopened for editing.'}
              </Text>
              <Text style={styles.metaText}>
                {labProject?.language?.toUpperCase()} · Updated {new Date(labProject?.updated_at ?? Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Code</Text>
              <View style={styles.codeCard}>
                <Text style={styles.codeText}>{labProject?.code || labProject?.blocks_xml || 'No code saved for this project yet.'}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Links</Text>
              <Text style={styles.descriptionText}>
                Assignment link: {labProject?.assignment_id ?? 'N/A'}{'\n'}
                Lesson link: {labProject?.lesson_id ?? 'N/A'}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => openUrl(labProject?.preview_url, 'Preview link')}>
                <Text style={styles.primaryBtnText}>Open Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={copyCode}>
                <Text style={styles.secondaryBtnText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={shareProject}>
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  bannerWrap: { height: 260, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.xl, gap: SPACING.sm },
  featuredPill: { alignSelf: 'flex-start', backgroundColor: colors.goldGlow, borderWidth: 1, borderColor: colors.goldLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  featuredText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.gold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  bannerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: colors.white100 },
  section: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.sm },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: colors.textPrimary },
  descriptionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 },
  metaText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  tagText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.primary },
  codeCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, padding: SPACING.md },
  codeText: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.sm, color: colors.success, lineHeight: 20 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  primaryBtn: { minWidth: 150, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: colors.primary, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.white100, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  secondaryBtn: { minWidth: 120, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center' },
  secondaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['2xl'], backgroundColor: colors.bg },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

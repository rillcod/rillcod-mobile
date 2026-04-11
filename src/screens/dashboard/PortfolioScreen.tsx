import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { projectService } from '../../services/project.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type PortfolioProject = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  project_url: string | null;
  image_url: string | null;
  tags: string[];
  is_featured: boolean;
  created_at: string;
};

const CATEGORIES = ['Coding', 'Robotics', 'Web Design', 'AI/ML', 'IoT', 'Game Dev', 'Art'];

export default function PortfolioScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [projectUrl, setProjectUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState('');

  const canUse = profile?.role === 'student';

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setProjectUrl('');
    setImageUrl('');
    setTags('');
  }, []);

  const loadProjects = useCallback(async () => {
    if (!profile || !canUse) {
      setProjects([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await projectService.listOwnPortfolioProjectsForStudent(profile.id);
      setProjects(((data ?? []) as any[]).map((item) => ({ ...item, tags: item.tags ?? [] })));
    } catch (e: any) {
      Alert.alert('Portfolio', e?.message ?? 'Could not load projects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canUse, profile]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const saveProject = useCallback(async () => {
    if (!profile || !canUse || !title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      project_url: projectUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await projectService.updatePortfolioProject(editingId, payload);
      } else {
        await projectService.insertPortfolioProject({
          ...payload,
          user_id: profile.id,
        });
      }
      resetForm();
      await loadProjects();
    } catch (e: any) {
      Alert.alert('Portfolio', e?.message ?? 'Could not save project.');
    }
  }, [canUse, category, description, editingId, imageUrl, loadProjects, profile, projectUrl, resetForm, tags, title]);

  const editProject = useCallback((project: PortfolioProject) => {
    setEditingId(project.id);
    setTitle(project.title);
    setDescription(project.description ?? '');
    setCategory(project.category);
    setProjectUrl(project.project_url ?? '');
    setImageUrl(project.image_url ?? '');
    setTags(project.tags.join(', '));
  }, []);

  const removeProject = useCallback((project: PortfolioProject) => {
    Alert.alert('Delete Project', `Delete ${project.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await projectService.deletePortfolioProject(project.id);
            if (editingId === project.id) resetForm();
            await loadProjects();
          } catch (e: any) {
            Alert.alert('Portfolio', e?.message ?? 'Could not delete project.');
          }
        },
      },
    ]);
  }, [editingId, loadProjects, resetForm]);

  if (!canUse) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Portfolio" subtitle="Student showcase" onBack={() => navigation.goBack()} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>This screen is available to student accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProjects();
  }, [loadProjects]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Portfolio" subtitle="Showcase your best work" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Portfolio" subtitle="Showcase your best work" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingId ? 'Edit Project' : 'Add Project'}</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Project title" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, styles.area]} value={description} onChangeText={setDescription} placeholder="What did you build?" placeholderTextColor={colors.textMuted} multiline textAlignVertical="top" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.pill, active && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.pillText, active && { color: colors.primary }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TextInput style={styles.input} value={projectUrl} onChangeText={setProjectUrl} placeholder="Project URL" placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="Image URL" placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="Tags, comma separated" placeholderTextColor={colors.textMuted} />

          <View style={styles.actionRow}>
            {editingId ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetForm}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={saveProject}>
              <Text style={styles.primaryBtnText}>{editingId ? 'Save Changes' : 'Add Project'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {projects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No portfolio projects yet</Text>
            <Text style={styles.emptyText}>Add your projects here so your mobile portfolio matches the web experience.</Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project.id} style={styles.projectCard}>
              {project.image_url ? <Image source={{ uri: project.image_url }} style={styles.cover} resizeMode="cover" /> : null}
              <Text style={styles.projectTitle}>{project.title}</Text>
              <Text style={styles.projectMeta}>{project.category} · {new Date(project.created_at).toLocaleDateString('en-GB')}</Text>
              {project.description ? <Text style={styles.projectDesc}>{project.description}</Text> : null}
              {project.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {project.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => editProject(project)}>
                  <Text style={styles.secondaryBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => removeProject(project)}>
                  <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  formCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  area: { minHeight: 120, paddingVertical: SPACING.md },
  pillRow: { gap: SPACING.sm, paddingVertical: 4 },
  pill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  pillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  actionRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  primaryBtn: { flex: 1, minWidth: 140, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, backgroundColor: colors.primary, borderRadius: RADIUS.lg },
  primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.white100, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  secondaryBtn: { flex: 1, minWidth: 120, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.lg },
  secondaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  emptyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  projectCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
  cover: { width: '100%', height: 170, borderRadius: RADIUS.md, backgroundColor: colors.bg },
  projectTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  projectMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textMuted },
  projectDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20, color: colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  tagText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.primary },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { VisualizerModal } from '../../components/visualizer/VisualizerModal';
import { CodeData, VisualizationType } from '../../types/visualizer';

type LabProject = {
  id: string;
  title: string;
  language: string;
  code: string | null;
  blocks_xml: string | null;
  preview_url: string | null;
  updated_at: string | null;
};

const LANGUAGES = ['python', 'javascript', 'html', 'blockly', 'scratch', 'robotics'] as const;

const STARTER_CODE: Record<string, string> = {
  python: 'print("Hello, Rillcod Technologies!")\n\nfor i in range(3):\n    print(i)',
  javascript: 'console.log("Hello, Rillcod Technologies!");\n\nconst total = [1,2,3].reduce((sum, value) => sum + value, 0);\nconsole.log(total);',
  html: '<section><h1>Rillcod Studio</h1><p>Build something great.</p></section>',
  blockly: '',
  scratch: '',
  robotics: 'robot.forward(100)\nrobot.turnRight(90)\nrobot.forward(100)',
};

export default function PlaygroundScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [projects, setProjects] = useState<LabProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled Project');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('python');
  const [code, setCode] = useState(STARTER_CODE.python);
  const [saving, setSaving] = useState(false);
  const [visualizerVisible, setVisualizerVisible] = useState(false);

  const canUse = profile?.role === 'student' || profile?.role === 'teacher' || profile?.role === 'admin';

  const loadProjects = useCallback(async () => {
    if (!profile || !canUse) {
      setProjects([]);
      return;
    }

    const data = await projectService.listOwnLabProjects(profile.id, 40);
    setProjects((data ?? []) as LabProject[]);
  }, [canUse, profile]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const openProject = useCallback((project: LabProject) => {
    setActiveId(project.id);
    setTitle(project.title);
    setLanguage((project.language as (typeof LANGUAGES)[number]) ?? 'python');
    setCode(project.code ?? STARTER_CODE[project.language] ?? '');
  }, []);

  const saveProject = useCallback(async () => {
    if (!profile || !canUse || !title.trim()) return;
    setSaving(true);
    try {
      if (activeId) {
        await projectService.updateLabProject(activeId, {
          title: title.trim(),
          language,
          code,
          updated_at: new Date().toISOString(),
        });
      } else {
        const newId = await projectService.insertLabProjectReturningId({
          user_id: profile.id,
          title: title.trim(),
          language,
          code,
          is_public: false,
        });
        if (newId) setActiveId(newId);
      }

      await loadProjects();
      Alert.alert('Saved', 'Your playground project has been saved.');
    } finally {
      setSaving(false);
    }
  }, [activeId, canUse, code, language, loadProjects, profile, title]);

  const newProject = useCallback(() => {
    setActiveId(null);
    setLanguage('python');
    setTitle('Untitled Project');
    setCode(STARTER_CODE.python);
  }, []);

  const deleteProject = useCallback((project: LabProject) => {
    Alert.alert('Delete Project', `Delete ${project.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await projectService.deleteLabProject(project.id);
          if (activeId === project.id) newProject();
          await loadProjects();
        },
      },
    ]);
  }, [activeId, loadProjects, newProject]);

  const runVisualizer = () => {
    setVisualizerVisible(true);
  };

  // Mock data for the current demonstration of the engine
  const mockCodeData: CodeData = {
    step: 0,
    totalSteps: 20,
    variables: { i: 0, n: 10, offset: 5.2 },
    visualizationState: {
      array: [45, 12, 89, 3, 27, 56, 12, 4],
      comparing: [0, 1]
    }
  };

  const getVisType = (): VisualizationType => {
    if (language === 'python') return 'sorting';
    if (language === 'javascript') return 'physics';
    if (language === 'robotics') return 'turtle';
    return 'loops';
  };

  if (!canUse) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Code Playground" subtitle="Lab workspace" onBack={() => navigation.goBack()} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>This screen is available to student, teacher, and admin accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Code Playground" subtitle="Build and save lab projects" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={newProject}>
            <Text style={styles.primaryBtnText}>New Project</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, saving && styles.btnDisabled]} onPress={saveProject} disabled={saving}>
            <Text style={styles.secondaryBtnText}>{saving ? 'Saving...' : 'Save Project'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.runBtn, { backgroundColor: colors.accent }]} 
          onPress={runVisualizer}
        >
          <Text style={styles.runBtnText}>✦ RUN VISUALIZER</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Project Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Project title" placeholderTextColor={colors.textMuted} />

          <Text style={[styles.fieldLabel, styles.spaced]}>Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {LANGUAGES.map((item) => {
              const active = language === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.pill, active && { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}
                  onPress={() => {
                    setLanguage(item);
                    if (!activeId) setCode(STARTER_CODE[item]);
                  }}
                >
                  <Text style={[styles.pillText, active && { color: colors.primary }]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.fieldLabel, styles.spaced]}>Code</Text>
          <TextInput
            style={styles.editor}
            multiline
            value={code}
            onChangeText={setCode}
            placeholder="Write your project code here..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Projects</Text>
          <Text style={styles.sectionHint}>{projects.length} saved</Text>
        </View>

        {projects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No playground projects yet</Text>
            <Text style={styles.emptyText}>Create your first saved lab project from mobile here.</Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project.id} style={styles.projectCard}>
              <TouchableOpacity style={styles.projectBody} onPress={() => openProject(project)} activeOpacity={0.84}>
                <Text style={styles.projectTitle}>{project.title}</Text>
                <Text style={styles.projectMeta}>
                  {project.language} · {project.updated_at ? new Date(project.updated_at).toLocaleDateString('en-GB') : 'No date'}
                </Text>
              </TouchableOpacity>
              <View style={styles.projectActions}>
                <TouchableOpacity style={styles.miniBtn} onPress={() => openProject(project)}>
                  <Text style={styles.miniBtnText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniBtn} onPress={() => deleteProject(project)}>
                  <Text style={[styles.miniBtnText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <VisualizerModal
        visible={visualizerVisible}
        onClose={() => setVisualizerVisible(false)}
        type={getVisType()}
        initialData={mockCodeData}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  toolbarRow: { flexDirection: 'row', gap: SPACING.md },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.white100, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  secondaryBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  btnDisabled: { opacity: 0.65 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl },
  fieldLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  spaced: { marginTop: SPACING.lg },
  input: { marginTop: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 48, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  pillRow: { gap: SPACING.sm, paddingTop: 8, paddingBottom: 4 },
  pill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  pillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  editor: { marginTop: 8, minHeight: 260, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, padding: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  sectionHint: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  emptyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  projectCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  projectBody: { flex: 1 },
  projectTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  projectMeta: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  projectActions: { gap: SPACING.sm },
  miniBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  miniBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  runBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  runBtnText: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xs,
    color: '#fff',
    letterSpacing: 1.5,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useHaptics } from '../../hooks/useHaptics';

interface LessonRecord {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  content_layout: unknown;
  lesson_notes: string | null;
  lesson_type: string | null;
  duration_minutes: number | null;
  status: string | null;
  video_url: string | null;
  course_id: string | null;
  order_index: number | null;
  courses?: { id: string; title: string | null } | null;
}

interface MaterialRecord {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
}

interface AssignmentRecord {
  id: string;
  title: string;
  assignment_type: string | null;
  due_date: string | null;
  instructions: string | null;
  max_points: number | null;
}

interface LessonPlanRecord {
  summary_notes: string | null;
  objectives: string | null;
  activities: string | null;
  assessment_methods: string | null;
}

interface LessonProgressRecord {
  progress_percentage: number | null;
  status: string | null;
  time_spent_minutes: number | null;
  completed_at: string | null;
}

interface LayoutBlock {
  title?: string;
  type?: string;
  content?: unknown;
  [key: string]: unknown;
}

const splitText = (value: string | null | undefined) =>
  (value ?? '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const listify = (value: string | null | undefined) =>
  (value ?? '')
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

const normalizeLayout = (layout: unknown): LayoutBlock[] => {
  if (!layout) return [];
  if (Array.isArray(layout)) return layout as LayoutBlock[];
  if (typeof layout === 'object') {
    const candidate = layout as { blocks?: unknown; sections?: unknown };
    if (Array.isArray(candidate.blocks)) return candidate.blocks as LayoutBlock[];
    if (Array.isArray(candidate.sections)) return candidate.sections as LayoutBlock[];
    return Object.entries(layout).map(([title, content]) => ({ title, content }));
  }
  if (typeof layout === 'string') return [{ title: 'Layout', content: layout }];
  return [];
};

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function LessonDetailScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { light, success } = useHaptics();
  const { lessonId } = route.params as { lessonId: string };

  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanRecord | null>(null);
  const [siblings, setSiblings] = useState<{ id: string; title: string }[]>([]);
  const [progress, setProgress] = useState<LessonProgressRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const contentParagraphs = useMemo(() => splitText(lesson?.content), [lesson?.content]);
  const noteParagraphs = useMemo(() => splitText(lesson?.lesson_notes), [lesson?.lesson_notes]);
  const layoutBlocks = useMemo(() => normalizeLayout(lesson?.content_layout), [lesson?.content_layout]);
  const objectives = useMemo(() => listify(lessonPlan?.objectives), [lessonPlan?.objectives]);
  const activities = useMemo(() => listify(lessonPlan?.activities), [lessonPlan?.activities]);
  const assessments = useMemo(() => listify(lessonPlan?.assessment_methods), [lessonPlan?.assessment_methods]);

  const currentIndex = siblings.findIndex((item) => item.id === lessonId);
  const previousLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
  const completed = progress?.status === 'completed' || !!progress?.completed_at;
  const visibleProgress = completed ? 100 : Math.max(progress?.progress_percentage ?? 0, 10);

  const openUrl = async (url: string | null | undefined, fallback: string) => {
    if (!url) return Alert.alert('Unavailable', fallback);
    if (!(await Linking.canOpenURL(url))) {
      return Alert.alert('Unavailable', 'This link cannot be opened on the device.');
    }
    await Linking.openURL(url);
  };

  const loadData = useCallback(async () => {
    try {
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          description,
          content,
          content_layout,
          lesson_notes,
          lesson_type,
          duration_minutes,
          status,
          video_url,
          course_id,
          order_index,
          courses (id, title)
        `)
        .eq('id', lessonId)
        .single();
      if (lessonError) throw lessonError;
      const resolvedLesson = lessonData as LessonRecord;
      setLesson(resolvedLesson);

      const [{ data: mats }, { data: asgns }, { data: planData }] = await Promise.all([
        supabase.from('lesson_materials').select('id, title, file_url, file_type').eq('lesson_id', lessonId).order('created_at'),
        supabase.from('assignments').select('id, title, assignment_type, due_date, instructions, max_points').eq('lesson_id', lessonId).eq('is_active', true).order('created_at'),
        supabase.from('lesson_plans').select('summary_notes, objectives, activities, assessment_methods').eq('lesson_id', lessonId).maybeSingle(),
      ]);

      setMaterials((mats as MaterialRecord[]) ?? []);
      setAssignments((asgns as AssignmentRecord[]) ?? []);
      setLessonPlan((planData as LessonPlanRecord | null) ?? null);

      if (resolvedLesson.course_id) {
        const { data: lessonSiblings } = await supabase
          .from('lessons')
          .select('id, title')
          .eq('course_id', resolvedLesson.course_id)
          .order('order_index', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });
        setSiblings((lessonSiblings as { id: string; title: string }[]) ?? []);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('progress_percentage, status, time_spent_minutes, completed_at')
          .eq('lesson_id', lessonId)
          .eq('portal_user_id', user.id)
          .maybeSingle();
        setProgress((progressData as LessonProgressRecord | null) ?? null);

        await supabase.from('lesson_progress').upsert({
          lesson_id: lessonId,
          portal_user_id: user.id,
          status: progressData?.status ?? 'in_progress',
          progress_percentage: Math.max(progressData?.progress_percentage ?? 0, 10),
          last_accessed_at: new Date().toISOString(),
          time_spent_minutes: progressData?.time_spent_minutes ?? 0,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      Alert.alert('Lesson', error.message || 'Unable to open this lesson.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [lessonId, navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markComplete = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in.');
      const timeSpent = (progress?.time_spent_minutes ?? 0) + 5;
      const completedAt = new Date().toISOString();
      const { error } = await supabase.from('lesson_progress').upsert({
        lesson_id: lessonId,
        portal_user_id: user.id,
        status: 'completed',
        progress_percentage: 100,
        completed_at: completedAt,
        last_accessed_at: completedAt,
        time_spent_minutes: timeSpent,
        updated_at: completedAt,
      });
      if (error) throw error;
      setProgress({ progress_percentage: 100, status: 'completed', time_spent_minutes: timeSpent, completed_at: completedAt });
      await success();
      Alert.alert('Progress Saved', nextLesson ? 'Lesson completed. Opening the next lesson.' : 'Lesson completed.');
      if (nextLesson) navigation.replace('LessonDetail', { lessonId: nextLesson.id });
    } catch (error: any) {
      Alert.alert('Progress', error.message || 'Unable to mark the lesson complete.');
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!lesson) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><Text style={[styles.bodyText, { color: colors.textMuted }]}>Lesson not found.</Text></View>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={lesson.title}
        subtitle={`${lesson.courses?.title ?? 'Learning'} · ${(lesson.lesson_type ?? 'lesson').toUpperCase()}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} style={[styles.hero, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <LinearGradient colors={[`${colors.primary}16`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{(lesson.courses?.title ?? 'Learning Track').toUpperCase()}</Text>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{lesson.title}</Text>
          {!!lesson.description && <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{lesson.description}</Text>}
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}2A` }]}><Text style={[styles.pillText, { color: colors.primary }]}>{(lesson.lesson_type ?? 'lesson').toUpperCase()}</Text></View>
            <View style={[styles.pill, { backgroundColor: `${colors.info}14`, borderColor: `${colors.info}2A` }]}><Text style={[styles.pillText, { color: colors.info }]}>{lesson.duration_minutes ?? 45} MIN</Text></View>
            <View style={[styles.pill, { backgroundColor: `${colors.success}14`, borderColor: `${colors.success}2A` }]}><Text style={[styles.pillText, { color: colors.success }]}>{completed ? 'COMPLETED' : `${visibleProgress}% TRACKED`}</Text></View>
          </View>
          <View style={[styles.track, { backgroundColor: colors.bg }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${visibleProgress}%` }]} /></View>
        </MotiView>

        {!!lesson.video_url && (
          <TouchableOpacity onPress={() => openUrl(lesson.video_url, 'No lesson video was attached.')} style={[styles.primaryAction, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryActionText}>Open Lesson Video</Text>
          </TouchableOpacity>
        )}

        {contentParagraphs.length > 0 && (
          <Section title="Core Content" colors={colors}>
            {contentParagraphs.map((paragraph, index) => <Text key={`c-${index}`} style={[styles.bodyText, { color: colors.textSecondary }]}>{paragraph}</Text>)}
          </Section>
        )}

        {noteParagraphs.length > 0 && (
          <Section title="Lesson Notes" colors={colors}>
            {noteParagraphs.map((paragraph, index) => <Text key={`n-${index}`} style={[styles.bodyText, { color: colors.textSecondary }]}>{paragraph}</Text>)}
          </Section>
        )}

        {layoutBlocks.length > 0 && (
          <Section title="Structured Layout" colors={colors}>
            {layoutBlocks.map((block: LayoutBlock, index: number) => (
              <View key={`b-${index}`} style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{typeof block.title === 'string' ? block.title : typeof block.type === 'string' ? block.type : `Section ${index + 1}`}</Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? block, null, 2)}</Text>
              </View>
            ))}
          </Section>
        )}

        {(lessonPlan?.summary_notes || objectives.length || activities.length || assessments.length) && (
          <Section title="Teaching Plan" colors={colors}>
            {!!lessonPlan?.summary_notes && <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{lessonPlan.summary_notes}</Text>}
            {objectives.map((item, index) => <Text key={`o-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>• {item}</Text>)}
            {activities.map((item, index) => <Text key={`a-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>• {item}</Text>)}
            {assessments.map((item, index) => <Text key={`m-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>• {item}</Text>)}
          </Section>
        )}

        {materials.length > 0 && (
          <Section title="Materials" colors={colors}>
            {materials.map((material) => (
              <TouchableOpacity key={material.id} onPress={() => openUrl(material.file_url, 'This material does not have a valid file URL.')} style={[styles.rowCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{material.title}</Text>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{(material.file_type ?? 'resource').toUpperCase()}</Text>
                </View>
                <Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {assignments.length > 0 && (
          <Section title="Assignments" colors={colors}>
            {assignments.map((assignment) => (
              <TouchableOpacity key={assignment.id} onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: assignment.id, title: assignment.title })} style={[styles.rowCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{assignment.title}</Text>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {(assignment.assignment_type ?? 'assignment').toUpperCase()}
                    {assignment.max_points ? ` · ${assignment.max_points} PTS` : ''}
                    {assignment.due_date ? ` · ${new Date(assignment.due_date).toLocaleDateString()}` : ''}
                  </Text>
                  {!!assignment.instructions && <Text numberOfLines={2} style={[styles.bodyText, { color: colors.textSecondary }]}>{assignment.instructions}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        <TouchableOpacity onPress={markComplete} disabled={marking || completed} style={[styles.primaryAction, { backgroundColor: completed ? colors.success : colors.primary, opacity: marking ? 0.8 : 1 }]}>
          {marking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionText}>{completed ? 'Lesson Completed' : 'Mark Lesson Complete'}</Text>}
        </TouchableOpacity>

        <View style={styles.navRow}>
          {previousLesson ? (
            <TouchableOpacity style={[styles.navCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => { light(); navigation.push('LessonDetail', { lessonId: previousLesson.id }); }}>
              <Text style={[styles.metaText, { color: colors.textMuted }]}>PREVIOUS</Text>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{previousLesson.title}</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}
          {nextLesson ? (
            <TouchableOpacity style={[styles.navCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => { light(); navigation.push('LessonDetail', { lessonId: nextLesson.id }); }}>
              <Text style={[styles.metaText, { color: colors.textMuted, textAlign: 'right' }]}>NEXT</Text>
              <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign: 'right' }]} numberOfLines={2}>{nextLesson.title}</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}
        </View>

        <View style={{ height: 64 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  hero: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.xl, overflow: 'hidden', gap: 12 },
  eyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.4 },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], lineHeight: 34 },
  bodyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 22 },
  bullet: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  track: { height: 7, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full },
  primaryAction: { marginTop: SPACING.lg, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  primaryActionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff', letterSpacing: 0.4 },
  section: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md },
  sectionBody: { gap: 12 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8 },
  rowCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
  cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  metaText: { fontFamily: FONT_FAMILY.mono, fontSize: 10 },
  openText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.6 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: SPACING.xl },
  navCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
});

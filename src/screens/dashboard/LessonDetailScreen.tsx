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
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { courseService } from '../../services/course.service';
import { analyticsService } from '../../services/analytics.service';
import { gamificationService } from '../../services/gamification.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import LessonVoiceReader from '../../components/ui/LessonVoiceReader';
import LessonAIPanel from '../../components/ui/LessonAIPanel';
import LessonBlockRenderer, { parseTextToBlocks } from '../../components/ui/LessonBlockRenderer';
import { ROUTES } from '../../navigation/routes';
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
  created_by: string | null;
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

const normalizeExternalUrl = (url: string) => {
  const value = (url ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const isVideoMaterial = (material: MaterialRecord) => {
  const type = (material.file_type ?? '').toLowerCase();
  const url = (material.file_url ?? '').toLowerCase();
  return type.includes('video') || /\.(mp4|mov|m3u8|webm)(\?|$)/i.test(url) || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
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
  const { profile } = useAuth();
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
  const [visualMode, setVisualMode] = useState<'standard' | 'cinematic'>('cinematic');

  const contentParagraphs = useMemo(() => splitText(lesson?.content), [lesson?.content]);
  const noteParagraphs = useMemo(() => splitText(lesson?.lesson_notes), [lesson?.lesson_notes]);
  const contentBlocks = useMemo(() => parseTextToBlocks(lesson?.content), [lesson?.content]);
  const noteBlocks = useMemo(() => parseTextToBlocks(lesson?.lesson_notes), [lesson?.lesson_notes]);
  const layoutBlocks = useMemo(() => normalizeLayout(lesson?.content_layout), [lesson?.content_layout]);
  const objectives = useMemo(() => listify(lessonPlan?.objectives), [lessonPlan?.objectives]);
  const activities = useMemo(() => listify(lessonPlan?.activities), [lessonPlan?.activities]);
  const assessments = useMemo(() => listify(lessonPlan?.assessment_methods), [lessonPlan?.assessment_methods]);

  const currentIndex = siblings.findIndex((item) => item.id === lessonId);
  const previousLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
  const completed = progress?.status === 'completed' || !!progress?.completed_at;
  const visibleProgress = completed ? 100 : Math.max(progress?.progress_percentage ?? 0, 10);

  const isStudent = profile?.role === 'student';

  const canEditLesson =
    !!lesson &&
    (profile?.role === 'admin' ||
      (profile?.role === 'teacher' && (!lesson.created_by || lesson.created_by === profile.id)));

  const openUrl = async (url: string | null | undefined, fallback: string) => {
    if (!url) return Alert.alert('Unavailable', fallback);
    const target = normalizeExternalUrl(url);
    if (!(await Linking.canOpenURL(target))) {
      return Alert.alert('Unavailable', 'This link cannot be opened on the device.');
    }
    
    // Log analytics
    if (profile?.id) {
      analyticsService.trackEvent(profile.id, 'video_open', {
        lessonId,
        courseId: lesson?.course_id,
        url: target
      });
    }

    await Linking.openURL(target);
  };

  const loadData = useCallback(async () => {
    try {
      const { lesson, materials: mats, assignments: asgns, lessonPlan: plan, siblings: sibs, progress: prog } = await courseService.getLessonDetail(lessonId, profile?.id, profile?.role !== 'student');
      
      setLesson(lesson as any);
      setMaterials(mats as any);
      setAssignments(asgns as any);
      setLessonPlan(plan as any);
      setSiblings(sibs as any);
      setProgress(prog as any);

      if (profile?.id) {
        await courseService.updateLessonProgress({
          userId: profile.id,
          courseId: lesson.course_id ?? '',
          lessonId,
          status: (prog?.status as 'completed' | 'in_progress') ?? 'in_progress'
        });
      }
    } catch (error: any) {
      Alert.alert('Lesson', error.message || 'Unable to open this lesson.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [lessonId, navigation, profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markComplete = async () => {
    if (marking || !profile?.id) return;
    if ((progress?.time_spent_minutes ?? 0) < 2) {
      Alert.alert('Keep learning', 'Spend a little more time on this lesson before marking it complete.');
      return;
    }
    setMarking(true);
    try {
      await courseService.updateLessonProgress({
        userId: profile.id,
        courseId: lesson?.course_id ?? '',
        lessonId,
        status: 'completed',
        incrementMinutes: 5,
      });

      try {
        await gamificationService.awardPoints(
          profile.id,
          'lesson_complete',
          lessonId,
          lesson?.title ?? 'Lesson',
        );
      } catch {
        /* points are optional if tables or RLS differ */
      }

      const completedAt = new Date().toISOString();
      const timeSpent = (progress?.time_spent_minutes ?? 0) + 5;
      setProgress({ progress_percentage: 100, status: 'completed', time_spent_minutes: timeSpent, completed_at: completedAt });
      
      await success();
      Alert.alert('Progress Saved', nextLesson ? 'Lesson completed. Opening the next lesson.' : 'Lesson completed.');
      if (nextLesson) navigation.replace(ROUTES.LessonDetail, { lessonId: nextLesson.id });
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
        rightAction={
          canEditLesson
            ? {
                label: 'Edit',
                color: colors.primary,
                onPress: () =>
                  navigation.navigate(ROUTES.LessonEditor, {
                    lessonId: lesson.id,
                    courseId: lesson.course_id ?? undefined,
                  }),
              }
            : undefined
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView
          from={{ opacity: 0, translateY: 10, scale: visualMode === 'cinematic' ? 0.98 : 1 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ duration: visualMode === 'cinematic' ? 620 : 320 }}
          style={[styles.hero, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          <LinearGradient
            colors={visualMode === 'cinematic' ? [`${colors.primary}26`, `${colors.info}14`, 'transparent'] : [`${colors.primary}16`, 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{(lesson.courses?.title ?? 'Learning Track').toUpperCase()}</Text>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{lesson.title}</Text>
          {!!lesson.description && <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{lesson.description}</Text>}
          <View style={styles.modeRow}>
            <Text style={[styles.modeLabel, { color: colors.textMuted }]}>Visual Mode</Text>
            <View style={[styles.modeSwitch, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <TouchableOpacity
                onPress={() => setVisualMode('standard')}
                style={[styles.modeBtn, visualMode === 'standard' && { backgroundColor: colors.primary + '20' }]}
              >
                <Text style={[styles.modeBtnText, { color: visualMode === 'standard' ? colors.primary : colors.textMuted }]}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setVisualMode('cinematic')}
                style={[styles.modeBtn, visualMode === 'cinematic' && { backgroundColor: colors.info + '20' }]}
              >
                <Text style={[styles.modeBtnText, { color: visualMode === 'cinematic' ? colors.info : colors.textMuted }]}>Cinematic</Text>
              </TouchableOpacity>
            </View>
          </View>
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

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => {
              light();
              if (isStudent && lesson.course_id) {
                navigation.navigate(ROUTES.CourseDetail, {
                  courseId: lesson.course_id,
                  title: lesson.courses?.title ?? undefined,
                });
              } else {
                navigation.navigate(ROUTES.Lessons);
              }
            }}
          >
            <Text style={[styles.quickLabel, { color: colors.textMuted }]}>COURSE</Text>
            <Text style={[styles.quickValue, { color: colors.textPrimary }]}>All lessons</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() =>
              assignments[0]
                ? navigation.navigate(ROUTES.AssignmentDetail, {
                    assignmentId: assignments[0].id,
                    title: assignments[0].title,
                  })
                : navigation.navigate(ROUTES.Assignments)
            }
          >
            <Text style={[styles.quickLabel, { color: colors.textMuted }]}>WORK</Text>
            <Text style={[styles.quickValue, { color: colors.textPrimary }]}>
              {assignments.length ? `${assignments.length} linked` : 'Assignments'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => {
              light();
              if (lesson.course_id) {
                navigation.navigate(ROUTES.CourseDiscussion, {
                  courseId: lesson.course_id,
                  courseTitle: lesson.courses?.title ?? undefined,
                });
              } else {
                Alert.alert('Forum', 'This lesson is not linked to a course yet.');
              }
            }}
          >
            <Text style={[styles.quickLabel, { color: colors.textMuted }]}>COMMUNITY</Text>
            <Text style={[styles.quickValue, { color: colors.textPrimary }]}>Q&A Forum</Text>
          </TouchableOpacity>
        </View>

        {contentBlocks.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: visualMode === 'cinematic' ? 14 : 0 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: visualMode === 'cinematic' ? 620 : 320 }}
            style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          >
            {visualMode === 'cinematic' ? (
              <LinearGradient colors={[`${colors.primary}12`, 'transparent']} style={StyleSheet.absoluteFill} />
            ) : null}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Core Content</Text>
            <View style={styles.sectionBody}>
              <LessonBlockRenderer blocks={contentBlocks as any} lessonType={lesson.lesson_type} visualMode={visualMode} />
            </View>
          </MotiView>
        )}

        {noteBlocks.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: visualMode === 'cinematic' ? 14 : 0 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: visualMode === 'cinematic' ? 620 : 320, delay: 60 }}
            style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lesson Notes</Text>
            <View style={styles.sectionBody}>
              <LessonBlockRenderer blocks={noteBlocks as any} lessonType={lesson.lesson_type} visualMode={visualMode} />
            </View>
          </MotiView>
        )}

        {layoutBlocks.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: visualMode === 'cinematic' ? 14 : 0 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: visualMode === 'cinematic' ? 620 : 320, delay: 90 }}
            style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lesson Content</Text>
            <View style={styles.sectionBody}>
              <LessonBlockRenderer blocks={layoutBlocks as any} lessonType={lesson.lesson_type} visualMode={visualMode} />
            </View>
          </MotiView>
        )}

        {!isStudent &&
          (lessonPlan?.summary_notes || objectives.length || activities.length || assessments.length) ? (
            <Section title="Teaching Plan" colors={colors}>
              {!!lessonPlan?.summary_notes && (
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{lessonPlan.summary_notes}</Text>
              )}
              {objectives.map((item, index) => (
                <Text key={`o-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>
                  • {item}
                </Text>
              ))}
              {activities.map((item, index) => (
                <Text key={`a-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>
                  • {item}
                </Text>
              ))}
              {assessments.map((item, index) => (
                <Text key={`m-${index}`} style={[styles.bullet, { color: colors.textSecondary }]}>
                  • {item}
                </Text>
              ))}
            </Section>
          ) : null}

        {materials.length > 0 && (
          <Section title="Materials" colors={colors}>
            {canEditLesson ? (
              <TouchableOpacity
                style={[styles.materialManageBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}
                onPress={() => navigation.navigate(ROUTES.LessonEditor, { lessonId: lesson.id, courseId: lesson.course_id ?? undefined })}
              >
                <Text style={[styles.materialManageBtnText, { color: colors.primary }]}>Add / Edit lesson materials</Text>
              </TouchableOpacity>
            ) : null}
            {materials.map((material) => (
              <TouchableOpacity key={material.id} onPress={() => openUrl(material.file_url, 'This material does not have a valid file URL.')} style={[styles.rowCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{material.title}</Text>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{(material.file_type ?? 'resource').toUpperCase()}</Text>
                </View>
                <Text style={[styles.openText, { color: colors.primary }]}>{isVideoMaterial(material) ? 'PLAY' : 'OPEN'}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {assignments.length > 0 && (
          <Section title="Assignments" colors={colors}>
            {assignments.map((assignment) => (
              <TouchableOpacity key={assignment.id} onPress={() => navigation.navigate(ROUTES.AssignmentDetail, { assignmentId: assignment.id, title: assignment.title })} style={[styles.rowCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
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

        {/* ── Voice Reader (Neural TTS, mirrors web NeuralVoiceReader) ── */}
        {!!(lesson.lesson_notes || lesson.content) && (
          <LessonVoiceReader
            content={lesson.lesson_notes || lesson.content || lesson.title}
            title={lesson.title}
          />
        )}

        {/* ── AI Learning Suite (Tutor · Image · Video · Diagram) ── */}
        <LessonAIPanel
          lessonTitle={lesson.title}
          lessonNotes={lesson.lesson_notes}
          courseTitle={lesson.courses?.title}
          gradeLevel={null}
        />

        <TouchableOpacity onPress={markComplete} disabled={marking || completed} style={[styles.primaryAction, { backgroundColor: completed ? colors.success : colors.primary, opacity: marking ? 0.8 : 1, marginTop: SPACING.xl }]}>
          {marking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionText}>{completed ? 'Lesson Completed' : 'Mark Lesson Complete'}</Text>}
        </TouchableOpacity>

        <View style={styles.navRow}>
          {previousLesson ? (
            <TouchableOpacity style={[styles.navCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => { light(); navigation.push(ROUTES.LessonDetail, { lessonId: previousLesson.id }); }}>
              <Text style={[styles.metaText, { color: colors.textMuted }]}>PREVIOUS</Text>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{previousLesson.title}</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}
          {nextLesson ? (
            <TouchableOpacity style={[styles.navCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => { light(); navigation.push(ROUTES.LessonDetail, { lessonId: nextLesson.id }); }}>
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
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  modeLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.8 },
  modeSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS.full, padding: 3 },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  modeBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11 },
  bullet: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  track: { height: 7, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full },
  primaryAction: { marginTop: SPACING.lg, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  primaryActionText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff', letterSpacing: 0.4 },
  quickRow: { flexDirection: 'row', gap: 12, marginTop: SPACING.lg },
  quickCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  quickLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  quickValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, marginTop: 6 },
  section: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md },
  sectionBody: { gap: 12 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8 },
  rowCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
  materialManageBtn: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: SPACING.md, alignItems: 'center' },
  materialManageBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  metaText: { fontFamily: FONT_FAMILY.mono, fontSize: 10 },
  openText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.6 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: SPACING.xl },
  navCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
});

/**
 * Create / edit lessons with the same AI engine as web `/dashboard/lessons/add` + `/edit`
 * (`webLessonAi` prompts + post-save lesson_plans + assignment-block rows).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { assignmentService } from '../../services/assignment.service';
import { courseService } from '../../services/course.service';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import type { Json } from '../../types/supabase';
import type { WebLessonGenRequest, WebLessonMode } from '../../lib/webLessonAi';
import { LESSON_AI_PRESET_SUBJECTS, lessonCoverImageUrl } from '../../lib/lessonAiPort';
import { expertAiService } from '../../services/expertAi.service';
import {
  requireLessonAiTopic,
  trackLessonAiEvent,
} from '../../lib/lessonAiIntegration';

interface ProgramRow {
  id: string;
  name: string;
}

interface CourseRow {
  id: string;
  title: string;
  program_id: string | null;
  programs?: { name: string | null } | null;
}

const LESSON_TYPES = ['hands-on', 'video', 'interactive', 'workshop', 'coding', 'reading'] as const;
const STATUSES = ['draft', 'scheduled', 'active', 'completed'] as const;
const AI_MODES: { id: WebLessonMode; label: string }[] = [
  { id: 'academic', label: 'Academic' },
  { id: 'project', label: 'Project' },
  { id: 'interactive', label: 'Interactive' },
];

const AI_GRADES = [
  'KG',
  'Basic 1',
  'Basic 2',
  'Basic 3',
  'Basic 4',
  'Basic 5',
  'Basic 6',
  'JSS1',
  'JSS2',
  'JSS3',
  'JSS1–JSS3',
  'SS1',
  'SS2',
  'SS3',
  'SS1–SS3',
  'JSS1–SS3',
];

function buildPlanAndAssignmentsFromLayout(contentLayout: any[], objectives: string[]) {
  const activityText = contentLayout
    .filter((b: any) => b?.type === 'activity')
    .map((b: any) =>
      [b.title ? `Activity: ${b.title}` : null, b.instructions, Array.isArray(b.steps) ? b.steps.map((s: string, si: number) => `  ${si + 1}. ${s}`).join('\n') : null]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
  const assessmentText = contentLayout
    .filter((b: any) => b?.type === 'quiz' || b?.type === 'assignment-block')
    .map((b: any) => (b.type === 'quiz' ? `Quiz: ${b.question}` : `${b.title || 'Assignment'}: ${b.instructions || ''}`))
    .join('\n\n');
  return {
    objectivesJoined: objectives.length > 0 ? objectives.join('\n') : null,
    activityText: activityText || null,
    assessmentText: assessmentText || null,
  };
}

export default function LessonEditorScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const lessonId = route.params?.lessonId as string | undefined;
  const initialCourseId = route.params?.courseId as string | undefined;
  const initialProgramId = route.params?.programId as string | undefined;

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState(initialProgramId || '');
  const [loadingBoot, setLoadingBoot] = useState(!!lessonId);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [aiMode, setAiMode] = useState<WebLessonMode>('academic');
  const [aiGrade, setAiGrade] = useState('JSS1–SS3');
  const [aiSubject, setAiSubject] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiObjectives, setAiObjectives] = useState<string[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    lesson_notes: '',
    course_id: initialCourseId || '',
    lesson_type: 'hands-on',
    duration_minutes: '60',
    video_url: '',
    status: 'draft' as (typeof STATUSES)[number],
    order_index: '',
    layoutJson: '[]',
  });

  const selectedCourse = useMemo(() => courses.find((c) => c.id === form.course_id), [courses, form.course_id]);

  const aiBase = useCallback((): WebLessonGenRequest => {
    const courseName = selectedCourse?.title ?? undefined;
    const programName = selectedCourse?.programs?.name ?? programs.find((p) => p.id === selectedProgramId)?.name;
    return {
      topic: aiTopic.trim() || form.title.trim() || 'Untitled topic',
      gradeLevel: aiGrade,
      subject: aiSubject.trim() || courseName,
      durationMinutes: parseInt(form.duration_minutes, 10) || 60,
      contentType: form.lesson_type,
      lessonMode: aiMode,
      courseName,
      programName: programName ?? undefined,
    };
  }, [aiTopic, form.title, form.duration_minutes, form.lesson_type, aiGrade, aiSubject, aiMode, selectedCourse, programs, selectedProgramId]);

  const loadSiblingTitles = useCallback(async () => {
    if (!form.course_id) return [] as string[];
    return courseService.listSiblingLessonTitles(form.course_id, lessonId);
  }, [form.course_id, lessonId]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const progData = await courseService.listActiveProgramsForEditor();
        setPrograms(progData as ProgramRow[]);

        const courseList = await courseService.listCoursesForLessonEditor(profile.school_id);
        const list = courseList as CourseRow[];
        setCourses(list);

        if (initialCourseId) {
          const c = list.find((x) => x.id === initialCourseId);
          if (c?.program_id) setSelectedProgramId(c.program_id);
          setForm((f) => ({ ...f, course_id: initialCourseId }));
          if (c?.title) {
            setAiSubject(c.title);
            setAiTopic((t) => t || c.title);
          }
        } else if (initialProgramId && list.length) {
          setSelectedProgramId(initialProgramId);
          const m = list.find((c) => c.program_id === initialProgramId);
          if (m) setForm((f) => ({ ...f, course_id: m.id }));
        }
      } catch {
        setPrograms([]);
        setCourses([]);
      }
    })();
  }, [profile?.id, profile?.school_id, initialCourseId, initialProgramId]);

  useEffect(() => {
    if (!lessonId || !profile) return;
    (async () => {
      try {
        const row = await courseService.getLessonRow(lessonId);
        const layout = row.content_layout;
        setForm({
          title: row.title ?? '',
          description: row.description ?? '',
          lesson_notes: row.lesson_notes ?? '',
          course_id: row.course_id ?? '',
          lesson_type: (row.lesson_type as any) || 'hands-on',
          duration_minutes: row.duration_minutes != null ? String(row.duration_minutes) : '60',
          video_url: row.video_url ?? '',
          status: (row.status as any) || 'draft',
          order_index: row.order_index != null ? String(row.order_index) : '',
          layoutJson: JSON.stringify(layout ?? [], null, 2),
        });
        if (row.course_id) {
          const courseRow = await courseService.getCourseProgramAndTitle(row.course_id);
          if (courseRow?.program_id) setSelectedProgramId(courseRow.program_id);
          if (courseRow?.title) {
            setAiSubject((s) => s || courseRow.title);
            setAiTopic((t) => t || courseRow.title);
          }
        }
        const objectivesText = await courseService.getLessonPlanObjectives(lessonId);
        if (objectivesText) {
          setAiObjectives(objectivesText.split('\n').map((s) => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean));
        }
      } catch (e: any) {
        Alert.alert('Load failed', e.message);
        navigation.goBack();
      } finally {
        setLoadingBoot(false);
      }
    })();
  }, [lessonId, profile?.id, navigation]);

  const handleCourseChange = (courseId: string) => {
    setForm((f) => ({ ...f, course_id: courseId }));
    const c = courses.find((x) => x.id === courseId);
    if (c?.title) {
      setAiSubject((s) => s || c.title);
      setAiTopic((t) => t || c.title);
    }
  };

  const runFullAi = async () => {
    let topic: string;
    try {
      topic = requireLessonAiTopic(aiTopic.trim() || form.title.trim());
    } catch {
      Alert.alert('Topic required', 'Enter a lesson topic (or title) first.');
      return;
    }
    try {
      const data = await expertAiService.generate({
        type: 'lesson',
        topic: topic.trim(),
        gradeLevel: aiGrade,
        subject: aiSubject.trim() || undefined,
        programName: profile?.school_name ?? undefined,
      });

      if (data.objectives?.length) setAiObjectives(data.objectives);
      setForm((f) => ({
        ...f,
        title: data.title ?? f.title,
        description: data.description ?? f.description,
        lesson_notes: data.lesson_notes ?? f.lesson_notes,
        duration_minutes: data.duration_minutes != null ? String(data.duration_minutes) : f.duration_minutes,
        lesson_type: data.lesson_type ?? f.lesson_type,
        video_url: data.video_url ?? f.video_url,
        layoutJson: Array.isArray(data.content_layout) ? JSON.stringify(data.content_layout, null, 2) : '[]',
      }));
      setAiOpen(false);
      void trackLessonAiEvent(profile?.id ?? null, profile?.school_id ?? null, 'full', {
        course_id: form.course_id || null,
        lesson_id: lessonId ?? null,
      });
    } catch (e: any) {
      Alert.alert('Generation failed', e.message ?? 'Unknown error');
    } finally {
      setAiGenerating(false);
    }
  };

  const runNotesAi = async () => {
    let topic: string;
    try {
      topic = requireLessonAiTopic(form.title.trim() || aiTopic.trim());
    } catch {
      Alert.alert('Title required', 'Enter a lesson title or topic first.');
      return;
    }
    try {
      const data = await expertAiService.generate({
        type: 'lesson-notes',
        topic,
        gradeLevel: aiGrade,
        subject: aiSubject.trim() || undefined,
        programName: profile?.school_name ?? undefined,
      });
      if (data.lesson_notes) setForm((f) => ({ ...f, lesson_notes: data.lesson_notes }));
      void trackLessonAiEvent(profile?.id ?? null, profile?.school_id ?? null, 'notes', {
        course_id: form.course_id || null,
        lesson_id: lessonId ?? null,
      });
    } catch (e: any) {
      Alert.alert('Notes failed', e.message ?? 'Unknown error');
    } finally {
      setAiNotesLoading(false);
    }
  };

  const parseLayout = (): any[] => {
    try {
      const v = JSON.parse(form.layoutJson || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      throw new Error('Content layout must be valid JSON array.');
    }
  };

  const syncAssignmentsAndPlan = async (newLessonId: string, courseId: string, contentLayout: any[], objectives: string[]) => {
    if (!profile?.id || !courseId) return;

    const normalizedTitles = await assignmentService.listNormalizedAssignmentTitlesForLesson(newLessonId);
    const existingTitles = new Set(normalizedTitles);

    const blocks = contentLayout.filter((b: any) => b?.type === 'assignment-block' && b?.title?.trim());
    for (const block of blocks) {
      const t = block.title.trim();
      if (existingTitles.has(t.toLowerCase())) continue;
      const instructions = [
        block.instructions,
        Array.isArray(block.deliverables)
          ? `\n\nDeliverables:\n${block.deliverables.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('');
      try {
        await assignmentService.createAssignment({
          title: t,
          instructions: instructions || null,
          course_id: courseId,
          lesson_id: newLessonId,
          assignment_type: 'project',
          max_points: 100,
          is_active: true,
          created_by: profile.id,
          school_id: profile.school_id ?? null,
          school_name: profile.school_name ?? null,
        });
      } catch (err: any) {
        console.warn('assignment-block insert', err?.message);
      }
    }

    const { objectivesJoined, activityText, assessmentText } = buildPlanAndAssignmentsFromLayout(contentLayout, objectives);
    if (objectivesJoined || activityText || assessmentText || contentLayout.length) {
      await courseService.upsertLessonPlan({
        lesson_id: newLessonId,
        objectives: objectivesJoined,
        activities: activityText,
        assessment_methods: assessmentText,
        updated_at: new Date().toISOString(),
      });
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.course_id) {
      Alert.alert('Validation', 'Title and course are required.');
      return;
    }
    let contentLayout: any[];
    try {
      contentLayout = parseLayout();
    } catch (e: any) {
      Alert.alert('Layout', e.message);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        lesson_notes: form.lesson_notes.trim() || null,
        course_id: form.course_id,
        lesson_type: form.lesson_type,
        status: form.status,
        video_url: form.video_url.trim() || null,
        content_layout: contentLayout as unknown as Json,
        duration_minutes: parseInt(form.duration_minutes, 10) || null,
        order_index: form.order_index ? parseInt(form.order_index, 10) : null,
        updated_at: new Date().toISOString(),
        school_id: profile?.school_id ?? null,
        school_name: profile?.school_name ?? null,
      };

      if (lessonId) {
        await courseService.updateLesson(lessonId, payload);
        await syncAssignmentsAndPlan(lessonId, form.course_id, contentLayout, aiObjectives);
        Alert.alert('Saved', 'Lesson updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        const newId = await courseService.insertLessonReturningId({
          ...payload,
          created_by: profile?.id ?? null,
          created_at: new Date().toISOString(),
        });
        await syncAssignmentsAndPlan(newId, form.course_id, contentLayout, aiObjectives);
        Alert.alert('Created', 'Lesson saved.', [
          { text: 'View lesson', onPress: () => navigation.replace(ROUTES.LessonDetail, { lessonId: newId }) },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingBoot) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const filteredCourses = selectedProgramId ? courses.filter((c) => c.program_id === selectedProgramId) : courses;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={lessonId ? 'Edit lesson' : 'New lesson'}
        subtitle="Web-aligned AI + content blocks"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setAiOpen(!aiOpen)} style={[styles.aiHeader, { borderColor: colors.border }]}>
            <Text style={[styles.aiHeaderTitle, { color: colors.textPrimary }]}>Quick Lesson Assistant</Text>
            <Text style={{ color: colors.textMuted }}>{aiOpen ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>

          {aiOpen ? (
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Lesson mode (AI)</Text>
              <View style={styles.rowWrap}>
                {AI_MODES.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setAiMode(m.id)}
                    style={[styles.pill, aiMode === m.id && styles.pillOn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.pillText, { color: aiMode === m.id ? '#fff' : colors.textPrimary }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Grade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                {AI_GRADES.map((g) => (
                  <TouchableOpacity key={g} onPress={() => setAiGrade(g)} style={[styles.pill, aiGrade === g && styles.pillOn, { borderColor: colors.border }]}>
                    <Text style={[styles.pillText, { color: aiGrade === g ? '#fff' : colors.textMuted }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Field label="Topic *" colors={colors} value={aiTopic} onChangeText={setAiTopic} placeholder="e.g. Python loops" />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Subject (quick pick)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                {LESSON_AI_PRESET_SUBJECTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setAiSubject(s)}
                    style={[styles.pill, aiSubject === s && styles.pillOn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.pillText, { color: aiSubject === s ? '#fff' : colors.textMuted }]} numberOfLines={1}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Field label="Subject" colors={colors} value={aiSubject} onChangeText={setAiSubject} placeholder="e.g. Python" />
              {aiTopic.trim().length > 1 && aiSubject.trim().length > 1 ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.hint, { color: colors.textMuted }]}>Cover idea (Pollinations, not saved)</Text>
                  <Image
                    source={{ uri: lessonCoverImageUrl(aiTopic, aiSubject, 384, 256) }}
                    style={[styles.aiCoverThumb, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
              <TouchableOpacity
                onPress={runFullAi}
                disabled={aiGenerating || aiNotesLoading}
                style={[styles.aiBtn, { opacity: aiGenerating ? 0.7 : 1 }]}
              >
                <LinearGradient colors={['#7c3aed', '#5b21b6']} style={styles.aiBtnGrad}>
                  {aiGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>Build lesson (full)</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={runNotesAi} disabled={aiNotesLoading || aiGenerating} style={{ marginTop: 10 }}>
                <Text style={{ color: '#ea580c', fontFamily: FONT_FAMILY.bodySemi }}>
                  {aiNotesLoading ? 'Writing notes…' : 'Generate notes only'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Lesson plan</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Programme</Text>
            <ScrollView horizontal style={{ marginBottom: 8 }}>
              <View style={styles.rowWrap}>
                {programs.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setSelectedProgramId(p.id)} style={[styles.pill, selectedProgramId === p.id && styles.pillOn, { borderColor: colors.border }]}>
                    <Text style={[styles.pillText, { color: selectedProgramId === p.id ? '#fff' : colors.textPrimary }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Course *</Text>
            <ScrollView horizontal>
              <View style={styles.rowWrap}>
                {filteredCourses.map((c) => (
                  <TouchableOpacity key={c.id} onPress={() => handleCourseChange(c.id)} style={[styles.pill, form.course_id === c.id && styles.pillOn, { borderColor: colors.border }]}>
                    <Text style={[styles.pillText, { color: form.course_id === c.id ? '#fff' : colors.textPrimary }]} numberOfLines={2}>
                      {c.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Field label="Title *" colors={colors} value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} />
            <Field label="Description" colors={colors} value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} multiline />
            <Field label="Study notes" colors={colors} value={form.lesson_notes} onChangeText={(t) => setForm((f) => ({ ...f, lesson_notes: t }))} multiline tall />
            <Field label="Video URL" colors={colors} value={form.video_url} onChangeText={(t) => setForm((f) => ({ ...f, video_url: t }))} />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
                <ScrollView horizontal contentContainerStyle={styles.rowWrap}>
                  {LESSON_TYPES.map((lt) => (
                    <TouchableOpacity key={lt} onPress={() => setForm((f) => ({ ...f, lesson_type: lt }))} style={[styles.pill, form.lesson_type === lt && styles.pillOn, { borderColor: colors.border }]}>
                      <Text style={[styles.pillText, { color: form.lesson_type === lt ? '#fff' : colors.textMuted }]}>{lt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.row2}>
              <Field label="Duration (min)" colors={colors} value={form.duration_minutes} onChangeText={(t) => setForm((f) => ({ ...f, duration_minutes: t }))} narrow />
              <Field label="Order" colors={colors} value={form.order_index} onChangeText={(t) => setForm((f) => ({ ...f, order_index: t }))} narrow />
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.rowWrap}>
              {STATUSES.map((st) => (
                <TouchableOpacity key={st} onPress={() => setForm((f) => ({ ...f, status: st }))} style={[styles.pill, form.status === st && styles.pillOn, { borderColor: colors.border }]}>
                  <Text style={[styles.pillText, { color: form.status === st ? '#fff' : colors.textMuted }]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Content layout (JSON)</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>AI fills this with blocks (mermaid, quiz, activity, …). Edit carefully or regenerate.</Text>
            <TextInput
              style={[styles.jsonInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={form.layoutJson}
              onChangeText={(t) => setForm((f) => ({ ...f, layoutJson: t }))}
              multiline
              textAlignVertical="top"
              placeholder="[]"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity onPress={handleSave} disabled={saving} style={{ marginBottom: 32 }}>
            <LinearGradient colors={['#ea580c', '#c2410c']} style={styles.saveGrad}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{lessonId ? 'Save changes' : 'Create lesson'}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  tall,
  narrow,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  tall?: boolean;
  narrow?: boolean;
  colors: any;
}) {
  return (
    <View style={{ marginBottom: SPACING.md, flex: narrow ? 1 : undefined }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: colors.border },
          multiline && { minHeight: tall ? 140 : 80 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: 48 },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  aiHeaderTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, marginBottom: SPACING.md, textTransform: 'uppercase', letterSpacing: 1 },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
  },
  jsonInput: { borderWidth: 1, borderRadius: RADIUS.md, minHeight: 220, padding: SPACING.md, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  hint: { fontSize: FONT_SIZE.xs, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row2: { flexDirection: 'row', gap: SPACING.md },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#444' },
  pillOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  pillText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  aiBtn: { marginTop: SPACING.md, borderRadius: RADIUS.md, overflow: 'hidden' },
  aiBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontFamily: FONT_FAMILY.bodySemi, textTransform: 'uppercase', letterSpacing: 1 },
  saveGrad: { paddingVertical: 16, borderRadius: RADIUS.lg, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, textTransform: 'uppercase', letterSpacing: 1 },
  aiCoverThumb: { width: '100%', maxWidth: 384, height: 128, borderRadius: RADIUS.md, borderWidth: 1, marginTop: 6 },
});

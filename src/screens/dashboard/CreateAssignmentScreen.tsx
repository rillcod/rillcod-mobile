import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { assignmentService } from '../../services/assignment.service';
import { courseService } from '../../services/course.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';

const ASSIGNMENT_TYPES = [
  { key: 'theory', label: 'Theory', emoji: '📖', color: COLORS.info },
  { key: 'practical', label: 'Practical', emoji: '🔬', color: COLORS.success },
  { key: 'quiz', label: 'Quiz', emoji: '🎯', color: COLORS.warning },
  { key: 'project', label: 'Project', emoji: '🚀', color: '#7c3aed' },
  { key: 'homework', label: 'Homework', emoji: '🏠', color: COLORS.accent },
];

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', required = false, multiline = false }: any) {
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[field.input, multiline && field.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCapitalize="sentences"
      />
    </View>
  );
}

export default function CreateAssignmentScreen({ navigation, route }: any) {
  const { classId: paramClassId, className: paramClassName, assignmentId: paramAssignmentId } =
    (route.params ?? {}) as { classId?: string; className?: string; assignmentId?: string };
  const isEditMode = !!paramAssignmentId;
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(!!paramAssignmentId);
  const [resolvedClassId, setResolvedClassId] = useState<string | null>(paramClassId ?? null);
  const [resolvedClassName, setResolvedClassName] = useState(paramClassName ?? '');
  const [programId, setProgramId] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; course_id: string | null }[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    instructions: '',
    type: 'theory',
    max_score: '100',
    due_date: '',
    due_time: '23:59',
    passing_score: '50',
    allow_late: true,
    course_id: '',
    lesson_id: '',
  });

  const set = (key: string) => (val: any) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    if (!paramAssignmentId) return;
    let cancelled = false;
    (async () => {
      let data: Awaited<ReturnType<typeof assignmentService.getAssignmentForEditor>> | null = null;
      try {
        data = await assignmentService.getAssignmentForEditor(paramAssignmentId);
      } catch {
        data = null;
      }
      if (cancelled) return;
      if (!data?.class_id) {
        Alert.alert('Error', 'Could not load assignment.');
        navigation.goBack();
        return;
      }
      const row = data as any;
      setResolvedClassId(row.class_id);
      setResolvedClassName(row.classes?.name ?? 'Class');
      const due = row.due_date as string | null;
      let due_date = '';
      let due_time = '23:59';
      if (due && typeof due === 'string') {
        const [d, rest] = due.split('T');
        due_date = d ?? '';
        if (rest) due_time = rest.slice(0, 5) || '23:59';
      }
      const meta = row.metadata ?? {};
      const typeKey = ASSIGNMENT_TYPES.some((t) => t.key === row.assignment_type)
        ? row.assignment_type
        : 'theory';
      setForm({
        title: row.title ?? '',
        description: row.description ?? '',
        instructions: row.instructions ?? '',
        type: typeKey,
        max_score: String(row.max_points ?? 100),
        due_date,
        due_time,
        passing_score: String(meta.passing_score ?? 50),
        allow_late: meta.allow_late !== false,
        course_id: row.course_id ?? '',
        lesson_id: row.lesson_id ?? '',
      });
      setBootLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [paramAssignmentId, navigation]);

  useEffect(() => {
    const loadClassContext = async () => {
      if (!resolvedClassId) {
        setProgramId(null);
        setCourses([]);
        return;
      }
      const nextProgramId = await courseService.getClassProgramId(resolvedClassId);
      setProgramId(nextProgramId);
      if (!nextProgramId) return;

      const courseRows = await courseService.listCourseTitlesForProgram(nextProgramId);
      setCourses((courseRows ?? []) as { id: string; title: string }[]);
    };

    loadClassContext();
  }, [resolvedClassId]);

  useEffect(() => {
    const loadLessons = async () => {
      if (!form.course_id) {
        setLessons([]);
        return;
      }

      const lessonRows = await courseService.listLessonsMinimalForCourse(form.course_id);
      setLessons((lessonRows ?? []) as { id: string; title: string; course_id: string | null }[]);
    };

    loadLessons();
  }, [form.course_id]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.course_id) ?? null,
    [courses, form.course_id]
  );

  const submit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Title is required');
      return;
    }
    if (!resolvedClassId) {
      Alert.alert('Missing class', 'Open this screen from a class or assignment.');
      return;
    }

    setSaving(true);
    const dueDateTime = form.due_date ? `${form.due_date}T${form.due_time}:00` : null;

    if (isEditMode && paramAssignmentId) {
      try {
        await assignmentService.updateAssignment(paramAssignmentId, {
          course_id: form.course_id || null,
          lesson_id: form.lesson_id || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          instructions: form.instructions.trim() || null,
          assignment_type: form.type,
          max_points: parseInt(form.max_score, 10) || 100,
          due_date: dueDateTime,
          metadata: {
            passing_score: parseInt(form.passing_score, 10) || 50,
            allow_late: form.allow_late,
          },
        });
      } catch (error: any) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }

      Alert.alert('Saved', `"${form.title}" was updated.`, [{ text: 'Done', onPress: () => navigation.goBack() }]);
      setSaving(false);
      return;
    }

    try {
      await assignmentService.createAssignment({
        class_id: resolvedClassId,
        course_id: form.course_id || null,
        lesson_id: form.lesson_id || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        assignment_type: form.type,
        max_points: parseInt(form.max_score, 10) || 100,
        due_date: dueDateTime,
        metadata: {
          passing_score: parseInt(form.passing_score, 10) || 50,
          allow_late: form.allow_late,
        },
        created_by: profile?.id,
        school_id: profile?.school_id ?? null,
        school_name: profile?.school_name ?? null,
        is_active: true,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setSaving(false);
      return;
    }

    Alert.alert('Assignment Created!', `"${form.title}" has been posted to ${resolvedClassName}.`, [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
    setSaving(false);
  };

  const selectedType = ASSIGNMENT_TYPES.find((t) => t.key === form.type) ?? ASSIGNMENT_TYPES[0];

  if (bootLoading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!isEditMode && !resolvedClassId) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="New Assignment" onBack={() => navigation.goBack()} />
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.md }}>
          <Text style={{ fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary }}>
            Assignments are created from a class. Open Classes, pick a class, then use New Assignment.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.Classes)}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 12,
              paddingHorizontal: SPACING.lg,
              borderRadius: RADIUS.lg,
              backgroundColor: COLORS.primary,
            }}
          >
            <Text style={{ fontFamily: FONT_FAMILY.bodySemi, color: COLORS.white100 }}>Go to Classes</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={isEditMode ? 'Edit Assignment' : 'New Assignment'}
        subtitle={resolvedClassName || undefined}
        onBack={() => navigation.goBack()}
        accentColor={selectedType.color}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>

          {/* Type picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typePills}>
              {ASSIGNMENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => set('type')(t.key)}
                  style={[styles.typePill, form.type === t.key && { backgroundColor: t.color + '20', borderColor: t.color }]}
                >
                  <Text style={styles.typePillEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typePillText, form.type === t.key && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <Field label="Assignment Title" value={form.title} onChangeText={set('title')} placeholder="e.g. Introduction to Variables" required />
            <Field label="Description" value={form.description} onChangeText={set('description')} placeholder="Brief overview for students…" multiline />
            <Field label="Instructions" value={form.instructions} onChangeText={set('instructions')} placeholder="Step-by-step instructions…" multiline />

            {programId && courses.length > 0 ? (
              <>
                <Text style={styles.pickerLabel}>Course Link</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkPills}>
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, course_id: '', lesson_id: '' }))}
                    style={[styles.linkPill, !form.course_id && styles.linkPillActive]}
                  >
                    <Text style={[styles.linkPillText, !form.course_id && styles.linkPillTextActive]}>None</Text>
                  </TouchableOpacity>
                  {courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      onPress={() => setForm((f) => ({ ...f, course_id: course.id, lesson_id: '' }))}
                      style={[styles.linkPill, form.course_id === course.id && styles.linkPillActive]}
                    >
                      <Text style={[styles.linkPillText, form.course_id === course.id && styles.linkPillTextActive]}>{course.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {selectedCourse && lessons.length > 0 ? (
              <>
                <Text style={styles.pickerLabel}>Lesson Link</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkPills}>
                  <TouchableOpacity
                    onPress={() => set('lesson_id')('')}
                    style={[styles.linkPill, !form.lesson_id && styles.linkPillActive]}
                  >
                    <Text style={[styles.linkPillText, !form.lesson_id && styles.linkPillTextActive]}>None</Text>
                  </TouchableOpacity>
                  {lessons.map((lesson) => (
                    <TouchableOpacity
                      key={lesson.id}
                      onPress={() => set('lesson_id')(lesson.id)}
                      style={[styles.linkPill, form.lesson_id === lesson.id && styles.linkPillActive]}
                    >
                      <Text style={[styles.linkPillText, form.lesson_id === lesson.id && styles.linkPillTextActive]}>{lesson.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grading</Text>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Max Score" value={form.max_score} onChangeText={set('max_score')} placeholder="100" keyboardType="number-pad" required />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Passing Score" value={form.passing_score} onChangeText={set('passing_score')} placeholder="50" keyboardType="number-pad" />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deadline</Text>
            <View style={styles.row2}>
              <View style={{ flex: 2 }}>
                <Field label="Due Date" value={form.due_date} onChangeText={set('due_date')} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Time" value={form.due_time} onChangeText={set('due_time')} placeholder="23:59" />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => set('allow_late')(!form.allow_late)}
              style={styles.toggleRow}
            >
              <View style={[styles.toggleBox, form.allow_late && { backgroundColor: selectedType.color + '20', borderColor: selectedType.color }]}>
                {form.allow_late && <Text style={[styles.toggleCheck, { color: selectedType.color }]}>✓</Text>}
              </View>
              <Text style={styles.toggleLabel}>Allow late submissions</Text>
            </TouchableOpacity>
          </View>

          {/* Preview card */}
          <View style={[styles.previewCard, { borderColor: selectedType.color + '40' }]}>
            <LinearGradient colors={[selectedType.color + '10', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.previewEmoji}>{selectedType.emoji}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.previewTitle}>{form.title || 'Assignment Title'}</Text>
              <Text style={styles.previewMeta}>
                {selectedType.label} · Max {form.max_score} pts
                {form.due_date ? ` · Due ${form.due_date}` : ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={[selectedType.color, selectedType.color + 'cc']} style={styles.submitGrad}>
              {saving ? (
                <ActivityIndicator color={COLORS.white100} />
              ) : (
                <Text style={styles.submitText}>{isEditMode ? 'Save changes' : 'Post Assignment'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const field = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },
  pickerLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  linkPills: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  linkPill: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
  linkPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  linkPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  linkPillTextActive: { color: COLORS.primaryLight },

  typePills: { gap: SPACING.sm, paddingBottom: 4 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  typePillEmoji: { fontSize: 16 },
  typePillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  row2: { flexDirection: 'row', gap: SPACING.md },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  toggleBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  toggleCheck: { fontSize: 14, fontWeight: 'bold' },
  toggleLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  previewCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.xl, overflow: 'hidden' },
  previewEmoji: { fontSize: 28 },
  previewTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  previewMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
});

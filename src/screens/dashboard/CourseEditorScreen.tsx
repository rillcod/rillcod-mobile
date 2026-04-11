/**
 * Full-screen create / edit course — parity target: web `/dashboard/courses/new` & `[id]/edit`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { courseService } from '../../services/course.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';

interface Program {
  id: string;
  name: string;
  school_id: string | null;
}

interface School {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  full_name: string | null;
}

interface CourseFormState {
  title: string;
  description: string;
  content: string;
  durationHours: string;
  orderIndex: string;
  programId: string;
  schoolId: string;
  teacherId: string;
  isActive: boolean;
  /** When true, students cannot see this course in Learn or open it (staff still can). */
  isLocked: boolean;
}

const EMPTY_FORM: CourseFormState = {
  title: '',
  description: '',
  content: '',
  durationHours: '',
  orderIndex: '',
  programId: '',
  schoolId: '',
  teacherId: '',
  isActive: true,
  isLocked: false,
};

export default function CourseEditorScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const courseId = route.params?.courseId as string | undefined;
  const initialProgramId = route.params?.programId as string | undefined;

  const role = profile?.role;
  const isAdmin = role === 'admin';
  const canPickSchool = isAdmin;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingBoot, setLoadingBoot] = useState(!!courseId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CourseFormState>(EMPTY_FORM);

  const selectedSchoolId = form.schoolId || profile?.school_id || '';
  const availablePrograms = useMemo(() => {
    if (!selectedSchoolId) return programs;
    return programs.filter((p) => !p.school_id || p.school_id === selectedSchoolId);
  }, [programs, selectedSchoolId]);

  const loadMeta = useCallback(async () => {
    if (!profile) return;
    const { programs: programRows, schools: schoolRows, teachers: teacherRows } = await courseService.loadCourseEditorMeta({
      isAdmin,
      schoolId: profile.school_id,
    });
    setPrograms(programRows as Program[]);
    setSchools(schoolRows as School[]);
    setTeachers(teacherRows as Teacher[]);
  }, [profile, isAdmin]);

  useEffect(() => {
    loadMeta().catch((e) => Alert.alert('Load failed', e.message));
  }, [loadMeta]);

  useEffect(() => {
    if (!courseId) {
      setForm({
        ...EMPTY_FORM,
        schoolId: profile?.school_id || '',
        programId: initialProgramId || '',
      });
      setLoadingBoot(false);
      return;
    }

    (async () => {
      try {
        const row = await courseService.getCourseRowById(courseId);
        if (!row) throw new Error('Course not found');
        setForm({
          title: row.title ?? '',
          description: row.description ?? '',
          content: row.content ?? '',
          durationHours: row.duration_hours != null ? String(row.duration_hours) : '',
          orderIndex: row.order_index != null ? String(row.order_index) : '',
          programId: row.program_id || '',
          schoolId: row.school_id || profile?.school_id || '',
          teacherId: row.teacher_id || '',
          isActive: row.is_active ?? true,
          isLocked: row.is_locked ?? false,
        });
      } catch (e: any) {
        Alert.alert('Error', e.message);
        navigation.goBack();
      } finally {
        setLoadingBoot(false);
      }
    })();
  }, [courseId, profile?.school_id, initialProgramId, navigation]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }
    if (canPickSchool && !form.schoolId && !profile?.school_id) {
      Alert.alert('Validation', 'Select a school for this course.');
      return;
    }

    setSaving(true);
    try {
      const schoolName =
        schools.find((s) => s.id === (form.schoolId || profile?.school_id || ''))?.name || profile?.school_name || null;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        content: form.content.trim() || null,
        duration_hours: form.durationHours ? parseInt(form.durationHours, 10) : null,
        order_index: form.orderIndex ? parseInt(form.orderIndex, 10) : null,
        program_id: form.programId || null,
        school_id: form.schoolId || profile?.school_id || null,
        school_name: schoolName,
        teacher_id: form.teacherId || null,
        is_active: form.isActive,
        is_locked: form.isLocked,
        updated_at: new Date().toISOString(),
      };

      if (courseId) {
        await courseService.updateCourse(courseId, payload);
        Alert.alert('Saved', 'Course updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        const newId = await courseService.insertCourseReturningId({ ...payload, created_at: new Date().toISOString() });
        Alert.alert('Created', 'Course saved.', [
          { text: 'View', onPress: () => navigation.replace(ROUTES.CourseDetail, { courseId: newId, programId: form.programId || undefined }) },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingBoot) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader
        title={courseId ? 'Edit course' : 'New course'}
        subtitle="Match web course fields"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.textMuted }]}>COURSE TITLE</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="E.g. Advanced robotics"
            placeholderTextColor={colors.textMuted}
            value={form.title}
            onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Module description…"
            placeholderTextColor={colors.textMuted}
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            multiline
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>CONTENT / OUTLINE</Text>
          <TextInput
            style={[styles.input, styles.largeTextArea, { color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Course outline, expectations, or lesson map…"
            placeholderTextColor={colors.textMuted}
            value={form.content}
            onChangeText={(v) => setForm((f) => ({ ...f, content: v }))}
            multiline
          />

          <View style={styles.doubleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>DURATION (HOURS)</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="40"
                placeholderTextColor={colors.textMuted}
                value={form.durationHours}
                onChangeText={(v) => setForm((f) => ({ ...f, durationHours: v }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>ORDER INDEX</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                value={form.orderIndex}
                onChangeText={(v) => setForm((f) => ({ ...f, orderIndex: v }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          {schools.length > 0 ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>SCHOOL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                <TouchableOpacity
                  style={[
                    styles.programPill,
                    { borderColor: colors.border },
                    !form.schoolId && !profile?.school_id && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => canPickSchool && setForm((f) => ({ ...f, schoolId: '' }))}
                >
                  <Text
                    style={[
                      styles.programPillText,
                      { color: colors.textMuted },
                      !form.schoolId && !profile?.school_id && { color: colors.primary, fontWeight: 'bold' },
                    ]}
                  >
                    NO SCHOOL
                  </Text>
                </TouchableOpacity>
                {schools.map((school) => {
                  const selected = (form.schoolId || profile?.school_id || '') === school.id;
                  return (
                    <TouchableOpacity
                      key={school.id}
                      style={[
                        styles.programPill,
                        { borderColor: colors.border },
                        selected && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                      ]}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          schoolId: school.id,
                          programId:
                            f.programId && programs.some((p) => p.id === f.programId && (!p.school_id || p.school_id === school.id))
                              ? f.programId
                              : '',
                        }))
                      }
                      disabled={!canPickSchool && !selected}
                    >
                      <Text style={[styles.programPillText, { color: colors.textMuted }, selected && { color: colors.primary, fontWeight: 'bold' }]}>
                        {school.name.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>LINK TO PROGRAM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            <TouchableOpacity
              style={[
                styles.programPill,
                { borderColor: colors.border },
                !form.programId && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
              ]}
              onPress={() => setForm((f) => ({ ...f, programId: '' }))}
            >
              <Text style={[styles.programPillText, { color: colors.textMuted }, !form.programId && { color: colors.primary, fontWeight: 'bold' }]}>
                NO PROGRAM
              </Text>
            </TouchableOpacity>
            {availablePrograms.map((program) => (
              <TouchableOpacity
                key={program.id}
                style={[
                  styles.programPill,
                  { borderColor: colors.border },
                  form.programId === program.id && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    programId: program.id,
                    schoolId: f.schoolId || program.school_id || f.schoolId,
                  }))
                }
              >
                <Text
                  style={[
                    styles.programPillText,
                    { color: colors.textMuted },
                    form.programId === program.id && { color: colors.primary, fontWeight: 'bold' },
                  ]}
                >
                  {program.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>ASSIGN TEACHER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            <TouchableOpacity
              style={[
                styles.programPill,
                { borderColor: colors.border },
                !form.teacherId && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
              ]}
              onPress={() => setForm((f) => ({ ...f, teacherId: '' }))}
            >
              <Text style={[styles.programPillText, { color: colors.textMuted }, !form.teacherId && { color: colors.primary, fontWeight: 'bold' }]}>
                UNASSIGNED
              </Text>
            </TouchableOpacity>
            {teachers.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                style={[
                  styles.programPill,
                  { borderColor: colors.border },
                  form.teacherId === teacher.id && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setForm((f) => ({ ...f, teacherId: teacher.id }))}
              >
                <Text
                  style={[
                    styles.programPillText,
                    { color: colors.textMuted },
                    form.teacherId === teacher.id && { color: colors.primary, fontWeight: 'bold' },
                  ]}
                >
                  {(teacher.full_name || 'Teacher').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: colors.textMuted, marginBottom: 0 }]}>ACTIVE COURSE</Text>
            <Switch
              value={form.isActive}
              onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              trackColor={{ true: colors.success, false: colors.border }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: SPACING.md }}>
              <Text style={[styles.label, { color: colors.textMuted, marginBottom: 4 }]}>LOCK FROM STUDENTS</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                While locked, students cannot open this course or see it in Learn. Staff always see it.
              </Text>
            </View>
            <Switch
              value={form.isLocked}
              onValueChange={(v) => setForm((f) => ({ ...f, isLocked: v }))}
              trackColor={{ true: '#c9a227', false: colors.border }}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <LinearGradient colors={colors.gradPrimary} style={styles.saveBtnInner}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{courseId ? 'Save course' : 'Create course'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: { bg: string }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
    label: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1, marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, fontFamily: FONT_FAMILY.body },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    largeTextArea: { minHeight: 120, textAlignVertical: 'top' },
    doubleRow: { flexDirection: 'row', gap: SPACING.md },
    programPill: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
    programPillText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg },
    hint: { fontSize: 11, fontFamily: FONT_FAMILY.body, lineHeight: 16 },
    saveBtn: { marginTop: SPACING.xl, borderRadius: RADIUS.sm, overflow: 'hidden' },
    saveBtnInner: { padding: 16, alignItems: 'center' },
    saveBtnText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyBold, color: '#fff', letterSpacing: 0.5 },
  });

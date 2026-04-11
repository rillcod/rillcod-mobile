import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { classService } from '../../services/class.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Teacher { id: string; full_name: string; email: string }
interface Program { id: string; name: string }

const CLASS_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'];

type ClassStatus = 'active' | 'scheduled' | 'completed';
const STATUS_OPTIONS: ClassStatus[] = ['active', 'scheduled', 'completed'];

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', required = false }: any) {
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={field.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="sentences"
      />
    </View>
  );
}

function sliceDate(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value.length >= 10 ? value.slice(0, 10) : value;
}

export default function AddClassScreen({ navigation, route }: any) {
  const classIdParam = route.params?.classId as string | undefined;
  const isEditMode = !!classIdParam;
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(!!classIdParam);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);
  const [showProgramPicker, setShowProgramPicker] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    teacher_id: '',
    teacher_name: '',
    program_id: '',
    program_title: '',
    max_students: '30',
    start_date: '',
    end_date: '',
    schedule: '',
    color: CLASS_COLORS[0],
    status: 'active' as ClassStatus,
  });

  const isAdmin = profile?.role === 'admin';

  const colorChoices = useMemo(() => {
    if (form.color && !CLASS_COLORS.includes(form.color)) {
      return [form.color, ...CLASS_COLORS];
    }
    return CLASS_COLORS;
  }, [form.color]);

  useEffect(() => {
    classService
      .listTeachersForClassPicker({ isAdmin, schoolId: profile?.school_id, limit: 100 })
      .then((data) => setTeachers(data as Teacher[]))
      .catch(() => setTeachers([]));

    classService
      .listActiveProgramOptions(100)
      .then((data) => setPrograms(data as Program[]))
      .catch(() => setPrograms([]));
  }, [isAdmin, profile]);

  useEffect(() => {
    if (!classIdParam) return;
    let cancelled = false;
    (async () => {
      let row: Awaited<ReturnType<typeof classService.getClassForEditor>>;
      try {
        row = await classService.getClassForEditor(classIdParam);
      } catch {
        if (cancelled) return;
        Alert.alert('Error', 'Could not load class.');
        navigation.goBack();
        return;
      }

      if (cancelled) return;

      const r = row as any;
      if (profile?.role === 'teacher' && r.teacher_id && r.teacher_id !== profile.id) {
        Alert.alert('Access denied', 'You can only edit your own classes.');
        navigation.goBack();
        return;
      }

      const st = (r.status as string) || 'active';
      const status: ClassStatus = STATUS_OPTIONS.includes(st as ClassStatus) ? (st as ClassStatus) : 'active';
      const rowColor = r.color && typeof r.color === 'string' ? r.color : CLASS_COLORS[0];

      setForm({
        name: r.name ?? '',
        description: r.description ?? '',
        teacher_id: r.teacher_id ?? '',
        teacher_name: r.portal_users?.full_name ?? '',
        program_id: r.program_id ?? '',
        program_title: r.programs?.name ?? '',
        max_students: r.max_students != null ? String(r.max_students) : '30',
        start_date: sliceDate(r.start_date),
        end_date: sliceDate(r.end_date),
        schedule: r.schedule ?? '',
        color: rowColor,
        status,
      });
      setBootLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classIdParam, navigation, profile?.id, profile?.role]);

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Class name is required');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      teacher_id: form.teacher_id || null,
      program_id: form.program_id || null,
      school_id: profile?.school_id ?? null,
      max_students: parseInt(form.max_students, 10) || 30,
      start_date: form.start_date.trim() || null,
      end_date: form.end_date.trim() || null,
      schedule: form.schedule.trim() || null,
      color: form.color || null,
      status: form.status,
    };

    if (isEditMode && classIdParam) {
      try {
        await classService.updateClass(classIdParam, payload);
        Alert.alert('Saved', `Class "${form.name}" was updated.`, [{ text: 'Done', onPress: () => navigation.goBack() }]);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Update failed');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await classService.createClass({
        ...payload,
        current_students: 0,
      });
      Alert.alert('Success', `Class "${form.name}" has been created.`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Create failed');
    } finally {
      setSaving(false);
    }

  };

  if (bootLoading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={isEditMode ? 'Edit Class' : 'Create Class'}
        onBack={() => navigation.goBack()}
        accentColor={COLORS.primary}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Information</Text>
            <Field label="Class Name" value={form.name} onChangeText={set('name')} placeholder="e.g. JSS 1 Coding Basics" required />
            <View style={field.wrap}>
              <Text style={field.label}>Description</Text>
              <TextInput
                style={[field.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={set('description')}
                placeholder="Brief class description…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Teacher</Text>
            <View style={field.wrap}>
              <Text style={field.label}>Assign Teacher</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowTeacherPicker(v => !v)}
              >
                <Text style={[styles.pickerText, !form.teacher_id && { color: COLORS.textMuted }]}>
                  {form.teacher_name || 'Select teacher…'}
                </Text>
                <Text style={styles.pickerChevron}>{showTeacherPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showTeacherPicker && (
                <View style={styles.dropDown}>
                  {teachers.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        setForm(f => ({ ...f, teacher_id: t.id, teacher_name: t.full_name }));
                        setShowTeacherPicker(false);
                      }}
                      style={[styles.dropItem, form.teacher_id === t.id && styles.dropItemActive]}
                    >
                      <Text style={[styles.dropItemText, form.teacher_id === t.id && styles.dropItemTextActive]}>{t.full_name}</Text>
                      <Text style={styles.dropItemSub}>{t.email}</Text>
                    </TouchableOpacity>
                  ))}
                  {teachers.length === 0 && (
                    <View style={styles.dropItem}>
                      <Text style={styles.dropItemText}>No teachers found</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Programme / Course</Text>
            <View style={field.wrap}>
              <Text style={field.label}>Link to Programme</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowProgramPicker(v => !v)}
              >
                <Text style={[styles.pickerText, !form.program_id && { color: COLORS.textMuted }]}>
                  {form.program_title || 'Select programme…'}
                </Text>
                <Text style={styles.pickerChevron}>{showProgramPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showProgramPicker && (
                <View style={styles.dropDown}>
                  {programs.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        setForm(f => ({ ...f, program_id: p.id, program_title: p.name }));
                        setShowProgramPicker(false);
                      }}
                      style={[styles.dropItem, form.program_id === p.id && styles.dropItemActive]}
                    >
                      <Text style={[styles.dropItemText, form.program_id === p.id && styles.dropItemTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {programs.length === 0 && (
                    <View style={styles.dropItem}>
                      <Text style={styles.dropItemText}>No programmes found</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule & Capacity</Text>
            <Field label="Max Students" value={form.max_students} onChangeText={set('max_students')} placeholder="30" keyboardType="number-pad" />
            <Field label="Schedule" value={form.schedule} onChangeText={set('schedule')} placeholder="e.g. Mon & Wed, 3pm–5pm" />
            <Field label="Start Date" value={form.start_date} onChangeText={set('start_date')} placeholder="YYYY-MM-DD" />
            <Field label="End Date" value={form.end_date} onChangeText={set('end_date')} placeholder="YYYY-MM-DD" />
            <Text style={styles.pickerSectionLabel}>Status</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((option) => {
                const active = form.status === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setForm((f) => ({ ...f, status: option }))}
                    style={[styles.statusPill, active && styles.statusPillActive]}
                  >
                    <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Colour</Text>
            <View style={styles.colorRow}>
              {colorChoices.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setForm(f => ({ ...f, color: c }))}
                  style={[styles.colorSwatch, { backgroundColor: c }, form.color === c && styles.colorSwatchActive]}
                >
                  {form.color === c && <Text style={styles.colorCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.submitGrad}>
              {saving ? (
                <ActivityIndicator color={COLORS.white100} />
              ) : (
                <Text style={styles.submitText}>{isEditMode ? 'Save changes' : 'Create Class'}</Text>
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
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },
  pickerSectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: SPACING.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  statusPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  statusPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusPillTextActive: { color: COLORS.primaryLight },

  picker: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  pickerChevron: { fontSize: 12, color: COLORS.textMuted },
  dropDown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, overflow: 'hidden', maxHeight: 220 },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 2 },
  dropItemActive: { backgroundColor: COLORS.primary + '15' },
  dropItemText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  dropItemTextActive: { color: COLORS.primary, fontFamily: FONT_FAMILY.bodySemi },
  dropItemSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  colorRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: COLORS.white100, transform: [{ scale: 1.15 }] },
  colorCheck: { color: COLORS.white100, fontSize: 18, fontWeight: 'bold' },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
});

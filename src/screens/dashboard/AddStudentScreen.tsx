import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { registrationService } from '../../services/registration.service';
import { schoolService } from '../../services/school.service';
import type { Database } from '../../types/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const GRADE_LEVELS = [
  'Nursery 1', 'Nursery 2',
  'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SS 1', 'SS 2', 'SS 3',
];

interface School { id: string; name: string }
interface Credentials { email: string; password: string; name: string }

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default',
  required = false, multiline = false,
}: any) {
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
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

export default function AddStudentScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(profile?.school_id ?? '');

  const isAdmin = profile?.role === 'admin';

  const [form, setForm] = useState({
    full_name: '',
    student_email: '',
    parent_name: '',
    parent_phone: '',
    school_name: profile?.school_name ?? '',
    grade_level: '',
    section_class: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (isAdmin) {
      schoolService
        .listApprovedSchoolOptions(100)
        .then((data) => setSchools(data as School[]))
        .catch(() => setSchools([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !form.school_name) return;
    const match = schools.find((school) => school.name === form.school_name);
    if (match) setSelectedSchoolId(match.id);
  }, [form.school_name, isAdmin, schools]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const submit = async () => {
    if (!form.full_name.trim()) { Alert.alert('Full name is required'); return; }
    if (isAdmin && !selectedSchoolId && form.school_name.trim()) { Alert.alert('Select a linked school from the list'); return; }

    setSaving(true);
    const email = form.student_email.trim().toLowerCase() ||
      `${form.full_name.trim().toLowerCase().replace(/\s+/g, '.')}@rillcod.school`;
    const resolvedSchoolId = isAdmin ? selectedSchoolId || null : profile?.school_id || null;
    const resolvedSchoolName = isAdmin ? form.school_name.trim() || null : profile?.school_name || null;

    const row: Database['public']['Tables']['students']['Insert'] = {
      name: form.full_name.trim(),
      full_name: form.full_name.trim(),
      student_email: email,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      school_name: resolvedSchoolName,
      school_id: resolvedSchoolId,
      grade_level: form.grade_level || null,
      current_class: form.section_class.trim() || null,
      section: form.section_class.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      enrollment_type: 'school',
      status: 'pending',
      created_by: profile?.id ?? null,
    };

    try {
      await registrationService.insertProspectiveStudent(row);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save student');
      setSaving(false);
      return;
    }

    setSaving(false);
    // Credentials shown here are for admin reference only.
    // The actual auth account + login password is created when admin approves
    // the student in the Approvals screen.
    setCredentials({ email, password: '(set on approval)', name: form.full_name.trim() });
  };

  if (credentials) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Student Added" accentColor={COLORS.success} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.credCard}>
            <LinearGradient colors={[COLORS.success + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.credEmoji}>✅</Text>
            <Text style={styles.credTitle}>Student Added to Queue</Text>
            <Text style={styles.credName}>{credentials.name}</Text>
            <Text style={styles.credNote}>
              Student is pending approval. Go to Approvals to activate their account and generate login credentials.
            </Text>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Registered Email</Text>
              <Text style={styles.credValue} selectable>{credentials.email}</Text>
            </View>
            <View style={[styles.credRow, { borderColor: COLORS.warning + '40' }]}>
              <Text style={styles.credLabel}>Password</Text>
              <Text style={[styles.credValue, { color: COLORS.warning }]}>Generated on approval</Text>
            </View>
            <Text style={styles.credWarn}>Credentials will be created when you approve this student.</Text>
            <TouchableOpacity onPress={() => { setCredentials(null); navigation.goBack(); }} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Register Student" onBack={() => navigation.goBack()} accentColor={COLORS.admin} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Student Information</Text>
            <Field label="Full Name" value={form.full_name} onChangeText={set('full_name')} placeholder="e.g. Amara Johnson" required />
            <Field label="Email Address" value={form.student_email} onChangeText={set('student_email')} placeholder="student@example.com (optional)" keyboardType="email-address" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parent / Guardian</Text>
            <Field label="Parent Name" value={form.parent_name} onChangeText={set('parent_name')} placeholder="Guardian's full name" />
            <Field label="Parent Phone" value={form.parent_phone} onChangeText={set('parent_phone')} placeholder="+234 …" keyboardType="phone-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>School & Class</Text>

            {isAdmin ? (
              <View style={field.wrap}>
                <Text style={field.label}>School</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schoolPills}>
                  {schools.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        setSelectedSchoolId(s.id);
                        setForm(f => ({ ...f, school_name: s.name }));
                      }}
                      style={[styles.pill, form.school_name === s.name && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, form.school_name === s.name && styles.pillTextActive]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.lockedField}>
                <Text style={styles.lockedLabel}>School</Text>
                <Text style={styles.lockedValue}>{profile?.school_name ?? '—'}</Text>
              </View>
            )}

            {/* Grade level picker */}
            <View style={field.wrap}>
              <Text style={field.label}>Grade Level</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowGradePicker(v => !v)}
              >
                <Text style={[styles.pickerText, !form.grade_level && { color: COLORS.textMuted }]}>
                  {form.grade_level || 'Select grade…'}
                </Text>
                <Text style={styles.pickerChevron}>{showGradePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showGradePicker && (
                <View style={styles.dropDown}>
                  {GRADE_LEVELS.map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => { setForm(f => ({ ...f, grade_level: g })); setShowGradePicker(false); }}
                      style={[styles.dropItem, form.grade_level === g && styles.dropItemActive]}
                    >
                      <Text style={[styles.dropItemText, form.grade_level === g && styles.dropItemTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Field label="Section / Class" value={form.section_class} onChangeText={set('section_class')} placeholder="e.g. JSS 1A" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location (optional)</Text>
            <Field label="City" value={form.city} onChangeText={set('city')} placeholder="City" />
            <Field label="State" value={form.state} onChangeText={set('state')} placeholder="State" />
          </View>

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator color={COLORS.white100} />
                : <Text style={styles.submitText}>Register Student</Text>}
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },

  schoolPills: { gap: SPACING.sm, paddingVertical: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, maxWidth: 180 },
  pillActive: { backgroundColor: COLORS.admin + '20', borderColor: COLORS.admin },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.admin },

  lockedField: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  lockedLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  lockedValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  picker: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  pickerChevron: { fontSize: 12, color: COLORS.textMuted },
  dropDown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, overflow: 'hidden' },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropItemActive: { backgroundColor: COLORS.admin + '15' },
  dropItemText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  dropItemTextActive: { color: COLORS.admin, fontFamily: FONT_FAMILY.bodySemi },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },

  credCard: { borderWidth: 1, borderColor: COLORS.success + '40', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, overflow: 'hidden' },
  credEmoji: { fontSize: 48 },
  credTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  credName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  credNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  credRow: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, backgroundColor: COLORS.bgCard },
  credLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  credWarn: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: 'center' },
  doneBtn: { width: '100%', paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center' },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
});

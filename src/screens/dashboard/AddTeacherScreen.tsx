import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface School {
  id: string;
  name: string;
}

interface Credentials {
  email: string;
  password: string;
  name: string;
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  required = false,
  multiline = false,
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
        numberOfLines={multiline ? 4 : 1}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

export default function AddTeacherScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const teacherId = route.params?.teacherId as string | undefined;
  const isAdmin = profile?.role === 'admin';

  const [schools, setSchools] = useState<School[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!teacherId);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(profile?.school_id ?? '');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    school_name: profile?.school_name ?? '',
    password: genPassword(),
  });

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from('schools')
      .select('id, name')
      .eq('status', 'approved')
      .limit(100)
      .then(({ data }) => {
        if (data) setSchools(data as School[]);
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!teacherId) return;

    const loadTeacher = async () => {
      const [{ data: teacher }, { data: assignments }] = await Promise.all([
        supabase
          .from('portal_users')
          .select('id, full_name, email, phone, bio, school_id, school_name')
          .eq('id', teacherId)
          .single(),
        supabase
          .from('teacher_schools')
          .select('school_id, schools!teacher_schools_school_id_fkey(id, name)')
          .eq('teacher_id', teacherId)
          .limit(1),
      ]);

      if (teacher) {
        const assignedSchool = assignments?.[0] as any;
        const assignmentSchool = Array.isArray(assignedSchool?.schools) ? assignedSchool?.schools?.[0] : assignedSchool?.schools;
        setForm({
          full_name: teacher.full_name || '',
          email: teacher.email || '',
          phone: teacher.phone || '',
          bio: teacher.bio || '',
          school_name: assignmentSchool?.name || teacher.school_name || '',
          password: '',
        });
        setSelectedSchoolId(assignmentSchool?.id || teacher.school_id || '');
      }
      setLoading(false);
    };

    loadTeacher();
  }, [teacherId]);

  useEffect(() => {
    if (!isAdmin || !form.school_name) return;
    const match = schools.find((school) => school.name === form.school_name);
    if (match) setSelectedSchoolId(match.id);
  }, [form.school_name, isAdmin, schools]);

  const summary = useMemo(() => {
    if (teacherId) return 'Update teacher profile and deployment.';
    return 'Create a teacher account and link it to the right school deployment.';
  }, [teacherId]);

  const set = (key: string) => (val: string) => setForm((current) => ({ ...current, [key]: val }));

  const saveAssignment = async (targetTeacherId: string, schoolId: string | null) => {
    await supabase.from('teacher_schools').delete().eq('teacher_id', targetTeacherId);

    if (!schoolId) return;

    const school = schools.find((item) => item.id === schoolId);
    await supabase.from('teacher_schools').insert({
      teacher_id: targetTeacherId,
      school_id: schoolId,
      assigned_by: profile?.id ?? null,
      is_primary: true,
    });

    await supabase.from('portal_users').update({
      school_id: schoolId,
      school_name: school?.name ?? (form.school_name.trim() || null),
    }).eq('id', targetTeacherId);
  };

  const submit = async () => {
    if (!form.full_name.trim()) { Alert.alert('Full name is required'); return; }
    if (!form.email.trim()) { Alert.alert('Email is required'); return; }
    if (isAdmin && form.school_name.trim() && !selectedSchoolId) { Alert.alert('Choose a school from the approved list'); return; }

    setSaving(true);
    const email = form.email.trim().toLowerCase();
    const resolvedSchoolId = isAdmin ? (selectedSchoolId || null) : (profile?.school_id || null);
    const resolvedSchoolName = isAdmin ? (form.school_name.trim() || null) : (profile?.school_name || null);

    if (teacherId) {
      const { error } = await supabase.from('portal_users').update({
        full_name: form.full_name.trim(),
        email,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        school_id: resolvedSchoolId,
        school_name: resolvedSchoolName,
      }).eq('id', teacherId);

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }

      await saveAssignment(teacherId, resolvedSchoolId);
      Alert.alert('Teacher Updated', 'Changes saved successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      setSaving(false);
      return;
    }

    const password = form.password || genPassword();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: form.full_name.trim(), role: 'teacher' } },
    });

    if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
      Alert.alert('Error', signUpError.message);
      setSaving(false);
      return;
    }

    const userId = signUpData?.user?.id;
    const { data: teacherRecord, error } = await supabase.from('portal_users').upsert({
      ...(userId ? { id: userId } : {}),
      email,
      full_name: form.full_name.trim(),
      role: 'teacher',
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      school_id: resolvedSchoolId,
      school_name: resolvedSchoolName,
      is_active: true,
      is_deleted: false,
    }, { onConflict: 'email' }).select('id').single();

    if (error || !teacherRecord) {
      Alert.alert('Error', error?.message ?? 'Failed to create teacher');
      setSaving(false);
      return;
    }

    await saveAssignment(teacherRecord.id, resolvedSchoolId);
    setSaving(false);
    setCredentials({ email, password, name: form.full_name.trim() });
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
        <Text style={styles.loadText}>Loading teacher...</Text>
      </View>
    );
  }

  if (credentials) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Teacher Added" accentColor={COLORS.info} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.credCard}>
            <LinearGradient colors={[COLORS.info + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.credCode}>TC</Text>
            <Text style={styles.credTitle}>Teacher Registered</Text>
            <Text style={styles.credName}>{credentials.name}</Text>
            <Text style={styles.credNote}>Share these login credentials with the teacher.</Text>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Email</Text>
              <Text style={styles.credValue} selectable>{credentials.email}</Text>
            </View>
            <View style={[styles.credRow, { borderColor: COLORS.info + '40' }]}>
              <Text style={styles.credLabel}>Temp Password</Text>
              <Text style={[styles.credValue, { color: COLORS.info }]} selectable>{credentials.password}</Text>
            </View>
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
      <ScreenHeader title={teacherId ? 'Edit Teacher' : 'Register Teacher'} onBack={() => navigation.goBack()} accentColor={COLORS.info} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.heroCard}>
            <LinearGradient colors={[COLORS.info + '18', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.heroEyebrow}>Teacher Workspace</Text>
            <Text style={styles.heroTitle}>{summary}</Text>
            <Text style={styles.heroMeta}>{resolvedSchoolNameText(isAdmin, form.school_name, profile?.school_name)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identity</Text>
            <Field label="Full Name" value={form.full_name} onChangeText={set('full_name')} placeholder="e.g. Ibrahim Adeyemi" required />
            <Field label="Email Address" value={form.email} onChangeText={set('email')} placeholder="teacher@example.com" keyboardType="email-address" required />
            <Field label="Phone Number" value={form.phone} onChangeText={set('phone')} placeholder="+234 ..." keyboardType="phone-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <Field label="Bio" value={form.bio} onChangeText={set('bio')} placeholder="Brief teacher background" multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>School Deployment</Text>
            {isAdmin ? (
              <View style={field.wrap}>
                <Text style={field.label}>Assign to School</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                  {schools.map((school) => (
                    <TouchableOpacity
                      key={school.id}
                      onPress={() => {
                        setSelectedSchoolId(school.id);
                        setForm((current) => ({ ...current, school_name: school.name }));
                      }}
                      style={[styles.pill, selectedSchoolId === school.id && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, selectedSchoolId === school.id && styles.pillTextActive]} numberOfLines={1}>
                        {school.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.helperText}>This also syncs the teacher into the school assignment registry.</Text>
              </View>
            ) : (
              <View style={styles.lockedField}>
                <Text style={styles.lockedLabel}>School</Text>
                <Text style={styles.lockedValue}>{profile?.school_name ?? '-'}</Text>
              </View>
            )}
          </View>

          {!teacherId ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Credentials</Text>
              <View style={styles.credentialHeader}>
                <Text style={field.label}>Temporary Password</Text>
                <TouchableOpacity onPress={() => setForm((current) => ({ ...current, password: genPassword() }))}>
                  <Text style={styles.inlineAction}>Regenerate</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={field.input}
                value={form.password}
                onChangeText={set('password')}
                placeholder="Auto-generated"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={[COLORS.info, '#1e3a8a']} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator color={COLORS.white100} />
                : <Text style={styles.submitText}>{teacherId ? 'Update Teacher' : 'Register Teacher'}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

function resolvedSchoolNameText(isAdmin: boolean, formSchoolName: string, profileSchoolName?: string | null) {
  if (isAdmin) return formSchoolName ? `Assigned school: ${formSchoolName}` : 'Choose the school this teacher belongs to.';
  return profileSchoolName ? `Using your school: ${profileSchoolName}` : 'School will be attached from your account.';
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
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  heroCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.info,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: 8,
  },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 8 },
  heroMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 20 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md },
  pills: { gap: SPACING.sm, paddingVertical: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, maxWidth: 200 },
  pillActive: { backgroundColor: COLORS.info + '20', borderColor: COLORS.info },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.info },
  helperText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 8 },
  lockedField: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' },
  lockedLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  lockedValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  credentialHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  inlineAction: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
  credCard: { borderWidth: 1, borderColor: COLORS.info + '40', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, overflow: 'hidden' },
  credCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.info },
  credTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  credName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  credNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  credRow: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, backgroundColor: COLORS.bgCard },
  credLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  doneBtn: { width: '100%', paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.info, alignItems: 'center' },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
});

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
import { authService } from '../../services/auth.service';
import { schoolService } from '../../services/school.service';
import { teacherService } from '../../services/teacher.service';
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
  // Multi-school: set of selected school IDs + one primary
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>(
    profile?.school_id ? [profile.school_id] : []
  );
  const [primarySchoolId, setPrimarySchoolId] = useState<string>(profile?.school_id ?? '');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    password: genPassword(),
  });

  useEffect(() => {
    if (!isAdmin) return;
    void schoolService
      .listApprovedSchoolOptions(100)
      .then((data) => setSchools(data as School[]))
      .catch(() => setSchools([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!teacherId) return;

    const loadTeacher = async () => {
      let teacher: any;
      let assignments: any[] = [];
      try {
        const loaded = await teacherService.loadTeacherEditorState(teacherId);
        teacher = loaded.teacher;
        assignments = loaded.assignments as any[];
      } catch {
        setLoading(false);
        return;
      }

      if (teacher) {
        setForm({
          full_name: teacher.full_name || '',
          email: teacher.email || '',
          phone: teacher.phone || '',
          bio: teacher.bio || '',
          password: '',
        });
        // Load ALL assigned schools (multi-school support)
        const allIds = assignments.map((a: any) => a.school_id).filter(Boolean);
        const primaryRow = assignments.find((a: any) => a.is_primary);
        const primaryId = primaryRow?.school_id || teacher.school_id || allIds[0] || '';
        setSelectedSchoolIds(allIds.length > 0 ? allIds : (teacher.school_id ? [teacher.school_id] : []));
        setPrimarySchoolId(primaryId);
      }
      setLoading(false);
    };

    loadTeacher();
  }, [teacherId]);

  const summary = useMemo(() => {
    if (teacherId) return 'Update teacher profile and deployment.';
    return 'Create a teacher account and link it to the right school deployment.';
  }, [teacherId]);

  const set = (key: string) => (val: string) => setForm((current) => ({ ...current, [key]: val }));

  const saveAssignments = async (targetTeacherId: string, schoolIds: string[], primaryId: string) => {
    if (schoolIds.length === 0) return;
    await teacherService.replaceTeacherSchoolAssignments({
      teacherId: targetTeacherId,
      schoolIds,
      primarySchoolId: primaryId,
      assignedBy: profile?.id ?? null,
    });
  };

  const submit = async () => {
    if (!form.full_name.trim()) { Alert.alert('Validation', 'Full name is required'); return; }
    if (!form.email.trim()) { Alert.alert('Validation', 'Email address is required'); return; }
    if (isAdmin && selectedSchoolIds.length === 0) {
      Alert.alert('Validation', 'Assign the teacher to at least one school');
      return;
    }

    setSaving(true);
    const email = form.email.trim().toLowerCase();

    // For non-admin: derive schools from own profile
    const resolvedSchoolIds = isAdmin
      ? selectedSchoolIds
      : (profile?.school_id ? [profile.school_id] : []);
    const resolvedPrimaryId = isAdmin
      ? (primarySchoolId || resolvedSchoolIds[0] || '')
      : (profile?.school_id ?? '');

    if (teacherId) {
      try {
        await teacherService.updateTeacher(teacherId, {
          full_name: form.full_name.trim(),
          email,
          phone: form.phone.trim() || null,
          bio: form.bio.trim() || null,
        });
        await saveAssignments(teacherId, resolvedSchoolIds, resolvedPrimaryId);
      } catch (error: any) {
        Alert.alert('Error', error?.message ?? 'Could not update teacher');
        setSaving(false);
        return;
      }
      Alert.alert('Teacher Updated', 'Changes saved successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      setSaving(false);
      return;
    }

    const password = form.password || genPassword();
    let userId: string | undefined;
    try {
      const signUp = await authService.signUpTeacherAccount({
        email,
        password,
        fullName: form.full_name.trim(),
      });
      userId = signUp.userId;
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not register account');
      setSaving(false);
      return;
    }

    let newTeacherId: string;
    try {
      newTeacherId = await teacherService.upsertTeacherPortalAfterSignUp({
        userId,
        email,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to create teacher');
      setSaving(false);
      return;
    }

    try {
      await saveAssignments(newTeacherId, resolvedSchoolIds, resolvedPrimaryId);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not assign schools');
      setSaving(false);
      return;
    }
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
            <Text style={styles.heroMeta}>{resolvedSchoolNameText(isAdmin, selectedSchoolIds, schools, profile?.school_name)}</Text>
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
                <View style={styles.schoolLabelRow}>
                  <Text style={field.label}>Assign Schools</Text>
                  <Text style={styles.schoolCount}>
                    {selectedSchoolIds.length} selected
                  </Text>
                </View>
                {schools.map((school) => {
                  const isSelected = selectedSchoolIds.includes(school.id);
                  const isPrimary = primarySchoolId === school.id && isSelected;
                  return (
                    <TouchableOpacity
                      key={school.id}
                      style={[styles.schoolRow, isSelected && styles.schoolRowActive]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedSchoolIds((prev) => {
                          if (prev.includes(school.id)) {
                            const next = prev.filter((id) => id !== school.id);
                            // If we removed the primary, reassign to first remaining
                            if (primarySchoolId === school.id && next.length > 0) {
                              setPrimarySchoolId(next[0]);
                            } else if (next.length === 0) {
                              setPrimarySchoolId('');
                            }
                            return next;
                          }
                          // First selection becomes primary automatically
                          if (prev.length === 0) setPrimarySchoolId(school.id);
                          return [...prev, school.id];
                        });
                      }}
                    >
                      <View style={[styles.schoolCheck, isSelected && styles.schoolCheckActive]}>
                        {isSelected && <View style={styles.schoolCheckDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.schoolRowName, isSelected && { color: COLORS.info }]} numberOfLines={1}>
                          {school.name}
                        </Text>
                        {isPrimary && (
                          <Text style={styles.primaryBadge}>Primary School</Text>
                        )}
                      </View>
                      {isSelected && !isPrimary && (
                        <TouchableOpacity
                          onPress={() => setPrimarySchoolId(school.id)}
                          style={styles.setPrimaryBtn}
                        >
                          <Text style={styles.setPrimaryText}>Set Primary</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.helperText}>
                  Tap to toggle. A teacher can belong to multiple schools. The primary school is used for timetable and dashboard defaults.
                </Text>
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

function resolvedSchoolNameText(isAdmin: boolean, selectedIds: string[], allSchools: School[], profileSchoolName?: string | null) {
  if (isAdmin) {
    if (selectedIds.length === 0) return 'Select one or more schools for this teacher.';
    if (selectedIds.length === 1) {
      const name = allSchools.find(s => s.id === selectedIds[0])?.name ?? 'Selected school';
      return `Assigned to: ${name}`;
    }
    return `Assigned to ${selectedIds.length} schools`;
  }
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
  helperText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 10 },
  schoolLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  schoolCount: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    backgroundColor: COLORS.bgCard,
  },
  schoolRowActive: { borderColor: COLORS.info, backgroundColor: COLORS.info + '08' },
  schoolCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolCheckActive: { borderColor: COLORS.info },
  schoolCheckDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.info },
  schoolRowName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  primaryBadge: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: COLORS.success, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  setPrimaryBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.xs, borderWidth: 1, borderColor: COLORS.info + '60' },
  setPrimaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: COLORS.info, textTransform: 'uppercase', letterSpacing: 0.8 },
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

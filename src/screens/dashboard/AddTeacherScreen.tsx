import React, { useEffect, useState } from 'react';
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
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface School { id: string; school_name: string }

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default',
  required = false, secureTextEntry = false,
}: any) {
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
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

export default function AddTeacherScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; name: string } | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    school_name: profile?.school_name ?? '',
    school_id: profile?.school_id ?? '',
    subject: '',
    password: genPassword(),
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      supabase.from('schools').select('id, school_name').eq('status', 'approved').limit(100)
        .then(({ data }) => { if (data) setSchools(data as School[]); });
    }
  }, [isAdmin]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const submit = async () => {
    if (!form.full_name.trim()) { Alert.alert('Full name is required'); return; }
    if (!form.email.trim()) { Alert.alert('Email is required'); return; }

    setSaving(true);
    const email = form.email.trim().toLowerCase();

    // Create auth user via admin (or use signUp for self-registration)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { full_name: form.full_name.trim(), role: 'teacher' } },
    });

    if (signUpError && !signUpError.message.includes('already registered')) {
      Alert.alert('Error', signUpError.message);
      setSaving(false);
      return;
    }

    const userId = signUpData?.user?.id;

    // Upsert portal_users entry
    const { error } = await supabase.from('portal_users').upsert({
      ...(userId ? { id: userId } : {}),
      email,
      full_name: form.full_name.trim(),
      role: 'teacher',
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      school_name: form.school_name.trim() || null,
      school_id: form.school_id || null,
      is_active: true,
    }, { onConflict: 'email' });

    if (error) {
      Alert.alert('Error', error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setCredentials({ email, password: form.password, name: form.full_name.trim() });
  };

  if (credentials) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Teacher Added" accentColor="#7c3aed" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.credCard}>
            <LinearGradient colors={['#7c3aed15', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.credEmoji}>✅</Text>
            <Text style={styles.credTitle}>Teacher Registered!</Text>
            <Text style={styles.credName}>{credentials.name}</Text>
            <Text style={styles.credNote}>Share these login credentials with the teacher:</Text>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Email</Text>
              <Text style={styles.credValue} selectable>{credentials.email}</Text>
            </View>
            <View style={[styles.credRow, { borderColor: '#7c3aed40' }]}>
              <Text style={styles.credLabel}>Temp Password</Text>
              <Text style={[styles.credValue, { color: '#7c3aed' }]} selectable>{credentials.password}</Text>
            </View>
            <Text style={styles.credWarn}>⚠ Note these credentials before closing.</Text>
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
      <ScreenHeader title="Register Teacher" onBack={() => navigation.goBack()} accentColor="#7c3aed" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Teacher Information</Text>
            <Field label="Full Name" value={form.full_name} onChangeText={set('full_name')} placeholder="e.g. Mr. Ibrahim Adeyemi" required />
            <Field label="Email Address" value={form.email} onChangeText={set('email')} placeholder="teacher@example.com" keyboardType="email-address" required />
            <Field label="Phone Number" value={form.phone} onChangeText={set('phone')} placeholder="+234 …" keyboardType="phone-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Details</Text>
            <Field label="Subject / Specialisation" value={form.subject} onChangeText={set('subject')} placeholder="e.g. Mathematics, Coding" />
            <View style={field.wrap}>
              <Text style={field.label}>Bio (optional)</Text>
              <TextInput
                style={[field.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={form.bio}
                onChangeText={set('bio')}
                placeholder="Brief background…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>School Assignment</Text>
            {isAdmin ? (
              <View style={field.wrap}>
                <Text style={field.label}>Assign to School</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                  {schools.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setForm(f => ({ ...f, school_name: s.school_name, school_id: s.id }))}
                      style={[styles.pill, form.school_id === s.id && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, form.school_id === s.id && styles.pillTextActive]} numberOfLines={1}>
                        {s.school_name}
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
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Login Credentials</Text>
            <View style={[field.wrap, { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm }]}>
              <View style={{ flex: 1 }}>
                <Field label="Temporary Password" value={form.password} onChangeText={set('password')} placeholder="Auto-generated" />
              </View>
              <TouchableOpacity
                onPress={() => setForm(f => ({ ...f, password: genPassword() }))}
                style={styles.regenBtn}
              >
                <Text style={styles.regenText}>🔄</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={['#7c3aed', '#4c1d95']} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator color={COLORS.white100} />
                : <Text style={styles.submitText}>Register Teacher</Text>}
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

  pills: { gap: SPACING.sm, paddingVertical: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, maxWidth: 180 },
  pillActive: { backgroundColor: '#7c3aed20', borderColor: '#7c3aed' },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: '#7c3aed' },

  lockedField: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  lockedLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  lockedValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  regenBtn: { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  regenText: { fontSize: 18 },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },

  credCard: { borderWidth: 1, borderColor: '#7c3aed40', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, overflow: 'hidden' },
  credEmoji: { fontSize: 48 },
  credTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  credName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  credNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  credRow: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, backgroundColor: COLORS.bgCard },
  credLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  credWarn: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: 'center' },
  doneBtn: { width: '100%', paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: '#7c3aed', alignItems: 'center' },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
});

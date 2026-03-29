import React, { useState } from 'react';
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

const SCHOOL_TYPES = ['Primary', 'Secondary', 'Primary & Secondary', 'Tertiary', 'Vocational'];
const ENROLLMENT_TYPES = ['school', 'bootcamp', 'online'];
const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', required = false, secureTextEntry = false }: any) {
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

function SelectRow({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <TouchableOpacity style={sel.btn} onPress={() => setOpen(v => !v)}>
        <Text style={[sel.btnText, !value && { color: COLORS.textMuted }]}>{value || `Select ${label}…`}</Text>
        <Text style={sel.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={sel.dropdown}>
          {options.map(o => (
            <TouchableOpacity key={o} onPress={() => { onChange(o); setOpen(false); }} style={[sel.item, value === o && sel.itemActive]}>
              <Text style={[sel.itemText, value === o && sel.itemTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AddSchoolScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; name: string } | null>(null);
  const [selectedEnrollTypes, setSelectedEnrollTypes] = useState<string[]>(['school']);

  const [form, setForm] = useState({
    name: '',
    school_type: '',
    contact_person: '',
    address: '',
    lga: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    password: genPassword(),
    program_interest: '',
    rillcod_quota_percent: '10',
    status: 'pending',
  });

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const toggleEnrollType = (t: string) => {
    setSelectedEnrollTypes(prev =>
      prev.includes(t) ? prev.filter(e => e !== t) : [...prev, t]
    );
  };

  const submit = async () => {
    if (!form.name.trim()) { Alert.alert('School name is required'); return; }
    if (!form.contact_person.trim()) { Alert.alert('Contact person is required'); return; }

    setSaving(true);

    const { error } = await supabase.from('schools').insert({
      school_name: form.name.trim(),
      school_type: form.school_type || null,
      contact_person: form.contact_person.trim(),
      address: form.address.trim() || null,
      lga: form.lga.trim() || null,
      city: form.city.trim() || null,
      state: form.state || null,
      phone: form.phone.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      program_interest: form.program_interest.trim() || null,
      rillcod_quota_percent: parseFloat(form.rillcod_quota_percent) || 10,
      enrollment_types: selectedEnrollTypes,
      status: form.status,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setSaving(false);
      return;
    }

    const email = form.email.trim().toLowerCase() ||
      `${form.name.trim().toLowerCase().replace(/\s+/g, '.')}@rillcod.school`;

    setSaving(false);
    setCredentials({ email, password: form.password, name: form.name.trim() });
  };

  if (credentials) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="School Added" accentColor={COLORS.info} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.credCard}>
            <LinearGradient colors={[COLORS.info + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.credEmoji}>🏫</Text>
            <Text style={styles.credTitle}>School Registered!</Text>
            <Text style={styles.credName}>{credentials.name}</Text>
            {form.status === 'approved' ? (
              <>
                <Text style={styles.credNote}>Share these login credentials with the school:</Text>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Email</Text>
                  <Text style={styles.credValue} selectable>{credentials.email}</Text>
                </View>
                <View style={[styles.credRow, { borderColor: COLORS.info + '40' }]}>
                  <Text style={styles.credLabel}>Password</Text>
                  <Text style={[styles.credValue, { color: COLORS.info }]} selectable>{credentials.password}</Text>
                </View>
                <Text style={styles.credWarn}>⚠ Note these credentials before closing.</Text>
              </>
            ) : (
              <Text style={styles.credNote}>School registered as pending. Approve it from the Approvals page to create a login account.</Text>
            )}
            <TouchableOpacity onPress={() => { setCredentials(null); navigation.goBack(); }} style={[styles.doneBtn, { backgroundColor: COLORS.info }]}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Add School" onBack={() => navigation.goBack()} accentColor={COLORS.info} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>

          {/* Basic Info */}
          <SectionTitle label="School Information" />
          <Field label="School Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Greenfield Academy" required />
          <SelectRow label="School Type" options={SCHOOL_TYPES} value={form.school_type} onChange={set('school_type')} />
          <Field label="Contact Person" value={form.contact_person} onChangeText={set('contact_person')} placeholder="Principal / Admin name" required />

          {/* Contact */}
          <SectionTitle label="Contact Details" />
          <Field label="Phone" value={form.phone} onChangeText={set('phone')} placeholder="+234 …" keyboardType="phone-pad" />
          <Field label="Email" value={form.email} onChangeText={set('email')} placeholder="school@example.com" keyboardType="email-address" />
          <View style={field.wrap}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={field.label}>Login Password</Text>
              <TouchableOpacity onPress={() => setForm(f => ({ ...f, password: genPassword() }))}>
                <Text style={styles.regenBtn}>↻ Regenerate</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={field.input}
              value={form.password}
              onChangeText={set('password')}
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
          </View>

          {/* Location */}
          <SectionTitle label="Location" />
          <Field label="Address" value={form.address} onChangeText={set('address')} placeholder="Street address" />
          <Field label="LGA" value={form.lga} onChangeText={set('lga')} placeholder="Local government area" />
          <Field label="City" value={form.city} onChangeText={set('city')} placeholder="City" />
          <SelectRow label="State" options={STATES} value={form.state} onChange={set('state')} />

          {/* Settings */}
          <SectionTitle label="Partnership Settings" />
          <Field label="Program Interest" value={form.program_interest} onChangeText={set('program_interest')} placeholder="e.g. Python, Web Dev, Robotics" />
          <Field label="Rillcod Quota %" value={form.rillcod_quota_percent} onChangeText={set('rillcod_quota_percent')} keyboardType="numeric" placeholder="10" />

          {/* Enrollment types */}
          <View style={field.wrap}>
            <Text style={field.label}>Enrollment Types</Text>
            <View style={styles.checkRow}>
              {ENROLLMENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => toggleEnrollType(t)}
                  style={[styles.checkPill, selectedEnrollTypes.includes(t) && styles.checkPillActive]}
                >
                  <Text style={[styles.checkText, selectedEnrollTypes.includes(t) && styles.checkTextActive]}>
                    {selectedEnrollTypes.includes(t) ? '✓ ' : ''}{t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status */}
          <View style={field.wrap}>
            <Text style={field.label}>Initial Status</Text>
            <View style={styles.checkRow}>
              {['pending', 'approved'].map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setForm(f => ({ ...f, status: s }))}
                  style={[styles.checkPill, form.status === s && styles.checkPillActive]}
                >
                  <Text style={[styles.checkText, form.status === s && styles.checkTextActive]}>
                    {s === 'approved' ? '✓ Approved' : '⏳ Pending'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={saving} style={[styles.submitBtn, saving && styles.btnDisabled]}>
            <LinearGradient colors={[COLORS.info, '#0369a1']} style={styles.submitGrad}>
              {saving
                ? <ActivityIndicator color={COLORS.white100} />
                : <Text style={styles.submitText}>Register School</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
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

const sel = StyleSheet.create({
  btn: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btnText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  chevron: { fontSize: 12, color: COLORS.textMuted },
  dropdown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, maxHeight: 200, overflow: 'hidden' },
  item: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemActive: { backgroundColor: COLORS.info + '15' },
  itemText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  itemTextActive: { color: COLORS.info, fontFamily: FONT_FAMILY.bodySemi },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.md, marginTop: SPACING.md },
  regenBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  checkPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  checkPillActive: { backgroundColor: COLORS.info + '20', borderColor: COLORS.info },
  checkText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  checkTextActive: { color: COLORS.info },
  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
  credCard: { borderWidth: 1, borderColor: COLORS.info + '40', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, overflow: 'hidden' },
  credEmoji: { fontSize: 48 },
  credTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  credName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  credNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center' },
  credRow: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, backgroundColor: COLORS.bgCard },
  credLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  credWarn: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: 'center' },
  doneBtn: { width: '100%', paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center' },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
});

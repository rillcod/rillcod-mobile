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

const GRADE_LEVELS = [
  'Nursery 1', 'Nursery 2',
  'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
];

type RegisterType = 'student' | 'teacher';
type Step = 'input' | 'preview' | 'result';

interface ParsedUser { name: string; email: string; status: 'pending' | 'done' | 'error'; error?: string }

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
}

export default function BulkRegisterScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [type, setType] = useState<RegisterType>('student');
  const [rawText, setRawText] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState({ id: profile?.school_id ?? '', name: profile?.school_name ?? '' });
  const [parsed, setParsed] = useState<ParsedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({ success: 0, failed: 0 });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      supabase.from('schools').select('id, school_name').eq('status', 'approved').limit(100)
        .then(({ data }) => { if (data) setSchools(data as School[]); });
    }
  }, [isAdmin]);

  const parse = () => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { Alert.alert('Enter at least one name'); return; }
    if (lines.length > 100) { Alert.alert('Maximum 100 entries at once'); return; }

    const users: ParsedUser[] = lines.map(name => ({
      name,
      email: `${slugify(name)}@rillcod.school`,
      status: 'pending' as const,
    }));
    setParsed(users);
    setStep('preview');
  };

  const editEntry = (idx: number, field: 'name' | 'email', val: string) => {
    setParsed(prev => prev.map((u, i) => i === idx ? { ...u, [field]: val } : u));
  };

  const removeEntry = (idx: number) => {
    setParsed(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    setSaving(true);
    let success = 0;
    let failed = 0;
    const updated = [...parsed];

    for (let i = 0; i < updated.length; i++) {
      const u = updated[i];
      try {
        const payload: Record<string, any> = {
          full_name: u.name.trim(),
          student_email: u.email.trim(),
          school_name: selectedSchool.name || null,
          school_id: selectedSchool.id || null,
          status: 'pending',
          created_by: profile?.id,
        };
        if (type === 'student') {
          payload.grade_level = gradeLevel || null;
        }

        const table = type === 'student' ? 'students' : 'portal_users';
        let q: any;

        if (type === 'teacher') {
          // Insert to portal_users for teachers
          const { error } = await supabase.from('portal_users').insert({
            full_name: u.name.trim(),
            email: u.email.trim(),
            role: 'teacher',
            school_name: selectedSchool.name || null,
            school_id: selectedSchool.id || null,
            is_active: false,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from('students').insert(payload);
          if (error) throw error;
        }

        updated[i] = { ...u, status: 'done' };
        success++;
      } catch (e: any) {
        updated[i] = { ...u, status: 'error', error: e.message };
        failed++;
      }
      setParsed([...updated]);
    }

    setResults({ success, failed });
    setSaving(false);
    setStep('result');
  };

  // ── Step: Input ────────────────────────────────────────────────────────────
  if (step === 'input') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Bulk Register" onBack={() => navigation.goBack()} accentColor={COLORS.primary} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>

            {/* Type selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Register As</Text>
              <View style={styles.typeRow}>
                {(['student', 'teacher'] as RegisterType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, type === t && styles.typePillActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={styles.typeEmoji}>{t === 'student' ? '👥' : '👩‍🏫'}</Text>
                    <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* School */}
            {isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>School</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                  {schools.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedSchool({ id: s.id, name: s.school_name })}
                      style={[styles.pill, selectedSchool.id === s.id && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, selectedSchool.id === s.id && styles.pillTextActive]} numberOfLines={1}>
                        {s.school_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Grade level (students only) */}
            {type === 'student' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Grade Level (optional)</Text>
                <TouchableOpacity style={styles.picker} onPress={() => setShowGradePicker(v => !v)}>
                  <Text style={[styles.pickerText, !gradeLevel && { color: COLORS.textMuted }]}>
                    {gradeLevel || 'Select grade…'}
                  </Text>
                  <Text style={styles.pickerChevron}>{showGradePicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showGradePicker && (
                  <View style={styles.dropDown}>
                    {GRADE_LEVELS.map(g => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => { setGradeLevel(g); setShowGradePicker(false); }}
                        style={[styles.dropItem, gradeLevel === g && styles.dropItemActive]}
                      >
                        <Text style={[styles.dropItemText, gradeLevel === g && styles.dropItemTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Name input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Names (one per line)</Text>
              <Text style={styles.hint}>Paste or type full names — one name per line. Emails will be auto-generated.</Text>
              <TextInput
                style={styles.bigInput}
                value={rawText}
                onChangeText={setRawText}
                placeholder={'Amara Johnson\nKwame Osei\nFatima Al-Hassan\n…'}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                autoCapitalize="words"
              />
              <Text style={styles.countLabel}>
                {rawText.split('\n').filter(l => l.trim()).length} names entered
              </Text>
            </View>

            <TouchableOpacity onPress={parse} style={styles.nextBtn}>
              <LinearGradient colors={COLORS.gradPrimary} style={styles.nextGrad}>
                <Text style={styles.nextText}>Preview & Review →</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Preview ──────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={`Preview (${parsed.length})`}
          onBack={() => setStep('input')}
          accentColor={COLORS.warning}
          rightAction={{ label: 'Register All', onPress: submit }}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.previewHint}>Review names and emails. Tap a row to edit. Swipe or tap ✕ to remove.</Text>

          {parsed.map((u, i) => (
            <MotiView key={i} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 20 }}>
              <View style={styles.previewRow}>
                <View style={styles.previewNum}>
                  <Text style={styles.previewNumText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <TextInput
                    style={styles.previewName}
                    value={u.name}
                    onChangeText={v => editEntry(i, 'name', v)}
                    placeholder="Full name"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.previewEmail}
                    value={u.email}
                    onChangeText={v => editEntry(i, 'email', v)}
                    placeholder="Email"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity onPress={() => removeEntry(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          ))}

          <View style={styles.previewActions}>
            <TouchableOpacity onPress={() => setStep('input')} style={styles.backBtn2}>
              <Text style={styles.backBtn2Text}>← Edit Names</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={saving || parsed.length === 0}
              style={[styles.submitBtn, (saving || parsed.length === 0) && styles.btnDisabled]}
            >
              <LinearGradient colors={COLORS.gradPrimary} style={styles.submitGrad}>
                {saving
                  ? <ActivityIndicator color={COLORS.white100} />
                  : <Text style={styles.submitText}>Register {parsed.length} {type}s</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step: Result ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Registration Complete" accentColor={COLORS.success} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.resultCard}>
          <LinearGradient colors={[COLORS.success + '12', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.resultEmoji}>{results.failed === 0 ? '🎉' : '⚠️'}</Text>
          <Text style={styles.resultTitle}>Bulk Registration Done</Text>
          <View style={styles.resultStats}>
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatVal, { color: COLORS.success }]}>{results.success}</Text>
              <Text style={styles.resultStatLabel}>Succeeded</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatVal, { color: results.failed > 0 ? COLORS.error : COLORS.textMuted }]}>{results.failed}</Text>
              <Text style={styles.resultStatLabel}>Failed</Text>
            </View>
          </View>
        </MotiView>

        {/* Results list */}
        {parsed.map((u, i) => (
          <View key={i} style={[styles.resultRow, { borderColor: u.status === 'done' ? COLORS.success + '40' : COLORS.error + '40' }]}>
            <Text style={{ fontSize: 16 }}>{u.status === 'done' ? '✅' : '❌'}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.resultName}>{u.name}</Text>
              <Text style={styles.resultEmail}>{u.email}</Text>
              {u.error ? <Text style={styles.resultError}>{u.error}</Text> : null}
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.sm },
  hint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, lineHeight: 18 },

  typeRow: { flexDirection: 'row', gap: SPACING.md },
  typePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  typePillActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  typeEmoji: { fontSize: 20 },
  typeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  typeTextActive: { color: COLORS.primary },

  pills: { gap: SPACING.sm, paddingVertical: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, maxWidth: 180 },
  pillActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.primary },

  picker: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  pickerChevron: { fontSize: 12, color: COLORS.textMuted },
  dropDown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropItemActive: { backgroundColor: COLORS.primary + '15' },
  dropItemText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  dropItemTextActive: { color: COLORS.primary, fontFamily: FONT_FAMILY.bodySemi },

  bigInput: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingTop: 12, paddingBottom: 12,
    fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary,
    minHeight: 180, textAlignVertical: 'top', lineHeight: 22,
  },
  countLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6, textAlign: 'right' },

  nextBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  nextGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },

  previewHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 18 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  previewNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  previewNumText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11, color: COLORS.primary },
  previewName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, paddingVertical: Platform.OS === 'ios' ? 4 : 2 },
  previewEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, paddingVertical: Platform.OS === 'ios' ? 4 : 2 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error + '15', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 12, color: COLORS.error },

  previewActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  backBtn2: { paddingHorizontal: SPACING.md, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backBtn2Text: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  submitBtn: { flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },

  resultCard: { borderWidth: 1, borderColor: COLORS.success + '40', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.md, overflow: 'hidden', marginBottom: SPACING.xl },
  resultEmoji: { fontSize: 48 },
  resultTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  resultStats: { flexDirection: 'row', gap: SPACING.xl },
  resultStat: { alignItems: 'center', gap: 4 },
  resultStatVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['3xl'] },
  resultStatLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  resultName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  resultEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  resultError: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.error },

  doneBtn: { paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', marginTop: SPACING.lg },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
});

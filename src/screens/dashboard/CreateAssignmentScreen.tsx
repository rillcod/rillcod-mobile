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
  const { classId, className } = route.params as { classId: string; className: string };
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

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
  });

  const set = (key: string) => (val: any) => setForm(f => ({ ...f, [key]: val }));

  const submit = async () => {
    if (!form.title.trim()) { Alert.alert('Title is required'); return; }

    setSaving(true);
    const dueDateTime = form.due_date
      ? `${form.due_date}T${form.due_time}:00`
      : null;

    const { error } = await supabase.from('assignments').insert({
      class_id: classId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      assignment_type: form.type,
      max_points: parseInt(form.max_score) || 100,
      due_date: dueDateTime,
      metadata: {
        passing_score: parseInt(form.passing_score) || 50,
        allow_late: form.allow_late,
      },
      created_by: profile?.id,
      school_id: profile?.school_id ?? null,
      school_name: profile?.school_name ?? null,
      is_active: true,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setSaving(false);
      return;
    }

    Alert.alert('Assignment Created!', `"${form.title}" has been posted to ${className}.`, [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
    setSaving(false);
  };

  const selectedType = ASSIGNMENT_TYPES.find(t => t.key === form.type)!;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="New Assignment"
        subtitle={className}
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
              {saving
                ? <ActivityIndicator color={COLORS.white100} />
                : <Text style={styles.submitText}>Post Assignment</Text>}
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

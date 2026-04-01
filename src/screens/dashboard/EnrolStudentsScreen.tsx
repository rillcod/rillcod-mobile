import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Student { id: string; full_name: string; email: string; school_name: string | null; section_class: string | null; }
interface Program { id: string; name: string; description: string | null; difficulty_level: string | null; price: number | null; }

const ENROLLMENT_TYPES = ['school', 'bootcamp', 'online', 'in_person'];
const DIFF_COLORS: Record<string, string> = { beginner: COLORS.success, intermediate: COLORS.warning, advanced: COLORS.error };

export default function EnrolStudentsScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const params = (route?.params ?? {}) as { classId?: string; className?: string; programId?: string };
  const targetClassId = params.classId;
  const targetClassName = params.className;
  const presetProgramId = params.programId;
  const [step, setStep] = useState<'students' | 'program' | 'confirm'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [enrollmentType, setEnrollmentType] = useState('in_person');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    let studentQuery = supabase.from('portal_users').select('id, full_name, email, school_name, section_class').eq('role', 'student').eq('is_active', true).order('full_name').limit(300);
    let programQuery = supabase.from('programs').select('id, name, description, difficulty_level, price').eq('is_active', true).order('name');

    if ((profile?.role === 'teacher' || profile?.role === 'school') && profile?.school_id) {
      studentQuery = studentQuery.eq('school_id', profile.school_id);
      programQuery = programQuery.eq('school_id', profile.school_id);
    }

    const [studRes, progRes] = await Promise.all([studentQuery, programQuery]);
    if (studRes.data) setStudents(studRes.data as Student[]);
    if (progRes.data) {
      const nextPrograms = progRes.data as Program[];
      setPrograms(nextPrograms);
      if (presetProgramId) {
        const found = nextPrograms.find((program) => program.id === presetProgramId);
        if (found) setSelectedProgram(found);
      }
    }
    setLoading(false);
  }, [profile?.role, profile?.school_id, presetProgramId]);

  useEffect(() => { load(); }, [load]);

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredStudents = search.trim()
    ? students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
    : students;

  const handleEnrol = async () => {
    if (!selectedProgram || selectedStudents.size === 0) return;
    setSubmitting(true);
    try {
      const studentIds = Array.from(selectedStudents);
      const rows = Array.from(selectedStudents).map(sid => ({
        user_id: sid,
        program_id: selectedProgram.id,
        enrollment_type: enrollmentType,
        role: 'student',
        status: 'active',
        progress_pct: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('enrollments').upsert(rows, { onConflict: 'user_id,program_id' });
      if (error) throw error;
      if (targetClassId) {
        const { error: classError } = await supabase
          .from('portal_users')
          .update({ class_id: targetClassId, section_class: targetClassName ?? null })
          .in('id', studentIds);
        if (classError) throw classError;
      }
      Alert.alert('✅ Enrolled!', `${selectedStudents.size} student${selectedStudents.size > 1 ? 's' : ''} enrolled in ${selectedProgram.name}.`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'students' ? navigation.goBack() : setStep(step === 'confirm' ? 'program' : 'students')} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Enrol Students</Text>
          <Text style={styles.subtitle}>
            {targetClassName
              ? `${targetClassName} · ${step === 'students' ? 'Select students' : step === 'program' ? 'Choose programme' : 'Confirm enrolment'}`
              : step === 'students'
                ? 'Select students'
                : step === 'program'
                  ? 'Choose programme'
                  : 'Confirm enrolment'}
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {(['students', 'program', 'confirm'] as const).map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.stepDot, { backgroundColor: step === s ? COLORS.primary : (i < (['students', 'program', 'confirm'].indexOf(step)) ? COLORS.success : COLORS.border) }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontFamily: FONT_FAMILY.bodySemi }}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, step === s && { color: COLORS.primaryLight }]}>
              {s === 'students' ? 'Students' : s === 'program' ? 'Programme' : 'Confirm'}
            </Text>
            {i < 2 && <View style={[styles.stepLine, { flex: 1 }]} />}
          </View>
        ))}
      </View>

      {/* Step: Students */}
      {step === 'students' && (
        <>
          <View style={styles.searchWrap}>
            <Text>🔍</Text>
            <TextInput style={styles.searchInput} placeholder="Search students…" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <Text style={styles.selCount}>{selectedStudents.size} selected</Text>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={() => {
              if (selectedStudents.size === filteredStudents.length) setSelectedStudents(new Set());
              else setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
            }}>
              <Text style={styles.selectAllText}>{selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
            {filteredStudents.map((s, i) => {
              const sel = selectedStudents.has(s.id);
              return (
                <MotiView key={s.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 20 }}>
                  <TouchableOpacity style={[styles.studentRow, sel && styles.studentRowSel]} onPress={() => toggleStudent(s.id)} activeOpacity={0.8}>
                    <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                      {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{s.full_name}</Text>
                      <Text style={styles.studentMeta}>{s.email}{s.section_class ? ` · ${s.section_class}` : ''}</Text>
                    </View>
                    {s.school_name && <View style={styles.schoolChip}><Text style={styles.schoolChipText}>{s.school_name}</Text></View>}
                  </TouchableOpacity>
                </MotiView>
              );
            })}
            <View style={{ height: 32 }} />
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, selectedStudents.size === 0 && { opacity: 0.4 }]}
              onPress={() => setStep('program')}
              disabled={selectedStudents.size === 0}
            >
              <LinearGradient colors={COLORS.gradPrimary as any} style={styles.nextBtnGrad}>
                <Text style={styles.nextBtnText}>Next: Choose Programme →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Step: Program */}
      {step === 'program' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {programs.map((p, i) => {
            const dc = DIFF_COLORS[p.difficulty_level || ''] || COLORS.textMuted;
            const sel = selectedProgram?.id === p.id;
            return (
              <MotiView key={p.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                <TouchableOpacity onPress={() => setSelectedProgram(p)} activeOpacity={0.85}>
                  <MotiView animate={{ borderColor: sel ? COLORS.primary : COLORS.border, backgroundColor: sel ? COLORS.primary + '15' : COLORS.bgCard }}
                    transition={{ type: 'timing', duration: 150 }} style={styles.programCard}>
                    <View style={styles.programTop}>
                      <Text style={styles.programName}>{p.name}</Text>
                      {sel && <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text>}
                    </View>
                    {p.description && <Text style={styles.programDesc} numberOfLines={2}>{p.description}</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      {p.difficulty_level && (
                        <View style={[styles.diffChip, { backgroundColor: dc + '22', borderColor: dc + '44' }]}>
                          <Text style={[styles.diffText, { color: dc }]}>{p.difficulty_level}</Text>
                        </View>
                      )}
                      {p.price && (
                        <View style={styles.priceChip}>
                          <Text style={styles.priceText}>₦{p.price.toLocaleString()}</Text>
                        </View>
                      )}
                    </View>
                  </MotiView>
                </TouchableOpacity>
              </MotiView>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
      {step === 'program' && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.nextBtn, !selectedProgram && { opacity: 0.4 }]} onPress={() => setStep('confirm')} disabled={!selectedProgram}>
            <LinearGradient colors={COLORS.gradPrimary as any} style={styles.nextBtnGrad}>
              <Text style={styles.nextBtnText}>Next: Confirm →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>📋 Enrolment Summary</Text>
            <View style={styles.confirmRow}><Text style={styles.confirmKey}>Students</Text><Text style={styles.confirmVal}>{selectedStudents.size} selected</Text></View>
            <View style={styles.confirmRow}><Text style={styles.confirmKey}>Programme</Text><Text style={styles.confirmVal}>{selectedProgram?.name}</Text></View>
          </View>

          <Text style={styles.sectionLabel}>Enrolment Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg }}>
            {ENROLLMENT_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setEnrollmentType(t)}
                style={[styles.typeChip, enrollmentType === t && styles.typeChipActive]}>
                <Text style={[styles.typeChipText, enrollmentType === t && { color: COLORS.primaryLight }]}>{t.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Students ({selectedStudents.size})</Text>
          {Array.from(selectedStudents).map(id => {
            const s = students.find(x => x.id === id);
            return s ? (
              <View key={id} style={styles.studentRowSmall}>
                <Text style={styles.studentName}>{s.full_name}</Text>
                <Text style={styles.studentMeta}>{s.email}</Text>
              </View>
            ) : null;
          })}

          <TouchableOpacity style={[styles.nextBtn, { marginTop: SPACING.xl }, submitting && { opacity: 0.6 }]} onPress={handleEnrol} disabled={submitting}>
            <LinearGradient colors={COLORS.gradPrimary as any} style={styles.nextBtnGrad}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.nextBtnText}>🎓 Confirm Enrolment</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginHorizontal: 4 },
  stepLine: { height: 1, backgroundColor: COLORS.border },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  selCount: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, paddingHorizontal: SPACING.xl, marginBottom: 4 },

  list: { paddingHorizontal: SPACING.xl },
  selectAllBtn: { alignSelf: 'flex-end', marginBottom: SPACING.sm },
  selectAllText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },

  studentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  studentRowSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  studentName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  studentMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  schoolChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  schoolChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },

  programCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  programTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  programName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, flex: 1 },
  programDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, lineHeight: 18 },
  diffChip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  priceChip: { backgroundColor: COLORS.gold + '22', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  priceText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.gold },

  confirmCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, gap: 8 },
  confirmTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between' },
  confirmKey: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  confirmVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  typeChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'capitalize' },
  studentRowSmall: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 6 },

  footer: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  nextBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },
});

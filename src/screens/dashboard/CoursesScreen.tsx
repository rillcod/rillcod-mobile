import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal,
  ScrollView, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Program { id: string; name: string; }

interface Course {
  id: string;
  title: string;
  description: string | null;
  program_id: string | null;
  duration_hours: number | null;
  is_active: boolean;
  created_at: string;
  programs?: { name: string } | null;
}

function formatDuration(h: number | null): string {
  if (!h) return '—';
  return `${h}h`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CoursesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formProgramId, setFormProgramId] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      let data: Course[] = [];

      if (isStaff) {
        const { data: rows, error } = await supabase
          .from('courses')
          .select('id, title, description, program_id, duration_hours, is_active, created_at, programs(name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = (rows ?? []) as unknown as Course[];
      } else {
        // Student: get enrolled programs → courses in those programs
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('program_id')
          .eq('user_id', profile.id);
        const programIds = (enrollments ?? []).map((e: any) => e.program_id).filter(Boolean);
        if (programIds.length > 0) {
          const { data: rows } = await supabase
            .from('courses')
            .select('id, title, description, program_id, duration_hours, is_active, created_at, programs(name)')
            .in('program_id', programIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          data = (rows ?? []) as unknown as Course[];
        }
      }
      setCourses(data);

      const { data: progs } = await supabase.from('programs').select('id, name').order('name');
      setPrograms((progs ?? []) as Program[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, isStaff]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSave = async () => {
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('courses').insert({
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        duration_hours: formDuration ? parseInt(formDuration, 10) : null,
        program_id: formProgramId || null,
        is_active: formActive,
      });
      if (error) throw error;
      setShowModal(false);
      setFormTitle(''); setFormDesc(''); setFormDuration(''); setFormProgramId(''); setFormActive(true);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // Group by program
  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, Course[]> = {};
  filtered.forEach(c => {
    const prog = (c.programs as any)?.name ?? 'No Program';
    if (!grouped[prog]) grouped[prog] = [];
    grouped[prog].push(c);
  });

  const groupKeys = Object.keys(grouped).sort();
  const totalActive = courses.filter(c => c.is_active).length;
  const programCount = new Set(courses.map(c => c.program_id)).size;

  const renderCourse = (course: Course, idx: number) => (
    <MotiView
      key={course.id}
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: idx * 40, type: 'timing', duration: 300 }}
      style={styles.courseCard}
    >
      <View style={styles.courseRow}>
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
          {course.description ? (
            <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
          ) : null}
          <View style={styles.chipRow}>
            {course.programs && (
              <View style={[styles.chip, { backgroundColor: COLORS.primaryPale }]}>
                <Text style={[styles.chipText, { color: COLORS.primaryLight }]}>
                  {(course.programs as any).name}
                </Text>
              </View>
            )}
            {course.duration_hours ? (
              <View style={[styles.chip, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Text style={[styles.chipText, { color: COLORS.info }]}>
                  {formatDuration(course.duration_hours)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.courseRight}>
          <View style={[styles.activeBadge, { backgroundColor: course.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)' }]}>
            <View style={[styles.dot, { backgroundColor: course.is_active ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.activeText, { color: course.is_active ? COLORS.success : COLORS.error }]}>
              {course.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <Text style={styles.courseDate}>{formatDate(course.created_at)}</Text>
        </View>
      </View>
    </MotiView>
  );

  const renderSection = ({ item: key }: { item: string }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <LinearGradient colors={COLORS.gradPrimary} style={styles.sectionDot} />
        <Text style={styles.sectionTitle}>{key}</Text>
        <Text style={styles.sectionCount}>{grouped[key].length}</Text>
      </View>
      {grouped[key].map((c, i) => renderCourse(c, i))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Courses</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{courses.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{totalActive}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.info }]}>{programCount}</Text>
          <Text style={styles.statLabel}>Programs</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : groupKeys.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyText}>No courses found</Text>
        </View>
      ) : (
        <FlatList
          data={groupKeys}
          keyExtractor={k => k}
          renderItem={renderSection}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Course Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Course</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="Course title" placeholderTextColor={COLORS.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Course description" placeholderTextColor={COLORS.textMuted}
                value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={3} />

              <Text style={styles.label}>Duration (hours)</Text>
              <TextInput style={styles.input} placeholder="e.g. 40" placeholderTextColor={COLORS.textMuted}
                value={formDuration} onChangeText={setFormDuration} keyboardType="numeric" />

              <Text style={styles.label}>Program</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                <TouchableOpacity
                  style={[styles.programPill, !formProgramId && styles.programPillActive]}
                  onPress={() => setFormProgramId('')}
                >
                  <Text style={[styles.programPillText, !formProgramId && styles.programPillTextActive]}>None</Text>
                </TouchableOpacity>
                {programs.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.programPill, formProgramId === p.id && styles.programPillActive]}
                    onPress={() => setFormProgramId(p.id)}
                  >
                    <Text style={[styles.programPillText, formProgramId === p.id && styles.programPillTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <Switch value={formActive} onValueChange={setFormActive}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={formActive ? COLORS.primaryLight : COLORS.textMuted} />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Save Course</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  addBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  addBtnInner: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display, color: COLORS.textPrimary },
  statLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.base, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 14, marginRight: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  section: { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  sectionCount: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  courseCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  courseRow: { flexDirection: 'row', gap: SPACING.sm },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 4 },
  courseDesc: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  courseRight: { alignItems: 'flex-end', gap: SPACING.sm },
  activeBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi },
  courseDate: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  programPill: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginRight: SPACING.sm },
  programPillActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  programPillText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  programPillTextActive: { color: COLORS.primaryLight, fontFamily: FONT_FAMILY.bodySemi },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

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
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';

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
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

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
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: idx * 40 }}
    >
      <TouchableOpacity 
        style={[styles.courseCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CourseDetail', { programId: course.program_id || '', title: course.title })}
      >
        <View style={styles.courseRow}>
          <View style={styles.courseInfo}>
            <Text style={[styles.courseTitle, { color: colors.textPrimary }]} numberOfLines={2}>{course.title}</Text>
            {course.description ? (
              <Text style={[styles.courseDesc, { color: colors.textMuted }]} numberOfLines={2}>{course.description}</Text>
            ) : null}
            <View style={styles.chipRow}>
              {course.programs && (
                <View style={[styles.chip, { backgroundColor: colors.primaryPale }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {(course.programs as any).name}
                  </Text>
                </View>
              )}
              {course.duration_hours ? (
                <View style={[styles.chip, { backgroundColor: colors.info + '15' }]}>
                  <Text style={[styles.chipText, { color: colors.info }]}>
                    {formatDuration(course.duration_hours)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.courseRight}>
            <View style={[styles.activeBadge, { backgroundColor: course.is_active ? colors.success + '15' : colors.error + '10' }]}>
              <View style={[styles.dot, { backgroundColor: course.is_active ? colors.success : colors.error }]} />
              <Text style={[styles.activeText, { color: course.is_active ? colors.success : colors.error }]}>
                {course.is_active ? 'ACTIVE' : 'OFFLINE'}
              </Text>
            </View>
            <Text style={[styles.courseDate, { color: colors.textMuted }]}>{formatDate(course.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  );

  const renderSection = ({ item: key }: { item: string }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <LinearGradient colors={colors.gradPrimary} style={styles.sectionDot} />
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{key.toUpperCase()}</Text>
        <View style={[styles.sectionCount, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>{grouped[key].length}</Text>
        </View>
      </View>
      {grouped[key].map((c, i) => renderCourse(c, i))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="COURSES"
        onBack={() => navigation.goBack()}
        rightAction={isAdmin ? { label: '+ ADD', onPress: () => { setShowModal(true); light(); } } : undefined}
      />

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'TOTAL', value: courses.length, color: colors.textPrimary },
          { label: 'ACTIVE', value: totalActive, color: colors.success },
          { label: 'PROGRAMS', value: programCount, color: colors.info },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="FILTER COURSES..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : groupKeys.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🌑</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>NO COURSES DETECTED</Text>
        </View>
      ) : (
        <FlatList
          data={groupKeys}
          keyExtractor={k => k}
          renderItem={renderSection}
          contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Course Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>ADD NEW COURSE</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textMuted }]}>COURSE TITLE</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} placeholder="E.G. ADVANCED ROBOTICS" placeholderTextColor={colors.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>DESCRIPTION</Text>
              <TextInput style={[styles.input, styles.textArea, { color: colors.textPrimary, borderColor: colors.border }]} placeholder="MODULE DESCRIPTION..." placeholderTextColor={colors.textMuted}
                value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={3} />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>DURATION (HOURS)</Text>
              <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} placeholder="40" placeholderTextColor={colors.textMuted}
                value={formDuration} onChangeText={setFormDuration} keyboardType="numeric" />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>LINK TO PROGRAM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
                {programs.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.programPill, { borderColor: colors.border }, formProgramId === p.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                    onPress={() => setFormProgramId(p.id)}
                  >
                    <Text style={[styles.programPillText, { color: colors.textMuted }, formProgramId === p.id && { color: colors.primary, fontWeight: 'bold' }]}>{p.name.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowModal(false)}>
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={colors.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>INITIALIZE COURSE</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 2 },

  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg, marginTop: SPACING.md },
  statCard: { flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display },
  statLabel: { fontSize: 8, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1, marginTop: 2 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 14, marginRight: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 12, fontFamily: FONT_FAMILY.mono },

  section: { marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.md },
  sectionDot: { width: 4, height: 16 },
  sectionTitle: { flex: 1, fontSize: 12, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
  sectionCount: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },

  courseCard: { borderRadius: RADIUS.sm, borderWidth: 1, padding: SPACING.lg, marginBottom: SPACING.sm },
  courseRow: { flexDirection: 'row', gap: SPACING.md },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, marginBottom: 4 },
  courseDesc: { fontSize: 12, fontFamily: FONT_FAMILY.body, marginBottom: SPACING.md, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: RADIUS.xs, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, textTransform: 'uppercase' },
  courseRight: { alignItems: 'flex-end', gap: SPACING.sm },
  activeBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.xs, paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  activeText: { fontSize: 8, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
  courseDate: { fontSize: 9, fontFamily: FONT_FAMILY.mono },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalSheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderTopWidth: 1, padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.xl },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.display, marginBottom: SPACING.xl, letterSpacing: 1 },
  label: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, fontFamily: FONT_FAMILY.body },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  programPill: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  programPillText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { flex: 1, padding: 16, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 11, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
  saveBtn: { flex: 2, borderRadius: RADIUS.sm, overflow: 'hidden' },
  saveBtnInner: { padding: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 11, fontFamily: FONT_FAMILY.bodyBold, color: '#fff', letterSpacing: 1 },
});

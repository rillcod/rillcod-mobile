import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Platform, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { classService } from '../../services/class.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  program_id: string | null;
  program_name: string | null;
  student_count: number;
  school_id: string | null;
  school_name: string | null;
  created_at: string;
  status: string | null;
  current_students: number | null;
  max_students: number | null;
  schedule: string | null;
}

interface TeacherOption {
  id: string;
  full_name: string;
  email: string | null;
}

interface ProgramOption {
  id: string;
  name: string;
}

type StatusFilter = 'all' | 'active' | 'scheduled' | 'completed';
type EditorStatus = 'active' | 'scheduled' | 'completed';

interface EditorState {
  id?: string;
  name: string;
  description: string;
  teacher_id: string;
  program_id: string;
  max_students: string;
  schedule: string;
  status: EditorStatus;
}

const CLASS_COLORS = [COLORS.admin, '#7c3aed', COLORS.info, COLORS.success, COLORS.gold, COLORS.accent];
const STATUS_OPTIONS: EditorStatus[] = ['active', 'scheduled', 'completed'];

const defaultEditorState = (): EditorState => ({
  name: '',
  description: '',
  teacher_id: '',
  program_id: '',
  max_students: '30',
  schedule: '',
  status: 'active',
});

export default function ClassesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  const isTeacher = profile?.role === 'teacher';
  const isSchool = profile?.role === 'school';
  const canManage = profile?.role === 'admin' || profile?.role === 'teacher';

  const loadLookups = useCallback(async () => {
    const [teacherRows, programRows] = await Promise.all([
      classService.listTeacherOptions({
        schoolId: profile?.school_id,
        isAdmin: profile?.role === 'admin',
      }),
      classService.listActiveProgramOptions(150),
    ]);

    setTeachers(teacherRows as TeacherOption[]);
    setPrograms(programRows as ProgramOption[]);
  }, [profile?.role, profile?.school_id]);

  const load = useCallback(async () => {
    const data = await classService.listClassesForManagement({
      role: profile?.role,
      teacherId: isTeacher ? profile!.id : undefined,
      schoolId: !isTeacher && profile?.school_id ? profile.school_id : undefined,
      limit: 150,
    });
    if (data) {
      const items: ClassItem[] = (data as any[]).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        teacher_id: c.teacher_id ?? null,
        teacher_name: c.portal_users?.full_name ?? null,
        program_id: c.program_id ?? null,
        program_name: c.programs?.name ?? null,
        school_id: c.school_id ?? null,
        school_name: c.schools?.name ?? null,
        current_students: c.current_students ?? 0,
        max_students: c.max_students ?? null,
        schedule: c.schedule ?? null,
        status: c.status ?? null,
        created_at: c.created_at,
        student_count: c.current_students ?? 0,
      }));

      // Refresh counts from live student records when possible.
      if (items.length > 0) {
        const counts = await Promise.all(items.map((c) => classService.countStudentsInClass(c.id)));
        counts.forEach((cnt, i) => {
          items[i].student_count = cnt;
        });
      }

      setClasses(items);
    }
    setLoading(false);
  }, [profile, isTeacher]);

  useEffect(() => {
    load();
    loadLookups();
  }, [load, loadLookups]);

  const filtered = classes.filter(c => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.program_name ?? '').toLowerCase().includes(q) ||
      (c.teacher_name ?? '').toLowerCase().includes(q) ||
      (c.school_name ?? '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || (c.status ?? 'active') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalStudents = classes.reduce((sum, item) => sum + (item.student_count ?? item.current_students ?? 0), 0);
  const activeCount = classes.filter((item) => item.status === 'active').length;
  const programCount = new Set(classes.map((item) => item.program_id).filter(Boolean)).size;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadLookups()]);
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditor(defaultEditorState());
    setEditorVisible(true);
  };

  const openEdit = (item: ClassItem) => {
    setEditor({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      teacher_id: item.teacher_id ?? '',
      program_id: item.program_id ?? '',
      max_students: item.max_students ? String(item.max_students) : '30',
      schedule: item.schedule ?? '',
      status: (item.status as EditorStatus) ?? 'active',
    });
    setEditorVisible(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorVisible(false);
    setEditor(defaultEditorState());
  };

  const saveClass = async () => {
    if (!editor.name.trim()) {
      Alert.alert('Class name required', 'Enter a class name before saving.');
      return;
    }

    setSaving(true);
    const payload = {
      name: editor.name.trim(),
      description: editor.description.trim() || null,
      teacher_id: editor.teacher_id || null,
      program_id: editor.program_id || null,
      school_id: profile?.school_id ?? null,
      max_students: Number.parseInt(editor.max_students || '0', 10) || 30,
      schedule: editor.schedule.trim() || null,
      status: editor.status,
    };

    try {
      if (editor.id) {
        await classService.updateClass(editor.id, payload);
      } else {
        await classService.createClass({ ...payload, current_students: 0 });
      }
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Unable to save class', e.message);
      return;
    }

    setSaving(false);

    closeEditor();
    await load();
  };

  const deleteClass = (item: ClassItem) => {
    Alert.alert(
      'Delete class',
      `Delete "${item.name}"? Related sessions and enrolments may also be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await classService.deleteClass(item.id);
              await load();
            } catch (e: any) {
              Alert.alert('Delete failed', e.message);
            }
          },
        },
      ]
    );
  };

  const getStatusTone = (status: string | null) => {
    if (status === 'completed') return { color: COLORS.info, bg: `${COLORS.info}14` };
    if (status === 'scheduled') return { color: COLORS.warning, bg: `${COLORS.warning}14` };
    return { color: COLORS.success, bg: `${COLORS.success}14` };
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadText}>Loading classes…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{isTeacher ? 'My Classes' : 'Classes'}</Text>
          <Text style={styles.subtitle}>Manage classes, enrolment, schedules, and learning flow.</Text>
        </View>
        {canManage && (
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add Class</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Total Classes" value={classes.length} color={COLORS.primary} />
        <StatCard label="Students" value={totalStudents} color={COLORS.info} />
        <StatCard label="Active" value={activeCount} color={COLORS.success} />
        <StatCard label="Programmes" value={programCount} color={COLORS.accent} />
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>S</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by class, programme, teacher, or school..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>x</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'active', 'scheduled', 'completed'] as StatusFilter[]).map((option) => {
          const active = option === statusFilter;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => setStatusFilter(option)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {option === 'all' ? 'All Statuses' : option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No classes found</Text>
            <Text style={styles.emptyText}>
              {search || statusFilter !== 'all'
                ? 'No classes match this filter. Try a broader search or switch the status.'
                : 'There are no classes yet. Create the first class from mobile and keep the workflow here.'}
            </Text>
            {canManage ? (
              <TouchableOpacity style={styles.emptyCta} onPress={openCreate}>
                <Text style={styles.emptyCtaText}>Create Class</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          filtered.map((c, i) => {
            const color = CLASS_COLORS[i % CLASS_COLORS.length];
            const tone = getStatusTone(c.status);
            const occupancy = c.max_students && c.max_students > 0
              ? Math.min(100, Math.round(((c.student_count ?? 0) / c.max_students) * 100))
              : null;
            return (
              <MotiView key={c.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => navigation.navigate(ROUTES.ClassDetail, { classId: c.id })}>
                  <LinearGradient colors={[color + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={[styles.colorBar, { backgroundColor: color }]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.className}>{c.name}</Text>
                        {c.program_name ? <Text style={styles.programMeta}>{c.program_name}</Text> : null}
                      </View>
                      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.badgeText, { color: tone.color }]}>{c.status ?? 'active'}</Text>
                      </View>
                    </View>
                    {c.description ? <Text style={styles.classDesc} numberOfLines={2}>{c.description}</Text> : null}
                    <View style={styles.infoLine}>
                      <Text style={styles.infoLabel}>Schedule</Text>
                      <Text style={styles.infoValue}>{c.schedule || 'No schedule'}</Text>
                    </View>
                    <View style={styles.infoLine}>
                      <Text style={styles.infoLabel}>Students</Text>
                      <Text style={styles.infoValue}>{c.student_count} / {c.max_students ?? 'Unlimited'}</Text>
                    </View>
                    {c.school_name ? (
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>School</Text>
                        <Text style={styles.infoValue}>{c.school_name}</Text>
                      </View>
                    ) : null}
                    {c.teacher_name && !isSchool ? (
                      <View style={styles.infoLine}>
                        <Text style={styles.infoLabel}>Teacher</Text>
                        <Text style={styles.infoValue}>{c.teacher_name}</Text>
                      </View>
                    ) : null}
                    {occupancy != null ? (
                      <View style={styles.progressWrap}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressText}>Enrolment</Text>
                          <Text style={styles.progressText}>{occupancy}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${occupancy}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.actionRow}>
                      <ActionButton label="Open" borderColor={color} textColor={color} onPress={() => navigation.navigate(ROUTES.ClassDetail, { classId: c.id })} />
                      {canManage ? <ActionButton label="Edit" borderColor={COLORS.border} textColor={COLORS.textPrimary} onPress={() => openEdit(c)} /> : null}
                      {canManage ? <ActionButton label="Delete" borderColor={COLORS.error} textColor={COLORS.error} onPress={() => deleteClass(c)} /> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              </MotiView>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeEditor} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editor.id ? 'Edit Class' : 'Create Class'}</Text>
              <TouchableOpacity onPress={closeEditor} disabled={saving}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <FormField label="Class Name" value={editor.name} onChangeText={(value) => setEditor((prev) => ({ ...prev, name: value }))} placeholder="e.g. JSS 1 Coding Basics" />
              <FormField label="Description" value={editor.description} onChangeText={(value) => setEditor((prev) => ({ ...prev, description: value }))} placeholder="Brief class description" multiline />
              <FormField label="Schedule" value={editor.schedule} onChangeText={(value) => setEditor((prev) => ({ ...prev, schedule: value }))} placeholder="Mon and Wed, 3pm - 5pm" />
              <FormField label="Max Students" value={editor.max_students} onChangeText={(value) => setEditor((prev) => ({ ...prev, max_students: value }))} placeholder="30" keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((option) => {
                  const active = editor.status === option;
                  return (
                    <TouchableOpacity key={option} style={[styles.statusPill, active && styles.statusPillActive]} onPress={() => setEditor((prev) => ({ ...prev, status: option }))}>
                      <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Programme</Text>
              <View style={styles.selectWrap}>
                <TouchableOpacity style={[styles.optionCard, !editor.program_id && styles.optionCardActive]} onPress={() => setEditor((prev) => ({ ...prev, program_id: '' }))}>
                  <Text style={[styles.optionTitle, !editor.program_id && styles.optionTitleActive]}>No programme</Text>
                </TouchableOpacity>
                {programs.map((program) => {
                  const active = editor.program_id === program.id;
                  return (
                    <TouchableOpacity key={program.id} style={[styles.optionCard, active && styles.optionCardActive]} onPress={() => setEditor((prev) => ({ ...prev, program_id: program.id }))}>
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{program.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Teacher</Text>
              <View style={styles.selectWrap}>
                <TouchableOpacity style={[styles.optionCard, !editor.teacher_id && styles.optionCardActive]} onPress={() => setEditor((prev) => ({ ...prev, teacher_id: '' }))}>
                  <Text style={[styles.optionTitle, !editor.teacher_id && styles.optionTitleActive]}>Unassigned</Text>
                </TouchableOpacity>
                {teachers.map((teacher) => {
                  const active = editor.teacher_id === teacher.id;
                  return (
                    <TouchableOpacity key={teacher.id} style={[styles.optionCard, active && styles.optionCardActive]} onPress={() => setEditor((prev) => ({ ...prev, teacher_id: teacher.id }))}>
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{teacher.full_name}</Text>
                      {teacher.email ? <Text style={styles.optionSub}>{teacher.email}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={saveClass} disabled={saving}>
                <LinearGradient colors={COLORS.gradPrimary} style={styles.saveGrad}>
                  {saving ? <ActivityIndicator color={COLORS.white100} /> : <Text style={styles.saveText}>{editor.id ? 'Save Changes' : 'Create Class'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: `${color}18` }]} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  borderColor,
  textColor,
  onPress,
}: {
  label: string;
  borderColor: string;
  textColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor }]} onPress={onPress}>
      <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldTextArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginTop: SPACING.md },
  statCard: { width: '48%', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md },
  statAccent: { width: 28, height: 28, borderRadius: RADIUS.sm, marginBottom: 10 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.lg,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },
  filterRow: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, gap: SPACING.sm },
  filterPill: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 9 },
  filterPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.primary },

  list: { paddingBottom: SPACING.xl },
  card: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginHorizontal: SPACING.xl, marginTop: SPACING.sm, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  colorBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: SPACING.md },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 8 },
  className: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  classDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 16 },
  programMeta: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'uppercase' },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, marginTop: 4 },
  infoLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  progressWrap: { marginTop: SPACING.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 999 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginTop: SPACING.md },
  actionBtn: { minHeight: 38, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  emptyWrap: { marginHorizontal: SPACING.xl, marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard, paddingHorizontal: SPACING.xl, paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  emptyCta: { marginTop: SPACING.md, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10 },
  emptyCtaText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9, 15, 25, 0.48)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  modalClose: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  fieldWrap: { marginBottom: SPACING.md },
  fieldLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  fieldTextArea: { minHeight: 84, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.md },
  statusPill: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: COLORS.bgCard },
  statusPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  statusPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  statusPillTextActive: { color: COLORS.primary },
  selectWrap: { gap: SPACING.sm, marginBottom: SPACING.md },
  optionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, padding: SPACING.md },
  optionCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  optionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  optionTitleActive: { color: COLORS.primary },
  optionSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 3 },
  saveBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.sm, marginBottom: SPACING.lg },
  saveGrad: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.6 },
});


import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { programService } from '../../services/program.service';
import { schoolService } from '../../services/school.service';
import { courseService } from '../../services/course.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  difficulty_level: string | null;
  price: number | null;
  max_students: number | null;
  is_active: boolean | null;
  school_id: string | null;
  created_at: string | null;
  schools?: { name: string } | null;
}

const DIFF_OPTS = ['beginner', 'intermediate', 'advanced'];
const DIFF_COLORS: Record<string, string> = {
  beginner: COLORS.success,
  intermediate: COLORS.warning,
  advanced: COLORS.error,
};

function ProgramModal({
  visible,
  program,
  schools,
  canPickSchool,
  defaultSchoolId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  program: Program | null;
  schools: School[];
  canPickSchool: boolean;
  defaultSchoolId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [weeks, setWeeks] = useState('');
  const [price, setPrice] = useState('');
  const [maxStudents, setMaxStudents] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [isActive, setIsActive] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (program) {
      setName(program.name);
      setDesc(program.description || '');
      setWeeks(program.duration_weeks ? String(program.duration_weeks) : '');
      setPrice(program.price ? String(program.price) : '');
      setMaxStudents(program.max_students ? String(program.max_students) : '');
      setDifficulty(program.difficulty_level || 'beginner');
      setIsActive(program.is_active ?? true);
      setSchoolId(program.school_id || defaultSchoolId || '');
    } else {
      setName('');
      setDesc('');
      setWeeks('');
      setPrice('');
      setMaxStudents('');
      setDifficulty('beginner');
      setIsActive(true);
      setSchoolId(defaultSchoolId || '');
    }
  }, [program, visible, defaultSchoolId]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Programme name is required.');
      return;
    }
    if (canPickSchool && !schoolId) {
      Alert.alert('Required', 'Select a school for this programme.');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: desc.trim() || null,
      duration_weeks: weeks ? parseInt(weeks, 10) : null,
      price: price ? parseFloat(price) : null,
      max_students: maxStudents ? parseInt(maxStudents, 10) : null,
      difficulty_level: difficulty,
      is_active: isActive,
      school_id: schoolId || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (program) {
        await programService.updateProgram(program.id, {
          name: payload.name,
          description: payload.description ?? undefined,
          duration_weeks: payload.duration_weeks ?? undefined,
          price: payload.price ?? undefined,
          max_students: payload.max_students ?? undefined,
          difficulty_level: payload.difficulty_level as 'beginner' | 'intermediate' | 'advanced',
          is_active: payload.is_active,
          school_id: payload.school_id ?? undefined,
        });
      } else {
        await programService.createProgram(
          {
            name: payload.name,
            description: payload.description ?? undefined,
            duration_weeks: payload.duration_weeks ?? undefined,
            price: payload.price ?? undefined,
            max_students: payload.max_students ?? undefined,
            difficulty_level: payload.difficulty_level as 'beginner' | 'intermediate' | 'advanced',
            is_active: payload.is_active ?? true,
          },
          schoolId,
        );
      }
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{program ? 'Edit Programme' : 'New Programme'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeBtn}>X</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={modalStyles.fieldWrap}>
              <Text style={modalStyles.fieldLabel}>Programme Name *</Text>
              <TextInput
                style={modalStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Python Foundations"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={modalStyles.fieldWrap}>
              <Text style={modalStyles.fieldLabel}>Description</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textArea]}
                value={desc}
                onChangeText={setDesc}
                placeholder="Brief description..."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </View>

            <View style={modalStyles.gridRow}>
              <View style={[modalStyles.fieldWrap, modalStyles.gridCol]}>
                <Text style={modalStyles.fieldLabel}>Duration (weeks)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={weeks}
                  onChangeText={setWeeks}
                  placeholder="12"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[modalStyles.fieldWrap, modalStyles.gridCol]}>
                <Text style={modalStyles.fieldLabel}>Price (N)</Text>
                <TextInput
                  style={modalStyles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="25000"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={modalStyles.fieldWrap}>
              <Text style={modalStyles.fieldLabel}>Max Students</Text>
              <TextInput
                style={modalStyles.input}
                value={maxStudents}
                onChangeText={setMaxStudents}
                placeholder="30"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>

            {schools.length > 0 ? (
              <View style={modalStyles.fieldWrap}>
                <Text style={modalStyles.fieldLabel}>School</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={modalStyles.chipRow}>
                    {schools.map((school) => {
                      const selected = schoolId === school.id;
                      return (
                        <TouchableOpacity
                          key={school.id}
                          onPress={() => setSchoolId(school.id)}
                          style={[
                            modalStyles.pickChip,
                            selected && modalStyles.pickChipActive,
                          ]}
                          disabled={!canPickSchool && schoolId !== school.id}
                        >
                          <Text
                            style={[
                              modalStyles.pickChipText,
                              selected && modalStyles.pickChipTextActive,
                            ]}
                          >
                            {school.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <Text style={modalStyles.fieldLabel}>Difficulty</Text>
            <View style={modalStyles.chipRow}>
              {DIFF_OPTS.map((level) => {
                const tone = DIFF_COLORS[level] || COLORS.primary;
                const selected = difficulty === level;
                return (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setDifficulty(level)}
                    style={[
                      modalStyles.pickChip,
                      selected && { backgroundColor: `${tone}22`, borderColor: tone },
                    ]}
                  >
                    <Text
                      style={[
                        modalStyles.pickChipText,
                        selected && { color: tone },
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={modalStyles.switchRow}>
              <Text style={modalStyles.fieldLabel}>Active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: COLORS.success, false: COLORS.border }}
              />
            </View>

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
            >
              <LinearGradient colors={COLORS.gradPrimary as any} style={modalStyles.saveBtnGrad}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={modalStyles.saveBtnText}>
                    {program ? 'Save Changes' : 'Create Programme'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProgramsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const role = profile?.role;
  const isAdmin = role === 'admin';
  const canManage = role === 'admin' || role === 'school' || role === 'teacher';

  const load = useCallback(async () => {
    try {
      const rows = await programService.listProgramsForManagement({
        isAdmin,
        schoolId: profile?.school_id,
      });
      setPrograms((rows ?? []) as unknown as Program[]);

      let schoolRows: School[] = [];
      if (isAdmin) {
        const opts = await schoolService.listApprovedSchoolOptions();
        schoolRows = (opts ?? []) as School[];
      } else if (profile?.school_id) {
        const d = await schoolService.getSchoolDetail(profile.school_id);
        if (d) schoolRows = [{ id: d.id, name: d.name }];
      }
      setSchools(schoolRows);

      setCourseCounts(await courseService.countCoursesByProgram());
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, profile?.school_id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return programs;
    return programs.filter((program) => {
      const schoolName = program.schools?.name?.toLowerCase() || '';
      return (
        program.name.toLowerCase().includes(term) ||
        (program.description || '').toLowerCase().includes(term) ||
        schoolName.includes(term)
      );
    }).filter((program) => diffFilter === 'all' || program.difficulty_level === diffFilter);
  }, [diffFilter, programs, search]);

  const deleteProgram = (program: Program) => {
    Alert.alert('Delete Programme', `Delete "${program.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await programService.deleteProgram(program.id);
            setPrograms((current) => current.filter((item) => item.id !== program.id));
          } catch (e: any) {
            Alert.alert('Delete failed', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const active = programs.filter((program) => program.is_active).length;
  const schoolCount = new Set(programs.map((program) => program.school_id).filter(Boolean)).size;
  const totalSlots = programs.reduce((sum, program) => sum + (program.max_students || 0), 0);
  const avgValue = programs.length
    ? `N${Math.round(programs.reduce((sum, program) => sum + (program.price || 0), 0) / programs.length).toLocaleString()}`
    : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Programmes</Text>
          <Text style={styles.subtitle}>
            {programs.length} total · {active} active
          </Text>
        </View>
        {canManage ? (
          <TouchableOpacity
            onPress={() => {
              setEditing(null);
              setModalVisible(true);
            }}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: programs.length, color: COLORS.primary },
            { label: 'Active', value: active, color: COLORS.success },
            { label: 'Schools', value: schoolCount, color: COLORS.info },
            { label: 'Slots', value: totalSlots, color: COLORS.secondary },
            { label: 'Avg Value', value: avgValue, color: COLORS.warning },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { borderColor: `${stat.color}44` }]}>
              <Text style={[styles.statNum, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.searchWrap}>
        <Text>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search programmes..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {['all', ...DIFF_OPTS].map((level) => {
          const selected = diffFilter === level;
          const tone = level === 'all' ? COLORS.primary : DIFF_COLORS[level] || COLORS.primary;
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.filterPill,
                { borderColor: COLORS.border },
                selected && { borderColor: tone, backgroundColor: `${tone}18` },
              ]}
              onPress={() => setDiffFilter(level)}
            >
              <Text style={[styles.filterPillText, { color: selected ? tone : COLORS.textSecondary }]}>
                {level === 'all' ? 'All Levels' : level}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((program, index) => {
          const tone = DIFF_COLORS[program.difficulty_level || ''] || COLORS.textMuted;
          return (
            <MotiView
              key={program.id}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: index * 40 }}
            >
              <View style={styles.card}>
                <LinearGradient colors={[`${COLORS.primary}10`, 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{program.name}</Text>
                    {program.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {program.description}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor: program.is_active ? `${COLORS.success}22` : `${COLORS.error}22`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeBadgeText,
                        { color: program.is_active ? COLORS.success : COLORS.error },
                      ]}
                    >
                      {program.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {program.schools?.name ? (
                  <Text style={styles.schoolMeta}>School: {program.schools.name}</Text>
                ) : null}

                <View style={styles.chipList}>
                  <View style={[styles.chip, styles.metricChip]}>
                    <Text style={styles.chipText}>{courseCounts[program.id] || 0} courses</Text>
                  </View>
                  {program.difficulty_level ? (
                    <View style={[styles.chip, { backgroundColor: `${tone}22`, borderColor: `${tone}44` }]}>
                      <Text style={[styles.chipText, { color: tone }]}>{program.difficulty_level}</Text>
                    </View>
                  ) : null}
                  {program.duration_weeks ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>⏱ {program.duration_weeks}w</Text>
                    </View>
                  ) : null}
                  {program.price ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>N{program.price.toLocaleString()}</Text>
                    </View>
                  ) : null}
                  {program.max_students ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>Max {program.max_students}</Text>
                    </View>
                  ) : null}
                </View>

                {canManage ? (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditing(program);
                        setModalVisible(true);
                      }}
                      style={styles.editBtn}
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate(ROUTES.Courses, { programId: program.id, programName: program.name })}
                      style={styles.openBtn}
                    >
                      <Text style={styles.openBtnText}>Courses</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProgram(program)} style={styles.delBtn}>
                      <Text style={styles.delBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </MotiView>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      <ProgramModal
        visible={modalVisible}
        program={editing}
        schools={schools}
        canPickSchool={isAdmin}
        defaultSchoolId={profile?.school_id || null}
        onClose={() => setModalVisible(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING.xl,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    fontSize: 16,
    color: COLORS.textMuted,
    padding: 4,
    fontFamily: FONT_FAMILY.bodySemi,
  },
  fieldWrap: { marginBottom: SPACING.md },
  fieldLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  gridRow: { flexDirection: 'row', gap: SPACING.md },
  gridCol: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  pickChipActive: {
    backgroundColor: `${COLORS.primary}18`,
    borderColor: COLORS.primary,
  },
  pickChipText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  pickChipTextActive: {
    color: COLORS.primaryLight,
    fontFamily: FONT_FAMILY.bodySemi,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  saveBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  statCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 92,
  },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  filterRow: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    textTransform: 'capitalize',
  },
  list: { paddingHorizontal: SPACING.xl },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  cardName: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    flex: 1,
  },
  cardDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  schoolMeta: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.secondary,
    marginTop: SPACING.sm,
  },
  activeBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  chipList: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, flexWrap: 'wrap' },
  chip: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metricChip: {
    backgroundColor: `${COLORS.primary}10`,
    borderColor: `${COLORS.primary}30`,
  },
  chipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, flexWrap: 'wrap' },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${COLORS.info}22`,
    borderRadius: RADIUS.md,
  },
  editBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${COLORS.primary}18`,
    borderRadius: RADIUS.md,
  },
  openBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  delBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${COLORS.error}15`,
    borderRadius: RADIUS.md,
  },
  delBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
});

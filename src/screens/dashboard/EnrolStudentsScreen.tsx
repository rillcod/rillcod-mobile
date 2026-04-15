import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { enrollmentService, type BulkEnrollClassRow, type BulkEnrollStudentRow } from '../../services/enrollment.service';
import { classService } from '../../services/class.service';
import { schoolService } from '../../services/school.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

interface LegacyStudent {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  section_class: string | null;
}
interface Program {
  id: string;
  name: string;
  description: string | null;
  difficulty_level: string | null;
  price: number | null;
}

const ENROLLMENT_TYPES = ['school', 'bootcamp', 'online', 'in_person'];
const DIFF_COLORS: Record<string, string> = { beginner: COLORS.success, intermediate: COLORS.warning, advanced: COLORS.error };

const GRADE_PRESETS = [
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JSS1',
  'JSS2',
  'JSS3',
  'SS1',
  'SS2',
  'SS3',
  'Cohort A',
  'Cohort B',
  'Cohort C',
];

/** Deep-linked from class detail: programme enrolment + optional class assignment (legacy flow). */
function LegacyEnrolFromClass({ navigation, route }: any) {
  const { profile } = useAuth();
  const params = (route?.params ?? {}) as {
    classId?: string;
    className?: string;
    classSchoolId?: string;
    programId?: string;
  };
  const targetClassId = params.classId;
  const targetClassName = params.className;
  const scopeSchoolId = params.classSchoolId ?? profile?.school_id ?? null;
  const presetProgramId = params.programId;
  const [step, setStep] = useState<'students' | 'program' | 'confirm'>('students');
  const [students, setStudents] = useState<LegacyStudent[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [enrollmentType, setEnrollmentType] = useState('in_person');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const applySchoolScope =
      (profile?.role === 'teacher' || profile?.role === 'school') && !!profile?.school_id;
    const [studList, progList] = await Promise.all([
      enrollmentService.listStudentsForEnrolPicker({
        role: profile?.role,
        teacherId: profile?.id ?? null,
        schoolId: scopeSchoolId,
        applySchoolScope,
      }),
      enrollmentService.listProgramsForEnrolPicker({ scopeSchoolId, applySchoolScope }),
    ]);
    setStudents(studList as LegacyStudent[]);
    setPrograms(progList as Program[]);
    if (presetProgramId) {
      const found = (progList as Program[]).find((program) => program.id === presetProgramId);
      if (found) setSelectedProgram(found);
    }
    setLoading(false);
  }, [profile?.id, profile?.role, profile?.school_id, presetProgramId, scopeSchoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredStudents = search.trim()
    ? students.filter(
        (s) =>
          s.full_name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()),
      )
    : students;

  const handleEnrol = async () => {
    if (!selectedProgram || selectedStudents.size === 0) return;
    setSubmitting(true);
    try {
      const studentIds = Array.from(selectedStudents);
      const now = new Date().toISOString();
      const day = now.split('T')[0];
      const rows = Array.from(selectedStudents).map((sid) => ({
        user_id: sid,
        program_id: selectedProgram.id,
        role: 'student',
        status: 'active',
        progress_pct: 0,
        enrollment_date: day,
        created_at: now,
        updated_at: now,
      }));
      await enrollmentService.upsertEnrollments(rows);
      if (targetClassId) {
        await Promise.all(
          studentIds.map((studentId) =>
            classService.assignStudentToClass(studentId, targetClassId, targetClassName ?? null, {
              callerRole: profile?.role,
              callerId: profile?.id,
              callerSchoolId: scopeSchoolId,
            }),
          ),
        );
      }
      Alert.alert(
        '✅ Enrolled!',
        `${selectedStudents.size} student${selectedStudents.size > 1 ? 's' : ''} enrolled in ${selectedProgram.name}.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton
          onPress={() => (step === 'students' ? navigation.goBack() : setStep(step === 'confirm' ? 'program' : 'students'))}
          color={COLORS.textPrimary}
          style={styles.backBtn}
        />
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

      <View style={styles.stepRow}>
        {(['students', 'program', 'confirm'] as const).map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    step === s
                      ? COLORS.primary
                      : i < ['students', 'program', 'confirm'].indexOf(step)
                        ? COLORS.success
                        : COLORS.border,
                },
              ]}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontFamily: FONT_FAMILY.bodySemi }}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, step === s && { color: COLORS.primaryLight }]}>
              {s === 'students' ? 'Students' : s === 'program' ? 'Programme' : 'Confirm'}
            </Text>
            {i < 2 && <View style={[styles.stepLine, { flex: 1 }]} />}
          </View>
        ))}
      </View>

      {step === 'students' && (
        <>
          <View style={styles.searchWrap}>
            <Text>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search students…"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Text style={styles.selCount}>{selectedStudents.size} selected</Text>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.selectAllBtn}
              onPress={() => {
                if (selectedStudents.size === filteredStudents.length) setSelectedStudents(new Set());
                else setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
              }}
            >
              <Text style={styles.selectAllText}>
                {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            {filteredStudents.map((s, i) => {
              const sel = selectedStudents.has(s.id);
              return (
                <MotiView key={s.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 20 }}>
                  <TouchableOpacity
                    style={[styles.studentRow, sel && styles.studentRowSel]}
                    onPress={() => toggleStudent(s.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                      {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{s.full_name}</Text>
                      <Text style={styles.studentMeta}>
                        {s.email}
                        {s.section_class ? ` · ${s.section_class}` : ''}
                      </Text>
                    </View>
                    {s.school_name && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>{s.school_name}</Text>
                      </View>
                    )}
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

      {step === 'program' && (
        <>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {programs.map((p, i) => {
              const dc = DIFF_COLORS[p.difficulty_level || ''] || COLORS.textMuted;
              const sel = selectedProgram?.id === p.id;
              return (
                <MotiView key={p.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                  <TouchableOpacity onPress={() => setSelectedProgram(p)} activeOpacity={0.85}>
                    <MotiView
                      animate={{
                        borderColor: sel ? COLORS.primary : COLORS.border,
                        backgroundColor: sel ? COLORS.primary + '15' : COLORS.bgCard,
                      }}
                      transition={{ type: 'timing', duration: 150 }}
                      style={styles.programCard}
                    >
                      <View style={styles.programTop}>
                        <Text style={styles.programName}>{p.name}</Text>
                        {sel && <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text>}
                      </View>
                      {p.description && (
                        <Text style={styles.programDesc} numberOfLines={2}>
                          {p.description}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {p.difficulty_level && (
                          <View style={[styles.diffChip, { backgroundColor: dc + '22', borderColor: dc + '44' }]}>
                            <Text style={[styles.diffText, { color: dc }]}>{p.difficulty_level}</Text>
                          </View>
                        )}
                        {!!p.price && (
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
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.nextBtn, !selectedProgram && { opacity: 0.4 }]} onPress={() => setStep('confirm')} disabled={!selectedProgram}>
              <LinearGradient colors={COLORS.gradPrimary as any} style={styles.nextBtnGrad}>
                <Text style={styles.nextBtnText}>Next: Confirm →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === 'confirm' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>📋 Enrolment Summary</Text>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Students</Text>
              <Text style={styles.confirmVal}>{selectedStudents.size} selected</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Programme</Text>
              <Text style={styles.confirmVal}>{selectedProgram?.name}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Enrolment Type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg }}>
            {ENROLLMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setEnrollmentType(t)}
                style={[styles.typeChip, enrollmentType === t && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, enrollmentType === t && { color: COLORS.primaryLight }]}>
                  {t.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Students ({selectedStudents.size})</Text>
          {Array.from(selectedStudents).map((id) => {
            const s = students.find((x) => x.id === id);
            return s ? (
              <View key={id} style={styles.studentRowSmall}>
                <Text style={styles.studentName}>{s.full_name}</Text>
                <Text style={styles.studentMeta}>{s.email}</Text>
              </View>
            ) : null;
          })}

          <TouchableOpacity
            style={[styles.nextBtn, { marginTop: SPACING.xl }, submitting && { opacity: 0.6 }]}
            onPress={handleEnrol}
            disabled={submitting}
          >
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

function BulkEnrolStudentsMain({ navigation }: any) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<BulkEnrollStudentRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classesList, setClassesList] = useState<BulkEnrollClassRow[]>([]);
  const [adminSchools, setAdminSchools] = useState<{ id: string; name: string }[]>([]);
  const [teacherSchools, setTeacherSchools] = useState<{ id: string; name: string }[]>([]);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  const [showSettings, setShowSettings] = useState(true);
  const [classMode, setClassMode] = useState<'pick' | 'create'>('pick');
  const [programFilterId, setProgramFilterId] = useState('');
  const [pickClassId, setPickClassId] = useState('');

  const [newGrade, setNewGrade] = useState('');
  const [newNameExtra, setNewNameExtra] = useState('');
  const [createProgramId, setCreateProgramId] = useState('');
  const [createSchoolId, setCreateSchoolId] = useState('');

  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<{
    enrolled: number;
    skipped: number;
    className: string;
    programName?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [studList, progList, clsList, admSch, tSch] = await Promise.all([
        enrollmentService.listStudentsForBulkEnroll({
          role: profile?.role ?? '',
          teacherId: profile?.id ?? null,
          schoolId: profile?.school_id ?? null,
        }),
        enrollmentService.listProgramsForEnrolPicker({ scopeSchoolId: null, applySchoolScope: false }),
        enrollmentService.listClassesForBulkPicker({
          role: profile?.role,
          isAdmin,
          teacherId: profile?.id ?? null,
          schoolId: profile?.school_id ?? null,
        }),
        isAdmin ? schoolService.listApprovedSchoolsMini() : Promise.resolve([]),
        !isAdmin && profile?.id
          ? enrollmentService.listSchoolsForTeacherBulkPicker(profile.id, profile.school_id ?? null)
          : Promise.resolve([]),
      ]);
      setStudents(studList);
      setPrograms(progList as Program[]);
      setClassesList(clsList);
      setAdminSchools(admSch);
      setTeacherSchools(tSch);
    } catch (e: any) {
      console.warn('BulkEnrol load', e);
      Alert.alert('Error', e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id, profile?.school_id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const schoolNameOptions = useMemo(() => {
    const names = new Set<string>();
    students.forEach((s) => names.add(s.school_name || '(No School)'));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const sectionOptions = useMemo(() => {
    return [...new Set(students.map((s) => s.section_class).filter(Boolean) as string[])].sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return students.filter((s) => {
      const matchSearch =
        !q ||
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.school_name || '').toLowerCase().includes(q);
      const matchClass = !classFilter || (s.section_class || '').toLowerCase() === classFilter.toLowerCase();
      const matchSchool = !schoolFilter || (s.school_name || '(No School)') === schoolFilter;
      return matchSearch && matchClass && matchSchool;
    });
  }, [students, search, classFilter, schoolFilter]);

  const enrollableFiltered = useMemo(() => filtered.filter((s) => !enrolledIds.has(s.id)), [filtered, enrolledIds]);

  const scopedClasses = useMemo(() => {
    if (classesList.length === 0) return [];
    const selectedObjs = students.filter((s) => selected.has(s.id));
    const relevantSchoolIds = new Set(selectedObjs.map((s) => s.school_id).filter(Boolean) as string[]);
    const relevantSchoolNames = new Set(selectedObjs.map((s) => s.school_name).filter(Boolean) as string[]);

    return classesList.filter((c) => {
      const noSchoolScope = relevantSchoolIds.size === 0 && relevantSchoolNames.size === 0;
      const schoolMatch =
        noSchoolScope ||
        (c.school_id && relevantSchoolIds.has(c.school_id)) ||
        !!(c.schools?.name && relevantSchoolNames.has(c.schools.name));
      if (!schoolMatch) return false;
      if (programFilterId && c.program_id !== programFilterId) return false;
      return true;
    });
  }, [classesList, students, selected, programFilterId]);

  const classGroups = useMemo(() => {
    const groups: Record<string, BulkEnrollClassRow[]> = {};
    scopedClasses.forEach((c) => {
      const key = c.schools?.name ?? '— No School —';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [scopedClasses]);

  const toggleOne = (id: string) => {
    if (enrolledIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const ids = enrollableFiltered.map((s) => s.id);
    const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSel) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleEnroll = async () => {
    const studentIds = [...selected];
    if (studentIds.length === 0) {
      Alert.alert('Select students', 'Choose at least one student to enrol.');
      return;
    }
    const role = profile?.role ?? '';

    if (classMode === 'pick') {
      if (!pickClassId) {
        Alert.alert('Class required', 'Pick a class or switch to Create New Class.');
        return;
      }
      setEnrolling(true);
      try {
        const { enrolled, skipped } = await enrollmentService.bulkEnrollStudentsInClass({
          classId: pickClassId,
          studentIds,
          callerRole: role,
        });
        const cls = classesList.find((c) => c.id === pickClassId);
        const progName =
          cls?.programs?.name ?? programs.find((p) => p.id === cls?.program_id)?.name ?? undefined;
        setResult({ enrolled, skipped, className: cls?.name ?? 'Class', programName: progName });
        setEnrolledIds((prev) => {
          const n = new Set(prev);
          studentIds.forEach((id) => n.add(id));
          return n;
        });
        setSelected(new Set());
        const fresh = await enrollmentService.listClassesForBulkPicker({
          role: profile?.role,
          isAdmin,
          teacherId: profile?.id ?? null,
          schoolId: profile?.school_id ?? null,
        });
        setClassesList(fresh);
      } catch (e: any) {
        Alert.alert('Enrolment failed', e?.message ?? 'Unknown error');
      } finally {
        setEnrolling(false);
      }
      return;
    }

    const className = (newGrade || newNameExtra).trim();
    if (!className || !createProgramId) {
      Alert.alert('Create class', 'Enter a class name (or pick a grade preset) and choose a programme.');
      return;
    }
    setEnrolling(true);
    try {
      const now = new Date().toISOString();
      const schoolId =
        createSchoolId ||
        (isAdmin ? '' : teacherSchools.length === 1 ? teacherSchools[0].id : '') ||
        null;
      const row = await classService.createClassReturningRow({
        name: className,
        program_id: createProgramId,
        status: 'active',
        school_id: schoolId || null,
        teacher_id: profile?.role === 'teacher' ? profile.id : null,
        created_at: now,
        current_students: 0,
      });
      const prog = programs.find((p) => p.id === createProgramId);
      const { enrolled, skipped } = await enrollmentService.bulkEnrollStudentsInClass({
        classId: row.id,
        studentIds,
        callerRole: role,
      });
      setResult({
        enrolled,
        skipped,
        className,
        programName: prog?.name,
      });
      setEnrolledIds((prev) => {
        const n = new Set(prev);
        studentIds.forEach((id) => n.add(id));
        return n;
      });
      setSelected(new Set());
      setClassesList((prev) => [
        {
          id: row.id,
          name: row.name,
          program_id: row.program_id,
          school_id: row.school_id,
          programs: prog ? { name: prog.name } : null,
          schools: null,
        },
        ...prev,
      ]);
      setPickClassId(row.id);
      setClassMode('pick');
      setNewGrade('');
      setNewNameExtra('');
      setCreateSchoolId('');
    } catch (e: any) {
      Alert.alert('Create / enrol failed', e?.message ?? 'Unknown error');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const allFilteredSelected =
    enrollableFiltered.length > 0 && enrollableFiltered.every((s) => selected.has(s.id));

  const schoolPickerRows = isAdmin ? adminSchools : teacherSchools;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => goBackOrTo(navigation, ROUTES.PeopleHub)} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bulk enrol</Text>
          <Text style={styles.subtitle}>Select students → pick or create a class → enrol</Text>
        </View>
      </View>

      {result && (
        <View style={styles.resultBanner}>
          <Text style={styles.resultTitle}>
            {result.enrolled} student{result.enrolled !== 1 ? 's' : ''} enrolled into {result.className}
          </Text>
          {result.programName ? (
            <Text style={styles.resultSub}>Programme: {result.programName}</Text>
          ) : null}
          {result.skipped > 0 ? (
            <Text style={styles.resultSkip}>{result.skipped} skipped (outside school boundary).</Text>
          ) : null}
          <TouchableOpacity onPress={() => setResult(null)} style={styles.resultDismiss}>
            <Text style={styles.resultDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.bulkScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchWrap}>
          <Text>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email, school…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <Text style={styles.sectionLabel}>School filter</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <TouchableOpacity
            style={[styles.chip, !schoolFilter && styles.chipOn]}
            onPress={() => setSchoolFilter('')}
          >
            <Text style={[styles.chipText, !schoolFilter && styles.chipTextOn]}>All</Text>
          </TouchableOpacity>
          {schoolNameOptions.map((nm) => (
            <TouchableOpacity key={nm} style={[styles.chip, schoolFilter === nm && styles.chipOn]} onPress={() => setSchoolFilter(nm)}>
              <Text style={[styles.chipText, schoolFilter === nm && styles.chipTextOn]} numberOfLines={1}>
                {nm}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Section / class label (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <TouchableOpacity style={[styles.chip, !classFilter && styles.chipOn]} onPress={() => setClassFilter('')}>
            <Text style={[styles.chipText, !classFilter && styles.chipTextOn]}>Any</Text>
          </TouchableOpacity>
          {sectionOptions.map((sec) => (
            <TouchableOpacity key={sec} style={[styles.chip, classFilter === sec && styles.chipOn]} onPress={() => setClassFilter(sec)}>
              <Text style={[styles.chipText, classFilter === sec && styles.chipTextOn]} numberOfLines={1}>
                {sec}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.rowBetween}>
          <Text style={styles.selCount}>{selected.size} selected</Text>
          <TouchableOpacity onPress={toggleAllFiltered}>
            <Text style={styles.selectAllText}>{allFilteredSelected ? 'Clear filtered' : 'Select filtered'}</Text>
          </TouchableOpacity>
        </View>

        {filtered.map((s, i) => {
          const done = enrolledIds.has(s.id);
          const sel = selected.has(s.id);
          return (
            <MotiView key={s.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 15, 300) }}>
              <TouchableOpacity
                style={[styles.studentRow, sel && styles.studentRowSel, done && { opacity: 0.45 }]}
                onPress={() => toggleOne(s.id)}
                disabled={done}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                  {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{s.full_name}</Text>
                  <Text style={styles.studentMeta}>
                    {s.email}
                    {s.section_class ? ` · ${s.section_class}` : ''}
                  </Text>
                </View>
                {done ? (
                  <Text style={styles.doneBadge}>Enrolled</Text>
                ) : s.school_name ? (
                  <View style={styles.schoolChip}>
                    <Text style={styles.schoolChipText}>{s.school_name}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </MotiView>
          );
        })}

        <TouchableOpacity style={styles.settingsToggle} onPress={() => setShowSettings((v) => !v)} activeOpacity={0.85}>
          <Text style={styles.settingsToggleText}>Enrolment settings {showSettings ? '▼' : '▶'}</Text>
          <Text style={styles.settingsHint}>{scopedClasses.length} classes match selection</Text>
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsCard}>
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, classMode === 'pick' && styles.modeBtnOn]} onPress={() => setClassMode('pick')}>
                <Text style={[styles.modeBtnText, classMode === 'pick' && styles.modeBtnTextOn]}>Pick class</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, classMode === 'create' && styles.modeBtnOn]} onPress={() => setClassMode('create')}>
                <Text style={[styles.modeBtnText, classMode === 'create' && styles.modeBtnTextOn]}>Create class</Text>
              </TouchableOpacity>
            </View>

            {classMode === 'pick' ? (
              <>
                <Text style={styles.sectionLabel}>Filter classes by programme</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <TouchableOpacity
                    style={[styles.chip, !programFilterId && styles.chipOn]}
                    onPress={() => {
                      setProgramFilterId('');
                      setPickClassId('');
                    }}
                  >
                    <Text style={[styles.chipText, !programFilterId && styles.chipTextOn]}>All programmes</Text>
                  </TouchableOpacity>
                  {programs.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, programFilterId === p.id && styles.chipOn]}
                      onPress={() => {
                        setProgramFilterId(p.id);
                        setPickClassId('');
                      }}
                    >
                      <Text style={[styles.chipText, programFilterId === p.id && styles.chipTextOn]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>Select class</Text>
                {scopedClasses.length === 0 ? (
                  <Text style={styles.emptyHint}>
                    No classes match the current filters. Clear programme filter or select students to scope schools — or create a new class.
                  </Text>
                ) : (
                  classGroups.map(([schoolName, clsArr]) => (
                    <View key={schoolName} style={{ marginBottom: SPACING.md }}>
                      <Text style={styles.groupLabel}>{schoolName}</Text>
                      {clsArr.map((c) => {
                        const on = pickClassId === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.classPickRow, on && styles.classPickRowOn]}
                            onPress={() => setPickClassId(c.id)}
                          >
                            <Text style={styles.studentName}>{c.name}</Text>
                            <Text style={styles.classPickMeta}>{c.programs?.name ?? 'No programme'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Grade / cohort (preset)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {GRADE_PRESETS.map((g) => (
                    <TouchableOpacity key={g} style={[styles.chip, newGrade === g && styles.chipOn]} onPress={() => setNewGrade(g)}>
                      <Text style={[styles.chipText, newGrade === g && styles.chipTextOn]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.sectionLabel}>Or custom name</Text>
                <TextInput
                  style={styles.textField}
                  placeholder="Class display name"
                  placeholderTextColor={COLORS.textMuted}
                  value={newNameExtra}
                  onChangeText={setNewNameExtra}
                />
                <Text style={styles.sectionLabel}>Programme (required)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {programs.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, createProgramId === p.id && styles.chipOn]}
                      onPress={() => setCreateProgramId(p.id)}
                    >
                      <Text style={[styles.chipText, createProgramId === p.id && styles.chipTextOn]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {schoolPickerRows.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>School (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                      <TouchableOpacity
                        style={[styles.chip, !createSchoolId && styles.chipOn]}
                        onPress={() => setCreateSchoolId('')}
                      >
                        <Text style={[styles.chipText, !createSchoolId && styles.chipTextOn]}>Default</Text>
                      </TouchableOpacity>
                      {schoolPickerRows.map((sc) => (
                        <TouchableOpacity
                          key={sc.id}
                          style={[styles.chip, createSchoolId === sc.id && styles.chipOn]}
                          onPress={() => setCreateSchoolId(sc.id)}
                        >
                          <Text style={[styles.chipText, createSchoolId === sc.id && styles.chipTextOn]} numberOfLines={1}>
                            {sc.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.nextBtn, { marginTop: SPACING.lg, marginBottom: SPACING['3xl'] }, enrolling && { opacity: 0.6 }]}
          onPress={handleEnroll}
          disabled={enrolling}
        >
          <LinearGradient colors={COLORS.gradPrimary as any} style={styles.nextBtnGrad}>
            {enrolling ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.nextBtnText}>
                Enrol {selected.size} student{selected.size !== 1 ? 's' : ''}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function EnrolStudentsScreen(props: any) {
  const classId = props.route?.params?.classId;
  if (classId) return <LegacyEnrolFromClass {...props} />;
  return <BulkEnrolStudentsMain {...props} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  bulkScroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING['3xl'] },
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
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginHorizontal: 4 },
  stepLine: { height: 1, backgroundColor: COLORS.border },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  selCount: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  list: { paddingHorizontal: SPACING.xl },
  selectAllBtn: { alignSelf: 'flex-end', marginBottom: SPACING.sm },
  selectAllText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  studentRowSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  confirmCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: 8,
  },
  confirmTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between' },
  confirmKey: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  confirmVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  typeChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'capitalize' },
  studentRowSmall: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 6 },
  footer: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  nextBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },
  resultBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.success + '44',
    backgroundColor: COLORS.success + '12',
  },
  resultTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  resultSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, marginTop: 4 },
  resultSkip: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, marginTop: 4 },
  resultDismiss: { alignSelf: 'flex-end', marginTop: SPACING.sm },
  resultDismissText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  chipScroll: { marginBottom: SPACING.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: COLORS.bgCard,
    maxWidth: 220,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '18' },
  chipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.primaryLight },
  settingsToggle: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  settingsToggleText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  settingsHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  settingsCard: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
  },
  modeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeBtnOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  modeBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  modeBtnTextOn: { color: COLORS.primaryLight },
  groupLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 1,
  },
  classPickRow: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.bg,
  },
  classPickRowOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  classPickMeta: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  textField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18 },
  doneBadge: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.success },
});

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { courseService, type CourseListRow } from '../../services/course.service';
import { schoolService } from '../../services/school.service';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';
import { ROUTES } from '../../navigation/routes';

interface Program {
  id: string;
  name: string;
  school_id: string | null;
}

interface School {
  id: string;
  name: string;
}

// Course type is now imported from CourseService

function formatDuration(hours: number | null) {
  if (!hours) return '—';
  return `${hours}h`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CoursesScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { light } = useHaptics();

  const requestedProgramId = route.params?.programId as string | undefined;
  const requestedProgramName = route.params?.programName as string | undefined;
  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isStaff = role === 'admin' || role === 'school' || role === 'teacher';
  const canEdit = role === 'admin' || role === 'teacher';
  const canManage = isStaff;
  const [courses, setCourses] = useState<CourseListRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState(requestedProgramId || 'all');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const courseRows = await courseService.listCourses({
        programId: requestedProgramId,
        role: profile.role,
        userId: profile.id,
        schoolId: profile.school_id
      });
      setCourses(courseRows);

      const programRows = await courseService.listPrograms(isAdmin ? null : profile.school_id);
      
      let schoolRows: any[] = [];
      if (isAdmin) {
        schoolRows = await schoolService.listSchools();
      } else if (profile.school_id) {
        const detail = await schoolService.getSchoolDetail(profile.school_id);
        schoolRows = [detail];
      }

      setPrograms(programRows as Program[]);
      setSchools(schoolRows as School[]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, requestedProgramId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        !term ||
        course.title.toLowerCase().includes(term) ||
        (course.description || '').toLowerCase().includes(term) ||
        (course.school_name || '').toLowerCase().includes(term) ||
        (course.programs?.name || '').toLowerCase().includes(term);
      const matchesProgram =
        (requestedProgramId ? course.program_id === requestedProgramId : true) &&
        (programFilter === 'all' ? true : (programFilter === '__none__' ? !course.program_id : course.program_id === programFilter));
      return matchesSearch && matchesProgram;
    });
  }, [courses, programFilter, requestedProgramId, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, CourseListRow[]> = {};
    filteredCourses.forEach((course) => {
      const key = course.programs?.name || 'No Program';
      if (!groups[key]) groups[key] = [];
      groups[key].push(course);
    });
    return groups;
  }, [filteredCourses]);

  const groupKeys = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  /** Programs eligible for quick-link on a course row (same idea as former modal `availablePrograms` with school context). */
  const programsForQuickLink = useMemo(() => {
    if (!profile?.school_id) return programs;
    return programs.filter((p) => !p.school_id || p.school_id === profile.school_id);
  }, [programs, profile?.school_id]);

  const openCourseEditor = (courseId?: string) => {
    light();
    navigation.navigate(ROUTES.CourseEditor, courseId ? { courseId } : { programId: requestedProgramId });
  };

  const handleDelete = (course: CourseListRow) => {
    Alert.alert('Delete Course', `Delete "${course.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await courseService.deleteCourse(course.id);
            setCourses((current) => current.filter((item) => item.id !== course.id));
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message ?? 'Could not delete course.');
          }
        },
      },
    ]);
  };

  const handleQuickAssignProgram = async (courseId: string, programId: string) => {
    const program = programs.find((item) => item.id === programId);
    try {
      await courseService.linkCourseToProgram(courseId, programId);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message ?? 'Could not link course.');
      return;
    }

    const schoolName =
      schools.find((school) => school.id === program?.school_id)?.name ||
      profile?.school_name ||
      null;

    setCourses((current) =>
      current.map((item) =>
        item.id === courseId
          ? {
              ...item,
              program_id: programId,
              school_id: program?.school_id || item.school_id,
              school_name: schoolName || item.school_name,
              programs: program ? { name: program.name } : item.programs,
            }
          : item,
      ),
    );
  };

  const handleBulkAssignProgram = async (programId: string) => {
    const uncategorized = courses.filter((course) => !course.program_id);
    if (!uncategorized.length) return;

    setBulkAssigning(true);
    try {
      for (const course of uncategorized) {
        // Keep this sequential so failures are surfaced cleanly.
        await handleQuickAssignProgram(course.id, programId);
      }
      Alert.alert('Courses fixed', `${uncategorized.length} uncategorized courses were assigned.`);
    } finally {
      setBulkAssigning(false);
    }
  };

  const renderCourse = (course: CourseListRow, index: number) => (
    <MotiView key={course.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 40 }}>
      <TouchableOpacity
        style={[styles.courseCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
        activeOpacity={0.82}
        onPress={() => navigation.navigate(ROUTES.CourseDetail, { courseId: course.id, programId: course.program_id || undefined, title: course.title })}
      >
        <View style={styles.courseRow}>
          <View style={styles.courseInfo}>
            <Text style={[styles.courseTitle, { color: colors.textPrimary }]} numberOfLines={2}>{course.title}</Text>
            {course.description ? <Text style={[styles.courseDesc, { color: colors.textMuted }]} numberOfLines={2}>{course.description}</Text> : null}
            <View style={styles.chipRow}>
              {course.programs?.name ? <View style={[styles.chip, { backgroundColor: colors.primaryPale }]}><Text style={[styles.chipText, { color: colors.primary }]}>{course.programs.name}</Text></View> : null}
              {course.is_locked ? <View style={[styles.chip, { backgroundColor: 'rgba(201,162,39,0.2)' }]}><Text style={[styles.chipText, { color: '#c9a227' }]}>LOCKED</Text></View> : null}
              {course.duration_hours ? <View style={[styles.chip, { backgroundColor: `${colors.info}15` }]}><Text style={[styles.chipText, { color: colors.info }]}>{formatDuration(course.duration_hours)}</Text></View> : null}
              {course.order_index !== null && course.order_index !== undefined ? <View style={[styles.chip, { backgroundColor: `${colors.success}14` }]}><Text style={[styles.chipText, { color: colors.success }]}>ORDER {course.order_index}</Text></View> : null}
            </View>
            {course.school_name ? <Text style={[styles.metaLine, { color: colors.textMuted }]}>School: {course.school_name}</Text> : null}
          </View>
          <View style={styles.courseRight}>
            <View style={[styles.activeBadge, { backgroundColor: course.is_active ? `${colors.success}15` : `${colors.error}10` }]}>
              <View style={[styles.dot, { backgroundColor: course.is_active ? colors.success : colors.error }]} />
              <Text style={[styles.activeText, { color: course.is_active ? colors.success : colors.error }]}>{course.is_active ? 'ACTIVE' : 'OFFLINE'}</Text>
            </View>
            <Text style={[styles.courseDate, { color: colors.textMuted }]}>{formatDate(course.created_at)}</Text>
          </View>
        </View>
        {!course.program_id && canEdit && programsForQuickLink.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assignStrip}>
            {programsForQuickLink.map((program) => (
              <TouchableOpacity
                key={`${course.id}-${program.id}`}
                style={[styles.assignPill, { borderColor: colors.border, backgroundColor: `${colors.error}10` }]}
                onPress={() => handleQuickAssignProgram(course.id, program.id)}
              >
                <Text style={[styles.assignPillText, { color: colors.error }]}>LINK {program.name.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        {canManage ? <View style={styles.actionRow}>
          {canEdit ? <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => openCourseEditor(course.id)}><Text style={[styles.actionText, { color: colors.info }]}>EDIT</Text></TouchableOpacity> : null}
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => navigation.navigate(ROUTES.CourseDetail, { courseId: course.id, programId: course.program_id || undefined, title: course.title })}><Text style={[styles.actionText, { color: colors.primary }]}>OPEN</Text></TouchableOpacity>
          {canEdit ? <TouchableOpacity style={[styles.actionBtn, { borderColor: `${colors.error}33` }]} onPress={() => handleDelete(course)}><Text style={[styles.actionText, { color: colors.error }]}>DELETE</Text></TouchableOpacity> : null}
        </View> : null}
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
      {grouped[key].map((course, index) => renderCourse(course, index))}
    </View>
  );

  const totalActive = courses.filter((course) => course.is_active).length;
  const totalPrograms = new Set(courses.map((course) => course.program_id).filter(Boolean)).size;
  const totalSchools = new Set(courses.map((course) => course.school_id).filter(Boolean)).size;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={requestedProgramName ? `${requestedProgramName}` : 'COURSES'} onBack={() => navigation.goBack()} rightAction={canEdit ? { label: '+ ADD', onPress: () => openCourseEditor() } : undefined} />
      <View style={styles.statsRow}>
        {[{ label: 'TOTAL', value: filteredCourses.length, color: colors.textPrimary }, { label: 'ACTIVE', value: totalActive, color: colors.success }, { label: 'PROGRAMS', value: totalPrograms, color: colors.info }, { label: 'SCHOOLS', value: totalSchools, color: colors.secondary }].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statNum, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {canEdit && courses.filter((course) => !course.program_id).length > 0 ? (
        <View style={[styles.alertCard, { borderColor: `${colors.error}44`, backgroundColor: `${colors.error}10` }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.error }]}>
              {courses.filter((course) => !course.program_id).length} courses need a program
            </Text>
            <Text style={[styles.alertText, { color: colors.textMuted }]}>
              The web flow treats uncategorized courses as a cleanup issue. Fix them here so lessons and student discovery stay organized.
            </Text>
          </View>
          {programs.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bulkRow}>
                {programs.map((program) => (
                  <TouchableOpacity
                    key={`bulk-${program.id}`}
                    style={[styles.bulkPill, { borderColor: colors.border }]}
                    onPress={() => handleBulkAssignProgram(program.id)}
                    disabled={bulkAssigning}
                  >
                    <Text style={[styles.bulkPillText, { color: colors.primary }]}>
                      {bulkAssigning ? 'WORKING...' : `FIX -> ${program.name.toUpperCase()}`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.bulkPill,
                    { borderColor: colors.border },
                    programFilter === '__none__' && { borderColor: colors.error, backgroundColor: `${colors.error}10` },
                  ]}
                  onPress={() => setProgramFilter('__none__')}
                >
                  <Text style={[styles.bulkPillText, { color: programFilter === '__none__' ? colors.error : colors.textSecondary }]}>
                    SHOW UNCATEGORIZED
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: SPACING.sm }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search courses…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {isStaff && !requestedProgramId && programs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: colors.border },
              programFilter === 'all' && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
            ]}
            onPress={() => setProgramFilter('all')}
          >
            <Text style={[styles.filterPillText, { color: programFilter === 'all' ? colors.primary : colors.textSecondary }]}>ALL PROGRAMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: colors.border },
              programFilter === '__none__' && { borderColor: colors.error, backgroundColor: `${colors.error}10` },
            ]}
            onPress={() => setProgramFilter('__none__')}
          >
            <Text style={[styles.filterPillText, { color: programFilter === '__none__' ? colors.error : colors.textSecondary }]}>UNCATEGORIZED</Text>
          </TouchableOpacity>
          {programs.map((program) => (
            <TouchableOpacity
              key={`filter-${program.id}`}
              style={[
                styles.filterPill,
                { borderColor: colors.border },
                programFilter === program.id && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
              ]}
              onPress={() => setProgramFilter(program.id)}
            >
              <Text style={[styles.filterPillText, { color: programFilter === program.id ? colors.primary : colors.textSecondary }]}>
                {program.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : groupKeys.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} style={{ marginBottom: SPACING.md }} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No courses match your filters</Text>
        </View>
      ) : (
        <FlatList
          data={groupKeys}
          keyExtractor={(key) => key}
          renderItem={renderSection}
          contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg, marginTop: SPACING.md, flexWrap: 'wrap' },
  statCard: { width: '23%', minWidth: 72, borderRadius: RADIUS.sm, borderWidth: 1, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display },
  statLabel: { fontSize: 8, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1, marginTop: 2 },
  alertCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md, gap: SPACING.md },
  alertTitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodyBold, textTransform: 'uppercase', letterSpacing: 1 },
  alertText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, lineHeight: 18, marginTop: 4 },
  bulkRow: { flexDirection: 'row', gap: SPACING.sm },
  bulkPill: { borderWidth: 1, borderRadius: RADIUS.xs, paddingHorizontal: 10, paddingVertical: 7 },
  bulkPillText: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 0.8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.md },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body },
  filterRow: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, gap: SPACING.sm },
  filterPill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
  filterPillText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 0.8 },
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
  metaLine: { fontSize: 10, fontFamily: FONT_FAMILY.bodySemi, marginTop: 10 },
  courseRight: { alignItems: 'flex-end', gap: SPACING.sm },
  activeBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.xs, paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  activeText: { fontSize: 8, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
  courseDate: { fontSize: 9, fontFamily: FONT_FAMILY.mono },
  assignStrip: { marginTop: SPACING.md, marginBottom: SPACING.xs },
  assignPill: { borderWidth: 1, borderRadius: RADIUS.xs, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  assignPillText: { fontSize: 9, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 0.8 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.xs, borderWidth: 1 },
  actionText: { fontSize: 10, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
});

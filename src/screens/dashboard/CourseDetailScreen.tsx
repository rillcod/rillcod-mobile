import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { courseService, type CourseWithDetail, type EnrollmentWithContact } from '../../services/course.service';
import type { Database } from '../../types/supabase';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';
import { ROUTES } from '../../navigation/routes';

type CourseRow = Database['public']['Tables']['courses']['Row'];
type ProgramRow = Database['public']['Tables']['programs']['Row'];
type LessonRow = Database['public']['Tables']['lessons']['Row'];
type SessionRow = Database['public']['Tables']['live_sessions']['Row'];
type ProgressRow = Database['public']['Tables']['student_progress']['Row'];

type Params = { courseId?: string; programId?: string; title?: string };

type CourseRecord = CourseWithDetail;
type EnrollmentRecord = EnrollmentWithContact;

const SESSION_PLATFORMS = ['zoom', 'google_meet', 'teams', 'discord', 'other'] as const;

export default function CourseDetailScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { light } = useHaptics();
  const styles = getStyles(colors);
  const params = (route?.params ?? {}) as Params;

  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [siblings, setSiblings] = useState<CourseRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [studentAccessBlocked, setStudentAccessBlocked] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    url: '',
    platform: 'zoom',
    duration: '60',
  });

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';
  const canEdit = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setStudentAccessBlocked(false);

      const courseId =
        params.courseId ??
        (params.programId
          ? await courseService.resolveFirstCourseIdForProgram(params.programId, isStaff)
          : null);

      if (!courseId) {
        setCourse(null);
        setProgram(null);
        setSiblings([]);
        setLessons([]);
        setSessions([]);
        setEnrollments([]);
        setProgress(null);
        return;
      }

      const { course: courseData, progress: progressData } = await courseService.getCourseDetail(
        courseId,
        profile.id,
        isStaff,
      );

      setCourse(courseData);
      setProgress(progressData);
      setLessons(courseData.lessons ?? []);
      setSessions(courseData.live_sessions ?? []);

      const programId = courseData.program_id;
      if (programId) {
        const { program, siblings, enrollments } = await courseService.getProgramEnrollmentContext(
          programId,
          profile.id,
          isStaff,
        );
        setProgram(program);
        setSiblings(siblings);
        setEnrollments(enrollments);
      } else {
        setProgram(null);
        setSiblings([]);
        setEnrollments([]);
      }
    } catch (error: any) {
      if (error.message === 'This course is locked.') {
        setStudentAccessBlocked(true);
        setCourse(null);
        setProgram(null);
        setSiblings([]);
        setLessons([]);
        setSessions([]);
        setEnrollments([]);
        setProgress(null);
      } else {
        Alert.alert('Course detail', error?.message ?? 'Failed to load course');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, profile, params.courseId, params.programId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const publishedLessons = useMemo(
    () => lessons.filter((lesson) => lesson.status === 'published' || lesson.status === 'active').length,
    [lessons]
  );
  /** Students only see published/active lessons; staff see the full list for authoring. */
  const lessonsForLearner = useMemo(() => {
    if (isStaff) return lessons;
    return lessons.filter((l) => l.status === 'published' || l.status === 'active');
  }, [lessons, isStaff]);
  const progressPct = progress?.total_lessons
    ? Math.round(((progress.lessons_completed ?? 0) / Math.max(progress.total_lessons, 1)) * 100)
    : 0;

  const formatDateTime = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'TBD';

  const openUrl = async (url?: string | null) => {
    if (!url) return;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unavailable', 'This link cannot be opened on this device.');
      return;
    }
    await Linking.openURL(url);
  };

  const scheduleSession = async () => {
    if (!course?.program_id || !profile?.id) {
      Alert.alert('Unavailable', 'This course is not ready for live scheduling.');
      return;
    }
    if (!form.title.trim() || !form.date.trim()) {
      Alert.alert('Validation', 'Title and date are required.');
      return;
    }

    let scheduled_at: string;
    try {
      const [datePart, timePart] = form.date.trim().split(' ');
      const [d, m, y] = datePart.split('/');
      const [h, min] = (timePart ?? '00:00').split(':');
      scheduled_at = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)).toISOString();
    } catch {
      Alert.alert('Validation', 'Use DD/MM/YYYY HH:MM');
      return;
    }

    setSavingSession(true);
    try {
      const payload: Database['public']['Tables']['live_sessions']['Insert'] = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduled_at,
        session_url: form.url.trim() || null,
        platform: form.platform,
        duration_minutes: Number(form.duration || 60),
        status: 'scheduled',
        host_id: profile.id,
        school_id: profile.school_id || null,
        program_id: course.program_id,
      };
      await courseService.scheduleLiveSession(payload);
      setForm({ title: '', description: '', date: '', url: '', platform: 'zoom', duration: '60' });
      setScheduleOpen(false);
      load();
    } catch (error: any) {
      Alert.alert('Session', error?.message ?? 'Failed to schedule session');
    } finally {
      setSavingSession(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={params.title || 'COURSE'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          {studentAccessBlocked ? (
            <>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Course not available</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                This course is locked by your school or instructor. Check back later or ask your teacher.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No course found</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                There is no unlocked course in this programme yet, or it may still be set up.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={course.title}
        subtitle={program?.name || params.title || 'Course workspace'}
        onBack={() => navigation.goBack()}
        rightAction={canEdit ? { label: '+ Session', onPress: () => setScheduleOpen(true) } : undefined}
      />
      {canEdit ? (
        <View style={[styles.courseEditBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(ROUTES.CourseEditor, {
                courseId: course.id,
                programId: course.program_id ?? undefined,
              })
            }
            style={[styles.courseEditBarBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
          >
            <Text style={[styles.courseEditBarBtnText, { color: colors.info }]}>Edit course</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <LinearGradient colors={[colors.primary + '18', colors.bgCard]} style={[styles.hero, { borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>COURSE OVERVIEW</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{course.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {course.description || course.content || 'This course is ready for lessons, live sessions, and tracked delivery.'}
          </Text>
          <View style={styles.metaRow}>
            <Chip label={course.is_active ? 'ACTIVE' : 'INACTIVE'} colors={colors} />
            {isStaff && course.is_locked ? <Chip label="LOCKED FOR STUDENTS" colors={colors} /> : null}
            {program?.difficulty_level ? <Chip label={String(program.difficulty_level).toUpperCase()} colors={colors} /> : null}
            {course.duration_hours ? <Chip label={`${course.duration_hours}H TOTAL`} colors={colors} /> : null}
            {program?.duration_weeks ? <Chip label={`${program.duration_weeks} WEEKS`} colors={colors} /> : null}
          </View>
          <View style={styles.statsRow}>
            {(isStaff
              ? [
                  { label: 'LESSONS', value: lessons.length },
                  { label: 'LIVE', value: sessions.filter((item) => item.status === 'scheduled' || item.status === 'live').length },
                  { label: 'ENROLLED', value: enrollments.length },
                ]
              : [
                  { label: 'PROGRESS', value: `${progressPct}%` },
                  { label: 'DONE', value: progress?.lessons_completed ?? 0 },
                  { label: 'LESSONS', value: lessonsForLearner.length },
                ]
            ).map((item) => (
              <View key={item.label} style={[styles.statCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {siblings.length > 1 ? (
          <Section title="Course Stack">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {siblings.map((item) => {
                const active = item.id === course.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (active) return;
                      light();
                      navigation.replace(ROUTES.CourseDetail, { courseId: item.id, programId: item.program_id || undefined, title: item.title });
                    }}
                    style={[
                      styles.switchChip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + '12' : colors.bgCard,
                      },
                    ]}
                  >
                    <Text style={[styles.switchChipText, { color: active ? colors.primary : colors.textSecondary }]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Section>
        ) : null}

        <Section
          title="Lessons"
          meta={
            isStaff ? `${publishedLessons}/${lessons.length} published` : `${lessonsForLearner.length} available`
          }
          headerRight={
            canEdit ? (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(ROUTES.LessonEditor, {
                    courseId: course.id,
                    programId: course.program_id ?? undefined,
                  })
                }
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary + '18' }}
              >
                <Text style={{ color: colors.primary, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs }}>+ Lesson</Text>
              </TouchableOpacity>
            ) : null
          }
        >
          {lessonsForLearner.length === 0 ? (
            <EmptyCard
              text={
                isStaff ? 'No lessons have been added yet.' : 'No published lessons yet. Check back soon.'
              }
              colors={colors}
            />
          ) : (
            lessonsForLearner.map((lesson, index) => (
              <TouchableOpacity
                key={lesson.id}
                activeOpacity={0.84}
                onPress={() => navigation.navigate(ROUTES.LessonDetail, { lessonId: lesson.id })}
                style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
              >
                <View style={[styles.indexBadge, { backgroundColor: colors.primary + '14' }]}>
                  <Text style={[styles.indexText, { color: colors.primary }]}>{index + 1}</Text>
                </View>
                <View style={styles.flexOne}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>{lesson.title}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                    {(lesson.lesson_type || 'lesson').toUpperCase()}
                    {lesson.duration_minutes ? `  ·  ${lesson.duration_minutes} MIN` : ''}
                    {lesson.status ? `  ·  ${String(lesson.status).toUpperCase()}` : ''}
                  </Text>
                </View>
                <Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>
              </TouchableOpacity>
            ))
          )}
        </Section>

        <Section title="Discussion">
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => {
              light();
              navigation.navigate(ROUTES.CourseDiscussion, {
                courseId: course.id,
                courseTitle: course.title,
              });
            }}
            style={[styles.listCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
          >
            <View style={[styles.indexBadge, { backgroundColor: colors.info + '14' }]}>
              <Text style={[styles.indexText, { color: colors.info }]}>QA</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>Course forum</Text>
              <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                Q&A and threads for this course
              </Text>
            </View>
            <Text style={[styles.openText, { color: colors.primary }]}>OPEN</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Live Sessions" meta={`${sessions.length} total`}>
          {sessions.length === 0 ? (
            <EmptyCard text="No live sessions scheduled yet." colors={colors} />
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <View style={styles.blockHead}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>{session.title}</Text>
                  <Chip label={String(session.status).toUpperCase()} colors={colors} />
                </View>
                {session.description ? <Text style={[styles.blockBody, { color: colors.textSecondary }]}>{session.description}</Text> : null}
                <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                  {formatDateTime(session.scheduled_at)}  ·  {String(session.platform).replace('_', ' ').toUpperCase()}  ·  {session.duration_minutes} MIN
                </Text>
                <View style={styles.actionsRow}>
                  {(session.status === 'scheduled' || session.status === 'live') && session.session_url ? (
                    <ActionButton label={session.status === 'live' ? 'Join Live' : 'Open Session'} primary onPress={() => openUrl(session.session_url)} colors={colors} />
                  ) : null}
                  {session.status === 'completed' && session.recording_url ? (
                    <ActionButton label="Recording" onPress={() => openUrl(session.recording_url)} colors={colors} />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Section>

        {isStaff ? (
          <Section title="Enrolled Learners" meta={`${enrollments.length} active records`}>
            {enrollments.length === 0 ? (
              <EmptyCard text="No enrolments tied to this programme yet." colors={colors} />
            ) : (
              enrollments.slice(0, 8).map((enrollment) => (
                <View key={enrollment.id} style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{enrollment.user_name || 'Learner'}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                    {enrollment.user_email || 'No email'}  ·  {String(enrollment.status || 'active').toUpperCase()}
                  </Text>
                  <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Enrolled {formatDateTime(enrollment.enrollment_date)}</Text>
                </View>
              ))
            )}
          </Section>
        ) : null}

        <Section title="Course Context">
          <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            {program?.name ? <Text style={[styles.contextLine, { color: colors.textSecondary }]}>Programme: {program.name}</Text> : null}
            {course.teacher_name ? <Text style={[styles.contextLine, { color: colors.textSecondary }]}>Instructor: {course.teacher_name}</Text> : null}
            {course.school_name ? <Text style={[styles.contextLine, { color: colors.textSecondary }]}>School: {course.school_name}</Text> : null}
            {!isStaff ? <Text style={[styles.contextLine, { color: colors.textSecondary }]}>Your progress: {progressPct}% complete</Text> : null}
          </View>
        </Section>
      </ScrollView>

      <Modal visible={scheduleOpen} animationType="slide" transparent onRequestClose={() => setScheduleOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Schedule Session</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="TITLE" value={form.title} onChangeText={(value) => setForm((s) => ({ ...s, title: value }))} colors={colors} />
              <Field label="DESCRIPTION" value={form.description} onChangeText={(value) => setForm((s) => ({ ...s, description: value }))} multiline colors={colors} />
              <Field label="DATE AND TIME" value={form.date} onChangeText={(value) => setForm((s) => ({ ...s, date: value }))} placeholder="DD/MM/YYYY HH:MM" colors={colors} />
              <Field label="JOIN URL" value={form.url} onChangeText={(value) => setForm((s) => ({ ...s, url: value }))} placeholder="https://..." colors={colors} />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PLATFORM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                {SESSION_PLATFORMS.map((option) => {
                  const active = form.platform === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setForm((s) => ({ ...s, platform: option }))}
                      style={[
                        styles.switchChip,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary + '12' : colors.bg,
                        },
                      ]}
                    >
                      <Text style={[styles.switchChipText, { color: active ? colors.primary : colors.textSecondary }]}>{option.replace('_', ' ')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Field label="DURATION (MINUTES)" value={form.duration} onChangeText={(value) => setForm((s) => ({ ...s, duration: value }))} keyboardType="number-pad" colors={colors} />
              <View style={styles.actionsRow}>
                <ActionButton
                  label="Cancel"
                  onPress={() => {
                    setScheduleOpen(false);
                    setForm({ title: '', description: '', date: '', url: '', platform: 'zoom', duration: '60' });
                  }}
                  colors={colors}
                />
                <ActionButton label={savingSession ? 'Saving...' : 'Schedule'} primary onPress={scheduleSession} colors={colors} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  meta,
  children,
  headerRight,
}: {
  title: string;
  meta?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <View style={styles.section}>
      <View
        style={[
          styles.sectionHeader,
          headerRight ? { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 } : null,
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
          {meta ? <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{meta}</Text> : null}
        </View>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, colors }: { label: string; colors: any }) {
  const styles = getStyles(colors);
  return (
    <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.bg }]}>
      <Text style={[styles.chipText, { color: colors.textPrimary }]}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, primary, colors }: { label: string; onPress: () => void; primary?: boolean; colors: any }) {
  const styles = getStyles(colors);
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        primary ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionButtonText, { color: primary ? '#fff' : colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ text, colors }: { text: string; colors: any }) {
  const styles = getStyles(colors);
  return (
    <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

function Field(
  {
    label,
    colors,
    multiline,
    ...props
  }: {
    label: string;
    colors: any;
    multiline?: boolean;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'number-pad';
  }
) {
  const styles = getStyles(colors);
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.fieldInput,
          multiline ? styles.fieldArea : null,
          { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg },
        ]}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    courseEditBar: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    courseEditBarBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.sm, borderWidth: 1 },
    courseEditBarBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, letterSpacing: 0.6 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    scroll: { padding: SPACING.xl, gap: SPACING.xl, paddingBottom: SPACING['3xl'] },
    hero: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
    eyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1.2 },
    title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
    description: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6 },
    chipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: 0.6 },
    statsRow: { flexDirection: 'row', gap: SPACING.sm },
    statCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
    statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
    statLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1, marginTop: 4 },
    section: { gap: SPACING.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    sectionMeta: { fontFamily: FONT_FAMILY.mono, fontSize: 10 },
    horizontalList: { gap: SPACING.sm },
    switchChip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8 },
    switchChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11, textTransform: 'uppercase' },
    listCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    indexBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    indexText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
    flexOne: { flex: 1 },
    itemTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, marginBottom: 2 },
    itemMeta: { fontFamily: FONT_FAMILY.mono, fontSize: 10, lineHeight: 16 },
    openText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
    blockCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
    blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    blockBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 18 },
    contextLine: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, marginBottom: SPACING.xs },
    emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 19, textAlign: 'center' },
    actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
    actionButton: { flex: 1, minHeight: 40, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
    actionButtonText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalCard: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderTopWidth: 1, padding: SPACING.xl, maxHeight: '90%' },
    modalHandle: { width: 42, height: 4, borderRadius: 3, alignSelf: 'center', marginBottom: SPACING.lg },
    modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, marginBottom: SPACING.md },
    fieldLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 1, marginBottom: 6, marginTop: SPACING.sm },
    fieldInput: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base },
    fieldArea: { minHeight: 86, textAlignVertical: 'top' },
  });

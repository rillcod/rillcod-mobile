import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { programService } from '../../services/program.service';
import { courseService } from '../../services/course.service';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import type { ColorPalette } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import { useNavigation } from '@react-navigation/native';
import { ROUTES } from '../../navigation/routes';
import { searchService } from '../../services/search.service';
import { assignmentService } from '../../services/assignment.service';
import { dashboardService } from '../../services/dashboard.service';

interface Program {
  id: string;
  name: string;
  description: string | null;
  difficulty_level: string | null;
  duration_weeks: number | null;
  is_active: boolean | null;
}

interface Enrollment {
  id: string;
  program_id: string;
  progress_pct: number | null;
  status: string;
}

type CourseRow = { program_id: string | null; is_locked: boolean | null };

function accentForProgram(id: string, palette: ColorPalette): string {
  const pool = [palette.primary, palette.info, palette.success, palette.accent];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

function buildProgramCourseStats(rows: CourseRow[]) {
  const unlockedByProgram = new Map<string, number>();
  const totalByProgram = new Map<string, number>();
  for (const row of rows) {
    const pid = row.program_id;
    if (!pid) continue;
    totalByProgram.set(pid, (totalByProgram.get(pid) ?? 0) + 1);
    if (!row.is_locked) {
      unlockedByProgram.set(pid, (unlockedByProgram.get(pid) ?? 0) + 1);
    }
  }
  return { unlockedByProgram, totalByProgram };
}

export default function LearnScreen() {
  const navigation: any = useNavigation();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { light } = useHaptics();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [catalogHits, setCatalogHits] = useState<{
    courses: { id: string; title?: string; name?: string }[];
    programs: { id: string; name?: string }[];
    teachers: { id: string; full_name?: string }[];
  } | null>(null);
  const catalogSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Programmes that have at least one unlocked active course (catalogue). */
  const [publicProgramIds, setPublicProgramIds] = useState<Set<string>>(new Set());
  const [unlockedByProgram, setUnlockedByProgram] = useState<Map<string, number>>(new Map());
  const [studentTodoCount, setStudentTodoCount] = useState<number | null>(null);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [nextLessonTitle, setNextLessonTitle] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [programRows, enrollRows, courseRows] = await Promise.all([
        programService.listActiveCatalog(),
        profile ? courseService.listUserEnrollmentsSummary(profile.id) : Promise.resolve([]),
        courseService.listActiveCourseProgramStats(),
      ]);

      setPrograms(programRows as Program[]);
      setEnrollments(enrollRows as Enrollment[]);

      const rows = courseRows as CourseRow[];
      const visible = new Set(
        rows.filter((r) => r.program_id && !r.is_locked).map((r) => r.program_id as string),
      );
      setPublicProgramIds(visible);
      const { unlockedByProgram: u } = buildProgramCourseStats(rows);
      setUnlockedByProgram(u);

      if (profile?.role === 'student' && profile.id) {
        const [todo, snap] = await Promise.all([
          assignmentService.countStudentAssignmentsTodo(profile.id),
          dashboardService.getStudentDashboardSnapshot(profile.id),
        ]);
        setStudentTodoCount(todo);
        const enrRow = (snap.enrollmentRes.data ?? [])[0] as { program_id?: string } | undefined;
        const pid = enrRow?.program_id;
        const completedLessonIds = (snap.progressRes.data ?? [])
          .map((r) => r.lesson_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (pid) {
          const next = await dashboardService.resolveNextLessonInProgram(pid, completedLessonIds);
          setNextLessonId(next.nextLessonId);
          setNextLessonTitle(next.nextLessonTitle);
        } else {
          setNextLessonId(null);
          setNextLessonTitle(null);
        }
      } else {
        setStudentTodoCount(null);
        setNextLessonId(null);
        setNextLessonTitle(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const q = search.trim();
    if (catalogSearchRef.current) clearTimeout(catalogSearchRef.current);
    if (q.length < 2) {
      setCatalogHits(null);
      return;
    }
    catalogSearchRef.current = setTimeout(async () => {
      try {
        const hits = await searchService.searchAll(q, profile?.school_id ?? undefined);
        setCatalogHits({
          courses: (hits.courses ?? []) as { id: string; title?: string }[],
          programs: (hits.programs ?? []) as { id: string; name?: string }[],
          teachers: (hits.teachers ?? []) as { id: string; full_name?: string }[],
        });
      } catch {
        setCatalogHits(null);
      }
    }, 320);
    return () => {
      if (catalogSearchRef.current) clearTimeout(catalogSearchRef.current);
    };
  }, [search, profile?.school_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getEnrollment = (programId: string) => enrollments.find((e) => e.program_id === programId);

  const filtered = programs.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    );
  });

  const enrolled = filtered.filter((p) => !!getEnrollment(p.id));
  const available = filtered.filter((p) => !getEnrollment(p.id) && publicProgramIds.has(p.id));

  const headerGradient = (
    isDark ? [colors.bg, `${colors.primary}12`] : [`${colors.primary}10`, colors.bg]
  ) as readonly [string, string];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />

      <LinearGradient colors={headerGradient} style={styles.header}>
        <Text style={styles.kicker}>{t('learn.kicker')}</Text>
        <Text style={styles.headerTitle}>{t('learn.title')}</Text>
        <Text style={styles.headerSub}>
          {t('learn.programmesCount', { count: programs.length })}
        </Text>

        <View
          style={[
            styles.searchWrap,
            {
              borderColor: searchFocused ? colors.primary : colors.border,
              backgroundColor: colors.bgCard,
            },
          ]}
        >
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('learn.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            selectionColor={colors.primary}
            returnKeyType="search"
            accessibilityLabel={t('learn.searchPlaceholder')}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: colors.bgCard }]} />
            ))}
          </View>
        ) : (
          <>
            {profile?.role === 'student' && studentTodoCount !== null ? (
              <View style={[styles.studentHub, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Learning hub</Text>
                <Text style={[styles.headerSub, { marginBottom: SPACING.md }]}>
                  Jump to lessons, assignments, and your week — same lanes as the web student Learning Center.
                </Text>
                <View style={styles.hubRow}>
                  <TouchableOpacity
                    style={[styles.hubTile, { borderColor: colors.warning + '44', backgroundColor: colors.warning + '10' }]}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.Assignments);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="clipboard-outline" size={22} color={colors.warning} />
                    <Text style={[styles.hubTileTitle, { color: colors.textPrimary }]}>Assignments</Text>
                    <Text style={[styles.hubTileSub, { color: colors.textMuted }]}>
                      {studentTodoCount > 0 ? `${studentTodoCount} to hand in` : 'All caught up'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.hubTile, { borderColor: colors.info + '44', backgroundColor: colors.info + '10' }]}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.Timetable);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={22} color={colors.info} />
                    <Text style={[styles.hubTileTitle, { color: colors.textPrimary }]}>My week</Text>
                    <Text style={[styles.hubTileSub, { color: colors.textMuted }]}>Timetable</Text>
                  </TouchableOpacity>
                </View>
                {nextLessonId ? (
                  <TouchableOpacity
                    style={[styles.nextLessonBtn, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '12' }]}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.LessonDetail, { lessonId: nextLessonId });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={[styles.hubTileTitle, { color: colors.textPrimary }]}>Next lesson</Text>
                      <Text style={[styles.hubTileSub, { color: colors.textMuted }]} numberOfLines={2}>
                        {nextLessonTitle ?? 'Continue'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {catalogHits && search.trim().length >= 2 ? (
              <View style={[styles.sectionBlock, { marginBottom: SPACING.md }]}>
                <Text style={styles.sectionLabel}>Catalog search</Text>
                <Text style={[styles.headerSub, { marginBottom: 8 }]}>
                  {catalogHits.courses.length} courses · {catalogHits.programs.length} programmes ·{' '}
                  {catalogHits.teachers.length} teachers
                </Text>
                {catalogHits.courses.slice(0, 5).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.hitRow, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.Courses, {});
                    }}
                  >
                    <Text style={[styles.hitTitle, { color: colors.textPrimary }]}>{c.title ?? 'Course'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Open courses</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {enrolled.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{t('learn.myProgrammes')}</Text>
                {enrolled.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    enrollment={getEnrollment(program.id)}
                    accent={accentForProgram(program.id, colors)}
                    unlockedCourses={unlockedByProgram.get(program.id) ?? 0}
                    colors={colors}
                    styles={styles}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.CourseDetail, {
                        programId: program.id,
                        title: program.name,
                      });
                    }}
                  />
                ))}
              </View>
            ) : null}

            {available.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>
                  {enrolled.length > 0 ? t('learn.exploreProgrammes') : t('learn.allProgrammes')}
                </Text>
                {available.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    enrollment={undefined}
                    accent={accentForProgram(program.id, colors)}
                    unlockedCourses={unlockedByProgram.get(program.id) ?? 0}
                    colors={colors}
                    styles={styles}
                    onPress={() => {
                      light();
                      navigation.navigate(ROUTES.CourseDetail, {
                        programId: program.id,
                        title: program.name,
                      });
                    }}
                  />
                ))}
              </View>
            ) : null}

            {!loading && filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Ionicons name="school-outline" size={40} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>{t('learn.noProgrammes')}</Text>
                <Text style={styles.emptySub}>{t('learn.noProgrammesSub')}</Text>
              </View>
            ) : null}

            {!loading &&
            filtered.length > 0 &&
            enrolled.length === 0 &&
            available.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.info}14` }]}>
                  <Ionicons name="lock-closed-outline" size={36} color={colors.info} />
                </View>
                <Text style={styles.emptyTitle}>{t('learn.noneAvailableTitle')}</Text>
                <Text style={styles.emptySub}>{t('learn.noneAvailableSub')}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProgramCardProps {
  program: Program;
  enrollment: Enrollment | undefined;
  accent: string;
  unlockedCourses: number;
  colors: ColorPalette;
  styles: ReturnType<typeof getStyles>;
  onPress: () => void;
}

function ProgramCard({
  program,
  enrollment,
  accent,
  unlockedCourses,
  colors,
  styles,
  onPress,
}: ProgramCardProps) {
  const progress = enrollment?.progress_pct ?? 0;
  const levelLabel = program.difficulty_level
    ? program.difficulty_level.charAt(0).toUpperCase() + program.difficulty_level.slice(1)
    : null;

  const ctaLabel = enrollment
    ? progress > 0
      ? t('learn.continue')
      : t('learn.start')
    : t('learn.openProgramme');

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.bgCard,
        },
        Platform.OS === 'web' ? SHADOW.sm : SHADOW.md,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${program.name}. ${ctaLabel}`}
    >
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <View style={[styles.iconTile, { backgroundColor: `${accent}18` }]}>
            <Ionicons name="library-outline" size={26} color={accent} />
          </View>
          <View style={styles.cardTopRight}>
            {enrollment ? (
              <View style={[styles.badge, { borderColor: `${colors.success}55`, backgroundColor: `${colors.success}12` }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>{t('learn.enrolled')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          {levelLabel ? (
            <View style={[styles.chip, { borderColor: `${accent}40` }]}>
              <Text style={[styles.chipText, { color: accent }]}>{levelLabel}</Text>
            </View>
          ) : null}
          {program.duration_weeks ? (
            <Text style={styles.durationText}>
              {t('learn.weeksDuration', { count: program.duration_weeks })}
            </Text>
          ) : null}
          {unlockedCourses > 0 ? (
            <Text style={styles.durationText}>
              {t('learn.openCourses', { count: unlockedCourses })}
            </Text>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {program.name}
        </Text>
        {program.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {program.description}
          </Text>
        ) : null}

        {enrollment ? (
          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: colors.bg }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, progress)}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: accent }]}>{Math.round(progress)}%</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.ctaRow,
            {
              borderTopColor: colors.border,
              backgroundColor: enrollment ? `${colors.primary}10` : colors.bg,
            },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.primary }]}>{ctaLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.lg,
    },
    kicker: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 10,
      letterSpacing: LETTER_SPACING.wider,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    headerTitle: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE['2xl'],
      color: colors.textPrimary,
      marginBottom: 4,
    },
    headerSub: {
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.md,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: RADIUS.xl,
      paddingHorizontal: SPACING.md,
      gap: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'web' ? 10 : 12,
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.base,
      color: colors.textPrimary,
    },
    scroll: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING['3xl'],
    },
    sectionBlock: { marginBottom: SPACING.sm },
    studentHub: {
      borderWidth: 1,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    hubRow: { flexDirection: 'row', gap: SPACING.md },
    hubTile: {
      flex: 1,
      minWidth: 140,
      borderWidth: 1,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: 6,
    },
    hubTileTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
    hubTileSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    nextLessonBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
    },
    sectionLabel: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: FONT_SIZE.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LETTER_SPACING.wider,
      marginBottom: SPACING.md,
    },
    hitRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      marginBottom: SPACING.xs,
    },
    hitTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, flex: 1 },
    card: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      marginBottom: SPACING.base,
      overflow: 'hidden',
      position: 'relative',
    },
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    cardInner: {
      padding: SPACING.lg,
      paddingLeft: SPACING.lg + 2,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.sm,
    },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTopRight: { alignItems: 'flex-end' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: FONT_SIZE.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: SPACING.sm,
    },
    chip: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: 10,
    },
    durationText: {
      fontFamily: FONT_FAMILY.body,
      fontSize: 11,
      color: colors.textMuted,
    },
    cardTitle: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE.lg,
      color: colors.textPrimary,
      lineHeight: FONT_SIZE.lg * 1.25,
      marginBottom: SPACING.xs,
    },
    cardDesc: {
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      lineHeight: FONT_SIZE.sm * 1.55,
      marginBottom: SPACING.md,
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    progressTrack: {
      flex: 1,
      height: 5,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    progressLabel: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: FONT_SIZE.xs,
      minWidth: 36,
      textAlign: 'right',
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: -SPACING.lg,
      marginBottom: -SPACING.lg,
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.bg,
    },
    ctaText: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: FONT_SIZE.sm,
      letterSpacing: 0.3,
    },
    loadingWrap: { gap: SPACING.base, marginTop: SPACING.sm },
    skeleton: {
      height: 168,
      borderRadius: RADIUS.xl,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 48,
      paddingBottom: 24,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    emptyTitle: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE.xl,
      color: colors.textPrimary,
      marginBottom: SPACING.sm,
    },
    emptySub: {
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.base,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: FONT_SIZE.base * 1.55,
    },
  });

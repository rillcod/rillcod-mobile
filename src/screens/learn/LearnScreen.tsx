import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';

const { width } = Dimensions.get('window');

interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  level: string | null;
  duration_weeks: number | null;
  thumbnail_url: string | null;
  is_published: boolean;
}

interface Enrollment {
  id: string;
  program_id: string;
  progress_pct: number | null;
  status: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'AI':          '🤖',
  'Robotics':    '🦾',
  'Coding':      '💻',
  'Web Dev':     '🌐',
  'Data Science':'📊',
  'IoT':         '📡',
  'Cybersecurity':'🔒',
  'Design':      '🎨',
};

const LEVEL_COLORS: Record<string, string> = {
  beginner:     COLORS.success,
  intermediate: COLORS.gold,
  advanced:     COLORS.accent,
};

const FILTERS = ['All', 'AI', 'Robotics', 'Coding', 'Web Dev', 'Data Science'];

export default function LearnScreen() {
  const { profile } = useAuth();
  const { light } = useHaptics();

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchFocused, setSearchFocused] = useState(false);

  const loadData = useCallback(async () => {
    const [courseRes, enrollRes] = await Promise.all([
      supabase
        .from('programs')
        .select('id, title, description, category, level, duration_weeks, thumbnail_url, is_published')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      profile
        ? supabase
            .from('enrollments')
            .select('id, program_id, progress_pct, status')
            .eq('user_id', profile.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (courseRes.data) setCourses(courseRes.data as Course[]);
    if (enrollRes.data) setEnrollments(enrollRes.data as Enrollment[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const getEnrollment = (courseId: string) =>
    enrollments.find(e => e.program_id === courseId);

  const filtered = courses.filter(c => {
    const matchFilter = activeFilter === 'All' || c.category === activeFilter;
    const matchSearch = !search.trim() ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const enrolled  = filtered.filter(c => !!getEnrollment(c.id));
  const available = filtered.filter(c => !getEnrollment(c.id));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OfflineBanner />

      {/* Header */}
      <LinearGradient colors={['#0d0510', COLORS.bg]} style={styles.header}>
        <MotiText
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 60 }}
          style={styles.headerTitle}
        >
          {t('learn.title')}
        </MotiText>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', delay: 180 }}
          style={styles.headerSub}
        >
          {courses.length} {t('learn.coursesAvailable')}
        </MotiText>

        {/* Search bar */}
        <MotiView
          animate={{
            borderColor: searchFocused ? COLORS.primaryMid : COLORS.border,
            backgroundColor: searchFocused ? 'rgba(122,6,6,0.05)' : COLORS.bgCard,
          }}
          transition={{ type: 'timing', duration: 180 }}
          style={styles.searchWrap}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('learn.searchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            selectionColor={COLORS.primaryLight}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ fontSize: 16, color: COLORS.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </MotiView>
      </LinearGradient>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroll}
      >
        {FILTERS.map(f => {
          const active = f === activeFilter;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => { setActiveFilter(f); light(); }}
              activeOpacity={0.75}
            >
              <MotiView
                animate={{
                  backgroundColor: active ? COLORS.primary : COLORS.bgCard,
                  borderColor: active ? COLORS.primaryMid : COLORS.border,
                  scale: active ? 1.04 : 1,
                }}
                transition={{ type: 'timing', duration: 160 }}
                style={styles.filterChip}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {CATEGORY_ICONS[f] ? `${CATEGORY_ICONS[f]} ` : ''}{f}
                </Text>
              </MotiView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            {[0, 1, 2].map(i => (
              <MotiView
                key={i}
                from={{ opacity: 0.3 }}
                animate={{ opacity: 0.7 }}
                transition={{ type: 'timing', duration: 800, loop: true, delay: i * 200 }}
                style={styles.skeleton}
              />
            ))}
          </View>
        ) : (
          <>
            {/* Enrolled courses */}
            {enrolled.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', delay: 100 }}
              >
                <Text style={styles.sectionLabel}>{t('learn.myCourses')}</Text>
                {enrolled.map((course, i) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrollment={getEnrollment(course.id)}
                    index={i}
                    onPress={() => light()}
                  />
                ))}
              </MotiView>
            )}

            {/* Available courses */}
            {available.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', delay: 200 }}
              >
                <Text style={styles.sectionLabel}>
                  {enrolled.length > 0 ? t('learn.explore') : t('learn.allCourses')}
                </Text>
                {available.map((course, i) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    enrollment={undefined}
                    index={i}
                    onPress={() => light()}
                  />
                ))}
              </MotiView>
            )}

            {filtered.length === 0 && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.emptyWrap}
              >
                <Text style={styles.emptyEmoji}>🔭</Text>
                <Text style={styles.emptyTitle}>{t('learn.noCourses')}</Text>
                <Text style={styles.emptySub}>{t('learn.noCourseSub')}</Text>
              </MotiView>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────────
interface CourseCardProps {
  course: Course;
  enrollment: Enrollment | undefined;
  index: number;
  onPress: () => void;
}

function CourseCard({ course, enrollment, index, onPress }: CourseCardProps) {
  const progress = enrollment?.progress_pct ?? 0;
  const catIcon  = CATEGORY_ICONS[course.category ?? ''] ?? '📘';
  const lvlColor = LEVEL_COLORS[course.level?.toLowerCase() ?? ''] ?? COLORS.textMuted;

  // Pick a gradient based on category
  const GRAD_MAP: Record<string, [string, string]> = {
    'AI':           ['#1e1050', '#3730a3'],
    'Robotics':     ['#0c2a1a', '#065f46'],
    'Coding':       ['#1a0505', '#7a0606'],
    'Web Dev':      ['#0c1a2e', '#1e40af'],
    'Data Science': ['#1c1400', '#92400e'],
    'IoT':          ['#0d1f25', '#164e63'],
  };
  const grad = GRAD_MAP[course.category ?? ''] ?? ['#0f0a1a', '#1e1050'] as [string, string];

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', delay: index * 60, damping: 22 }}
      style={styles.card}
    >
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={{ overflow: 'hidden', borderRadius: RADIUS['2xl'] }}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Top banner */}
        <LinearGradient colors={grad} style={styles.cardBanner}>
          <Text style={styles.cardBannerEmoji}>{catIcon}</Text>
          {enrollment && (
            <View style={styles.enrolledBadge}>
              <Text style={styles.enrolledBadgeText}>✓ Enrolled</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.cardBody}>
          {/* Category + level row */}
          <View style={styles.cardMeta}>
            {course.category && (
              <View style={styles.catChip}>
                <Text style={styles.catChipText}>{course.category}</Text>
              </View>
            )}
            {course.level && (
              <View style={[styles.lvlChip, { borderColor: lvlColor + '60' }]}>
                <Text style={[styles.lvlChipText, { color: lvlColor }]}>
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </Text>
              </View>
            )}
            {course.duration_weeks && (
              <Text style={styles.durationText}>⏱ {course.duration_weeks}w</Text>
            )}
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>

          {course.description && (
            <Text style={styles.cardDesc} numberOfLines={2}>{course.description}</Text>
          )}

          {/* Progress bar (enrolled only) */}
          {enrollment && (
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${Math.min(100, progress)}%` as any }}
                  transition={{ type: 'spring', delay: 300 + index * 60 }}
                  style={[styles.progressFill, { backgroundColor: lvlColor }]}
                />
              </View>
              <Text style={[styles.progressLabel, { color: lvlColor }]}>{Math.round(progress)}%</Text>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.ctaBtn}>
            <LinearGradient
              colors={enrollment ? [COLORS.primary, COLORS.primaryMid] : ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.04)']}
              style={styles.ctaGrad}
            >
              <Text style={[styles.ctaText, enrollment ? { color: '#fff' } : { color: COLORS.textSecondary }]}>
                {enrollment ? (progress > 0 ? '▶ Continue' : '▶ Start') : t('learn.enroll')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.base,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
  },
  filtersScroll: { maxHeight: 52 },
  filtersRow: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  filterText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  filterTextActive: { color: '#fff' },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: SPACING.md,
    marginTop: SPACING.base,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.base,
    ...SHADOW.md,
  },
  cardBanner: {
    height: 90,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
  },
  cardBannerEmoji: { fontSize: 44, opacity: 0.9 },
  enrolledBadge: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enrolledBadgeText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: '#34d399',
  },
  cardBody: { padding: SPACING.lg },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: SPACING.sm, flexWrap: 'wrap' },
  catChip: {
    backgroundColor: COLORS.primaryPale,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  catChipText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: 10,
    color: COLORS.primaryLight,
  },
  lvlChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  lvlChipText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: 10,
  },
  durationText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
    lineHeight: FONT_SIZE.lg * 1.25,
    marginBottom: SPACING.xs,
  },
  cardDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.sm * 1.6,
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
    height: 4,
    backgroundColor: COLORS.bgCard,
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
    minWidth: 32,
    textAlign: 'right',
  },
  ctaBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  ctaGrad: {
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.wide,
  },
  loadingWrap: { gap: SPACING.base, marginTop: SPACING.base },
  skeleton: {
    height: 200,
    borderRadius: RADIUS['2xl'],
    backgroundColor: COLORS.bgCard,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.lg },
  emptyTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: width * 0.7,
    lineHeight: FONT_SIZE.base * 1.6,
  },
});

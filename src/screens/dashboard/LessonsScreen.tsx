import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface LessonListItem {
  id: string;
  title: string;
  lesson_type: string | null;
  course_id: string | null;
  duration_minutes: number | null;
  order_index: number | null;
  status: string | null;
  created_at: string | null;
  created_by: string | null;
  courses?: {
    title: string | null;
    programs?: {
      name: string | null;
    } | null;
  } | null;
}

const TYPE_ACCENTS: Record<string, { tone: string; icon: string }> = {
  video: { tone: '#D1494E', icon: 'V' },
  reading: { tone: '#2F6FDD', icon: 'R' },
  interactive: { tone: '#E8742B', icon: 'I' },
  'hands-on': { tone: '#0F9D7A', icon: 'H' },
  workshop: { tone: '#7B61FF', icon: 'W' },
  coding: { tone: '#172439', icon: 'C' },
};

function getTypeMeta(type: string | null, fallback: string) {
  return TYPE_ACCENTS[type ?? ''] ?? { tone: fallback, icon: 'L' };
}

export default function LessonsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = ['admin', 'teacher', 'school'].includes(profile?.role ?? '');

  const loadLessons = useCallback(async () => {
    try {
      let query = supabase
        .from('lessons')
        .select(`
          id,
          title,
          lesson_type,
          course_id,
          duration_minutes,
          order_index,
          status,
          created_at,
          created_by,
          courses (
            title,
            programs (
              name
            )
          )
        `)
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!isStaff) {
        query = query.eq('status', 'active');
      }

      if (profile?.role === 'teacher' && profile.id) {
        query = query.eq('created_by', profile.id);
      }

      const { data, error } = await query.limit(120);
      if (error) throw error;
      setLessons((data as LessonListItem[]) ?? []);
    } catch (error: any) {
      Alert.alert('Lessons', error.message || 'Unable to load lessons.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, profile?.id, profile?.role]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const availableTypes = useMemo(() => {
    const values = Array.from(new Set(lessons.map((lesson) => lesson.lesson_type).filter(Boolean)));
    return ['all', ...values] as string[];
  }, [lessons]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesType = typeFilter === 'all' || lesson.lesson_type === typeFilter;
      const matchesSearch =
        !needle ||
        lesson.title.toLowerCase().includes(needle) ||
        (lesson.courses?.title ?? '').toLowerCase().includes(needle) ||
        (lesson.courses?.programs?.name ?? '').toLowerCase().includes(needle);
      return matchesType && matchesSearch;
    });
  }, [lessons, search, typeFilter]);

  const activeCount = lessons.filter((lesson) => lesson.status === 'active').length;

  const onToggleStatus = async (lesson: LessonListItem) => {
    const nextStatus = lesson.status === 'active' ? 'draft' : 'active';
    try {
      const { error } = await supabase
        .from('lessons')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', lesson.id);
      if (error) throw error;
      setLessons((prev) =>
        prev.map((item) => (item.id === lesson.id ? { ...item, status: nextStatus } : item)),
      );
    } catch (error: any) {
      Alert.alert('Lesson Status', error.message || 'Unable to update lesson status.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Lesson Engine"
        subtitle={`${lessons.length} lessons · ${activeCount} active`}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.searchWrap}>
        <Text style={[styles.searchIcon, { color: colors.textMuted }]}>S</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search lessons, courses, programs"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={[styles.clearBtn, { color: colors.textMuted }]}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filtersRow}>
          {availableTypes.map((type) => {
            const active = typeFilter === type;
            const meta = getTypeMeta(type === 'all' ? null : type, colors.primary);
            return (
              <TouchableOpacity
                key={type}
                onPress={() => setTypeFilter(type)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: active ? meta.tone : colors.border,
                    backgroundColor: active ? `${meta.tone}18` : colors.bgCard,
                  },
                ]}
              >
                <Text style={[styles.filterGlyph, { color: active ? meta.tone : colors.textMuted }]}>
                  {type === 'all' ? 'A' : meta.icon}
                </Text>
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? meta.tone : colors.textMuted },
                  ]}
                >
                  {type === 'all' ? 'All' : type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadLessons();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No matching lessons</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Try another search or switch the lesson type filter.</Text>
          </View>
        ) : (
          filtered.map((lesson, index) => {
            const meta = getTypeMeta(lesson.lesson_type, colors.primary);
            const active = lesson.status === 'active';
            return (
              <MotiView
                key={lesson.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: Math.min(index * 40, 240) }}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate('LessonDetail', { lessonId: lesson.id })}
                  style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                >
                  <LinearGradient
                    colors={[`${meta.tone}18`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={[styles.iconBadge, { backgroundColor: `${meta.tone}18`, borderColor: `${meta.tone}40` }]}>
                    <Text style={[styles.iconGlyph, { color: meta.tone }]}>{meta.icon}</Text>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                        {lesson.title}
                      </Text>
                      {isStaff && (
                        <TouchableOpacity
                          onPress={() => onToggleStatus(lesson)}
                          style={[
                            styles.statusButton,
                            {
                              backgroundColor: active ? `${colors.success}18` : `${colors.warning}18`,
                              borderColor: active ? `${colors.success}40` : `${colors.warning}40`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusButtonText,
                              { color: active ? colors.success : colors.warning },
                            ]}
                          >
                            {active ? 'Live' : 'Draft'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                      {(lesson.courses?.programs?.name ?? 'Program').toUpperCase()} · {(lesson.courses?.title ?? 'Course').toUpperCase()}
                    </Text>

                    <View style={styles.tagRow}>
                      <View style={[styles.metaChip, { backgroundColor: `${meta.tone}18`, borderColor: `${meta.tone}36` }]}>
                        <Text style={[styles.metaChipText, { color: meta.tone }]}>
                          {(lesson.lesson_type ?? 'lesson').toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.metaChip, { backgroundColor: `${colors.info}16`, borderColor: `${colors.info}32` }]}>
                        <Text style={[styles.metaChipText, { color: colors.info }]}>
                          {(lesson.duration_minutes ?? 45)} MIN
                        </Text>
                      </View>
                      {lesson.order_index !== null && (
                        <View style={[styles.metaChip, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                          <Text style={[styles.metaChipText, { color: colors.primary }]}>STEP {lesson.order_index + 1}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.cardFooter, { color: colors.textMuted }]}>
                      {active ? 'Active for learners' : 'Hidden from learners'} · {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'No date'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </MotiView>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loadingWrap: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.sm,
      marginBottom: SPACING.md,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    searchIcon: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 12,
      letterSpacing: 1.2,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
    },
    clearBtn: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 11,
      letterSpacing: 1,
    },
    filtersScroll: { flexGrow: 0 },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      borderWidth: 1,
    },
    filterGlyph: {
      fontFamily: FONT_FAMILY.display,
      fontSize: 11,
    },
    filterText: {
      fontFamily: FONT_FAMILY.bodySemi,
      fontSize: FONT_SIZE.xs,
      textTransform: 'capitalize',
    },
    list: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xl,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 72,
      gap: 10,
    },
    emptyTitle: {
      fontFamily: FONT_FAMILY.display,
      fontSize: FONT_SIZE.xl,
    },
    emptyText: {
      fontFamily: FONT_FAMILY.body,
      fontSize: FONT_SIZE.sm,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 20,
    },
    card: {
      flexDirection: 'row',
      gap: SPACING.md,
      padding: SPACING.md,
      borderWidth: 1,
      borderRadius: RADIUS.xl,
      marginBottom: SPACING.sm,
      overflow: 'hidden',
    },
    iconBadge: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    iconGlyph: {
      fontFamily: FONT_FAMILY.display,
      fontSize: 16,
    },
    cardContent: {
      flex: 1,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: FONT_SIZE.base,
      lineHeight: 21,
    },
    statusButton: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusButtonText: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    cardMeta: {
      fontFamily: FONT_FAMILY.mono,
      fontSize: 9,
      letterSpacing: 0.8,
      lineHeight: 14,
    },
    tagRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    metaChip: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    metaChipText: {
      fontFamily: FONT_FAMILY.bodyBold,
      fontSize: 9,
      letterSpacing: 0.8,
    },
    cardFooter: {
      fontFamily: FONT_FAMILY.body,
      fontSize: 11,
    },
  });

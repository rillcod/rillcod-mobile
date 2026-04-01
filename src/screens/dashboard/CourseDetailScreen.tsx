import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';

const { width } = Dimensions.get('window');

interface Course {
  id: string;
  title: string;
  description: string | null;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  lesson_type: string | null;
  completed: boolean;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
}

export default function CourseDetailScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { colors, theme } = useTheme();
  const styles = getStyles(colors);
  const { light, success } = useHaptics();
  const { programId, title } = route.params as { programId: string; title?: string };

  const [program, setProgram] = useState<Program | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!programId) return;
    try {
      const [progRes, coursesRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from('programs').select('*').eq('id', programId).single(),
        supabase.from('courses').select('id, title, description').eq('program_id', programId).order('created_at', { ascending: true }),
        supabase.from('lessons').select('id, title, lesson_type, course_id').in('course_id', 
          (await supabase.from('courses').select('id').eq('program_id', programId)).data?.map(c => c.id) || []
        ).order('created_at', { ascending: true }),
        profile ? supabase.from('lesson_progress').select('lesson_id').eq('portal_user_id', profile.id) : Promise.resolve({ data: [] })
      ]);

      if (progRes.data) setProgram(progRes.data as Program);
      
      const doneIds = new Set((progressRes.data ?? []).map((p: any) => p.lesson_id));
      
      if (coursesRes.data) {
        const mapped: Course[] = coursesRes.data.map(c => ({
          ...c,
          lessons: (lessonsRes.data ?? [])
            .filter((l: any) => l.course_id === c.id)
            .map((l: any) => ({
              ...l,
              completed: doneIds.has(l.id)
            }))
        }));
        setCourses(mapped);
        if (mapped.length > 0 && !expandedId) setExpandedId(mapped[0].id);
      }
    } catch (e: any) {
      console.warn('CourseDetail:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [programId, profile]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const totalLessons = useMemo(() => courses.reduce((s, c) => s + c.lessons.length, 0), [courses]);
  const completedCount = useMemo(() => courses.reduce((s, c) => s + c.lessons.filter(l => l.completed).length, 0), [courses]);
  const progressPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title || program?.name || 'ROADMAP'} onBack={() => navigation.goBack()} />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Progress Header */}
        <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={[styles.progressCard, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
          <LinearGradient colors={[colors.primary + '15', 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.progHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.progEyebrow, { color: colors.primary }]}>OPERATIONAL PROGRESS</Text>
              <Text style={[styles.progTitle, { color: colors.textPrimary }]}>{program?.name || 'MISSION TRACKER'}</Text>
            </View>
            <View style={styles.progCircle}>
               <Text style={[styles.progVal, { color: colors.primary }]}>{progressPercent}%</Text>
            </View>
          </View>
          <View style={[styles.track, { backgroundColor: colors.bg }]}>
            <MotiView 
              from={{ width: '0%' }} 
              animate={{ width: `${progressPercent}%` as any }} 
              transition={{ type: 'spring', damping: 20 }}
              style={[styles.fill, { backgroundColor: colors.primary }]} 
            />
          </View>
          <Text style={[styles.progMeta, { color: colors.textMuted }]}>{completedCount} OF {totalLessons} MODULES MASTERED</Text>
        </MotiView>

        {/* Roadmap List */}
        <View style={styles.roadmap}>
           {courses.map((course, cIdx) => {
             const isExpanded = expandedId === course.id;
             const courseDoneCount = course.lessons.filter(l => l.completed).length;
             const isCourseMastered = course.lessons.length > 0 && courseDoneCount === course.lessons.length;

             return (
               <View key={course.id} style={styles.courseGroup}>
                 <TouchableOpacity 
                   activeOpacity={0.8}
                   onPress={() => { light(); setExpandedId(isExpanded ? null : course.id); }}
                   style={[styles.courseHeader, { borderColor: isExpanded ? colors.primary + '50' : colors.border, backgroundColor: colors.bgCard }]}
                 >
                   <View style={[styles.stepNum, { backgroundColor: isCourseMastered ? colors.success + '20' : colors.bg, borderColor: isCourseMastered ? colors.success : colors.border }]}>
                      <Text style={[styles.stepText, { color: isCourseMastered ? colors.success : colors.textMuted }]}>{isCourseMastered ? '✓' : cIdx + 1}</Text>
                   </View>
                   <View style={{ flex: 1 }}>
                     <Text style={[styles.courseTitleText, { color: colors.textPrimary }]} numberOfLines={1}>{course.title}</Text>
                     <Text style={[styles.courseMetaText, { color: colors.textMuted }]}>{course.lessons.length} LESSONS  ·  {courseDoneCount} DONE</Text>
                   </View>
                   <Text style={{ color: colors.textMuted, fontSize: 18 }}>{isExpanded ? '−' : '+'}</Text>
                 </TouchableOpacity>

                 <AnimatePresence>
                   {isExpanded && (
                     <MotiView 
                       from={{ height: 0, opacity: 0 }} 
                       animate={{ height: 'auto' as any, opacity: 1 }} 
                       exit={{ height: 0, opacity: 0 }}
                       transition={{ type: 'timing', duration: 250 }}
                       style={styles.lessonsContainer}
                     >
                       {course.lessons.map((lesson, lIdx) => (
                         <TouchableOpacity 
                           key={lesson.id} 
                           activeOpacity={0.7}
                           onPress={() => { light(); navigation.navigate('LessonDetail', { lessonId: lesson.id }); }}
                           style={styles.lessonRow}
                         >
                            <View style={[styles.line, lIdx === course.lessons.length - 1 && { height: '50%' }, { backgroundColor: colors.border }]} />
                            <View style={[styles.dot, { backgroundColor: lesson.completed ? colors.success : colors.border }]} />
                            <View style={[styles.lessonCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                               <Text style={[styles.lessonType, { color: colors.primary }]}>{lesson.lesson_type?.toUpperCase() || 'MOD'}</Text>
                               <Text style={[styles.lessonName, { color: colors.textPrimary }]} numberOfLines={1}>{lesson.title}</Text>
                               {lesson.completed && <Text style={{ color: colors.success }}>✓</Text>}
                            </View>
                         </TouchableOpacity>
                       ))}
                       {course.lessons.length === 0 && (
                         <Text style={[styles.emptyLessons, { color: colors.textMuted }]}>NO LESSONS DETECTED IN THIS TRACK.</Text>
                       )}
                     </MotiView>
                   )}
                 </AnimatePresence>
               </View>
             );
           })}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  
  progressCard: { padding: SPACING.xl, borderRadius: RADIUS.sm, borderWidth: 1, marginBottom: SPACING.xl, overflow: 'hidden' },
  progHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  progEyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  progTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  progCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary },
  progVal: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11 },
  track: { height: 6, borderRadius: 3, marginBottom: 10 },
  fill: { height: '100%', borderRadius: 3 },
  progMeta: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1 },

  roadmap: { gap: SPACING.base },
  courseGroup: { marginBottom: 4 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: 14, borderRadius: RADIUS.sm, borderWidth: 1 },
  stepNum: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12 },
  courseTitleText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  courseMetaText: { fontFamily: FONT_FAMILY.mono, fontSize: 9, marginTop: 2 },

  lessonsContainer: { paddingLeft: 14, marginTop: 4 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  line: { position: 'absolute', left: 14, width: 2, height: '100%', top: -30 },
  dot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  lessonCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.xs, borderWidth: 1 },
  lessonType: { fontFamily: FONT_FAMILY.mono, fontSize: 9, opacity: 0.8 },
  lessonName: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: 12 },
  emptyLessons: { paddingLeft: 30, paddingVertical: 12, fontFamily: FONT_FAMILY.mono, fontSize: 9 },
});

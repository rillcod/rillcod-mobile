import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  school_name: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
}

interface ClassItem { id: string; name: string; student_count?: number }

export default function TeacherDetailScreen({ route, navigation }: any) {
  const { teacherId } = route.params ?? {};
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stats, setStats] = useState({ classes: 0, students: 0, assignments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('portal_users')
        .select('id, full_name, email, phone, school_name, bio, is_active, created_at')
        .eq('id', teacherId)
        .single();
      if (data) setTeacher(data as TeacherProfile);

      const [cls, asgn] = await Promise.all([
        supabase.from('classes').select('id, name').eq('teacher_id', teacherId).limit(20),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
      ]);

      // Fetch student counts per class
      let enrichedClasses: ClassItem[] = cls.data ?? [];
      if (enrichedClasses.length > 0) {
        const classIds = enrichedClasses.map(c => c.id);
        const enrollCounts = await Promise.all(
          classIds.map(id =>
            supabase.from('class_enrollments').select('id', { count: 'exact', head: true }).eq('class_id', id)
          )
        );
        enrichedClasses = enrichedClasses.map((c, i) => ({
          ...c,
          student_count: enrollCounts[i].count ?? 0,
        }));
      }

      const totalStudents = enrichedClasses.reduce((sum, c) => sum + (c.student_count ?? 0), 0);
      if (enrichedClasses.length > 0) setClasses(enrichedClasses);
      setStats({
        classes: enrichedClasses.length,
        students: totalStudents,
        assignments: asgn.count ?? 0,
      });
      setLoading(false);
    };
    if (teacherId) load();
  }, [teacherId]);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  if (!teacher) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Teacher" onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>Teacher not found.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Teacher Profile" onBack={() => navigation.goBack()} accentColor="#7c3aed" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
          <View style={styles.heroCard}>
            <LinearGradient colors={['#7c3aed15', 'transparent']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['#7c3aed', '#4c1d95']} style={styles.avatar}>
              <Text style={styles.avatarInitial}>{teacher.full_name[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.heroName}>{teacher.full_name}</Text>
            <Text style={styles.heroEmail}>{teacher.email}</Text>
            {teacher.school_name ? (
              <Text style={styles.schoolName}>🏫 {teacher.school_name}</Text>
            ) : null}
            <View style={[styles.statusPill, { backgroundColor: teacher.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: teacher.is_active ? COLORS.success : COLORS.error }]} />
              <Text style={[styles.statusText, { color: teacher.is_active ? COLORS.success : COLORS.error }]}>
                {teacher.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Classes', value: stats.classes, color: '#7c3aed', emoji: '📚' },
            { label: 'Students', value: stats.students, color: COLORS.success, emoji: '👨‍🎓' },
            { label: 'Assignments', value: stats.assignments, color: COLORS.info, emoji: '📝' },
          ].map((s, i) => (
            <MotiView key={s.label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 80 }} style={styles.statCard}>
              <LinearGradient colors={[s.color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </MotiView>
          ))}
        </View>

        {/* Bio */}
        {teacher.bio ? (
          <View style={styles.bioCard}>
            <Text style={styles.sectionLabel}>Bio</Text>
            <Text style={styles.bioText}>{teacher.bio}</Text>
          </View>
        ) : null}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Details</Text>
          {[
            { label: 'Phone', value: teacher.phone, emoji: '📞' },
            { label: 'Joined', value: new Date(teacher.created_at).toLocaleDateString('en-GB'), emoji: '📅' },
          ].filter(f => f.value).map((f, i) => (
            <View key={f.label} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
              <Text style={styles.infoEmoji}>{f.emoji}</Text>
              <Text style={styles.infoLabel}>{f.label}</Text>
              <Text style={styles.infoValue}>{f.value}</Text>
            </View>
          ))}
        </View>

        {/* Classes */}
        {classes.length > 0 ? (
          <View style={styles.classesCard}>
            <Text style={styles.sectionLabel}>Classes ({classes.length})</Text>
            {classes.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.classRow, i > 0 && styles.classRowBorder]}
                onPress={() => navigation.navigate('ClassDetail', { classId: c.id })}
                activeOpacity={0.8}
              >
                <Text style={styles.classIcon}>📚</Text>
                <Text style={styles.className}>{c.name}</Text>
                {c.student_count != null && c.student_count > 0 && (
                  <Text style={styles.classCount}>{c.student_count} students</Text>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl },

  heroCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md, overflow: 'hidden' },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['3xl'], color: COLORS.white100 },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  heroEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  schoolName: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', gap: 4, overflow: 'hidden' },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  bioCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md },
  bioText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },

  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, padding: SPACING.md, paddingBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoEmoji: { fontSize: 16, width: 24 },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  classesCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  classRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  classIcon: { fontSize: 18 },
  className: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  chevron: { fontSize: 18, color: COLORS.textMuted },
  classCount: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

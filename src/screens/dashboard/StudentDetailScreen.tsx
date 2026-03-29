import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  school_name: string | null;
  section_class: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  created_at: string;
}

interface Stat { label: string; value: string | number; color: string; emoji: string }

export default function StudentDetailScreen({ route, navigation }: any) {
  const { studentId } = route.params ?? {};
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('portal_users')
        .select('id, full_name, email, phone, school_name, section_class, date_of_birth, is_active, created_at')
        .eq('id', studentId)
        .single();
      if (data) setStudent(data as StudentProfile);

      const [subs, enr] = await Promise.all([
        supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('portal_user_id', studentId),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', studentId),
      ]);
      setStats([
        { label: 'Enrollments', value: enr.count ?? 0, color: COLORS.info, emoji: '📚' },
        { label: 'Submissions', value: subs.count ?? 0, color: '#7c3aed', emoji: '📝' },
      ]);
      setLoading(false);
    };
    if (studentId) load();
  }, [studentId]);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.admin} size="large" />
      </View>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Student" onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>Student not found.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Student Profile" onBack={() => navigation.goBack()} accentColor={COLORS.admin} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar hero */}
        <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
          <View style={styles.heroCard}>
            <LinearGradient colors={[COLORS.admin + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={COLORS.gradPrimary} style={styles.avatar}>
              <Text style={styles.avatarInitial}>{student.full_name[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.heroName}>{student.full_name}</Text>
            <Text style={styles.heroEmail}>{student.email}</Text>
            <View style={[styles.statusPill, { backgroundColor: student.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: student.is_active ? COLORS.success : COLORS.error }]} />
              <Text style={[styles.statusText, { color: student.is_active ? COLORS.success : COLORS.error }]}>
                {student.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((s, i) => (
            <MotiView key={s.label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 80 }} style={styles.statCard}>
              <LinearGradient colors={[s.color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </MotiView>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.accent + '18', borderColor: COLORS.accent + '44' }]}
            onPress={() => navigation.navigate('StudentReport', { studentId, studentName: student.full_name })}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.accent }]}>📋 View Report</Text>
          </TouchableOpacity>
        </View>

        {/* Info fields */}
        <View style={styles.infoCard}>
          <LinearGradient colors={[COLORS.white05, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.sectionLabel}>Details</Text>
          {[
            { label: 'School', value: student.school_name, emoji: '🏫' },
            { label: 'Class', value: student.section_class, emoji: '📚' },
            { label: 'Phone', value: student.phone, emoji: '📞' },
            { label: 'Date of Birth', value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : null, emoji: '🎂' },
            { label: 'Joined', value: new Date(student.created_at).toLocaleDateString('en-GB'), emoji: '📅' },
          ].filter(f => f.value).map((f, i) => (
            <View key={f.label} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
              <Text style={styles.infoEmoji}>{f.emoji}</Text>
              <Text style={styles.infoLabel}>{f.label}</Text>
              <Text style={styles.infoValue}>{f.value}</Text>
            </View>
          ))}
        </View>

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
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', gap: 4, overflow: 'hidden' },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, padding: SPACING.md, paddingBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoEmoji: { fontSize: 16, width: 24 },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center' },
  actionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

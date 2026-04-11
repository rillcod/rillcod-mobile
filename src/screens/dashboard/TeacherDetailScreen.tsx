import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { assignmentService } from '../../services/assignment.service';
import { classService } from '../../services/class.service';
import { teacherService } from '../../services/teacher.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../navigation/routes';

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

interface ClassItem {
  id: string;
  name: string;
  student_count?: number;
}

interface TeacherSchoolAssignment {
  id: string;
  school_id: string;
  is_primary: boolean | null;
  schools: {
    id: string;
    name: string;
    state: string | null;
    status: string | null;
  } | null;
}

function normalizeAssignment(raw: any): TeacherSchoolAssignment {
  return {
    id: raw.id,
    school_id: raw.school_id,
    is_primary: raw.is_primary ?? null,
    schools: Array.isArray(raw.schools) ? raw.schools[0] ?? null : raw.schools ?? null,
  };
}

export default function TeacherDetailScreen({ route, navigation }: any) {
  const { profile } = useAuth();
  const { teacherId } = route.params ?? {};
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<TeacherSchoolAssignment[]>([]);
  const [stats, setStats] = useState({ classes: 0, students: 0, assignments: 0, schools: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const row = await teacherService.getTeacherDetail(teacherId);
        setTeacher({
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          school_name: row.school_name,
          bio: row.bio,
          is_active: row.is_active ?? false,
          created_at: row.created_at ?? '',
        });
      } catch {
        setTeacher(null);
      }

      let enrichedClasses: ClassItem[] = [];
      let assignmentCount = 0;
      let schoolAssignmentsRaw: any[] = [];
      try {
        const [cls, asgnCount, sar] = await Promise.all([
          classService.listClassSummariesForTeacher(teacherId),
          assignmentService.countAssignmentsByCreator(teacherId),
          teacherService.listTeacherSchoolLinksForDetail(teacherId),
        ]);
        enrichedClasses = cls as ClassItem[];
        assignmentCount = asgnCount;
        schoolAssignmentsRaw = sar as any[];
      } catch {
        enrichedClasses = [];
        assignmentCount = 0;
        schoolAssignmentsRaw = [];
      }

      if (enrichedClasses.length > 0) {
        const enrollCounts = await Promise.all(
          enrichedClasses.map(async (item) => {
            try {
              return await classService.countStudentsInClass(item.id);
            } catch {
              return 0;
            }
          }),
        );
        enrichedClasses = enrichedClasses.map((item, index) => ({
          ...item,
          student_count: enrollCounts[index] ?? 0,
        }));
      }

      const normalizedAssignments = schoolAssignmentsRaw.map(normalizeAssignment);
      setAssignments(normalizedAssignments);

      const totalStudents = enrichedClasses.reduce((sum, item) => sum + (item.student_count ?? 0), 0);
      if (enrichedClasses.length > 0) setClasses(enrichedClasses);
      setStats({
        classes: enrichedClasses.length,
        students: totalStudents,
        assignments: assignmentCount,
        schools: normalizedAssignments.length,
      });
      setLoading(false);
    };
    if (teacherId) load();
  }, [teacherId]);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.info} size="large" />
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
      <ScreenHeader
        title="Teacher Profile"
        onBack={() => navigation.goBack()}
        accentColor={COLORS.info}
        rightAction={profile?.role === 'admin' ? { label: 'Edit', onPress: () => navigation.navigate(ROUTES.AddTeacher, { teacherId }) } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
          <View style={styles.heroCard}>
            <LinearGradient colors={[COLORS.info + '15', 'transparent']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[COLORS.info, '#1e3a8a']} style={styles.avatar}>
              <Text style={styles.avatarInitial}>{teacher.full_name[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.heroName}>{teacher.full_name}</Text>
            <Text style={styles.heroEmail}>{teacher.email}</Text>
            {teacher.school_name ? <Text style={styles.schoolName}>{teacher.school_name}</Text> : null}
            <View style={[styles.statusPill, { backgroundColor: teacher.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: teacher.is_active ? COLORS.success : COLORS.error }]} />
              <Text style={[styles.statusText, { color: teacher.is_active ? COLORS.success : COLORS.error }]}>
                {teacher.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </MotiView>

        <View style={styles.statsRow}>
          {[
            { label: 'Classes', value: stats.classes, color: COLORS.info, code: 'CL' },
            { label: 'Students', value: stats.students, color: COLORS.success, code: 'ST' },
            { label: 'Assignments', value: stats.assignments, color: COLORS.warning, code: 'AS' },
            { label: 'Schools', value: stats.schools, color: COLORS.primary, code: 'SC' },
          ].map((item, index) => (
            <MotiView key={item.label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 80 }} style={styles.statCard}>
              <LinearGradient colors={[item.color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={[styles.statCode, { color: item.color }]}>{item.code}</Text>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </MotiView>
          ))}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Teachers)}>
            <Text style={styles.quickActionCode}>TC</Text>
            <Text style={styles.quickActionText}>Directory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Classes)}>
            <Text style={styles.quickActionCode}>CL</Text>
            <Text style={styles.quickActionText}>Classes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Assignments)}>
            <Text style={styles.quickActionCode}>AS</Text>
            <Text style={styles.quickActionText}>Assignments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Reports)}>
            <Text style={styles.quickActionCode}>RP</Text>
            <Text style={styles.quickActionText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {teacher.bio ? (
          <View style={styles.bioCard}>
            <Text style={styles.sectionLabel}>Bio</Text>
            <Text style={styles.bioText}>{teacher.bio}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Details</Text>
          {[
            { label: 'Phone', value: teacher.phone },
            { label: 'Joined', value: new Date(teacher.created_at).toLocaleDateString('en-GB') },
          ].filter((item) => item.value).map((item, index) => (
            <View key={item.label} style={[styles.infoRow, index > 0 && styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.schoolsCard}>
          <Text style={styles.sectionLabel}>Assigned Schools ({assignments.length})</Text>
          {assignments.length === 0 ? (
            <Text style={styles.inlineEmpty}>No school assignments yet.</Text>
          ) : (
            assignments.map((assignment, index) => (
              <TouchableOpacity
                key={assignment.id}
                style={[styles.schoolRow, index > 0 && styles.classRowBorder]}
                onPress={() => assignment.schools ? navigation.navigate(ROUTES.SchoolDetail, { schoolId: assignment.schools.id }) : null}
                activeOpacity={0.8}
              >
                <Text style={styles.classIcon}>SC</Text>
                <View style={styles.schoolRowInfo}>
                  <Text style={styles.className}>{assignment.schools?.name ?? 'Assigned school'}</Text>
                  <Text style={styles.classCount}>{assignment.schools?.state ?? assignment.schools?.status ?? 'School link active'}</Text>
                </View>
                {assignment.is_primary ? <Text style={styles.primaryBadge}>Primary</Text> : null}
                <Text style={styles.chevron}>{'>'}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {classes.length > 0 ? (
          <View style={styles.classesCard}>
            <Text style={styles.sectionLabel}>Classes ({classes.length})</Text>
            {classes.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.classRow, index > 0 && styles.classRowBorder]}
                onPress={() => navigation.navigate(ROUTES.ClassDetail, { classId: item.id })}
                activeOpacity={0.8}
              >
                <Text style={styles.classIcon}>CL</Text>
                <Text style={styles.className}>{item.name}</Text>
                {item.student_count != null && item.student_count > 0 ? (
                  <Text style={styles.classCount}>{item.student_count} students</Text>
                ) : null}
                <Text style={styles.chevron}>{'>'}</Text>
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
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { width: '48%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', gap: 4, overflow: 'hidden' },
  statCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'] },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  quickActionCard: { width: '48%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  quickActionCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.info },
  quickActionText: { marginTop: 6, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 },
  bioCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md },
  bioText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  schoolsCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  classesCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, padding: SPACING.md, paddingBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  schoolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  classRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  classIcon: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.info, width: 24 },
  className: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  classCount: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  schoolRowInfo: { flex: 1, gap: 2 },
  primaryBadge: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.success },
  chevron: { fontSize: 18, color: COLORS.textMuted },
  inlineEmpty: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

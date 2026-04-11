import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { schoolService } from '../../services/school.service';
import { teacherService } from '../../services/teacher.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';

interface School {
  id: string;
  name: string;
  school_type: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lga: string | null;
  city: string | null;
  state: string | null;
  status: string;
  rillcod_quota_percent: number | null;
  enrollment_types: string[] | null;
  created_at: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  portal_users: Teacher | null;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  section_class: string | null;
}

type ActiveTab = 'info' | 'teachers' | 'students';

const STATUS_COLOR: Record<string, string> = {
  approved: COLORS.success,
  pending: COLORS.warning,
  rejected: COLORS.error,
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={info.row}>
      <Text style={info.label}>{label}</Text>
      <Text style={info.value}>{value}</Text>
    </View>
  );
}

function normalizeAssignment(raw: any): TeacherAssignment {
  return {
    id: raw.id,
    teacher_id: raw.teacher_id,
    portal_users: Array.isArray(raw.portal_users) ? raw.portal_users[0] ?? null : raw.portal_users ?? null,
  };
}

export default function SchoolDetailScreen({ navigation, route }: any) {
  const { schoolId } = route.params as { schoolId: string };
  const { profile } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningTeacherId, setAssigningTeacherId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const { school: schoolRow, assignmentRows, students: studentRows, teacherPickerPool } =
        await schoolService.loadSchoolDetailScreenData(schoolId, { includeTeacherPicker: isAdmin });

      if (schoolRow) setSchool(schoolRow as School);

      const normalizedAssignments = (assignmentRows ?? []).map(normalizeAssignment);
      setTeacherAssignments(normalizedAssignments);
      setTeachers(normalizedAssignments.map((assignment) => assignment.portal_users).filter(Boolean) as Teacher[]);

      setStudents((studentRows ?? []) as Student[]);

      const assignedTeacherIds = new Set(normalizedAssignments.map((assignment) => assignment.teacher_id));
      setAvailableTeachers(
        ((teacherPickerPool ?? []) as Teacher[]).filter((teacher) => !assignedTeacherIds.has(teacher.id)),
      );
    } catch (e: any) {
      Alert.alert('Load failed', e?.message ?? 'Could not load school');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, schoolId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updateStatus = async (status: 'approved' | 'rejected') => {
    if (!school) return;
    Alert.alert(
      `${status === 'approved' ? 'Approve' : 'Reject'} School`,
      `Are you sure you want to ${status} "${school.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await schoolService.updateSchool(schoolId, { status });
              setSchool((current) => (current ? { ...current, status } : current));
            } catch (e: any) {
              Alert.alert('Update failed', e?.message ?? 'Could not update status');
            }
          },
        },
      ]
    );
  };

  const assignTeacher = async (teacher: Teacher) => {
    setAssigningTeacherId(teacher.id);
    let data: any;
    try {
      data = await teacherService.insertTeacherSchoolAssignmentReturningRow({
        schoolId,
        teacherId: teacher.id,
        assignedBy: profile?.id ?? null,
      });
    } catch (error: any) {
      Alert.alert('Assignment failed', error?.message ?? 'Unknown error');
      setAssigningTeacherId(null);
      return;
    }

    const assignment = normalizeAssignment(data);
    setTeacherAssignments((prev) => [...prev, assignment]);
    if (assignment.portal_users) setTeachers((prev) => [...prev, assignment.portal_users!]);
    setAvailableTeachers((prev) => prev.filter((item) => item.id !== teacher.id));
    setAssigningTeacherId(null);
  };

  const removeTeacher = async (assignment: TeacherAssignment) => {
    setAssigningTeacherId(assignment.id);
    try {
      await teacherService.deleteTeacherSchoolAssignmentById(assignment.id);
    } catch (error: any) {
      Alert.alert('Remove failed', error?.message ?? 'Unknown error');
      setAssigningTeacherId(null);
      return;
    }

    setTeacherAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
    setTeachers((prev) => prev.filter((item) => item.id !== assignment.teacher_id));
    if (assignment.portal_users) {
      setAvailableTeachers((prev) => [...prev, assignment.portal_users!].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    }
    setAssigningTeacherId(null);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.info} size="large" />
      </View>
    );
  }

  if (!school) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="School" onBack={() => navigation.goBack()} />
        <View style={styles.loader}>
          <Text style={styles.emptyText}>School not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLOR[school.status] ?? COLORS.textMuted;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={school.name} onBack={() => navigation.goBack()} accentColor={statusColor} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.info} />}
        showsVerticalScrollIndicator={false}
      >
        <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.hero}>
          <LinearGradient colors={[COLORS.info + '18', 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>SC</Text>
          </View>
          <Text style={styles.heroName}>{school.name}</Text>
          {school.school_type ? <Text style={styles.heroType}>{school.school_type}</Text> : null}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{school.status.toUpperCase()}</Text>
          </View>

          <View style={styles.statsRow}>
            {[
              { label: 'Teachers', value: teachers.length },
              { label: 'Students', value: students.length },
              { label: 'Quota', value: school.rillcod_quota_percent != null ? `${school.rillcod_quota_percent}%` : '-' },
            ].map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </MotiView>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.SchoolOverview)}>
            <Text style={styles.quickActionCode}>OV</Text>
            <Text style={styles.quickActionText}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Students)}>
            <Text style={styles.quickActionCode}>ST</Text>
            <Text style={styles.quickActionText}>Students</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Teachers)}>
            <Text style={styles.quickActionCode}>TC</Text>
            <Text style={styles.quickActionText}>Teachers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate(ROUTES.Reports)}>
            <Text style={styles.quickActionCode}>RP</Text>
            <Text style={styles.quickActionText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {isAdmin ? (
          <View style={styles.actionRow}>
            {school.status !== 'approved' ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => updateStatus('approved')}>
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : null}
            {school.status !== 'rejected' && school.status !== 'approved' ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.error }]} onPress={() => updateStatus('rejected')}>
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.info }]} onPress={() => navigation.navigate(ROUTES.AddSchool, { schoolId })}>
              <Text style={styles.actionBtnText}>Edit Details</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.tabs}>
          {(['info', 'teachers', 'students'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'info' ? 'Info' : tab === 'teachers' ? `Teachers (${teachers.length})` : `Students (${students.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'info' ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.infoCard}>
              <LinearGradient colors={[COLORS.bgCard, 'transparent']} style={StyleSheet.absoluteFill} />
              <InfoRow label="Contact Person" value={school.contact_person} />
              <InfoRow label="Email" value={school.email} />
              <InfoRow label="Phone" value={school.phone} />
              <InfoRow label="Address" value={school.address} />
              <InfoRow label="LGA" value={school.lga} />
              <InfoRow label="City" value={school.city} />
              <InfoRow label="State" value={school.state} />
              {school.enrollment_types && school.enrollment_types.length > 0 ? (
                <View style={info.row}>
                  <Text style={info.label}>Enrollment Types</Text>
                  <Text style={info.value}>{school.enrollment_types.join(', ')}</Text>
                </View>
              ) : null}
              <InfoRow label="Joined" value={new Date(school.created_at).toLocaleDateString('en-GB')} />
            </MotiView>
          ) : null}

          {activeTab === 'teachers' ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {teacherAssignments.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>TC</Text>
                  <Text style={styles.emptyText}>No teachers assigned yet.</Text>
                </View>
              ) : (
                teacherAssignments.map((assignment) => {
                  const teacher = assignment.portal_users;
                  if (!teacher) return null;
                  return (
                    <TouchableOpacity
                      key={assignment.id}
                      style={styles.personCard}
                      onPress={() => navigation.navigate(ROUTES.TeacherDetail, { teacherId: teacher.id })}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={[COLORS.info + '18', 'transparent']} style={StyleSheet.absoluteFill} />
                      <View style={[styles.personAvatar, { backgroundColor: COLORS.info + '30' }]}>
                        <Text style={styles.personAvatarText}>{(teacher.full_name || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={styles.personName}>{teacher.full_name}</Text>
                        <Text style={styles.personEmail}>{teacher.email}</Text>
                      </View>
                      {isAdmin ? (
                        <TouchableOpacity onPress={() => removeTeacher(assignment)} style={styles.inlineDangerButton} disabled={assigningTeacherId === assignment.id}>
                          <Text style={styles.inlineDangerText}>{assigningTeacherId === assignment.id ? '...' : 'Remove'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.chevron}>{'>'}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              {isAdmin ? (
                <View style={styles.assignSection}>
                  <Text style={styles.assignTitle}>Assign Teacher</Text>
                  {availableTeachers.length === 0 ? (
                    <Text style={styles.assignEmpty}>All active teachers are already assigned.</Text>
                  ) : (
                    availableTeachers.map((teacher) => (
                      <View key={teacher.id} style={styles.assignCard}>
                        <View style={styles.assignInfo}>
                          <Text style={styles.assignName}>{teacher.full_name}</Text>
                          <Text style={styles.assignEmail}>{teacher.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => assignTeacher(teacher)} style={styles.inlinePrimaryButton} disabled={assigningTeacherId === teacher.id}>
                          <Text style={styles.inlinePrimaryText}>{assigningTeacherId === teacher.id ? '...' : 'Assign'}</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </MotiView>
          ) : null}

          {activeTab === 'students' ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {students.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>ST</Text>
                  <Text style={styles.emptyText}>No students registered yet.</Text>
                </View>
              ) : (
                students.map((student) => (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.personCard}
                    onPress={() => navigation.navigate(ROUTES.StudentDetail, { studentId: student.id })}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[COLORS.admin + '18', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.personAvatar, { backgroundColor: COLORS.admin + '30' }]}>
                      <Text style={styles.personAvatarText}>{(student.full_name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{student.full_name}</Text>
                      <Text style={styles.personEmail}>{student.email}</Text>
                      {student.section_class ? <Text style={styles.personSub}>{student.section_class}</Text> : null}
                    </View>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </MotiView>
          ) : null}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const info = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, flex: 0.45, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 0.55, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  hero: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, overflow: 'hidden',
  },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.info + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  heroIconText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.info },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, textAlign: 'center' },
  heroType: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1 },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.sm },
  statItem: { alignItems: 'center', gap: 3 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  actionRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  actionBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  quickActionCard: { width: '48%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  quickActionCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.info },
  quickActionText: { marginTop: 6, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginHorizontal: SPACING.xl },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.info },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  tabTextActive: { color: COLORS.info },
  tabContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden', paddingHorizontal: SPACING.md },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  personAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  personAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.white100 },
  personInfo: { flex: 1, gap: 2 },
  personName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  personEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  personSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  chevron: { fontSize: 20, color: COLORS.textMuted },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyEmoji: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  assignSection: { marginTop: SPACING.lg, gap: SPACING.sm },
  assignTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 },
  assignEmpty: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  assignCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, backgroundColor: COLORS.bgCard,
  },
  assignInfo: { flex: 1, gap: 2 },
  assignName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  assignEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  inlinePrimaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.info },
  inlinePrimaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.white100 },
  inlineDangerButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.error + '14' },
  inlineDangerText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
});

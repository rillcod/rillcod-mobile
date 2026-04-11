import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../services/attendance.service';
import { certificateService } from '../../services/certificate.service';
import { gradeService } from '../../services/grade.service';
import { paymentService } from '../../services/payment.service';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

interface Child {
  id: string;
  full_name: string;
  school_name: string | null;
  grade_level: string | null;
  status: string;
  gender: string | null;
  date_of_birth: string | null;
  parent_relationship: string | null;
  user_id: string | null;
}

interface ChildStats {
  attendancePct: number | null;
  lastGrade: string | null;
  unpaidInvoices: number;
  certificates: number;
}

function calcAge(dob: string | null): string | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${age} yrs`;
}

function gradeColor(g: string | null): string {
  if (!g) return COLORS.textMuted;
  if (g.startsWith('A')) return COLORS.success;
  if (g.startsWith('B')) return COLORS.info;
  if (g.startsWith('C')) return COLORS.warning;
  return COLORS.error;
}

export default function MyChildrenScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ChildStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const kids = (await studentService.listRegistrationsForParentEmail(profile.email)) as Child[];
      setChildren(kids);

      const stats: Record<string, ChildStats> = {};
      await Promise.all(
        kids.map(async (child) => {
          const [attRows, unpaidInvoices, certificates] = await Promise.all([
            attendanceService.listAttendanceStatusesForStudentsRegistration(child.id, 60),
            child.user_id ? paymentService.countUnpaidInvoicesForPortalUser(child.user_id) : Promise.resolve(0),
            child.user_id ? certificateService.countCertificatesForPortalUser(child.user_id) : Promise.resolve(0),
          ]);

          const present = attRows.filter((a) => a.status === 'present').length;
          const attendancePct = attRows.length > 0 ? Math.round((present / attRows.length) * 100) : null;

          stats[child.id] = {
            attendancePct,
            lastGrade: null,
            unpaidInvoices,
            certificates,
          };

          if (child.user_id) {
            const letter = await gradeService.getLatestPublishedOverallGradeForPortalStudent(child.user_id);
            if (letter) stats[child.id].lastGrade = letter;
          }
        }),
      );

      setStatsMap(stats);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  if (profile?.role !== 'parent') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.accessDenied}>Access restricted to parent accounts</Text>
        </View>
      </SafeAreaView>
    );
  }

  const QUICK_LINKS = (childId: string, childName: string, userId: string | null) => [
    // ParentResults uses userId (portal_users.id) because student_progress_reports.student_id → portal_users
    { label: 'Report Card', emoji: '📊', screen: ROUTES.ParentResults, params: { studentId: childId, studentName: childName, userId } },
    { label: 'Attendance', emoji: '📋', screen: ROUTES.ParentAttendance, params: { studentId: childId, studentName: childName } },
    { label: 'Grades', emoji: '🎓', screen: ROUTES.ParentGrades, params: { studentId: childId, studentName: childName } },
    { label: 'Invoices', emoji: '💰', screen: ROUTES.ParentInvoices, params: { studentId: childId, studentName: childName } },
    { label: 'Certificates', emoji: '🏆', screen: ROUTES.ParentCertificates, params: { studentId: childId, studentName: childName } },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <View>
            <Text style={styles.title}>My Children</Text>
            <Text style={styles.subtitle}>Children linked to your account</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : children.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyTitle}>No children linked</Text>
            <Text style={styles.emptyText}>
              Contact your school administrator to link your child's enrolment to your parent account.
            </Text>
          </View>
        ) : (
          <View style={styles.childrenList}>
            {children.map((child, i) => {
              const s = statsMap[child.id];
              const age = calcAge(child.date_of_birth);

              return (
                <MotiView
                  key={child.id}
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: i * 80 }}
                  style={styles.childCard}
                >
                  {/* Child header */}
                  <View style={styles.childHeader}>
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>
                        {child.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.childName}>{child.full_name}</Text>
                        <View style={[
                          styles.statusBadge,
                          {
                            backgroundColor: child.status === 'approved' ? COLORS.success + '22' : COLORS.warning + '22',
                            borderColor: child.status === 'approved' ? COLORS.success + '55' : COLORS.warning + '55',
                          },
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: child.status === 'approved' ? COLORS.success : COLORS.warning },
                          ]}>
                            {child.status}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.childMeta}>
                        {child.school_name && <Text style={styles.metaItem}>🏫 {child.school_name}</Text>}
                        {child.grade_level && <Text style={styles.metaItem}>📚 {child.grade_level}</Text>}
                        {age && <Text style={styles.metaItem}>👤 {age}</Text>}
                      </View>
                      {child.parent_relationship && (
                        <Text style={styles.relationship}>{child.parent_relationship}</Text>
                      )}
                    </View>
                  </View>

                  {/* Stats strip */}
                  {s && (
                    <View style={styles.statsStrip}>
                      {[
                        {
                          label: 'Attendance',
                          value: s.attendancePct != null ? `${s.attendancePct}%` : '—',
                          color: s.attendancePct != null && s.attendancePct >= 70 ? COLORS.success : s.attendancePct != null ? COLORS.error : COLORS.textMuted,
                        },
                        {
                          label: 'Last Grade',
                          value: s.lastGrade ?? '—',
                          color: gradeColor(s.lastGrade),
                        },
                        {
                          label: 'Unpaid',
                          value: `${s.unpaidInvoices}`,
                          color: s.unpaidInvoices > 0 ? COLORS.error : COLORS.textMuted,
                        },
                        {
                          label: 'Certs',
                          value: `${s.certificates}`,
                          color: s.certificates > 0 ? COLORS.gold : COLORS.textMuted,
                        },
                      ].map(({ label, value, color }, idx) => (
                        <View key={label} style={[styles.statCell, idx < 3 && styles.statCellBorder]}>
                          <Text style={[styles.statValue, { color }]}>{value}</Text>
                          <Text style={styles.statLabel}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Quick links */}
                  <View style={styles.quickLinks}>
                    {QUICK_LINKS(child.id, child.full_name, child.user_id).map(({ label, emoji, screen, params }) => (
                      <TouchableOpacity
                        key={label}
                        style={styles.quickLink}
                        onPress={() => navigation.navigate(screen, params)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickLinkEmoji}>{emoji}</Text>
                        <Text style={styles.quickLinkLabel}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </MotiView>
              );
            })}
          </View>
        )}

        {/* Note */}
        {!loading && children.length > 0 && (
          <Text style={styles.note}>
            Not seeing a child? Message the admin to link their account.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  accessDenied: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm, paddingHorizontal: SPACING['2xl'] },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted, textAlign: 'center', lineHeight: FONT_SIZE.base * 1.6 },
  childrenList: { padding: SPACING.base, gap: SPACING.xl },
  childCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  childHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.base,
  },
  childAvatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  childAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.primaryLight },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  childName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  childMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.xs },
  metaItem: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  relationship: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.accentLight, marginTop: SPACING.xs },
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statCell: { flex: 1, alignItems: 'center', padding: SPACING.md, gap: 4 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickLinks: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  quickLinkEmoji: { fontSize: 18 },
  quickLinkLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  note: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING['2xl'],
    marginTop: SPACING.base,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../services/attendance.service';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note: string | null;
  course_name: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: COLORS.success,
  absent: COLORS.error,
  late: COLORS.warning,
  excused: COLORS.info,
};

export default function ParentAttendanceScreen({ navigation, route }: any) {
  const { profile } = useAuth();
  const { studentId: paramStudentId, studentName } = route.params ?? {};
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      let studentId = paramStudentId as string | undefined;
      if (!studentId && profile?.email) {
        studentId = (await studentService.getFirstStudentRegistrationIdForParentEmail(profile.email)) ?? undefined;
      }
      if (!studentId) {
        setRecords([]);
        return;
      }

      const rows = await attendanceService.listParentAttendanceByStudentsRegistrationId(studentId);
      setRecords(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [paramStudentId, profile?.email]);

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const attendancePct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
        <View>
          <Text style={styles.title}>Attendance</Text>
          {studentName && <Text style={styles.subtitle}>{studentName}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {/* Summary Stats */}
          {records.length > 0 && (
            <View style={styles.statsRow}>
              {[
                { label: 'Rate', value: attendancePct != null ? `${attendancePct}%` : '—', color: attendancePct != null && attendancePct >= 70 ? COLORS.success : COLORS.error },
                { label: 'Present', value: `${presentCount}`, color: COLORS.success },
                { label: 'Absent', value: `${absentCount}`, color: COLORS.error },
                { label: 'Late', value: `${lateCount}`, color: COLORS.warning },
              ].map(({ label, value, color }, i) => (
                <View key={label} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
                  <Text style={[styles.statValue, { color }]}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {records.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No attendance records</Text>
              <Text style={styles.emptyText}>Attendance records will appear here once recorded.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {records.map((record, i) => (
                <MotiView
                  key={record.id}
                  from={{ opacity: 0, translateX: -10 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ delay: i * 30 }}
                  style={styles.recordRow}
                >
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[record.status] ?? COLORS.textMuted }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.dateText}>
                      {record.date ? new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </Text>
                    {record.course_name && (
                      <Text style={styles.courseText}>{record.course_name}</Text>
                    )}
                  </View>
                  <View>
                    <View style={[styles.statusBadge, { borderColor: (STATUS_COLOR[record.status] ?? COLORS.textMuted) + '55', backgroundColor: (STATUS_COLOR[record.status] ?? COLORS.textMuted) + '22' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[record.status] ?? COLORS.textMuted }]}>
                        {record.status}
                      </Text>
                    </View>
                    {record.note && <Text style={styles.noteText}>{record.note}</Text>}
                  </View>
                </MotiView>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  scroll: { padding: SPACING.base, paddingBottom: 40 },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, marginBottom: SPACING.base, overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statCellBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  list: { gap: SPACING.sm },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dateText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  courseText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: 'flex-end' },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  noteText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2, textAlign: 'right' },
});

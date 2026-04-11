
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../services/attendance.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';

interface AttendanceRecord {
  id: string;
  user_id: string | null;
  student_name: string;
  created_at: string | null;
  status: string | null;
  notes: string | null;
}

interface AttendanceSession {
  id: string;
  class_id: string | null;
  session_date: string;
  topic: string | null;
  start_time: string | null;
  created_at: string | null;
}

interface ClassItem {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { color: string; emoji: string }> = {
  present: { color: COLORS.success, emoji: 'OK' },
  absent: { color: COLORS.error, emoji: 'NO' },
  late: { color: COLORS.warning, emoji: 'LT' },
  excused: { color: COLORS.info, emoji: 'EX' },
};

export default function AttendanceScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'sessions' | 'records'>('sessions');

  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';

  const loadClasses = useCallback(async () => {
    if (isStudent) {
      setLoading(false);
      return;
    }

    try {
      const rows = await attendanceService.listClassesForAttendancePicker({
        teacherId: isTeacher ? profile!.id : undefined,
        schoolId: !isTeacher ? profile?.school_id ?? undefined : undefined,
        limit: 50,
      });
      setClasses(rows as ClassItem[]);
    } catch {
      setClasses([]);
    }
    setLoading(false);
  }, [isStudent, isTeacher, profile]);

  const loadSessions = useCallback(async (classId: string) => {
    try {
      const rows = await attendanceService.listSessionsForClass(classId, 30);
      setSessions(rows as AttendanceSession[]);
    } catch {
      setSessions([]);
    }
  }, []);

  const loadRecords = useCallback(async (sessionId: string) => {
    if (isStudent) {
      if (!profile) return;
      try {
        const rows = await attendanceService.listAttendanceRowsForStudent(profile.id, 50);
        setRecords((rows as any[]).map((row) => ({ ...row, student_name: profile.full_name })));
      } catch {
        setRecords([]);
      }
      return;
    }

    const data = await attendanceService.listAttendance(sessionId, profile?.school_id);

    setRecords(
      ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        created_at: row.created_at,
        status: row.status,
        notes: row.notes,
        student_name: row.portal_users?.full_name ?? 'Unknown',
      }))
    );
  }, [isStudent, profile]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => {
    if (isStudent) {
      loadRecords('');
      setView('records');
    }
  }, [isStudent, loadRecords]);
  useEffect(() => {
    if (selectedClass) loadSessions(selectedClass);
  }, [selectedClass, loadSessions]);
  useEffect(() => {
    if (selectedSession) {
      loadRecords(selectedSession);
      setView('records');
    }
  }, [selectedSession, loadRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedSession) await loadRecords(selectedSession);
    else if (selectedClass) await loadSessions(selectedClass);
    else await loadClasses();
    setRefreshing(false);
  };

  const presentCount = records.filter((record) => record.status === 'present').length;
  const lateCount = records.filter((record) => record.status === 'late').length;
  const absentCount = records.filter((record) => record.status === 'absent').length;

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.warning} size="large" />
        <Text style={styles.loadText}>Loading attendance...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton
          onPress={() => {
            if (view === 'records' && !isStudent) {
              setView('sessions');
              setSelectedSession('');
            } else navigation.goBack();
          }}
          color={COLORS.textPrimary}
          style={styles.backBtn}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>{isStudent ? 'My attendance records' : view === 'sessions' ? 'Select a session' : `${records.length} records`}</Text>
        </View>
        {isTeacher && view === 'sessions' && selectedClass && (
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.MarkAttendance, { classId: selectedClass, className: classes.find((c) => c.id === selectedClass)?.name })}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>+ Take Register</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.primary }]}>{isStudent ? records.length : sessions.length}</Text>
          <Text style={styles.summaryLabel}>{isStudent ? 'Records' : 'Sessions'}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>{presentCount}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.warning }]}>{lateCount}</Text>
          <Text style={styles.summaryLabel}>Late</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.error }]}>{absentCount}</Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.warning} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {!isStudent && !selectedClass && (
          <>
            <Text style={styles.sectionLabel}>Select Class</Text>
            {classes.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>CL</Text>
                <Text style={styles.emptyText}>No classes found.</Text>
              </View>
            ) : (
              classes.map((item, index) => (
                <MotiView key={item.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 40 }}>
                  <TouchableOpacity style={styles.classCard} onPress={() => setSelectedClass(item.id)} activeOpacity={0.8}>
                    <Text style={styles.classIcon}>CL</Text>
                    <Text style={styles.className}>{item.name}</Text>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </>
        )}

        {!isStudent && selectedClass && view === 'sessions' && (
          <>
            <Text style={styles.sectionLabel}>Sessions</Text>
            {sessions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>SS</Text>
                <Text style={styles.emptyText}>No class sessions yet.</Text>
              </View>
            ) : (
              sessions.map((session, index) => (
                <MotiView key={session.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 40 }}>
                  <TouchableOpacity style={styles.sessionCard} onPress={() => setSelectedSession(session.id)} activeOpacity={0.8}>
                    <View>
                      <Text style={styles.sessionDate}>{new Date(session.session_date).toDateString()}</Text>
                      <Text style={styles.sessionTopic}>{session.topic || 'Class session'}{session.start_time ? ` - ${session.start_time}` : ''}</Text>
                    </View>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </>
        )}

        {(isStudent || view === 'records') && (
          <>
            <Text style={styles.sectionLabel}>Records</Text>
            {records.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>AT</Text>
                <Text style={styles.emptyText}>No attendance records.</Text>
              </View>
            ) : (
              records.map((record, index) => {
                const cfg = STATUS_CONFIG[record.status ?? ''] ?? { color: COLORS.textMuted, emoji: '--' };
                return (
                  <MotiView key={record.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 30 }}>
                    <View style={styles.recordCard}>
                      <LinearGradient colors={[cfg.color + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                      <Text style={styles.recordEmoji}>{cfg.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        {!isStudent && <Text style={styles.recordName}>{record.student_name}</Text>}
                        <Text style={styles.recordDate}>{new Date(record.created_at ?? Date.now()).toDateString()}</Text>
                        {record.notes ? <Text style={styles.recordNotes}>{record.notes}</Text> : null}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{record.status ?? 'unknown'}</Text>
                      </View>
                    </View>
                  </MotiView>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.md, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },
  actionBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: '#fff', letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  summaryCard: { width: '48%', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  list: { paddingHorizontal: SPACING.xl },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.sm },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  classIcon: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: COLORS.primary },
  className: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  chevron: { fontSize: 20, color: COLORS.textMuted },
  sessionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  sessionDate: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sessionTopic: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  recordCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  recordEmoji: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: COLORS.textMuted },
  recordName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  recordDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  recordNotes: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 20, fontFamily: FONT_FAMILY.bodyBold, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  status: string;
  notes: string | null;
}

interface AttendanceSession {
  id: string;
  class_id: string;
  date: string;
  topic: string | null;
  created_at: string;
}

interface ClassItem {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { color: string; emoji: string }> = {
  present: { color: COLORS.success, emoji: '✅' },
  absent: { color: COLORS.error, emoji: '❌' },
  late: { color: COLORS.warning, emoji: '⏰' },
  excused: { color: COLORS.info, emoji: '📋' },
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
    if (isStudent) { setLoading(false); return; }
    let q = supabase.from('classes').select('id, name').limit(50);
    if (isTeacher) q = q.eq('teacher_id', profile!.id);
    const { data } = await q;
    if (data) setClasses(data as ClassItem[]);
    setLoading(false);
  }, [profile]);

  const loadSessions = useCallback(async (classId: string) => {
    const { data } = await supabase
      .from('attendance_sessions')
      .select('id, class_id, date, topic, created_at')
      .eq('class_id', classId)
      .order('date', { ascending: false })
      .limit(30);
    if (data) setSessions(data as AttendanceSession[]);
  }, []);

  const loadRecords = useCallback(async (sessionId: string) => {
    // For student: load their own attendance
    if (isStudent) {
      const { data } = await supabase
        .from('attendance_records')
        .select('id, student_id, date, status, notes')
        .eq('student_id', profile!.id)
        .order('date', { ascending: false })
        .limit(50);
      if (data) {
        setRecords((data as any[]).map(r => ({ ...r, student_name: profile!.full_name })));
      }
      return;
    }
    const { data } = await supabase
      .from('attendance_records')
      .select('id, student_id, date, status, notes, portal_users:student_id(full_name)')
      .eq('session_id', sessionId)
      .limit(100);
    if (data) {
      setRecords((data as any[]).map(r => ({
        ...r,
        student_name: r.portal_users?.full_name ?? 'Unknown',
      })));
    }
  }, [profile]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  useEffect(() => {
    if (isStudent) {
      loadRecords('');
      setView('records');
    }
  }, [isStudent]);

  useEffect(() => {
    if (selectedClass) loadSessions(selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    if (selectedSession) { loadRecords(selectedSession); setView('records'); }
  }, [selectedSession]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedSession) await loadRecords(selectedSession);
    else if (selectedClass) await loadSessions(selectedClass);
    else await loadClasses();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.warning} size="large" />
        <Text style={styles.loadText}>Loading attendance…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (view === 'records' && !isStudent) { setView('sessions'); setSelectedSession(''); }
          else navigation.goBack();
        }} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>
            {isStudent ? 'My attendance records' : view === 'sessions' ? 'Select a session' : `${records.length} records`}
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.warning} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {/* Class picker for teacher/admin */}
        {!isStudent && !selectedClass && (
          <>
            <Text style={styles.sectionLabel}>Select Class</Text>
            {classes.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyText}>No classes found.</Text>
              </View>
            ) : (
              classes.map((c, i) => (
                <MotiView key={c.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
                  <TouchableOpacity style={styles.classCard} onPress={() => setSelectedClass(c.id)} activeOpacity={0.8}>
                    <Text style={styles.classIcon}>📚</Text>
                    <Text style={styles.className}>{c.name}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </>
        )}

        {/* Sessions list */}
        {!isStudent && selectedClass && view === 'sessions' && (
          <>
            <Text style={styles.sectionLabel}>Sessions</Text>
            {sessions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.emptyText}>No sessions yet.</Text>
              </View>
            ) : (
              sessions.map((s, i) => (
                <MotiView key={s.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 40 }}>
                  <TouchableOpacity style={styles.sessionCard} onPress={() => setSelectedSession(s.id)} activeOpacity={0.8}>
                    <View>
                      <Text style={styles.sessionDate}>{new Date(s.date).toDateString()}</Text>
                      {s.topic ? <Text style={styles.sessionTopic}>{s.topic}</Text> : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </>
        )}

        {/* Attendance records */}
        {(isStudent || view === 'records') && (
          <>
            <Text style={styles.sectionLabel}>Records</Text>
            {records.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyText}>No attendance records.</Text>
              </View>
            ) : (
              records.map((r, i) => {
                const cfg = STATUS_CONFIG[r.status] ?? { color: COLORS.textMuted, emoji: '❓' };
                return (
                  <MotiView key={r.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 30 }}>
                    <View style={styles.recordCard}>
                      <LinearGradient colors={[cfg.color + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                      <Text style={styles.recordEmoji}>{cfg.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        {!isStudent && <Text style={styles.recordName}>{r.student_name}</Text>}
                        <Text style={styles.recordDate}>{new Date(r.date).toDateString()}</Text>
                        {r.notes ? <Text style={styles.recordNotes}>{r.notes}</Text> : null}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{r.status}</Text>
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
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  list: { paddingHorizontal: SPACING.xl },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.sm },

  classCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  classIcon: { fontSize: 24 },
  className: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  chevron: { fontSize: 20, color: COLORS.textMuted },

  sessionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  sessionDate: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sessionTopic: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  recordCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  recordEmoji: { fontSize: 22 },
  recordName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  recordDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  recordNotes: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

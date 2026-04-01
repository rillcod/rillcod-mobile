
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useHaptics } from '../../hooks/useHaptics';

interface Student {
  id: string;
  full_name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string;
}

export default function MarkAttendanceScreen({ navigation, route }: any) {
  const { classId, className } = route.params;
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { light, success } = useHaptics();

  const [students, setStudents] = useState<Student[]>([]);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('portal_users')
        .select('id, full_name')
        .eq('role', 'student')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      setStudents(((data ?? []) as any[]).map((student) => ({
        id: student.id,
        full_name: student.full_name || 'Unknown Student',
        status: 'present',
        notes: '',
      })));
      setLoading(false);
    };

    fetchStudents();
  }, [classId]);

  const toggleStatus = (id: string) => {
    light();
    setStudents((prev) => prev.map((student) => {
      if (student.id !== id) return student;
      const cycle: Record<Student['status'], Student['status']> = {
        present: 'absent',
        absent: 'late',
        late: 'excused',
        excused: 'present',
      };
      return { ...student, status: cycle[student.status] };
    }));
  };

  const updateNotes = (id: string, notes: string) => {
    setStudents((prev) => prev.map((student) => student.id === id ? { ...student, notes } : student));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionTopic = topic.trim() || `Attendance - ${today}`;

      let sessionId: string | null = null;
      const existingSession = await supabase
        .from('class_sessions')
        .select('id')
        .eq('class_id', classId)
        .eq('session_date', today)
        .maybeSingle();

      if (existingSession.data?.id) {
        sessionId = existingSession.data.id;
      } else {
        const createdSession = await supabase
          .from('class_sessions')
          .insert({
            class_id: classId,
            session_date: today,
            topic: sessionTopic,
            title: sessionTopic,
            description: topic.trim() || null,
            status: 'completed',
            is_active: true,
            start_time: null,
          })
          .select('id')
          .single();

        if (createdSession.error || !createdSession.data) throw createdSession.error;
        sessionId = createdSession.data.id;
      }

      const records = students.map((student) => ({
        session_id: sessionId,
        user_id: student.id,
        student_id: null,
        status: student.status,
        notes: student.notes.trim() || null,
        recorded_by: profile?.id,
      }));

      const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'session_id,user_id' });
      if (error) throw error;

      success();
      Alert.alert('Success', 'Attendance records have been finalized.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const presentCount = students.filter((student) => student.status === 'present').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={className || 'MARK REGISTER'} onBack={() => navigation.goBack()} />
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.primary + '20', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroMeta}>
          <Text style={styles.heroTitle}>{new Date().toDateString().toUpperCase()}</Text>
          <Text style={styles.heroSub}>{presentCount} / {students.length} STUDENTS PRESENT</Text>
        </View>
        <TextInput
          style={styles.topicInput}
          placeholder="LESSON TOPIC (OPTIONAL)..."
          placeholderTextColor={COLORS.textMuted}
          value={topic}
          onChangeText={setTopic}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {students.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>NO STUDENTS REGISTERED IN THIS CLASS.</Text>
          </View>
        ) : (
          students.map((student, index) => {
            const isPresent = student.status === 'present';
            const isAbsent = student.status === 'absent';
            const isLate = student.status === 'late';
            const statusColor = isPresent ? COLORS.success : isAbsent ? COLORS.error : isLate ? COLORS.warning : COLORS.info;

            return (
              <MotiView
                key={student.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 30 }}
                style={[styles.studentCard, { borderColor: statusColor + '40' }]}
              >
                <TouchableOpacity style={styles.cardMain} onPress={() => toggleStatus(student.id)} activeOpacity={0.7}>
                  <View style={[styles.avatar, { backgroundColor: statusColor + '15', borderColor: statusColor }]}>
                    <Text style={[styles.avatarText, { color: statusColor }]}>{student.full_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{student.full_name}</Text>
                    <Text style={[styles.statusText, { color: statusColor }]}>{student.status.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.checkCircle, { borderColor: statusColor, backgroundColor: isPresent ? statusColor : 'transparent' }]}>
                    {isPresent && <Text style={styles.checkIcon}>OK</Text>}
                    {isAbsent && <Text style={styles.checkIcon}>NO</Text>}
                  </View>
                </TouchableOpacity>
                {(isAbsent || isLate) && (
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Add reason/note..."
                    placeholderTextColor={COLORS.textMuted}
                    value={student.notes}
                    onChangeText={(value) => updateNotes(student.id, value)}
                  />
                )}
              </MotiView>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving || students.length === 0}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>FINALIZE ATTENDANCE</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: SPACING.xl, gap: SPACING.md },
  heroMeta: { marginBottom: 4 },
  heroTitle: { fontFamily: FONT_FAMILY.mono, fontSize: 10, letterSpacing: 2, color: COLORS.primaryLight },
  heroSub: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, marginTop: 4 },
  topicInput: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: 12, fontFamily: FONT_FAMILY.mono, fontSize: 11, color: COLORS.textPrimary },
  scroll: { paddingHorizontal: SPACING.xl },
  studentCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderRadius: RADIUS.md, marginBottom: SPACING.md, padding: SPACING.md, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  studentName: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  statusText: { fontFamily: FONT_FAMILY.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  noteInput: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, fontFamily: FONT_FAMILY.body, fontSize: 12, color: COLORS.textSecondary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.xl, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: '#fff', letterSpacing: 2 },
  empty: { alignItems: 'center', paddingVertical: 100 },
  emptyText: { fontFamily: FONT_FAMILY.mono, fontSize: 11, color: COLORS.textMuted },
});

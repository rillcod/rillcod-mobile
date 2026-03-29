import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface School {
  id: string;
  school_name: string;
  school_type: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lga: string | null;
  city: string | null;
  state: string | null;
  status: string;
  rillcod_quota_pct: number | null;
  enrollment_types: string[] | null;
  created_at: string;
}

interface Teacher { id: string; full_name: string; email: string }
interface Student { id: string; full_name: string; email: string; section_class: string | null }

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

export default function SchoolDetailScreen({ navigation, route }: any) {
  const { schoolId } = route.params as { schoolId: string };
  const { profile } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'teachers' | 'students'>('info');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    const [schoolRes, teachersRes, studentsRes] = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('portal_users').select('id, full_name, email').eq('role', 'teacher').eq('school_id', schoolId).limit(50),
      supabase.from('portal_users').select('id, full_name, email, section_class').eq('role', 'student').eq('school_id', schoolId).limit(100),
    ]);
    if (schoolRes.data) setSchool(schoolRes.data as School);
    if (teachersRes.data) setTeachers(teachersRes.data as Teacher[]);
    if (studentsRes.data) setStudents(studentsRes.data as Student[]);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateStatus = async (status: 'approved' | 'rejected') => {
    if (!school) return;
    Alert.alert(
      `${status === 'approved' ? 'Approve' : 'Reject'} School`,
      `Are you sure you want to ${status} "${school.school_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            await supabase.from('schools').update({ status }).eq('id', schoolId);
            setSchool(s => s ? { ...s, status } : s);
          },
        },
      ]
    );
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
      <ScreenHeader title={school.school_name} onBack={() => navigation.goBack()} accentColor={statusColor} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.info} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.hero}>
          <LinearGradient colors={[COLORS.info + '18', 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroIcon}>
            <Text style={{ fontSize: 34 }}>🏫</Text>
          </View>
          <Text style={styles.heroName}>{school.school_name}</Text>
          {school.school_type ? <Text style={styles.heroType}>{school.school_type}</Text> : null}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{school.status.toUpperCase()}</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Teachers', value: teachers.length },
              { label: 'Students', value: students.length },
              { label: 'Quota', value: school.rillcod_quota_pct != null ? `${school.rillcod_quota_pct}%` : '—' },
            ].map(stat => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </MotiView>

        {/* Admin action buttons */}
        {isAdmin && school.status !== 'approved' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => updateStatus('approved')}>
              <Text style={styles.actionBtnText}>✅ Approve</Text>
            </TouchableOpacity>
            {school.status !== 'rejected' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.error }]} onPress={() => updateStatus('rejected')}>
                <Text style={styles.actionBtnText}>✕ Reject</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['info', 'teachers', 'students'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t === 'info' ? 'Info' : t === 'teachers' ? `Teachers (${teachers.length})` : `Students (${students.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'info' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.infoCard}>
              <LinearGradient colors={[COLORS.bgCard, 'transparent']} style={StyleSheet.absoluteFill} />
              <InfoRow label="Contact Person" value={school.contact_person} />
              <InfoRow label="Email" value={school.email} />
              <InfoRow label="Phone" value={school.phone} />
              <InfoRow label="Address" value={school.address} />
              <InfoRow label="LGA" value={school.lga} />
              <InfoRow label="City" value={school.city} />
              <InfoRow label="State" value={school.state} />
              {school.enrollment_types && school.enrollment_types.length > 0 && (
                <View style={info.row}>
                  <Text style={info.label}>Enrollment Types</Text>
                  <Text style={info.value}>{school.enrollment_types.join(', ')}</Text>
                </View>
              )}
              <InfoRow label="Joined" value={new Date(school.created_at).toLocaleDateString('en-GB')} />
            </MotiView>
          )}

          {activeTab === 'teachers' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {teachers.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>👩‍🏫</Text>
                  <Text style={styles.emptyText}>No teachers assigned yet.</Text>
                </View>
              ) : (
                teachers.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.personCard}
                    onPress={() => navigation.navigate('TeacherDetail', { teacherId: t.id })}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={['#7c3aed18', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.personAvatar, { backgroundColor: '#7c3aed30' }]}>
                      <Text style={styles.personAvatarText}>{(t.full_name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{t.full_name}</Text>
                      <Text style={styles.personEmail}>{t.email}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </MotiView>
          )}

          {activeTab === 'students' && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {students.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyText}>No students registered yet.</Text>
                </View>
              ) : (
                students.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.personCard}
                    onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[COLORS.admin + '18', 'transparent']} style={StyleSheet.absoluteFill} />
                    <View style={[styles.personAvatar, { backgroundColor: COLORS.admin + '30' }]}>
                      <Text style={styles.personAvatarText}>{(s.full_name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{s.full_name}</Text>
                      <Text style={styles.personEmail}>{s.email}</Text>
                      {s.section_class ? <Text style={styles.personSub}>{s.section_class}</Text> : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </MotiView>
          )}
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
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

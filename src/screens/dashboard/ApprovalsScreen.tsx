import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type Tab = 'students' | 'schools' | 'prospective';

interface PendingStudent {
  id: string;
  full_name: string;
  student_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  school_name: string | null;
  current_class: string | null;
  grade_level: string | null;
  enrollment_type: string | null;
  created_at: string;
  status: string;
}

interface PendingSchool {
  id: string;
  school_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  contact_person: string | null;
  student_count: number | null;
  school_type: string | null;
  status: string;
  created_at: string;
}

interface ProspectiveStudent {
  id: string;
  full_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  school_name: string | null;
  grade: string | null;
  course_interest: string | null;
  created_at: string;
}

interface Credentials { email: string; password: string; name: string }

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Credentials Modal ────────────────────────────────────────────────────────
function CredentialsModal({ creds, onDone }: { creds: Credentials; onDone: () => void }) {
  return (
    <View style={modal.overlay}>
      <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={modal.box}>
        <LinearGradient colors={[COLORS.success + '15', 'transparent']} style={StyleSheet.absoluteFill} />
        <Text style={modal.icon}>✅</Text>
        <Text style={modal.title}>Approved!</Text>
        <Text style={modal.name}>{creds.name}</Text>
        <View style={modal.credRow}>
          <Text style={modal.credLabel}>Email</Text>
          <Text style={modal.credValue} selectable>{creds.email}</Text>
        </View>
        <View style={[modal.credRow, modal.pwRow]}>
          <Text style={modal.credLabel}>Temp Password</Text>
          <Text style={[modal.credValue, { color: COLORS.success }]} selectable>{creds.password}</Text>
        </View>
        <Text style={modal.note}>⚠ Note these credentials — they won't be shown again.</Text>
        <TouchableOpacity onPress={onDone} style={modal.doneBtn}>
          <Text style={modal.doneBtnText}>Done — I've noted the credentials</Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ApprovalsScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [schools, setSchools] = useState<PendingSchool[]>([]);
  const [prospective, setProspective] = useState<ProspectiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const load = useCallback(async () => {
    const [stuRes, schRes, proRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, student_email, parent_name, parent_phone, school_name, current_class, grade_level, enrollment_type, created_at, status')
        .eq('status', 'pending')
        .is('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('schools')
        .select('id, school_name, email, phone, city, state, contact_person, student_count, school_type, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('prospective_students')
        .select('id, full_name, parent_email, parent_phone, school_name, grade, course_interest, created_at')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (stuRes.data) setStudents(stuRes.data as PendingStudent[]);
    if (schRes.data) setSchools(schRes.data as PendingSchool[]);
    if (proRes.data) setProspective(proRes.data as ProspectiveStudent[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Student approval ──────────────────────────────────────────────────────
  const approveStudent = (s: PendingStudent) => {
    Alert.alert('Approve Student', `Approve ${s.full_name} and create portal account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(s.id);
          const email = s.student_email ?? `student_${s.id.slice(0, 6)}@rillcod.school`;
          const password = genPassword();

          await supabase.from('students').update({ status: 'approved' }).eq('id', s.id);
          // Create portal account
          await supabase.from('portal_users').upsert({
            email,
            full_name: s.full_name,
            role: 'student',
            is_active: true,
            school_name: s.school_name,
            section_class: s.current_class,
          }, { onConflict: 'email' });

          setStudents(p => p.filter(u => u.id !== s.id));
          setCredentials({ email, password, name: s.full_name });
          setProcessing(null);
        },
      },
    ]);
  };

  const rejectStudent = (s: PendingStudent) => {
    Alert.alert('Reject Student', `Reject ${s.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(s.id);
          await supabase.from('students').update({ status: 'rejected' }).eq('id', s.id);
          setStudents(p => p.filter(u => u.id !== s.id));
          setProcessing(null);
        },
      },
    ]);
  };

  // ── School approval ───────────────────────────────────────────────────────
  const approveSchool = (s: PendingSchool) => {
    Alert.alert('Approve School', `Approve ${s.school_name} and create account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(s.id);
          const email = s.email ?? `school_${s.id.slice(0, 6)}@rillcod.school`;
          const password = genPassword();

          await supabase.from('schools').update({ status: 'approved' }).eq('id', s.id);
          await supabase.from('portal_users').upsert({
            email,
            full_name: s.contact_person ?? s.school_name,
            role: 'school',
            is_active: true,
            school_name: s.school_name,
          }, { onConflict: 'email' });

          setSchools(p => p.filter(u => u.id !== s.id));
          setCredentials({ email, password, name: s.school_name });
          setProcessing(null);
        },
      },
    ]);
  };

  const rejectSchool = (s: PendingSchool) => {
    Alert.alert('Reject School', `Reject ${s.school_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(s.id);
          await supabase.from('schools').update({ status: 'rejected' }).eq('id', s.id);
          setSchools(p => p.filter(u => u.id !== s.id));
          setProcessing(null);
        },
      },
    ]);
  };

  // ── Prospective approval ──────────────────────────────────────────────────
  const approveProspective = (p: ProspectiveStudent) => {
    Alert.alert('Accept Prospective', `Accept ${p.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setProcessing(p.id);
          await supabase.from('prospective_students').update({ is_active: true }).eq('id', p.id);
          setProspective(prev => prev.filter(u => u.id !== p.id));
          setProcessing(null);
        },
      },
    ]);
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'students', label: 'Students', count: students.length },
    { key: 'schools', label: 'Schools', count: schools.length },
    { key: 'prospective', label: 'Prospective', count: prospective.length },
  ];

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.success} size="large" />
        <Text style={styles.loadText}>Loading approvals…</Text>
      </View>
    );
  }

  const totalPending = students.length + schools.length + prospective.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Approvals"
        subtitle={`${totalPending} pending`}
        onBack={() => navigation.goBack()}
        accentColor={COLORS.success}
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {t.count > 0 && (
              <View style={[styles.tabBadge, tab === t.key && styles.tabBadgeActive]}>
                <Text style={styles.tabBadgeText}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.success} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {/* ── Students tab ── */}
        {tab === 'students' && (
          students.length === 0 ? (
            <EmptyState emoji="✅" message="No pending student applications." />
          ) : (
            students.map((s, i) => (
              <MotiView key={s.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.success + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardRow}>
                    <View style={styles.iconWrap}>
                      <Text style={{ fontSize: 24 }}>👨‍🎓</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.full_name}</Text>
                      {s.student_email ? <Text style={styles.email}>{s.student_email}</Text> : null}
                    </View>
                    <Text style={styles.time}>{timeAgo(s.created_at)}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {s.school_name ? <Chip label={`🏫 ${s.school_name}`} /> : null}
                    {s.current_class ? <Chip label={`📚 ${s.current_class}`} /> : null}
                    {s.grade_level ? <Chip label={s.grade_level} /> : null}
                    {s.enrollment_type ? <Chip label={s.enrollment_type} color={COLORS.info} /> : null}
                  </View>
                  {(s.parent_name || s.parent_phone) ? (
                    <Text style={styles.parentInfo}>
                      👨‍👩‍👧 {s.parent_name}{s.parent_phone ? ` · ${s.parent_phone}` : ''}
                    </Text>
                  ) : null}
                  <ApproveRejectRow
                    processing={processing === s.id}
                    onApprove={() => approveStudent(s)}
                    onReject={() => rejectStudent(s)}
                  />
                </View>
              </MotiView>
            ))
          )
        )}

        {/* ── Schools tab ── */}
        {tab === 'schools' && (
          schools.length === 0 ? (
            <EmptyState emoji="✅" message="No pending school applications." />
          ) : (
            schools.map((s, i) => (
              <MotiView key={s.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.info + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardRow}>
                    <View style={[styles.iconWrap, { backgroundColor: COLORS.info + '15' }]}>
                      <Text style={{ fontSize: 24 }}>🏫</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.school_name}</Text>
                      {s.email ? <Text style={styles.email}>{s.email}</Text> : null}
                    </View>
                    <Text style={styles.time}>{timeAgo(s.created_at)}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {s.city ? <Chip label={`📍 ${s.city}${s.state ? `, ${s.state}` : ''}`} /> : null}
                    {s.school_type ? <Chip label={s.school_type} color={COLORS.info} /> : null}
                    {s.student_count ? <Chip label={`👥 ${s.student_count} students`} /> : null}
                  </View>
                  {s.contact_person ? <Text style={styles.parentInfo}>👤 Contact: {s.contact_person}</Text> : null}
                  {s.phone ? <Text style={styles.parentInfo}>📞 {s.phone}</Text> : null}
                  <ApproveRejectRow
                    processing={processing === s.id}
                    onApprove={() => approveSchool(s)}
                    onReject={() => rejectSchool(s)}
                    approveLabel="Approve & Create Account"
                  />
                </View>
              </MotiView>
            ))
          )
        )}

        {/* ── Prospective tab ── */}
        {tab === 'prospective' && (
          prospective.length === 0 ? (
            <EmptyState emoji="✅" message="No prospective applications." />
          ) : (
            prospective.map((p, i) => (
              <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }}>
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.gold + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardRow}>
                    <View style={[styles.iconWrap, { backgroundColor: COLORS.gold + '15' }]}>
                      <Text style={{ fontSize: 24 }}>🌟</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{p.full_name}</Text>
                      {p.parent_email ? <Text style={styles.email}>{p.parent_email}</Text> : null}
                    </View>
                    <Text style={styles.time}>{timeAgo(p.created_at)}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {p.school_name ? <Chip label={`🏫 ${p.school_name}`} /> : null}
                    {p.grade ? <Chip label={`Grade: ${p.grade}`} /> : null}
                    {p.course_interest ? <Chip label={`📖 ${p.course_interest}`} color={COLORS.gold} /> : null}
                  </View>
                  {p.parent_phone ? <Text style={styles.parentInfo}>📞 {p.parent_phone}</Text> : null}
                  <TouchableOpacity
                    onPress={() => approveProspective(p)}
                    disabled={processing === p.id}
                    style={[styles.acceptBtn, processing === p.id && styles.btnDisabled]}
                  >
                    {processing === p.id
                      ? <ActivityIndicator color={COLORS.white100} size="small" />
                      : <Text style={styles.acceptText}>✓ Accept Application</Text>}
                  </TouchableOpacity>
                </View>
              </MotiView>
            ))
          )
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Credentials overlay */}
      {credentials && (
        <CredentialsModal creds={credentials} onDone={() => setCredentials(null)} />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[chip.wrap, color ? { backgroundColor: color + '18' } : {}]}>
      <Text style={[chip.text, color ? { color } : {}]}>{label}</Text>
    </View>
  );
}

function ApproveRejectRow({ processing, onApprove, onReject, approveLabel = 'Approve' }: {
  processing: boolean; onApprove: () => void; onReject: () => void; approveLabel?: string;
}) {
  return (
    <View style={arr.row}>
      <TouchableOpacity onPress={onReject} disabled={processing} style={[arr.rejectBtn, processing && styles.btnDisabled]}>
        <Text style={arr.rejectText}>✕ Reject</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onApprove} disabled={processing} style={[arr.approveBtn, processing && styles.btnDisabled]}>
        {processing
          ? <ActivityIndicator color={COLORS.white100} size="small" />
          : <Text style={arr.approveText}>✓ {approveLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
});

const arr = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  rejectBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + '50', alignItems: 'center' },
  rejectText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.error },
  approveBtn: { flex: 2, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  approveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
});

const modal = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, zIndex: 99 },
  box: { width: '100%', maxWidth: 380, borderWidth: 1, borderColor: COLORS.success + '40', borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.sm, overflow: 'hidden', alignItems: 'center', backgroundColor: COLORS.bg },
  icon: { fontSize: 40, marginBottom: 4 },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  name: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  credRow: { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4, backgroundColor: COLORS.bgCard },
  pwRow: { borderColor: COLORS.success + '40' },
  credLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  note: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: 'center' },
  doneBtn: { width: '100%', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center' },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  tabBar: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: COLORS.bgCard },
  tabBtnActive: { backgroundColor: COLORS.success + '20' },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.success },
  tabBadge: { backgroundColor: COLORS.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: COLORS.success },
  tabBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: COLORS.white100 },

  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', gap: SPACING.sm },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  iconWrap: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.success + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  email: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  time: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, flexShrink: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  parentInfo: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  acceptBtn: { paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  acceptText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  btnDisabled: { opacity: 0.5 },

  emptyWrap: { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

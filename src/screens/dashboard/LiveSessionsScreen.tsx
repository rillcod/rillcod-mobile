import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
type FilterTab = 'upcoming' | 'live' | 'past' | 'all';

interface Program { id: string; name: string; }

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: SessionStatus;
  program_id: string | null;
  created_at: string;
  programs?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  live:      COLORS.error,
  scheduled: COLORS.info,
  completed: COLORS.textMuted,
  cancelled: COLORS.error,
};

const STATUS_LABELS: Record<string, string> = {
  live: '● LIVE', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled',
};

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'live',     label: 'Live' },
  { key: 'past',     label: 'Past' },
  { key: 'all',      label: 'All' },
];

export default function LiveSessionsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formProgramId, setFormProgramId] = useState('');
  const [saving, setSaving] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title, description, scheduled_at, status, program_id, created_at, programs(name)')
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      setSessions((data ?? []) as unknown as LiveSession[]);
      const { data: progs } = await supabase.from('programs').select('id, name').order('name');
      setPrograms((progs ?? []) as Program[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = sessions.filter(s => {
    if (tab === 'all') return true;
    if (tab === 'live') return s.status === 'live';
    if (tab === 'upcoming') return s.status === 'scheduled';
    if (tab === 'past') return s.status === 'completed' || s.status === 'cancelled';
    return true;
  });

  const handleSave = async () => {
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    if (!formDate.trim()) { Alert.alert('Validation', 'Date/time is required'); return; }

    // Parse DD/MM/YYYY HH:MM
    let scheduledAt: string;
    try {
      const [datePart, timePart] = formDate.trim().split(' ');
      const [d, m, y] = datePart.split('/');
      const [h, min] = (timePart ?? '00:00').split(':');
      scheduledAt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(min, 10)).toISOString();
    } catch {
      Alert.alert('Validation', 'Invalid date format. Use DD/MM/YYYY HH:MM'); return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('live_sessions').insert({
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        scheduled_at: scheduledAt,
        program_id: formProgramId || null,
        status: 'scheduled',
        created_by: profile?.id,
      });
      if (error) throw error;
      setShowModal(false);
      setFormTitle(''); setFormDesc(''); setFormDate(''); setFormProgramId('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }: { item: LiveSession; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] ?? COLORS.textMuted;
    const isLive = item.status === 'live';
    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 40, type: 'timing', duration: 300 }}
      >
        <View style={[styles.card, isLive && styles.cardLive]}>
          <View style={styles.cardHeader}>
            <View style={styles.statusRow}>
              {isLive ? (
                <MotiView
                  from={{ opacity: 0.3 }}
                  animate={{ opacity: 1 }}
                  transition={{ loop: true, type: 'timing', duration: 800 }}
                  style={[styles.liveDot, { backgroundColor: COLORS.error }]}
                />
              ) : null}
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            {item.programs && (
              <View style={styles.programChip}>
                <Text style={styles.programChipText}>{(item.programs as any).name}</Text>
              </View>
            )}
          </View>
          <Text style={styles.sessionTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.sessionDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <Text style={styles.sessionTime}>📅 {formatDateTime(item.scheduled_at)}</Text>
        </View>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Sessions</Text>
        {isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
              <Text style={styles.addBtnText}>+ Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map(t => {
          const count = t.key === 'all' ? sessions.length
            : t.key === 'live' ? sessions.filter(s => s.status === 'live').length
            : t.key === 'upcoming' ? sessions.filter(s => s.status === 'scheduled').length
            : sessions.filter(s => s.status === 'completed' || s.status === 'cancelled').length;
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && { color: COLORS.primaryLight }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyTitle}>No sessions found</Text>
          <Text style={styles.emptySubtitle}>
            {tab === 'live' ? 'No sessions are currently live' : 'Check back later'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40, paddingTop: SPACING.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Schedule Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Schedule Session</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="Session title" placeholderTextColor={COLORS.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="What will be covered?" placeholderTextColor={COLORS.textMuted}
                value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={3} />

              <Text style={styles.label}>Date & Time * (DD/MM/YYYY HH:MM)</Text>
              <TextInput style={styles.input} placeholder="e.g. 15/08/2025 14:00" placeholderTextColor={COLORS.textMuted}
                value={formDate} onChangeText={setFormDate} />

              <Text style={styles.label}>Program</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                <TouchableOpacity
                  style={[styles.programPill, !formProgramId && styles.programPillActive]}
                  onPress={() => setFormProgramId('')}
                >
                  <Text style={[styles.programPillText, !formProgramId && styles.programPillTextActive]}>None</Text>
                </TouchableOpacity>
                {programs.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.programPill, formProgramId === p.id && styles.programPillActive]}
                    onPress={() => setFormProgramId(p.id)}
                  >
                    <Text style={[styles.programPillText, formProgramId === p.id && styles.programPillTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Schedule</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  addBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  addBtnInner: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addBtnText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
  tabsScroll: { maxHeight: 52 },
  tabsContent: { paddingHorizontal: SPACING.base, gap: SPACING.sm, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  tabText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primaryLight },
  tabBadge: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: COLORS.primaryPale },
  tabBadgeText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  cardLive: { borderColor: COLORS.error, backgroundColor: 'rgba(239,68,68,0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, textTransform: 'uppercase', letterSpacing: 0.5 },
  programChip: { backgroundColor: COLORS.primaryPale, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  programChipText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.primaryLight },
  sessionTitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: 6 },
  sessionDesc: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary, marginBottom: 8 },
  sessionTime: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  programPill: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginRight: SPACING.sm },
  programPillActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  programPillText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  programPillTextActive: { color: COLORS.primaryLight, fontFamily: FONT_FAMILY.bodySemi },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

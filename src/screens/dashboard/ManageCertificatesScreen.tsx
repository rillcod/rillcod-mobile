import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Certificate {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  issued_at: string;
  issued_by: string | null;
  is_revoked: boolean;
  portal_users?: { full_name: string; email: string } | null;
}

interface StudentOption { id: string; full_name: string; email: string; }

type FilterTab = 'all' | 'active' | 'revoked';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManageCertificatesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form
  const [formStudentId, setFormStudentId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('id, user_id, title, description, issued_at, issued_by, is_revoked, portal_users!certificates_user_id_fkey(full_name, email)')
        .order('issued_at', { ascending: false });
      if (error) throw error;
      setCerts((data ?? []) as unknown as Certificate[]);

      if (isAdmin) {
        const { data: studs } = await supabase
          .from('portal_users')
          .select('id, full_name, email')
          .eq('role', 'student')
          .order('full_name');
        setStudents((studs ?? []) as StudentOption[]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleRevoke = (cert: Certificate) => {
    Alert.alert(
      'Revoke Certificate',
      `Revoke "${cert.title}" for ${(cert.portal_users as any)?.full_name ?? 'this student'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('certificates').update({ is_revoked: true }).eq('id', cert.id);
            if (error) { Alert.alert('Error', error.message); return; }
            setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, is_revoked: true } : c));
          },
        },
      ]
    );
  };

  const handleIssue = async () => {
    if (!formStudentId) { Alert.alert('Validation', 'Please select a student'); return; }
    if (!formTitle.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('certificates').insert({
        user_id: formStudentId,
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        issued_by: profile?.id,
        issued_at: new Date().toISOString(),
        is_revoked: false,
      });
      if (error) throw error;
      setShowModal(false);
      setFormStudentId(''); setFormTitle(''); setFormDesc('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = certs.filter(c => {
    const matchFilter = filter === 'all' || (filter === 'active' && !c.is_revoked) || (filter === 'revoked' && c.is_revoked);
    const studentName = (c.portal_users as any)?.full_name ?? '';
    const matchSearch = !search || studentName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalIssued = certs.length;
  const activeCount = certs.filter(c => !c.is_revoked).length;
  const revokedCount = certs.filter(c => c.is_revoked).length;

  const renderItem = ({ item, index }: { item: Certificate; index: number }) => {
    const student = item.portal_users as any;
    return (
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35, type: 'timing', duration: 260 }}
      >
        <TouchableOpacity
          style={[styles.card, item.is_revoked && styles.cardRevoked]}
          onLongPress={() => !item.is_revoked && isAdmin && handleRevoke(item)}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <LinearGradient
              colors={item.is_revoked ? ['rgba(239,68,68,0.1)', 'rgba(239,68,68,0.05)'] : COLORS.gradGold}
              style={styles.certIcon}
            >
              <Text style={styles.certIconText}>{item.is_revoked ? '🚫' : '🏅'}</Text>
            </LinearGradient>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.certTitle} numberOfLines={1}>{item.title}</Text>
              {item.is_revoked && (
                <View style={styles.revokedBadge}>
                  <Text style={styles.revokedText}>Revoked</Text>
                </View>
              )}
            </View>
            {student?.full_name && (
              <Text style={styles.studentName}>{student.full_name}</Text>
            )}
            <Text style={styles.certDate}>Issued {formatDate(item.issued_at)}</Text>
            {item.description && (
              <Text style={styles.certDesc} numberOfLines={1}>{item.description}</Text>
            )}
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Certificates</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.addBtnInner}>
              <Text style={styles.addBtnText}>+ Issue</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total', value: totalIssued, color: COLORS.textPrimary },
          { label: 'Active', value: activeCount, color: COLORS.success },
          { label: 'Revoked', value: revokedCount, color: COLORS.error },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'revoked'] as FilterTab[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏅</Text>
          <Text style={styles.emptyTitle}>No certificates found</Text>
          <Text style={styles.emptySubtitle}>
            {isAdmin ? 'Issue a certificate to get started' : 'Certificates you receive will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: 40, paddingTop: SPACING.xs }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isAdmin ? <Text style={styles.hint}>Long press a certificate to revoke it</Text> : null
          }
        />
      )}

      {/* Issue Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Issue Certificate</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Select Student *</Text>
              <ScrollView style={styles.studentList} nestedScrollEnabled>
                {students.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.studentOption, formStudentId === s.id && styles.studentOptionActive]}
                    onPress={() => setFormStudentId(s.id)}
                  >
                    <View style={[styles.studentOptionDot, { backgroundColor: formStudentId === s.id ? COLORS.success : COLORS.border }]} />
                    <View>
                      <Text style={[styles.studentOptionName, formStudentId === s.id && { color: COLORS.textPrimary }]}>{s.full_name}</Text>
                      <Text style={styles.studentOptionEmail}>{s.email}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Certificate Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Python Fundamentals Certificate" placeholderTextColor={COLORS.textMuted}
                value={formTitle} onChangeText={setFormTitle} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Certificate description..." placeholderTextColor={COLORS.textMuted}
                value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={3} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleIssue} disabled={saving}>
                  <LinearGradient colors={COLORS.gradPrimary} style={styles.saveBtnInner}>
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Issue Certificate</Text>}
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
  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  statNum: { fontSize: FONT_SIZE.xl, fontFamily: FONT_FAMILY.display },
  statLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.base, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 14, marginRight: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.sm },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primaryLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.md },
  cardRevoked: { opacity: 0.65, borderColor: COLORS.error + '40' },
  cardLeft: {},
  certIcon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  certIconText: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  certTitle: { flex: 1, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },
  revokedBadge: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  revokedText: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.error },
  studentName: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 2 },
  certDate: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, marginBottom: 2 },
  certDesc: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  hint: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xl },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0f0f1a', borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  studentList: { maxHeight: 180, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard },
  studentOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  studentOptionActive: { backgroundColor: 'rgba(16,185,129,0.08)' },
  studentOptionDot: { width: 10, height: 10, borderRadius: 5 },
  studentOptionName: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textSecondary },
  studentOptionEmail: { fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },
  saveBtn: { flex: 2, borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveBtnInner: { padding: SPACING.md, alignItems: 'center' },
  saveBtnText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
});

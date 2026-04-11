import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { parentService } from '../../services/parent.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';
import { ROUTES } from '../../navigation/routes';

interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
  child_count?: number;
  approved_children?: number;
}

interface ParentFormState {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  is_active: boolean;
}

const EMPTY_FORM: ParentFormState = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  is_active: true,
};

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function ParentModal({
  visible,
  parent,
  onClose,
  onSaved,
}: {
  visible: boolean;
  parent: Parent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ParentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parent) {
      setForm({
        full_name: parent.full_name,
        email: parent.email,
        phone: parent.phone || '',
        password: '',
        is_active: parent.is_active,
      });
    } else {
      setForm({ ...EMPTY_FORM, password: generatePassword() });
    }
  }, [parent, visible]);

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      Alert.alert('Required', 'Full name and email are required.');
      return;
    }

    setSaving(true);
    try {
      const nextEmail = form.email.trim().toLowerCase();
      const nextName = form.full_name.trim();
      const nextPhone = form.phone.trim() || null;

      if (parent) {
        const oldEmail = parent.email;
        const oldName = parent.full_name;
        const oldPhone = parent.phone;

        await parentService.updateParentPortalProfile({
          parentId: parent.id,
          full_name: nextName,
          email: nextEmail,
          phone: nextPhone,
          is_active: form.is_active,
        });

        if (oldEmail !== nextEmail || oldName !== nextName || oldPhone !== nextPhone) {
          await parentService.syncStudentsParentContactByOldEmail({
            oldEmail,
            newEmail: nextEmail,
            newName: nextName,
            newPhone: nextPhone,
          });
        }
      } else {
        const password = form.password || generatePassword();
        await parentService.signUpParentAndUpsertPortal({
          email: nextEmail,
          password,
          full_name: nextName,
          phone: nextPhone,
          is_active: form.is_active,
        });

        Alert.alert('Parent created', `Temporary password: ${password}`);
      }

      onSaved();
      onClose();
    } catch (error: any) {
      Alert.alert('Save failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{parent ? 'Edit Parent' : 'Add Parent'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeText}>X</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalStyles.label}>Full Name *</Text>
            <TextInput
              style={modalStyles.input}
              value={form.full_name}
              onChangeText={(value) => setForm((current) => ({ ...current, full_name: value }))}
              placeholder="Parent full name"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[modalStyles.label, { marginTop: SPACING.md }]}>Email *</Text>
            <TextInput
              style={modalStyles.input}
              value={form.email}
              onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="parent@example.com"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[modalStyles.label, { marginTop: SPACING.md }]}>Phone</Text>
            <TextInput
              style={modalStyles.input}
              value={form.phone}
              onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))}
              keyboardType="phone-pad"
              placeholder="+234..."
              placeholderTextColor={COLORS.textMuted}
            />

            {!parent ? (
              <>
                <View style={modalStyles.labelRow}>
                  <Text style={[modalStyles.label, { marginTop: SPACING.md }]}>Temporary Password</Text>
                  <TouchableOpacity onPress={() => setForm((current) => ({ ...current, password: generatePassword() }))}>
                    <Text style={modalStyles.regen}>Regenerate</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={modalStyles.input}
                  value={form.password}
                  onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                  autoCapitalize="none"
                  placeholder="Generated password"
                  placeholderTextColor={COLORS.textMuted}
                />
              </>
            ) : null}

            <View style={modalStyles.switchRow}>
              <Text style={modalStyles.label}>Active Account</Text>
              <Switch value={form.is_active} onValueChange={(value) => setForm((current) => ({ ...current, is_active: value }))} />
            </View>

            <TouchableOpacity onPress={save} disabled={saving} style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}>
              <LinearGradient colors={[COLORS.gold, COLORS.primary]} style={modalStyles.saveGradient}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={modalStyles.saveText}>{parent ? 'Save Parent' : 'Create Parent'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ParentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const canManage = profile?.role === 'admin' || profile?.role === 'teacher';
  const [parents, setParents] = useState<Parent[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await parentService.listParentsDirectoryWithChildStats(200);
      setParents(rows as Parent[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parents.filter((parent) => {
      const matchesSearch =
        !term ||
        parent.full_name.toLowerCase().includes(term) ||
        parent.email.toLowerCase().includes(term) ||
        (parent.phone || '').toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? parent.is_active : !parent.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [parents, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: parents.length,
      active: parents.filter((parent) => parent.is_active).length,
      inactive: parents.filter((parent) => !parent.is_active).length,
      linkedChildren: parents.reduce((sum, parent) => sum + (parent.child_count ?? 0), 0),
    }),
    [parents]
  );

  const toggleActive = async (parent: Parent) => {
    Alert.alert(parent.is_active ? 'Deactivate Parent' : 'Activate Parent', parent.full_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: parent.is_active ? 'Deactivate' : 'Activate',
        onPress: async () => {
          try {
            await parentService.toggleParentPortalActive(parent.id, !parent.is_active);
            load();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  };

  const deleteParent = async (parent: Parent) => {
    Alert.alert('Delete Parent', `Delete ${parent.full_name} and unlink their children?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await parentService.unlinkStudentsByParentEmail(parent.email);
          try {
            await parentService.deleteParentPortalUser(parent.id);
            load();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Parents"
        subtitle={`${parents.length} parent accounts`}
        onBack={() => navigation.goBack()}
        primaryAction={canManage ? { label: 'Add', onPress: () => { setEditingParent(null); setModalVisible(true); } } : undefined}
        colors={COLORS}
      />

      <View style={styles.summaryStrip}>
        {[
          { label: 'Total', value: stats.total, color: COLORS.gold },
          { label: 'Active', value: stats.active, color: COLORS.success },
          { label: 'Inactive', value: stats.inactive, color: COLORS.error },
          { label: 'Children', value: stats.linkedChildren, color: COLORS.info },
        ].map((item) => (
          <View key={item.label} style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search parents..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all', 'active', 'inactive'] as const).map((filter) => {
          const selected = statusFilter === filter;
          return (
            <TouchableOpacity key={filter} onPress={() => setStatusFilter(filter)} style={[styles.filterPill, selected && styles.filterPillActive]}>
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>PR</Text>
            <Text style={styles.emptyText}>No parents found.</Text>
          </View>
        ) : (
          filtered.map((parent, index) => (
            <MotiView key={parent.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 30 }}>
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardMain} activeOpacity={0.85} onPress={() => navigation.navigate(ROUTES.ParentDetail, { parentId: parent.id })}>
                  <LinearGradient colors={[`${COLORS.gold}10`, 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(parent.full_name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardName}>{parent.full_name}</Text>
                    <Text style={styles.cardEmail}>{parent.email}</Text>
                    {parent.phone ? <Text style={styles.cardEmail}>{parent.phone}</Text> : null}
                    <View style={styles.metaRow}>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>{parent.child_count ?? 0} children</Text>
                      </View>
                      {(parent.approved_children ?? 0) > 0 ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{parent.approved_children} approved</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.sideRail}>
                    <View style={[styles.statusPill, { backgroundColor: parent.is_active ? `${COLORS.success}20` : `${COLORS.error}20` }]}>
                      <Text style={[styles.statusPillText, { color: parent.is_active ? COLORS.success : COLORS.error }]}>
                        {parent.is_active ? 'LIVE' : 'OFF'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {canManage ? (
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => navigation.navigate(ROUTES.ParentDetail, { parentId: parent.id })} style={styles.cardAction}>
                      <Text style={styles.cardActionText}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingParent(parent); setModalVisible(true); }} style={styles.cardAction}>
                      <Text style={styles.cardActionText}>Edit</Text>
                    </TouchableOpacity>
                    {isAdmin ? (
                      <TouchableOpacity onPress={() => toggleActive(parent)} style={styles.cardAction}>
                        <Text style={styles.cardActionText}>{parent.is_active ? 'Deactivate' : 'Activate'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {isAdmin ? (
                      <TouchableOpacity onPress={() => deleteParent(parent)} style={styles.cardActionDanger}>
                        <Text style={styles.cardActionDangerText}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </MotiView>
          ))
        )}
        <View style={{ height: 36 }} />
      </ScrollView>

      <ParentModal
        visible={modalVisible}
        parent={editingParent}
        onClose={() => setModalVisible(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  sheetTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  closeText: { color: COLORS.textMuted, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  regen: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  input: { marginTop: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 9, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xl },
  saveBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  saveGradient: { paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md, flexWrap: 'wrap' },
  summaryCard: { width: '23%', minWidth: 72, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  summaryLabel: { marginTop: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, textTransform: 'uppercase' },
  filters: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterPillActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}18` },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: LETTER_SPACING.wide },
  filterTextActive: { color: COLORS.gold },
  list: { paddingHorizontal: SPACING.xl },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${COLORS.gold}22`, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.gold },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  metaRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  metaChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  metaChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  sideRail: { alignItems: 'flex-end' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  statusPillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, flexWrap: 'wrap' },
  cardAction: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  cardActionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  cardActionDanger: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: `${COLORS.error}14` },
  cardActionDangerText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

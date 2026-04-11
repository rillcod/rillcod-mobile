import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform, Alert, Dimensions,
} from 'react-native';
const { width } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { portalUserAdminService } from '../../services/portal-user-admin.service';
import { schoolService } from '../../services/school.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { RoleGuard } from '../../components/ui/RoleGuard';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  school_id: string | null;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
  section_class: string | null;
  last_login: string | null;
  linked_school_count?: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: COLORS.admin,
  teacher: '#7c3aed',
  student: COLORS.success,
  school: COLORS.info,
  parent: COLORS.gold,
};
const ROLE_EMOJI: Record<string, string> = {
  admin: '🛡️', teacher: '👩‍🏫', student: '🎓', school: '🏫', parent: '👨‍👩‍👧',
};

const ALL_ROLES = ['all', 'admin', 'teacher', 'student', 'school', 'parent'];

export default function UsersScreen({ navigation }: any) {
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit/Create state
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: '',
    phone: '',
    is_active: true,
    school_id: '',
    school_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', full_name: '', role: 'student' });

  const load = useCallback(async () => {
    try {
      const nextUsers = (await portalUserAdminService.listUsersForAdminScreen()) as User[];
      setUsers(nextUsers);
      setFiltered(nextUsers);
    } finally {
      setLoading(false);
    }
  }, []);

  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    schoolService.listApprovedSchoolOptions(100).then((data) => setSchools(data as { id: string; name: string }[]));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.school_name ?? '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, roleFilter, users]);

  const toggleActive = async (user: User) => {
    Alert.alert(
      user.is_active ? 'Deactivate' : 'Activate',
      `Are you sure? ${user.is_active ? 'Deactivating' : 'Activating'} ${user.full_name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          onPress: async () => {
            try {
              await portalUserAdminService.setPortalUserActive(user.id, !user.is_active);
              load();
            } catch {
              /* ignore */
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (u: User) => {
    Alert.alert(
      'Permanent Delete',
      `Are you sure you want to delete ${u.full_name}? This will remove their portal profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await portalUserAdminService.hardDeletePortalUser(u.id);
              load();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Delete failed');
            }
          },
        },
      ]
    );
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setEditForm({
      full_name: u.full_name,
      role: u.role,
      phone: u.phone || '',
      is_active: u.is_active,
      school_id: u.school_id || '',
      school_name: u.school_name || '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await portalUserAdminService.updatePortalUserAdminEdit(editing.id, {
        full_name: editForm.full_name,
        role: editForm.role,
        phone: editForm.phone || null,
        is_active: editForm.is_active,
        school_id: editForm.school_id || null,
        school_name: editForm.school_name || null,
      });
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Update failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setShowCreate(false);
    Alert.alert('Provision User', 'Choose the closest workflow for the user you want to create.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Student', onPress: () => navigation.navigate(ROUTES.AddStudent) },
      { text: 'Teacher', onPress: () => navigation.navigate(ROUTES.AddTeacher) },
      { text: 'School', onPress: () => navigation.navigate(ROUTES.AddSchool) },
    ]);
  };

  const roleCounts = ALL_ROLES.slice(1).reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);
  const activeUsers = users.filter((user) => user.is_active).length;
  const inactiveUsers = users.length - activeUsers;
  const recentLogins = users.filter((user) => user.last_login).length;

  if (loading) return (
    <View style={styles.loadWrap}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  return (
    <RoleGuard allow={['admin']} navigation={navigation}>
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
          <IconBackButton onPress={() => goBackOrTo(navigation, ROUTES.PeopleHub)} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>{users.length} portal accounts</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{activeUsers}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{inactiveUsers}</Text>
          <Text style={styles.summaryLabel}>Inactive</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{recentLogins}</Text>
          <Text style={styles.summaryLabel}>Seen</Text>
        </View>
      </View>

      {/* Stats row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm }}>
          {Object.entries(roleCounts).map(([r, n]) => (
            <TouchableOpacity key={r} onPress={() => setRoleFilter(roleFilter === r ? 'all' : r)}
              style={[styles.statChip, { borderColor: (ROLE_COLORS[r] || COLORS.border) + '60' }, roleFilter === r && { backgroundColor: (ROLE_COLORS[r] || COLORS.primary) + '22' }]}>
              <Text style={{ fontSize: 14 }}>{ROLE_EMOJI[r] || '👤'}</Text>
              <Text style={[styles.statChipLabel, roleFilter === r && { color: ROLE_COLORS[r] || COLORS.primary }]}>{r}</Text>
              <Text style={[styles.statChipNum, { color: ROLE_COLORS[r] || COLORS.textMuted }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search users…" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Text style={styles.clearBtn}>✕</Text></TouchableOpacity>}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>👤</Text>
            <Text style={styles.emptyText}>No users found.</Text>
          </View>
        ) : filtered.map((u, i) => {
          const rc = ROLE_COLORS[u.role] || COLORS.textMuted;
          return (
            <MotiView key={u.id} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i * 30 }}>
              <TouchableOpacity style={styles.card} activeOpacity={0.8}
                onPress={() => {
                  if (u.role === 'student') navigation.navigate(ROUTES.StudentDetail, { studentId: u.id });
                  else if (u.role === 'teacher') navigation.navigate(ROUTES.TeacherDetail, { teacherId: u.id });
                }}>
                <LinearGradient colors={[rc + '12', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={[styles.avatar, { backgroundColor: rc + '22' }]}>
                  <Text style={{ fontSize: 20 }}>{ROLE_EMOJI[u.role] || '👤'}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>{u.full_name}</Text>
                  <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
                  {u.phone ? <Text style={styles.cardMeta} numberOfLines={1}>{u.phone}</Text> : null}
                  {u.last_login ? (
                    <Text style={styles.cardMeta}>
                      Last login {new Date(u.last_login).toLocaleDateString()}
                    </Text>
                  ) : (
                    <Text style={styles.cardMeta}>No login recorded yet</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={[styles.roleBadge, { backgroundColor: rc + '22', borderColor: rc + '44' }]}>
                      <Text style={[styles.roleBadgeText, { color: rc }]}>{u.role}</Text>
                    </View>
                    {u.school_name && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>🏫 {u.school_name}</Text>
                      </View>
                    )}
                    {u.role === 'teacher' && (u.linked_school_count ?? 0) > 1 && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>🔗 {u.linked_school_count} schools</Text>
                      </View>
                    )}
                    {u.section_class && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>📚 {u.section_class}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(u)} style={styles.actionIcon}>
                    <Text>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(u)} style={styles.actionIcon}>
                    <Text>🗑️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleActive(u)} style={[styles.activeToggle, { backgroundColor: u.is_active ? COLORS.success + '22' : COLORS.error + '22' }]}>
                    <View style={[styles.activeDot, { backgroundColor: u.is_active ? COLORS.success : COLORS.error }]} />
                    <Text style={[styles.activeText, { color: u.is_active ? COLORS.success : COLORS.error }]}>
                      {u.is_active ? 'Active' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </MotiView>
          );
        })}

        {/* Modal: Edit User (Simplified) */}
        {editing && (
          <View style={styles.modalOverlay}>
            <MotiView from={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <Text style={styles.modalSub}>{editing.email}</Text>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput style={styles.input} value={editForm.full_name} onChangeText={t => setEditForm(p => ({ ...p, full_name: t }))} />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>ROLE</Text>
                <View style={styles.rolePicker}>
                  {ALL_ROLES.slice(1).map(r => (
                    <TouchableOpacity key={r} onPress={() => setEditForm(p => ({ ...p, role: r }))}
                      style={[styles.roleOption, editForm.role === r && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                      <Text style={[styles.roleOptionText, editForm.role === r && { color: '#fff' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>PHONE</Text>
                <TextInput style={styles.input} value={editForm.phone} onChangeText={t => setEditForm(p => ({ ...p, phone: t }))} placeholder="Phone number" placeholderTextColor={COLORS.textMuted} />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>ACTIVE STATUS</Text>
                <TouchableOpacity
                  onPress={() => setEditForm(p => ({ ...p, is_active: !p.is_active }))}
                  style={[styles.statusToggle, { borderColor: editForm.is_active ? COLORS.success : COLORS.error }]}
                >
                  <View style={[styles.activeDot, { backgroundColor: editForm.is_active ? COLORS.success : COLORS.error }]} />
                  <Text style={[styles.statusToggleText, { color: editForm.is_active ? COLORS.success : COLORS.error }]}>
                    {editForm.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>ASSIGNED SCHOOL</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setEditForm(p => ({ ...p, school_id: '', school_name: '' }))}
                      style={[styles.roleOption, !editForm.school_id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                    >
                      <Text style={[styles.roleOptionText, !editForm.school_id && { color: '#fff' }]}>None</Text>
                    </TouchableOpacity>
                    {schools.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setEditForm(p => ({ ...p, school_id: s.id, school_name: s.name }))}
                        style={[styles.roleOption, editForm.school_id === s.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                      >
                        <Text style={[styles.roleOptionText, editForm.school_id === s.id && { color: '#fff' }]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setEditing(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} disabled={saving} style={styles.saveBtn}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        )}
        {showCreate && (
          <View style={styles.modalOverlay}>
            <MotiView from={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Provision User</Text>
              <Text style={styles.modalSub}>Choose the closest admin workflow.</Text>

              <TouchableOpacity style={styles.quickActionCard} onPress={() => { setShowCreate(false); navigation.navigate(ROUTES.AddStudent); }}>
                <Text style={styles.quickActionTitle}>Student intake</Text>
                <Text style={styles.quickActionText}>Create a student profile and keep onboarding inside the admin student flow.</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionCard} onPress={() => { setShowCreate(false); navigation.navigate(ROUTES.AddTeacher); }}>
                <Text style={styles.quickActionTitle}>Teacher provisioning</Text>
                <Text style={styles.quickActionText}>Create a teacher account, then assign that teacher to schools and classes.</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionCard} onPress={() => { setShowCreate(false); navigation.navigate(ROUTES.AddSchool); }}>
                <Text style={styles.quickActionTitle}>School onboarding</Text>
                <Text style={styles.quickActionText}>Create a school and continue through the school admin workflow.</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Close</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  createBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  createBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, paddingVertical: SPACING.md, alignItems: 'center' },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  summaryLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  statsScroll: { flexGrow: 0 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.bgCard, borderWidth: 1, borderRadius: RADIUS.full },
  statChipLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'capitalize' },
  statChipNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },
  list: { paddingHorizontal: SPACING.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardContent: { flex: 1, gap: 2 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardMeta: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  roleBadge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  roleBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  schoolChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  schoolChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  activeToggle: { borderRadius: RADIUS.md, padding: 6, alignItems: 'center', gap: 3, flexShrink: 0 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontFamily: FONT_FAMILY.body, fontSize: 9 },
  cardActions: { gap: 6, alignItems: 'flex-end' },
  actionIcon: { padding: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.border + '33' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalContent: { width: width - 40, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  modalSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: -8 },
  inputWrap: { gap: 6 },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  rolePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  roleOptionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase' },
  statusToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start' },
  statusToggleText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: 0.8 },
  modalButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  saveBtn: { flex: 2, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },
  quickActionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, padding: SPACING.lg, gap: 6 },
  quickActionTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  quickActionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

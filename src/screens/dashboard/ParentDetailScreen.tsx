import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { parentService } from '../../services/parent.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../navigation/routes';

interface ParentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface LinkedChild {
  id: string;
  name: string;
  school_name: string | null;
  current_class: string | null;
  status: string | null;
  user_id: string | null;
  parent_relationship: string | null;
}

type Tab = 'overview' | 'children';

export default function ParentDetailScreen({ route, navigation }: any) {
  const { parentId } = route.params as { parentId: string };
  const { profile } = useAuth();
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      const parentRow = await parentService.getPortalProfileForParentDetail(parentId);

      if (!parentRow) {
        setParent(null);
        setChildren([]);
        return;
      }

      setParent(parentRow as ParentProfile);

      const childRows = await parentService.listRegistrationChildrenByParentEmail(parentRow.email);
      setChildren((childRows ?? []) as LinkedChild[]);
    } catch {
      setParent(null);
      setChildren([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [parentId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      children: children.length,
      approved: children.filter((child) => child.status === 'approved').length,
      pending: children.filter((child) => child.status === 'pending').length,
      schools: new Set(children.map((child) => child.school_name).filter(Boolean)).size,
    }),
    [children]
  );

  const toggleActive = async () => {
    if (!parent) return;
    Alert.alert(parent.is_active ? 'Deactivate Parent' : 'Activate Parent', parent.full_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: parent.is_active ? 'Deactivate' : 'Activate',
        onPress: async () => {
          try {
            await parentService.setPortalUserActive(parent.id, !parent.is_active);
            setParent((current) => (current ? { ...current, is_active: !current.is_active } : current));
          } catch {
            Alert.alert('Update failed', 'Could not change account status.');
          }
        },
      },
    ]);
  };

  const unlinkChild = (child: LinkedChild) => {
    if (!parent) return;
    Alert.alert('Unlink Child', `Remove ${child.name} from ${parent.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          try {
            await parentService.clearStudentParentLink(child.id);
            setChildren((current) => current.filter((item) => item.id !== child.id));
          } catch {
            Alert.alert('Unlink failed', 'Could not remove this link.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  if (!parent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Parent" onBack={() => navigation.goBack()} />
        <View style={styles.loader}>
          <Text style={styles.emptyText}>Parent not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Parent Detail"
        onBack={() => navigation.goBack()}
        accentColor={COLORS.gold}
        rightAction={canManage ? { label: parent.is_active ? 'Disable' : 'Enable', onPress: toggleActive } : undefined}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.heroCard}>
          <LinearGradient colors={[`${COLORS.gold}18`, 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{parent.full_name[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{parent.full_name}</Text>
          <Text style={styles.heroMeta}>{parent.email}</Text>
          {parent.phone ? <Text style={styles.heroMeta}>{parent.phone}</Text> : null}
          <View style={[styles.statusPill, { backgroundColor: parent.is_active ? `${COLORS.success}20` : `${COLORS.error}20` }]}>
            <Text style={[styles.statusText, { color: parent.is_active ? COLORS.success : COLORS.error }]}>
              {parent.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Children', value: stats.children, color: COLORS.gold },
            { label: 'Approved', value: stats.approved, color: COLORS.success },
            { label: 'Pending', value: stats.pending, color: COLORS.warning },
            { label: 'Schools', value: stats.schools, color: COLORS.info },
          ].map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabBar}>
          {(['overview', 'children'] as const).map((item) => (
            <TouchableOpacity key={item} style={[styles.tabBtn, tab === item && styles.tabBtnActive]} onPress={() => setTab(item)}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'overview' ? (
          <View style={styles.infoCard}>
            {[
              { label: 'Joined', value: parent.created_at ? new Date(parent.created_at).toLocaleDateString('en-GB') : '—' },
              { label: 'Linked Children', value: `${children.length}` },
              { label: 'Approved Children', value: `${stats.approved}` },
            ].map((row, index) => (
              <View key={row.label} style={[styles.infoRow, index > 0 && styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'children' ? (
          <View style={styles.sectionCard}>
            {children.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No linked children yet.</Text>
              </View>
            ) : (
              children.map((child, index) => (
                <View key={child.id} style={[styles.childCard, index > 0 && styles.childBorder]}>
                  <TouchableOpacity
                    style={styles.childMain}
                    onPress={() => {
                      if (child.user_id) navigation.navigate(ROUTES.StudentDetail, { studentId: child.user_id });
                      else Alert.alert('No portal account', `${child.name} does not have a linked portal account yet.`);
                    }}
                    activeOpacity={0.82}
                  >
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>{child.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName}>{child.name}</Text>
                      <Text style={styles.childMeta}>
                        {child.school_name || 'No school'}{child.current_class ? ` · ${child.current_class}` : ''}
                      </Text>
                      {child.parent_relationship ? <Text style={styles.childMeta}>{child.parent_relationship}</Text> : null}
                    </View>
                    <View style={styles.childStatusWrap}>
                      <Text style={styles.childStatus}>{child.status || 'unknown'}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.childActions}>
                    {child.user_id ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate(ROUTES.StudentReport, { studentId: child.user_id, studentName: child.name })}
                      >
                        <Text style={styles.actionText}>Report</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canManage ? (
                      <TouchableOpacity style={styles.unlinkBtn} onPress={() => unlinkChild(child)}>
                        <Text style={styles.unlinkText}>Unlink</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  heroCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, overflow: 'hidden', marginBottom: SPACING.md },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: `${COLORS.gold}24`, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.gold },
  heroName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  heroMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.md },
  statCard: { width: '48%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { marginTop: 4, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  tabBar: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tabBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.bgCard },
  tabBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: 0.8 },
  tabTextActive: { color: COLORS.gold },
  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.bgCard, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  infoLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  infoValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  sectionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard, overflow: 'hidden', marginBottom: SPACING.md },
  childCard: { padding: SPACING.md, gap: SPACING.sm },
  childBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  childMain: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  childAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${COLORS.info}22`, alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.info },
  childName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  childMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  childStatusWrap: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: `${COLORS.border}` },
  childStatus: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase' },
  childActions: { flexDirection: 'row', gap: SPACING.sm, paddingLeft: 56 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  actionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  unlinkBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: `${COLORS.error}14` },
  unlinkText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
  emptyWrap: { alignItems: 'center', padding: SPACING.xl },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

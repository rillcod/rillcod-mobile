import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
  section_class: string | null;
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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('portal_users')
      .select('id, full_name, email, role, school_name, is_active, created_at, section_class')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) { setUsers(data as User[]); setFiltered(data as User[]); }
    setLoading(false);
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
      user.is_active ? 'Deactivate User' : 'Activate User',
      `${user.is_active ? 'Deactivate' : 'Activate'} ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          style: user.is_active ? 'destructive' : 'default',
          onPress: async () => {
            await supabase.from('portal_users').update({ is_active: !user.is_active }).eq('id', user.id);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
          },
        },
      ]
    );
  };

  const roleCounts = ALL_ROLES.slice(1).reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <View style={styles.loadWrap}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.subtitle}>{users.length} portal accounts</Text>
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
                  if (u.role === 'student') navigation.navigate('StudentDetail', { studentId: u.id });
                  else if (u.role === 'teacher') navigation.navigate('TeacherDetail', { teacherId: u.id });
                }}>
                <LinearGradient colors={[rc + '12', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={[styles.avatar, { backgroundColor: rc + '22' }]}>
                  <Text style={{ fontSize: 20 }}>{ROLE_EMOJI[u.role] || '👤'}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>{u.full_name}</Text>
                  <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={[styles.roleBadge, { backgroundColor: rc + '22', borderColor: rc + '44' }]}>
                      <Text style={[styles.roleBadgeText, { color: rc }]}>{u.role}</Text>
                    </View>
                    {u.school_name && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>🏫 {u.school_name}</Text>
                      </View>
                    )}
                    {u.section_class && (
                      <View style={styles.schoolChip}>
                        <Text style={styles.schoolChipText}>📚 {u.section_class}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => toggleActive(u)} style={[styles.activeToggle, { backgroundColor: u.is_active ? COLORS.success + '22' : COLORS.error + '22' }]}>
                  <View style={[styles.activeDot, { backgroundColor: u.is_active ? COLORS.success : COLORS.error }]} />
                  <Text style={[styles.activeText, { color: u.is_active ? COLORS.success : COLORS.error }]}>
                    {u.is_active ? 'Active' : 'Off'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </MotiView>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
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
  roleBadge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  roleBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  schoolChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 2 },
  schoolChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  activeToggle: { borderRadius: RADIUS.md, padding: 6, alignItems: 'center', gap: 3, flexShrink: 0 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontFamily: FONT_FAMILY.body, fontSize: 9 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ParentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [parents, setParents] = useState<Parent[]>([]);
  const [filtered, setFiltered] = useState<Parent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('portal_users')
      .select('id, full_name, email, phone, is_active, created_at')
      .eq('role', 'parent')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) {
      setParents(data as Parent[]);
      setFiltered(data as Parent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(parents); return; }
    const q = search.toLowerCase();
    setFiltered(parents.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    ));
  }, [search, parents]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleActive = async (parent: Parent) => {
    Alert.alert(
      parent.is_active ? 'Deactivate' : 'Activate',
      `Are you sure? ${parent.is_active ? 'Deactivating' : 'Activating'} ${parent.full_name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: parent.is_active ? 'Deactivate' : 'Activate',
          onPress: async () => {
            const { error } = await supabase.from('portal_users').update({ is_active: !parent.is_active }).eq('id', parent.id);
            if (!error) load();
          },
        },
      ]
    );
  };

  const openParentActions = (parent: Parent) => {
    Alert.alert(
      parent.full_name,
      [parent.email, parent.phone ? `Phone: ${parent.phone}` : null, `Status: ${parent.is_active ? 'Active' : 'Inactive'}`]
        .filter(Boolean)
        .join('\n'),
      [
        { text: 'Close', style: 'cancel' },
        isAdmin
          ? {
              text: parent.is_active ? 'Deactivate' : 'Activate',
              onPress: () => toggleActive(parent),
            }
          : { text: 'OK' },
      ]
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Parents</Text>
          <Text style={styles.subtitle}>{parents.length} registered parents</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search parents…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={styles.emptyText}>No parents found.</Text>
          </View>
        ) : (
          filtered.map((p, i) => (
            <MotiView
              key={p.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: i * 30 }}
            >
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openParentActions(p)}
              >
                <LinearGradient colors={[COLORS.gold + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(p.full_name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardName}>{p.full_name}</Text>
                  <Text style={styles.cardEmail}>{p.email}</Text>
                  {p.phone && <Text style={styles.cardEmail}>📞 {p.phone}</Text>}
                </View>
                <TouchableOpacity onPress={() => toggleActive(p)} style={[styles.statusDot, { backgroundColor: p.is_active ? COLORS.success : COLORS.error }]} />
              </TouchableOpacity>
            </MotiView>
          ))
        )}
        <View style={{ height: 40 }} />
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 4 },
  list: { paddingHorizontal: SPACING.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gold + '22', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.gold },
  cardContent: { flex: 1, gap: 2 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert, Modal, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Program {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number | null;
  difficulty_level: string | null;
  price: number | null;
  max_students: number | null;
  is_active: boolean;
  created_at: string;
}

const DIFF_OPTS = ['beginner', 'intermediate', 'advanced'];
const DIFF_COLORS: Record<string, string> = { beginner: COLORS.success, intermediate: COLORS.warning, advanced: COLORS.error };

function ProgramModal({ visible, program, onClose, onSaved }: { visible: boolean; program: Program | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [weeks, setWeeks] = useState('');
  const [price, setPrice] = useState('');
  const [maxStudents, setMaxStudents] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (program) {
      setName(program.name); setDesc(program.description || '');
      setWeeks(String(program.duration_weeks || '')); setPrice(String(program.price || ''));
      setMaxStudents(String(program.max_students || '')); setDifficulty(program.difficulty_level || 'beginner');
      setIsActive(program.is_active);
    } else {
      setName(''); setDesc(''); setWeeks(''); setPrice(''); setMaxStudents(''); setDifficulty('beginner'); setIsActive(true);
    }
  }, [program, visible]);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Programme name is required.'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(), description: desc.trim() || null,
      duration_weeks: weeks ? parseInt(weeks) : null,
      price: price ? parseFloat(price) : null,
      max_students: maxStudents ? parseInt(maxStudents) : null,
      difficulty_level: difficulty, is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    try {
      if (program) {
        await supabase.from('programs').update(payload).eq('id', program.id);
      } else {
        await supabase.from('programs').insert({ ...payload, created_at: new Date().toISOString() });
      }
      onSaved();
      onClose();
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.sheetHeader}>
            <Text style={ms.sheetTitle}>{program ? 'Edit Programme' : 'New Programme'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={ms.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Programme Name *', value: name, set: setName, placeholder: 'e.g. Python Foundations' },
              { label: 'Description', value: desc, set: setDesc, placeholder: 'Brief description…', multi: true },
              { label: 'Duration (weeks)', value: weeks, set: setWeeks, placeholder: '12', keyboard: 'numeric' as any },
              { label: 'Price (₦)', value: price, set: setPrice, placeholder: '25000', keyboard: 'numeric' as any },
              { label: 'Max Students', value: maxStudents, set: setMaxStudents, placeholder: '30', keyboard: 'numeric' as any },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: SPACING.md }}>
                <Text style={ms.fieldLabel}>{f.label}</Text>
                <TextInput style={[ms.input, f.multi && { height: 80, textAlignVertical: 'top' }]}
                  value={f.value} onChangeText={f.set} placeholder={f.placeholder} placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.keyboard} multiline={f.multi} />
              </View>
            ))}
            <Text style={ms.fieldLabel}>Difficulty</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
              {DIFF_OPTS.map(d => (
                <TouchableOpacity key={d} onPress={() => setDifficulty(d)}
                  style={[ms.chip, difficulty === d && { backgroundColor: (DIFF_COLORS[d] || COLORS.primary) + '33', borderColor: DIFF_COLORS[d] || COLORS.primary }]}>
                  <Text style={[ms.chipText, difficulty === d && { color: DIFF_COLORS[d] || COLORS.primaryLight }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl }}>
              <Text style={ms.fieldLabel}>Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: COLORS.success, false: COLORS.border }} />
            </View>
            <TouchableOpacity onPress={save} disabled={saving} style={[ms.saveBtn, saving && { opacity: 0.6 }]}>
              <LinearGradient colors={COLORS.gradPrimary as any} style={ms.saveBtnGrad}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ms.saveBtnText}>{program ? 'Save Changes' : 'Create Programme'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  sheetTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  closeBtn: { fontSize: 18, color: COLORS.textMuted, padding: 4 },
  fieldLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  chipText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  saveBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.xl },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },
});

export default function ProgramsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    const { data } = await supabase.from('programs').select('*').order('created_at', { ascending: false });
    if (data) setPrograms(data as Program[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? programs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : programs;

  const deleteProgram = (p: Program) => {
    Alert.alert('Delete Programme', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('programs').delete().eq('id', p.id);
        setPrograms(prev => prev.filter(x => x.id !== p.id));
      }},
    ]);
  };

  if (loading) return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const active = programs.filter(p => p.is_active).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Programmes</Text>
          <Text style={styles.subtitle}>{programs.length} total · {active} active</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => { setEditing(null); setModalVisible(true); }} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md }}>
          {[
            { label: 'Total', value: programs.length, color: COLORS.primary },
            { label: 'Active', value: active, color: COLORS.success },
            { label: 'Inactive', value: programs.length - active, color: COLORS.error },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.searchWrap}>
        <Text>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search programmes…" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
      >
        {filtered.map((p, i) => {
          const dc = DIFF_COLORS[p.difficulty_level || ''] || COLORS.textMuted;
          return (
            <MotiView key={p.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 40 }}>
              <View style={styles.card}>
                <LinearGradient colors={[COLORS.primary + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{p.name}</Text>
                    {p.description && <Text style={styles.cardDesc} numberOfLines={2}>{p.description}</Text>}
                  </View>
                  <View style={[styles.activeBadge, { backgroundColor: p.is_active ? COLORS.success + '22' : COLORS.error + '22' }]}>
                    <Text style={[styles.activeBadgeText, { color: p.is_active ? COLORS.success : COLORS.error }]}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.sm, flexWrap: 'wrap' }}>
                  {p.difficulty_level && <View style={[styles.chip, { backgroundColor: dc + '22', borderColor: dc + '44' }]}><Text style={[styles.chipText, { color: dc }]}>{p.difficulty_level}</Text></View>}
                  {p.duration_weeks && <View style={styles.chip}><Text style={styles.chipText}>⏱ {p.duration_weeks}w</Text></View>}
                  {p.price && <View style={styles.chip}><Text style={styles.chipText}>₦{p.price.toLocaleString()}</Text></View>}
                  {p.max_students && <View style={styles.chip}><Text style={styles.chipText}>👥 max {p.max_students}</Text></View>}
                </View>
                {isAdmin && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => { setEditing(p); setModalVisible(true); }} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProgram(p)} style={styles.delBtn}>
                      <Text style={styles.delBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </MotiView>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      <ProgramModal visible={modalVisible} program={editing} onClose={() => setModalVisible(false)} onSaved={load} />
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
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  addBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#fff' },
  statCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', minWidth: 80 },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  list: { paddingHorizontal: SPACING.xl },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  cardName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, flex: 1 },
  cardDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, lineHeight: 18 },
  activeBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  chip: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  editBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.info + '22', borderRadius: RADIUS.md },
  editBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  delBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.error + '15', borderRadius: RADIUS.md },
  delBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
});

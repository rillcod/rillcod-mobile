import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

interface Student {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
}

type Action = 'deactivate' | 'delete';

export default function WipeStudentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    const restrictToSchoolId =
      (profile?.role === 'teacher' || profile?.role === 'school') && profile?.school_id
        ? profile.school_id
        : null;
    const data = await studentService.listStudentsForWipeScreen({ restrictToSchoolId });
    setStudents(data as Student[]);
    setLoading(false);
  }, [profile?.role, profile?.school_id]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filteredStudents = students.filter(s => {
    if (filter === 'active' && !s.is_active) return false;
    if (filter === 'inactive' && s.is_active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    }
    return true;
  });

  const confirmAction = (action: Action) => {
    if (selected.size === 0) { Alert.alert('No selection', 'Please select students first.'); return; }
    const label = action === 'deactivate' ? 'Deactivate' : 'Permanently Delete';
    const detail = action === 'delete'
      ? 'This will permanently delete their portal accounts and cannot be undone.'
      : 'They will lose access but data is retained.';
    Alert.alert(
      `${label} ${selected.size} Student${selected.size > 1 ? 's' : ''}?`,
      detail,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: label, style: 'destructive', onPress: () => executeAction(action) },
      ]
    );
  };

  const executeAction = async (action: Action) => {
    setProcessing(true);
    const ids = Array.from(selected);
    try {
      if (action === 'deactivate') {
        await studentService.bulkSetPortalStudentsActive(ids, false);
        setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_active: false } : s));
      } else {
        await studentService.bulkHardDeletePortalStudents(ids);
        setStudents(prev => prev.filter(s => !ids.includes(s.id)));
      }
      setSelected(new Set());
      Alert.alert('Done', `${ids.length} student${ids.length > 1 ? 's' : ''} ${action === 'deactivate' ? 'deactivated' : 'deleted'}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.error} size="large" /></View>;

  if (!(profile?.role === 'admin' || profile?.role === 'school' || profile?.role === 'teacher')) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <IconBackButton onPress={() => goBackOrTo(navigation, ROUTES.PeopleHub)} color={COLORS.textPrimary} style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Wipe Students</Text>
            <Text style={styles.subtitle}>Restricted access</Text>
          </View>
        </View>
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Only admin, school, and teacher accounts can access student bulk actions.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => goBackOrTo(navigation, ROUTES.PeopleHub)} color={COLORS.textPrimary} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Wipe Students</Text>
          <Text style={styles.subtitle}>Archive or remove student accounts</Text>
        </View>
      </View>

      {/* Warning banner */}
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>⚠️ Use with caution — deletions are permanent and cannot be undone.</Text>
      </View>

      {/* Filter + Search */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchWrap}>
        <Text>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Search students…" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
      </View>

      {/* Select all */}
      <View style={styles.selectBar}>
        <Text style={styles.selCount}>{selected.size} of {filteredStudents.length} selected</Text>
        <TouchableOpacity onPress={() => {
          if (selected.size === filteredStudents.length) setSelected(new Set());
          else setSelected(new Set(filteredStudents.map(s => s.id)));
        }}>
          <Text style={styles.selAllText}>{selected.size === filteredStudents.length ? 'Deselect All' : 'Select All'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filteredStudents.map((s, i) => {
          const sel = selected.has(s.id);
          return (
            <MotiView key={s.id} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 20 }}>
              <TouchableOpacity style={[styles.row, sel && styles.rowSel]} onPress={() => toggle(s.id)} activeOpacity={0.8}>
                <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                  {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.full_name}</Text>
                  <Text style={styles.meta}>{s.email}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: s.is_active ? COLORS.success : COLORS.error }]} />
              </TouchableOpacity>
            </MotiView>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action bar */}
      {selected.size > 0 && (
        <MotiView from={{ translateY: 80 }} animate={{ translateY: 0 }} style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.warning + '22', borderColor: COLORS.warning + '44' }]}
            onPress={() => confirmAction('deactivate')}
            disabled={processing}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.warning }]}>⏸ Deactivate {selected.size}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.error + '22', borderColor: COLORS.error + '44' }]}
            onPress={() => confirmAction('delete')}
            disabled={processing}
          >
            {processing ? <ActivityIndicator color={COLORS.error} size="small" /> : <Text style={[styles.actionBtnText, { color: COLORS.error }]}>🗑️ Delete {selected.size}</Text>}
          </TouchableOpacity>
        </MotiView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  warningBanner: { marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.error + '15', borderWidth: 1, borderColor: COLORS.error + '40', borderRadius: RADIUS.md, padding: SPACING.sm },
  warningText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.error, lineHeight: 18 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  filterText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'capitalize' },
  filterTextActive: { color: COLORS.primaryLight },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  selectBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  selCount: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  selAllText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },
  list: { paddingHorizontal: SPACING.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  rowSel: { borderColor: COLORS.error, backgroundColor: COLORS.error + '0f' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  name: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: SPACING.lg, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm },
});

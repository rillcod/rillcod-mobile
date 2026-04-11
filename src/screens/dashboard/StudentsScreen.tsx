import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { studentService } from '../../services/student.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { Alert } from 'react-native';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';
import { shareCsv } from '../../lib/csv';

interface Student {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  is_active: boolean;
  created_at: string;
  section_class: string | null;
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <LinearGradient colors={[color, color + '80']} style={styles.avatar}>
      <Text style={styles.avatarText}>{(name || '?')[0].toUpperCase()}</Text>
    </LinearGradient>
  );
}

export default function StudentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const isAdmin = profile?.role === 'admin';
  const canAdd = isAdmin || profile?.role === 'teacher';

  const isTeacher = profile?.role === 'teacher';

  const load = useCallback(async () => {
    try {
      if (isTeacher && profile?.id) {
        const { rows, total } = await studentService.listStudentsByTeacherClasses(profile.id);
        setStudents(rows as Student[]);
        setFiltered(rows as Student[]);
        setTotal(total);
        return;
      }

      const { rows, total } = await studentService.listStudentsDirectory({
        isAdmin,
        schoolId: profile?.school_id,
        limit: 100,
      });
      setStudents(rows as Student[]);
      setFiltered(rows as Student[]);
      setTotal(total);
    } catch (e) {
      console.warn('StudentsScreen load', e);
      setStudents([]);
      setFiltered([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, isTeacher]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(students);
    } else {
      const q = search.toLowerCase();
      setFiltered(students.filter((s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.school_name ?? '').toLowerCase().includes(q)
      ));
    }
  }, [search, students]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const exportStudentsCsv = async () => {
    if (filtered.length === 0) {
      Alert.alert('Export', 'No rows to export.');
      return;
    }
    const rows: string[][] = [
      ['id', 'full_name', 'email', 'school_name', 'section_class', 'is_active', 'created_at'],
      ...filtered.map((s) => [
        s.id,
        s.full_name,
        s.email,
        s.school_name ?? '',
        s.section_class ?? '',
        s.is_active ? 'true' : 'false',
        s.created_at,
      ]),
    ];
    try {
      await shareCsv('students-export.csv', rows);
    } catch (e: any) {
      Alert.alert('Export', e?.message ?? 'Could not share CSV.');
    }
  };

  const handleDelete = (studentId: string, name: string) => {
    Alert.alert(
      'Delete Student',
      `Permanently remove ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await studentService.deleteStudent(studentId);
              setStudents((prev) => prev.filter((s) => s.id !== studentId));
              Alert.alert('Deleted', 'Student removed successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Remove failed');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.admin} size="large" />
        <Text style={styles.loadText}>Loading students...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Students"
        subtitle={`${total} registered learners`}
        onBack={() => goBackOrTo(navigation, ROUTES.PeopleHub)}
        secondaryAction={canAdd ? { label: 'Bulk reg.', onPress: () => navigation.navigate(ROUTES.BulkRegister) } : undefined}
        primaryAction={canAdd ? { label: 'Add', onPress: () => navigation.navigate(ROUTES.AddStudent) } : undefined}
        colors={COLORS}
      />

      <View style={styles.searchWrap}>
        <Text style={styles.searchLabel}>Find</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or school"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => void exportStudentsCsv()}>
          <Text style={styles.clearBtn}>CSV</Text>
        </TouchableOpacity>
        {canAdd ? (
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.StudentImport)}>
            <Text style={styles.clearBtn}>Import</Text>
          </TouchableOpacity>
        ) : null}
        {canAdd ? (
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.EnrolStudents)}>
            <Text style={styles.clearBtn}>Enrol</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.admin} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyCode}>ST</Text>
            <Text style={styles.emptyText}>{search ? 'No students match your search.' : 'No students found.'}</Text>
          </View>
        ) : (
          filtered.map((s, i) => (
            <MotiView
              key={s.id}
              from={{ opacity: 0, translateX: -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', delay: i * 40 }}
            >
              <TouchableOpacity style={styles.card} activeOpacity={0.82} onPress={() => navigation.navigate(ROUTES.StudentDetail, { studentId: s.id })}>
                <LinearGradient colors={[COLORS.admin + '08', 'transparent']} style={StyleSheet.absoluteFill} />
                <Avatar name={s.full_name} color={COLORS.admin} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardName} numberOfLines={1}>{s.full_name}</Text>
                  <Text style={styles.cardEmail} numberOfLines={1}>{s.email}</Text>
                  <View style={styles.cardMeta}>
                    {s.school_name ? (
                      <View style={styles.metaChip}><Text style={styles.metaChipText}>{s.school_name}</Text></View>
                    ) : null}
                    {s.section_class ? (
                      <View style={styles.metaChip}><Text style={styles.metaChipText}>{s.section_class}</Text></View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.sideRail}>
                  <View style={[styles.statusPill, { backgroundColor: s.is_active ? COLORS.success + '20' : COLORS.error + '20' }]}>
                    <Text style={[styles.statusPillText, { color: s.is_active ? COLORS.success : COLORS.error }]}>{s.is_active ? 'LIVE' : 'OFF'}</Text>
                  </View>
                  {isAdmin ? (
                    <TouchableOpacity onPress={() => handleDelete(s.id, s.full_name)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>DEL</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            </MotiView>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clearBtn: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, textTransform: 'uppercase' },
  list: { paddingHorizontal: SPACING.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.md, color: COLORS.white100 },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  metaChip: { backgroundColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  metaChipText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textSecondary },
  sideRail: { alignItems: 'flex-end', gap: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  statusPillText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: LETTER_SPACING.wide },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.error + '10' },
  deleteBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: COLORS.error, letterSpacing: LETTER_SPACING.wide },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

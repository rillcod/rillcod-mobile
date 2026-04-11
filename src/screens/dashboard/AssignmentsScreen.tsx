import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView, TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { assignmentService } from '../../services/assignment.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { Ionicons } from '@expo/vector-icons';
import { ROUTES } from '../../navigation/routes';

interface CourseSummary {
  title: string | null;
  programs?: { name: string | null } | null;
}

interface SubmissionSummary {
  id: string;
  assignment_id: string | null;
  status: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
}

interface AssignmentCard {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number | null;
  assignment_type: string | null;
  is_active: boolean | null;
  course?: CourseSummary | null;
  submission?: SubmissionSummary | null;
  submissionCount?: number;
  submittedCount?: number;
  gradedCount?: number;
}

function formatDate(d: string | null): string {
  if (!d) return 'No due date';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string | null): boolean {
  return !!dueDate && new Date(dueDate) < new Date();
}

function statusColor(status: string): string {
  if (status === 'graded') return COLORS.success;
  if (status === 'submitted') return COLORS.info;
  if (status === 'draft') return COLORS.textMuted;
  if (status === 'pending') return COLORS.warning;
  if (status === 'overdue') return COLORS.error;
  return COLORS.primary;
}

export default function AssignmentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'overdue'>('all');
  const [search, setSearch] = useState('');

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await assignmentService.listAssignments({
        role: profile.role,
        userId: profile.id,
        schoolId: profile.school_id
      });
      setAssignments(data as any[]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const status = isStaff
        ? assignment.submittedCount && assignment.submittedCount > 0
          ? 'submitted'
          : assignment.gradedCount && assignment.submissionCount && assignment.gradedCount === assignment.submissionCount
          ? 'graded'
          : !assignment.is_active
          ? 'pending'
          : isOverdue(assignment.due_date)
          ? 'overdue'
          : 'all'
        : assignment.submission?.status ?? (isOverdue(assignment.due_date) ? 'overdue' : 'pending');

      const matchesFilter = filter === 'all' || status === filter;
      const matchesSearch =
        !q ||
        assignment.title.toLowerCase().includes(q) ||
        (assignment.description ?? '').toLowerCase().includes(q) ||
        (assignment.course?.title ?? '').toLowerCase().includes(q) ||
        (assignment.course?.programs?.name ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [assignments, filter, isStaff, search]);

  const stats = useMemo(() => {
    if (isStaff) {
      return {
        primary: assignments.length,
        secondary: assignments.filter((a) => (a.submittedCount ?? 0) > 0).length,
        tertiary: assignments.filter((a) => (a.gradedCount ?? 0) > 0).length,
        overdue: assignments.filter((a) => isOverdue(a.due_date) && a.is_active !== false).length,
      };
    }
    return {
      primary: assignments.filter((a) => !a.submission).length,
      secondary: assignments.filter((a) => a.submission?.status === 'submitted').length,
      tertiary: assignments.filter((a) => a.submission?.status === 'graded').length,
      overdue: assignments.filter((a) => !a.submission && isOverdue(a.due_date)).length,
    };
  }, [assignments, isStaff]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: isStaff ? 'Needs Work' : 'Pending' },
    { key: 'submitted', label: isStaff ? 'To Grade' : 'Submitted' },
    { key: 'graded', label: 'Graded' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const renderItem = ({ item, index }: { item: AssignmentCard; index: number }) => {
    const overdue = isOverdue(item.due_date);
    const studentStatus = item.submission?.status ?? (overdue ? 'overdue' : 'pending');
    const staffStatus = (item.submittedCount ?? 0) > 0
      ? 'submitted'
      : (item.gradedCount ?? 0) > 0 && item.submissionCount === item.gradedCount
      ? 'graded'
      : !item.is_active
      ? 'draft'
      : overdue
      ? 'overdue'
      : 'pending';
    const label = isStaff
      ? staffStatus === 'submitted'
        ? `${item.submittedCount} awaiting review`
        : staffStatus === 'graded'
        ? 'Graded'
        : staffStatus === 'draft'
        ? 'Draft'
        : staffStatus === 'overdue'
        ? 'Overdue'
        : 'Active'
      : studentStatus === 'graded'
      ? 'Graded'
      : studentStatus === 'submitted'
      ? 'Submitted'
      : studentStatus === 'overdue'
      ? 'Overdue'
      : 'Pending';
    const color = statusColor(isStaff ? staffStatus : studentStatus);

    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 35 }}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.88}
          onPress={() => navigation.navigate(ROUTES.AssignmentDetail, { assignmentId: item.id, title: item.title })}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                  <Text style={[styles.badgeText, { color }]}>{label}</Text>
                </View>
              </View>
              {!!item.assignment_type && (
                <Text style={styles.eyebrow}>{item.assignment_type.toUpperCase()}</Text>
              )}
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.cardMeta}>
            <Text style={[styles.metaItem, overdue && { color: COLORS.error }]}>Due {formatDate(item.due_date)}</Text>
            <Text style={styles.metaItem}>{item.max_points ?? 100} pts</Text>
            {item.course?.title ? <Text style={styles.metaItem}>{item.course.title}</Text> : null}
          </View>

          {isStaff ? (
            <View style={styles.staffStatsRow}>
              <View style={styles.staffStat}><Text style={styles.staffStatLabel}>Submissions</Text><Text style={styles.staffStatValue}>{item.submissionCount ?? 0}</Text></View>
              <View style={styles.staffStat}><Text style={styles.staffStatLabel}>Pending</Text><Text style={[styles.staffStatValue, { color: COLORS.warning }]}>{item.submittedCount ?? 0}</Text></View>
              <View style={styles.staffStat}><Text style={styles.staffStatLabel}>Graded</Text><Text style={[styles.staffStatValue, { color: COLORS.success }]}>{item.gradedCount ?? 0}</Text></View>
            </View>
          ) : (
            <>
              {item.submission?.grade != null && (
                <Text style={[styles.gradeText, { color: COLORS.success }]}>Score {item.submission.grade}/{item.max_points ?? 100}</Text>
              )}
              {item.submission?.feedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>Teacher Feedback</Text>
                  <Text style={styles.feedbackText} numberOfLines={2}>{item.submission.feedback}</Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} size={20} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Assignments</Text>
          <Text style={styles.subtitle}>{isStaff ? 'Create, monitor and grade work' : 'Track and submit your work'}</Text>
        </View>
        {isStaff ? (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() =>
              Alert.alert(
                'Create from a class',
                'Open Classes, choose a class, then use New Assignment.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Go to Classes', onPress: () => navigation.navigate(ROUTES.Classes) },
                ],
              )
            }
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={16} color={COLORS.bg} />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statLabel}>{isStaff ? 'Total' : 'Pending'}</Text><Text style={styles.statValue}>{stats.primary}</Text></View>
        <View style={styles.statCard}><Text style={styles.statLabel}>{isStaff ? 'To Grade' : 'Submitted'}</Text><Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.secondary}</Text></View>
        <View style={styles.statCard}><Text style={styles.statLabel}>Graded</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{stats.tertiary}</Text></View>
      </View>

      {isStaff && stats.secondary > 0 ? (
        <View style={styles.alertCard}>
          <View style={[styles.alertDot, { backgroundColor: COLORS.warning }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{stats.secondary} submission{stats.secondary > 1 ? 's' : ''} awaiting review</Text>
            <Text style={styles.alertText}>Filter to `To Grade` and open the assignment detail to mark and respond quickly.</Text>
          </View>
        </View>
      ) : null}

      {!isStaff && stats.overdue > 0 ? (
        <View style={[styles.alertCard, styles.alertDangerCard]}>
          <View style={[styles.alertDot, { backgroundColor: COLORS.error }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: COLORS.error }]}>{stats.overdue} overdue assignment{stats.overdue > 1 ? 's' : ''}</Text>
            <Text style={styles.alertText}>Switch to the overdue filter and submit the missing work from your detail screen.</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search assignments..."
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No assignments found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full },
  createBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.bg },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.base, marginBottom: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md },
  statLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginTop: 6 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginHorizontal: SPACING.base, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.warning + '35', backgroundColor: COLORS.warning + '12' },
  alertDangerCard: { borderColor: COLORS.error + '35', backgroundColor: COLORS.error + '10' },
  alertDot: { width: 10, height: 10, borderRadius: 999, marginTop: 5 },
  alertTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  alertText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2, lineHeight: 18 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.base, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  filtersScroll: { maxHeight: 48, marginBottom: SPACING.md },
  filters: { paddingHorizontal: SPACING.base, gap: SPACING.sm, alignItems: 'center' },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  filterChipActive: { backgroundColor: COLORS.primaryPale, borderColor: COLORS.primary },
  filterText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primaryLight },
  list: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontFamily: FONT_FAMILY.display, fontSize: 32, color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  card: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.sm },
  cardTop: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  eyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.warning, letterSpacing: 1, textTransform: 'uppercase' },
  cardDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, alignSelf: 'flex-start', flexShrink: 0 },
  badgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metaItem: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  staffStatsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  staffStat: { flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  staffStatLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  staffStatValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginTop: 4 },
  gradeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  feedbackBox: { backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: SPACING.sm, borderLeftWidth: 2, borderLeftColor: COLORS.info },
  feedbackLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info, marginBottom: 2 },
  feedbackText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

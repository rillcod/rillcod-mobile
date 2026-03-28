import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number;
  submission?: {
    id: string;
    status: string;
    grade: number | null;
    feedback: string | null;
    submitted_at: string;
  } | null;
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case 'graded': return COLORS.success;
    case 'submitted': return COLORS.info;
    case 'pending': return COLORS.warning;
    default: return COLORS.error;
  }
}

function statusLabel(sub: Assignment['submission'], dueDate: string | null): string {
  if (!sub) {
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    return 'Pending';
  }
  return sub.status.charAt(0).toUpperCase() + sub.status.slice(1);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AssignmentsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      // Get assignments with submissions for this student
      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, status, grade, feedback, submitted_at')
        .eq('portal_user_id', profile.id);

      const subMap: Record<string, any> = {};
      (subs ?? []).forEach(s => { subMap[s.assignment_id] = s; });

      const { data: asgns } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, max_points')
        .order('due_date', { ascending: true })
        .limit(60);

      const result = (asgns ?? []).map(a => ({
        ...a,
        submission: subMap[a.id] ?? null,
      }));

      setAssignments(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const filtered = assignments.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !a.submission;
    if (filter === 'submitted') return a.submission?.status === 'submitted';
    if (filter === 'graded') return a.submission?.status === 'graded';
    return true;
  });

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
  ];

  const renderItem = ({ item, index }: { item: Assignment; index: number }) => {
    const status = item.submission?.status;
    const label = statusLabel(item.submission, item.due_date);
    const color = statusColor(status);
    const isOverdue = !item.submission && item.due_date && new Date(item.due_date) < new Date();

    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 40 }}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: item.id, title: item.title })}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
          </View>

          <View style={styles.cardMeta}>
            <Text style={[styles.metaItem, isOverdue && { color: COLORS.error }]}>
              📅 {formatDate(item.due_date)}
              {isOverdue ? ' · OVERDUE' : ''}
            </Text>
            <Text style={styles.metaItem}>🎯 {item.max_points} pts</Text>
            {item.submission?.grade != null && (
              <Text style={[styles.metaItem, { color: COLORS.success }]}>
                ✅ {item.submission.grade}/{item.max_points}
              </Text>
            )}
          </View>

          {item.submission?.feedback && (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackLabel}>Teacher Feedback</Text>
              <Text style={styles.feedbackText} numberOfLines={2}>{item.submission.feedback}</Text>
            </View>
          )}
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Assignments</Text>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📝</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryPale,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  filterTextActive: { color: COLORS.primaryLight },
  list: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.base, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  cardTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metaItem: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  feedbackBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.info,
  },
  feedbackLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info, marginBottom: 2 },
  feedbackText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

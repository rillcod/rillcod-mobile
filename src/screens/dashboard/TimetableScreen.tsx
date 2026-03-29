import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface TimetableSlot {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_name: string | null;
  room: string | null;
  notes: string | null;
}

interface Timetable {
  id: string;
  name: string;
  academic_year: string | null;
  term: string | null;
  is_active: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_COLORS = [COLORS.admin, '#7c3aed', COLORS.info, COLORS.success, COLORS.gold];

export default function TimetableScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTimetables = useCallback(async () => {
    let q = supabase
      .from('timetables')
      .select('id, name, academic_year, term, is_active')
      .order('is_active', { ascending: false })
      .limit(20);

    if (profile?.school_id) q = q.eq('school_id', profile.school_id);

    const { data } = await q;
    if (data && data.length > 0) {
      setTimetables(data as Timetable[]);
      const active = (data as Timetable[]).find(t => t.is_active);
      setSelectedId(active?.id ?? data[0].id);
    }
    setLoading(false);
  }, [profile]);

  const loadSlots = useCallback(async (timetableId: string) => {
    const { data } = await supabase
      .from('timetable_slots')
      .select('id, day_of_week, start_time, end_time, subject, room, notes, portal_users:teacher_id(full_name)')
      .eq('timetable_id', timetableId)
      .order('start_time');
    if (data) {
      setSlots((data as any[]).map(s => ({
        ...s,
        teacher_name: s.portal_users?.full_name ?? null,
      })));
    }
  }, []);

  useEffect(() => { loadTimetables(); }, [loadTimetables]);
  useEffect(() => { if (selectedId) loadSlots(selectedId); }, [selectedId]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedId) await loadSlots(selectedId);
    setRefreshing(false);
  };

  const daySlots = slots.filter(s => s.day_of_week === selectedDay);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.success} size="large" />
        <Text style={styles.loadText}>Loading timetable…</Text>
      </View>
    );
  }

  if (timetables.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Timetable</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No timetable available yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Timetable</Text>
          {timetables.find(t => t.id === selectedId) && (
            <Text style={styles.subtitle}>{timetables.find(t => t.id === selectedId)?.name}</Text>
          )}
        </View>
      </View>

      {/* Timetable picker if multiple */}
      {timetables.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ttPicker}>
          {timetables.map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setSelectedId(t.id)}
              style={[styles.ttPill, selectedId === t.id && styles.ttPillActive]}
            >
              <Text style={[styles.ttPillText, selectedId === t.id && styles.ttPillTextActive]}>
                {t.name} {t.is_active ? '●' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
        {DAYS.map((day, i) => {
          const count = slots.filter(s => s.day_of_week === day).length;
          return (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[styles.dayTab, selectedDay === day && { backgroundColor: DAY_COLORS[i] + '25', borderColor: DAY_COLORS[i] }]}
            >
              <Text style={[styles.dayTabText, selectedDay === day && { color: DAY_COLORS[i] }]}>{day.slice(0, 3)}</Text>
              {count > 0 && (
                <View style={[styles.dayBadge, { backgroundColor: DAY_COLORS[i] }]}>
                  <Text style={styles.dayBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.success} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {daySlots.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No classes on {selectedDay}.</Text>
          </View>
        ) : (
          daySlots.map((slot, i) => {
            const color = DAY_COLORS[DAYS.indexOf(selectedDay)] ?? COLORS.info;
            return (
              <MotiView key={slot.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 60 }}>
                <View style={styles.slotCard}>
                  <LinearGradient colors={[color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={[styles.timeBlock, { borderColor: color + '60', backgroundColor: color + '15' }]}>
                    <Text style={[styles.timeText, { color }]}>{slot.start_time}</Text>
                    <View style={[styles.timeDivider, { backgroundColor: color + '40' }]} />
                    <Text style={[styles.timeText, { color: COLORS.textMuted }]}>{slot.end_time}</Text>
                  </View>
                  <View style={styles.slotInfo}>
                    <Text style={styles.subject}>{slot.subject}</Text>
                    {slot.teacher_name ? <Text style={styles.slotMeta}>👩‍🏫 {slot.teacher_name}</Text> : null}
                    {slot.room ? <Text style={styles.slotMeta}>📍 Room {slot.room}</Text> : null}
                    {slot.notes ? <Text style={styles.slotNotes}>{slot.notes}</Text> : null}
                  </View>
                </View>
              </MotiView>
            );
          })
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

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  ttPicker: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm, gap: SPACING.sm },
  ttPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  ttPillActive: { backgroundColor: COLORS.success + '20', borderColor: COLORS.success },
  ttPillText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  ttPillTextActive: { color: COLORS.success },

  dayTabs: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  dayTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, alignItems: 'center', minWidth: 56 },
  dayTabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  dayBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  dayBadgeText: { fontSize: 9, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.white100 },

  list: { paddingHorizontal: SPACING.xl },
  slotCard: { flexDirection: 'row', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  timeBlock: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, alignItems: 'center', gap: 3, minWidth: 56 },
  timeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs },
  timeDivider: { width: 1, height: 8 },
  slotInfo: { flex: 1, gap: 3 },
  subject: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  slotMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  slotNotes: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

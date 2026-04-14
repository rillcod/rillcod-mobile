import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { moderationService } from '../../services/moderation.service';
import { SPACING, RADIUS } from '../../constants/spacing';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';

type FlagStatus = 'pending' | 'reviewed' | 'dismissed' | 'removed';

interface FlaggedItem {
  id: string;
  content_type: 'topic' | 'reply';
  reason: string;
  status: FlagStatus;
  created_at: string;
  reporter?: { full_name: string; email: string } | null;
}

const STATUS_CONFIG: Record<FlagStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: 'time-outline' },
  reviewed: { label: 'Reviewed', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: 'eye-outline' },
  dismissed: { label: 'Dismissed', color: '#71717a', bg: 'rgba(113,113,122,0.1)', icon: 'close-circle-outline' },
  removed: { label: 'Removed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'trash-outline' },
};

/**
 * ModerationScreen - Mobile port of the content moderation queue.
 */
export default function ModerationScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FlagStatus | 'all'>('pending');
  const [selectedItem, setSelectedItem] = useState<FlaggedItem | null>(null);
  const [modNotes, setModNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await moderationService.listFlaggedContent();
      setItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (status: 'reviewed' | 'dismissed' | 'removed') => {
    if (!selectedItem) return;
    setResolving(true);
    try {
      await moderationService.resolveFlag(selectedItem.id, status, modNotes, profile?.id);
      Alert.alert('Success', `Flagged item marked as ${status}`);
      setSelectedItem(null);
      setModNotes('');
      load();
    } catch (err) {
      Alert.alert('Error', 'Failed to update moderation state');
    } finally {
      setResolving(false);
    }
  };

  const filtered = items.filter((i) => statusFilter === 'all' || i.status === statusFilter);

  const renderItem = (item: FlaggedItem, index: number) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: item.content_type === 'topic' ? '#8b5cf620' : '#3b82f620' }]}>
            <Text style={[styles.typeText, { color: item.content_type === 'topic' ? '#8b5cf6' : '#3b82f6' }]}>
              {item.content_type.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
        
        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>By {item.reporter?.full_name || 'System'}</Text>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString('en-GB')}
          </Text>
        </View>

        {item.status === 'pending' && (
          <TouchableOpacity style={styles.reviewBtn} onPress={() => setSelectedItem(item)}>
            <Text style={styles.reviewBtnText}>Review Report</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Moderation"
        subtitle="Review community content"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'pending', 'reviewed', 'removed'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.filterPill,
                statusFilter === s && { backgroundColor: '#6366f1', borderColor: '#6366f1' },
              ]}
            >
              <Text style={[styles.filterText, statusFilter === s && { color: '#fff' }]}>
                {s === 'all' ? `All (${items.length})` : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#6366f1" />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>Queue is clear!</Text>
          </View>
        ) : (
          filtered.map((item, idx) => renderItem(item, idx))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <MotiView from={{ translateY: 300 }} animate={{ translateY: 0 }} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Report</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.reportSummary}>
              <Text style={styles.summaryLabel}>Reported Content Reason:</Text>
              <Text style={styles.summaryValue}>{selectedItem?.reason}</Text>
            </View>

            <TextInput
              style={styles.modInput}
              placeholder="Add moderator notes..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={modNotes}
              onChangeText={setModNotes}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.dismissBtn]} onPress={() => handleAction('dismissed')}>
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={() => handleAction('removed')}>
                <Text style={styles.removeBtnText}>Remove Content</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filterBar: { paddingVertical: SPACING.md, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  filterScroll: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  filterText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: colors.textSecondary },
  content: { padding: SPACING.xl, gap: SPACING.lg },
  card: { backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9 },
  reasonText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: colors.textPrimary, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: SPACING.sm },
  reporterText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: colors.textMuted },
  dateText: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: colors.textMuted },
  reviewBtn: { marginTop: SPACING.md, backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  reviewBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, color: '#fff' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, opacity: 0.5 },
  emptyText: { marginTop: 16, fontFamily: FONT_FAMILY.bodyBold, color: colors.textMuted },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  reportSummary: { backgroundColor: colors.bg, padding: SPACING.lg, borderRadius: RADIUS.lg, marginBottom: SPACING.lg },
  summaryLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textPrimary },
  modInput: { backgroundColor: colors.bg, borderRadius: RADIUS.lg, padding: SPACING.md, minHeight: 100, textAlignVertical: 'top', color: colors.textPrimary, fontFamily: FONT_FAMILY.body, marginBottom: SPACING.xl },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center' },
  dismissBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  dismissBtnText: { color: colors.textSecondary, fontFamily: FONT_FAMILY.bodyBold },
  removeBtn: { backgroundColor: '#ef4444' },
  removeBtnText: { color: '#fff', fontFamily: FONT_FAMILY.bodyBold },
});

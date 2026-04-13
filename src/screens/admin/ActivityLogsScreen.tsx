import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { useTheme } from '../../contexts/ThemeContext';
import { logService, LogEntry } from '../../services/log.service';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';
import { useAuth } from '../../contexts/AuthContext';

type LogType = 'activity' | 'audit';

export default function ActivityLogsScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const [type, setType] = useState<LogType>('activity');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  
  const LIMIT = 20;

  const loadLogs = useCallback(async (pageNum: number, isRefresh = false) => {
    if (pageNum === 1) setLoading(true);
    try {
      const result = await logService.getLogs({
        type,
        page: pageNum,
        limit: LIMIT,
        // Add more filters if needed
      });
      
      if (isRefresh || pageNum === 1) {
        setLogs(result.data);
      } else {
        setLogs(prev => [...prev, ...result.data]);
      }
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    setPage(1);
    loadLogs(1);
  }, [type, loadLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadLogs(1, true);
  };

  const loadMore = () => {
    if (!loading && logs.length < total) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadLogs(nextPage);
    }
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const event = type === 'activity' ? item.event_type : item.action;
    const userName = item.portal_users?.full_name || 'System';
    const date = new Date(item.created_at).toLocaleString();

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={[styles.logCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <View style={styles.logHeader}>
          <View style={[styles.badge, { backgroundColor: colors.primaryGlow }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{String(event).toUpperCase()}</Text>
          </View>
          <Text style={[styles.logDate, { color: colors.textMuted }]}>{date}</Text>
        </View>
        
        <View style={styles.logBody}>
          <Text style={[styles.logUser, { color: colors.textPrimary }]}>{userName}</Text>
          <Text style={[styles.logDesc, { color: colors.textSecondary }]}>
            {type === 'activity' ? item.description : `Modified ${item.table_name}`}
          </Text>
        </View>

        {type === 'audit' && item.new_data && (
          <View style={[styles.auditDetails, { backgroundColor: colors.bg + '50' }]}>
            <Text style={[styles.detailsTitle, { color: colors.textMuted }]}>Changes recorded</Text>
            <Text style={[styles.detailsText, { color: colors.textSecondary }]} numberOfLines={2}>
              {JSON.stringify(item.new_data)}
            </Text>
          </View>
        )}
      </MotiView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>System Logs</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setType('activity')}
            style={[
              styles.tab,
              type === 'activity' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
          >
            <Text style={[styles.tabText, { color: type === 'activity' ? '#fff' : colors.textSecondary }]}>Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setType('audit')}
            style={[
              styles.tab,
              type === 'audit' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
          >
            <Text style={[styles.tabText, { color: type === 'audit' ? '#fff' : colors.textSecondary }]}>Audit Trail</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No logs found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading && page > 1 ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontFamily: FONT_FAMILY.heading,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: RADIUS.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.bodySemi,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  logCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.bodyBold,
  },
  logDate: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.body,
  },
  logBody: {
    marginBottom: 8,
  },
  logUser: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.bodyBold,
    marginBottom: 4,
  },
  logDesc: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.body,
    lineHeight: 20,
  },
  auditDetails: {
    marginTop: 12,
    padding: 12,
    borderRadius: RADIUS.md,
  },
  detailsTitle: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.bodySemi,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.mono,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: FONT_SIZE.md,
    fontFamily: FONT_FAMILY.bodySemi,
  },
});

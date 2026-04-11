import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { iotService } from '../../services/iot.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type DeviceStatus = 'online' | 'offline' | 'warning';

type Device = {
  id: string;
  name: string;
  type: string;
  status: DeviceStatus;
  location: string;
  ip: string;
  uptime: number;
  temperature: number;
  cpu: number;
  memory: number;
  network: number;
  battery: number | null;
  lastSeenLabel: string;
};

type AlertRow = {
  id: string;
  device: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  resolved: boolean;
  timeLabel: string;
};

const SEED_DEVICES: Device[] = [
  { id: '1', name: 'Computer Lab 1 Main Server', type: 'server', status: 'online', location: 'Computer Lab 1', ip: '192.168.1.100', uptime: 99.8, temperature: 45, cpu: 23, memory: 67, network: 85, battery: null, lastSeenLabel: 'Just now' },
  { id: '2', name: 'Computer Lab 2 Workstation', type: 'workstation', status: 'online', location: 'Computer Lab 2', ip: '192.168.1.101', uptime: 95.2, temperature: 38, cpu: 45, memory: 78, network: 92, battery: 85, lastSeenLabel: '5m ago' },
  { id: '3', name: 'IoT Hub Central Controller', type: 'hub', status: 'warning', location: 'Main Office', ip: '192.168.1.50', uptime: 87.5, temperature: 52, cpu: 67, memory: 89, network: 73, battery: null, lastSeenLabel: '10m ago' },
  { id: '4', name: 'Tablet 01', type: 'tablet', status: 'offline', location: 'Classroom A', ip: '192.168.1.102', uptime: 0, temperature: 0, cpu: 0, memory: 0, network: 0, battery: 15, lastSeenLabel: '1h ago' },
];

const SEED_ALERTS: AlertRow[] = [
  { id: '1', device: 'IoT Hub Central Controller', type: 'warning', message: 'High temperature detected (52C)', resolved: false, timeLabel: '5m ago' },
  { id: '2', device: 'Tablet 01', type: 'error', message: 'Device offline for more than 1 hour', resolved: false, timeLabel: '1h ago' },
  { id: '3', device: 'Computer Lab 2 Workstation', type: 'info', message: 'Software update available', resolved: true, timeLabel: '30m ago' },
];

function ago(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function IoTScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const canView = profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: deviceData, error: deviceError } = await iotService.listIotDevicesOrderedByLastSeen();

      if (deviceError || !deviceData || deviceData.length === 0) {
        setIsDemo(true);
        setDevices(SEED_DEVICES);
        setAlerts(SEED_ALERTS);
      } else {
        setIsDemo(false);
        setDevices(deviceData.map((row: any) => ({
          id: String(row.id),
          name: row.name ?? row.device_name ?? 'Unknown',
          type: row.type ?? row.device_type ?? 'workstation',
          status: (row.status ?? 'offline') as DeviceStatus,
          location: row.location ?? 'Unknown',
          ip: row.ip_address ?? row.ip ?? 'N/A',
          uptime: row.uptime_pct ?? row.uptime ?? 0,
          temperature: row.temperature ?? 0,
          cpu: row.cpu_usage ?? row.cpu ?? 0,
          memory: row.memory_usage ?? row.memory ?? 0,
          network: row.network_usage ?? row.network ?? 0,
          battery: row.battery_pct ?? row.battery ?? null,
          lastSeenLabel: ago(row.last_seen ?? row.updated_at),
        })));

        const { data: alertData } = await iotService.listIotAlertsRecent(20);

        setAlerts((alertData ?? []).map((row: any) => ({
          id: String(row.id),
          device: row.device_name ?? row.device ?? 'Unknown device',
          type: (row.severity ?? row.type ?? 'info') as 'error' | 'warning' | 'info',
          message: row.message ?? 'No message',
          resolved: row.resolved ?? false,
          timeLabel: ago(row.created_at),
        })));
      }
    } catch {
      setIsDemo(true);
      setDevices(SEED_DEVICES);
      setAlerts(SEED_ALERTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canView]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    online: devices.filter((item) => item.status === 'online').length,
    warning: devices.filter((item) => item.status === 'warning').length,
    offline: devices.filter((item) => item.status === 'offline').length,
    avgCpu: devices.length ? Math.round(devices.reduce((sum, item) => sum + item.cpu, 0) / devices.length) : 0,
  }), [devices]);

  const statusTone = useCallback((status: DeviceStatus) => {
    if (status === 'online') return colors.success;
    if (status === 'warning') return colors.warning;
    return colors.error;
  }, [colors]);

  if (!canView) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="IoT" subtitle="Infrastructure monitoring" onBack={() => navigation.goBack()} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Access Restricted</Text>
          <Text style={styles.emptyText}>This screen is available to admin accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="IoT Dashboard" subtitle={isDemo ? 'Simulation mode' : 'Live infrastructure monitoring'} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isDemo ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Simulation Mode</Text>
            <Text style={styles.bannerText}>No live `iot_devices` table data was found, so the mobile dashboard is showing demo monitoring data just like the web fallback.</Text>
          </View>
        ) : null}

        <View style={styles.statRow}>
          <StatCard label="Online" value={String(stats.online)} styles={styles} />
          <StatCard label="Warning" value={String(stats.warning)} styles={styles} />
          <StatCard label="Offline" value={String(stats.offline)} styles={styles} />
          <StatCard label="Avg CPU" value={`${stats.avgCpu}%`} styles={styles} />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Devices</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); load(); }}>
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {devices.map((device) => (
              <View key={device.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{device.name}</Text>
                    <Text style={styles.cardMeta}>{device.type} · {device.location} · {device.ip}</Text>
                    <Text style={styles.cardSub}>Last seen {device.lastSeenLabel}</Text>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: statusTone(device.status) + '40', backgroundColor: statusTone(device.status) + '14' }]}>
                    <Text style={[styles.statusBadgeText, { color: statusTone(device.status) }]}>{device.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <MetricItem label="CPU" value={`${device.cpu}%`} styles={styles} />
                  <MetricItem label="Memory" value={`${device.memory}%`} styles={styles} />
                  <MetricItem label="Network" value={`${device.network}%`} styles={styles} />
                  <MetricItem label="Temp" value={device.temperature ? `${device.temperature}C` : 'N/A'} styles={styles} />
                </View>
              </View>
            ))}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alerts</Text>
            </View>

            {alerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No alerts</Text>
                <Text style={styles.emptyText}>System alerts will appear here when devices report warnings or errors.</Text>
              </View>
            ) : (
              alerts.map((alert) => (
                <View key={alert.id} style={styles.alertCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{alert.device}</Text>
                      <Text style={styles.cardMeta}>{alert.message}</Text>
                      <Text style={styles.cardSub}>{alert.timeLabel}</Text>
                    </View>
                    <View style={[styles.statusBadge, alert.type === 'error'
                      ? { borderColor: colors.error + '40', backgroundColor: colors.error + '14' }
                      : alert.type === 'warning'
                        ? { borderColor: colors.warning + '40', backgroundColor: colors.warning + '14' }
                        : { borderColor: colors.info + '40', backgroundColor: colors.info + '14' }]}>
                      <Text style={[styles.statusBadgeText, { color: alert.type === 'error' ? colors.error : alert.type === 'warning' ? colors.warning : colors.info }]}>
                        {alert.resolved ? 'RESOLVED' : alert.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetricItem({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  banner: { borderWidth: 1, borderColor: colors.warning + '30', backgroundColor: colors.warning + '12', borderRadius: RADIUS.lg, padding: SPACING.lg },
  bannerTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: colors.warning, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  bannerText: { marginTop: 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 20 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statCard: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg },
  statValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  statLabel: { marginTop: 6, fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  loaderWrap: { paddingVertical: SPACING['3xl'], alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  refreshBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  refreshBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl, gap: SPACING.md },
  alertCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  cardMeta: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary },
  cardSub: { marginTop: 4, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: colors.textMuted },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wider },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metricItem: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: RADIUS.md, padding: SPACING.md },
  metricLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  metricValue: { marginTop: 6, fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: colors.textPrimary },
  emptyCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, padding: SPACING['2xl'], alignItems: 'center' },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: colors.textPrimary },
  emptyText: { marginTop: 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS, SHADOW } from '../../constants/spacing';

interface Certificate {
  id: string;
  certificate_number: string;
  title: string;
  course_name: string | null;
  issue_date: string;
  issued_by: string | null;
  certificate_url: string | null;
}

export default function CertificatesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('certificates')
        .select('id, certificate_number, title, course_name, issue_date, issued_by, certificate_url')
        .eq('portal_user_id', profile.id)
        .order('issue_date', { ascending: false });
      setCerts(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const handleShare = async (cert: Certificate) => {
    try {
      await Share.share({
        message: `I earned a certificate in ${cert.course_name ?? cert.title} from Rillcod Academy!\nCertificate #${cert.certificate_number}`,
        url: cert.certificate_url ?? undefined,
      });
    } catch { /* noop */ }
  };

  const renderItem = ({ item, index }: { item: Certificate; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 80 }}
    >
      <LinearGradient
        colors={['#92400e', '#f59e0b', '#92400e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.certOuter}
      >
        <View style={styles.certCard}>
          {/* Badge */}
          <View style={styles.certBadge}>
            <Text style={styles.certBadgeIcon}>🏆</Text>
          </View>

          {/* Content */}
          <View style={styles.certBody}>
            <Text style={styles.certIssuer}>RILLCOD ACADEMY</Text>
            <Text style={styles.certTitle}>{item.title}</Text>
            {item.course_name && (
              <Text style={styles.certCourse}>{item.course_name}</Text>
            )}
            <View style={styles.certMeta}>
              <Text style={styles.certNum}>#{item.certificate_number}</Text>
              <Text style={styles.certDate}>
                {new Date(item.issue_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </View>
            {item.issued_by && (
              <Text style={styles.certIssuedBy}>Issued by: {item.issued_by}</Text>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)}>
            <Text style={styles.shareBtnText}>Share 📤</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </MotiView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Certificates</Text>
          {certs.length > 0 && (
            <Text style={styles.subtitle}>{certs.length} earned</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : (
        <FlatList
          data={certs}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>No certificates yet</Text>
              <Text style={styles.emptyText}>
                Complete courses to earn certificates and showcase your achievements.
              </Text>
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
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.gold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.base, gap: SPACING.xl, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm, paddingHorizontal: SPACING['2xl'] },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textMuted, textAlign: 'center', lineHeight: FONT_SIZE.base * 1.6 },
  certOuter: {
    borderRadius: RADIUS.xl,
    padding: 2,
    ...SHADOW.glow(COLORS.gold),
  },
  certCard: {
    backgroundColor: '#1a0e00',
    borderRadius: RADIUS.xl - 2,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  certBadge: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.goldGlow,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certBadgeIcon: { fontSize: 36 },
  certBody: { alignItems: 'center', gap: SPACING.xs },
  certIssuer: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    color: COLORS.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  certTitle: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
    color: COLORS.white100,
    textAlign: 'center',
  },
  certCourse: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.base,
    color: COLORS.goldLight,
    textAlign: 'center',
  },
  certMeta: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginTop: SPACING.sm,
  },
  certNum: { fontFamily: FONT_FAMILY.mono, fontSize: FONT_SIZE.xs, color: COLORS.gold },
  certDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.white80 },
  certIssuedBy: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.white40,
    fontStyle: 'italic',
  },
  shareBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldGlow,
  },
  shareBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.goldLight,
  },
});

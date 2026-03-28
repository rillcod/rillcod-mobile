import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface Certificate {
  id: string;
  certificate_number: string;
  verification_code: string;
  issued_date: string;
  pdf_url: string | null;
  course_title: string | null;
}

export default function ParentCertificatesScreen({ navigation, route }: any) {
  const { studentId, studentName } = route.params ?? {};
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noPortalAccount, setNoPortalAccount] = useState(false);

  const load = async () => {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .maybeSingle();

      if (!student?.user_id) {
        setNoPortalAccount(true);
        setCerts([]);
        return;
      }

      setNoPortalAccount(false);

      const { data } = await supabase
        .from('certificates')
        .select('id, certificate_number, verification_code, issued_date, pdf_url, courses(title)')
        .eq('portal_user_id', student.user_id)
        .order('issued_date', { ascending: false });

      setCerts((data ?? []).map((c: any) => ({
        id: c.id,
        certificate_number: c.certificate_number,
        verification_code: c.verification_code,
        issued_date: c.issued_date,
        pdf_url: c.pdf_url,
        course_title: c.courses?.title ?? null,
      })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [studentId]);

  const handleShare = async (cert: Certificate) => {
    try {
      await Share.share({
        message: `🏆 Certificate: ${cert.course_title ?? 'Course Certificate'}\nIssued: ${new Date(cert.issued_date).toLocaleDateString('en-GB')}\nCertificate No: ${cert.certificate_number}\nVerification Code: ${cert.verification_code}`,
        title: cert.course_title ?? 'Certificate',
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Certificates</Text>
          {studentName && <Text style={styles.subtitle}>{studentName}</Text>}
        </View>
        {certs.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{certs.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {noPortalAccount ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>No portal account</Text>
              <Text style={styles.emptyText}>This child has no linked portal account yet.</Text>
            </View>
          ) : certs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyTitle}>No certificates yet</Text>
              <Text style={styles.emptyText}>Certificates will appear here once awarded.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {certs.map((cert, i) => (
                <MotiView
                  key={cert.id}
                  from={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 80, type: 'spring', damping: 20 }}
                  style={styles.card}
                >
                  {/* Gold accent */}
                  <View style={styles.goldAccent} />

                  {/* Trophy icon */}
                  <View style={styles.iconWrap}>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                  </View>

                  {/* Course title */}
                  <Text style={styles.courseTitle}>{cert.course_title ?? 'Course Certificate'}</Text>
                  <Text style={styles.issuedDate}>
                    Issued: {new Date(cert.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>

                  {/* Cert number */}
                  <View style={styles.certNumberBox}>
                    <Text style={styles.certNumberLabel}>Certificate No.</Text>
                    <Text style={styles.certNumber}>{cert.certificate_number}</Text>
                  </View>

                  {/* Verification */}
                  <View style={styles.verifyRow}>
                    <Text style={styles.verifyCheck}>✓</Text>
                    <Text style={styles.verifyText}>Verified · {cert.verification_code}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(cert)} activeOpacity={0.8}>
                      <Text style={styles.shareBtnText}>↑  Share</Text>
                    </TouchableOpacity>
                    {cert.pdf_url && (
                      <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(cert.pdf_url!)} activeOpacity={0.8}>
                        <Text style={styles.downloadBtnText}>↓  Download PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </MotiView>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md },
  backBtn: { padding: SPACING.xs },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, flex: 1 },
  subtitle: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },
  countBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  scroll: { padding: SPACING.base, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.sm },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  list: { gap: SPACING.xl },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: '#f59e0b55',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  goldAccent: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#f59e0b', opacity: 0.06,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: RADIUS.xl,
    backgroundColor: '#f59e0b22',
    borderWidth: 1, borderColor: '#f59e0b55',
    alignItems: 'center', justifyContent: 'center',
  },
  trophyEmoji: { fontSize: 28 },
  courseTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  issuedDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  certNumberBox: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, gap: 2 },
  certNumberLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  certNumber: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  verifyCheck: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.success },
  verifyText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.success },
  actionsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  shareBtn: { flex: 1, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, alignItems: 'center' },
  shareBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  downloadBtn: { flex: 1, paddingVertical: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center' },
  downloadBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.4 },
});

/**
 * ReportCardPreview — native mobile rendering of the report card.
 * Mirrors web's ReportCard.tsx design system: header, metrics, grade, strengths,
 * qualifiers, milestones, certificate, and QR/signature footer.
 *
 * Used in StudentReportScreen to give a live preview before PDF export.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';

// ── Grade helper ──────────────────────────────────────────────────────────────

function gradeInfo(pct: number) {
  if (pct >= 85) return { g: 'A', label: 'Excellent',  color: '#1a6b3c', bg: '#dcfce7' };
  if (pct >= 70) return { g: 'B', label: 'Very Good',  color: '#1a4d8c', bg: '#dbeafe' };
  if (pct >= 55) return { g: 'C', label: 'Good',       color: '#7c6b15', bg: '#fef9c3' };
  if (pct >= 45) return { g: 'D', label: 'Pass',       color: '#8c3a14', bg: '#ffedd5' };
  return          { g: 'E', label: 'Fail',       color: '#8c1414', bg: '#fee2e2' };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricBar({ label, value, color, weight }: { label: string; value: number; color: string; weight: string }) {
  return (
    <View style={mb.row}>
      <View style={mb.header}>
        <Text style={mb.label}>{label}</Text>
        <Text style={[mb.value, { color }]}>{value}%</Text>
      </View>
      <View style={mb.track}>
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${Math.min(value, 100)}%` as any }}
          transition={{ type: 'timing', duration: 900 }}
          style={[mb.fill, { backgroundColor: color }]}
        />
      </View>
      <Text style={mb.weight}>{weight}</Text>
    </View>
  );
}

const mb = StyleSheet.create({
  row: { gap: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  value: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, lineHeight: 20 },
  track: { height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  weight: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#9ca3af' },
});

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={sec.row}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.line} />
    </View>
  );
}

const sec = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1.2, color: '#111827', flexShrink: 0 },
  line: { flex: 1, height: 2, backgroundColor: '#f3f4f6' },
});

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReportCardPreviewData {
  id?: string | null;
  student_name?: string | null;
  school_name?: string | null;
  course_name?: string | null;
  section_class?: string | null;
  report_term?: string | null;
  report_date?: string | null;
  theory_score?: number | null;
  practical_score?: number | null;
  attendance_score?: number | null;
  participation_score?: number | null;
  participation_grade?: string | null;
  projects_grade?: string | null;
  homework_grade?: string | null;
  overall_score?: number | null;
  overall_grade?: string | null;
  key_strengths?: string | null;
  areas_for_growth?: string | null;
  instructor_assessment?: string | null;
  instructor_name?: string | null;
  current_module?: string | null;
  next_module?: string | null;
  course_duration?: string | null;
  report_period?: string | null;
  learning_milestones?: any;
  is_published?: boolean | null;
  has_certificate?: boolean | null;
  certificate_text?: string | null;
  school_section?: string | null;
  fee_label?: string | null;
  fee_amount?: string | null;
  fee_status?: string | null;
  show_payment_notice?: boolean | null;
  proficiency_level?: string | null;
}

interface Props {
  report: ReportCardPreviewData;
  studentName?: string | null;
  onExportPDF?: (isModern: boolean) => void;
  exportingPdf?: boolean;
}

const FEE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  paid:        { bg: '#d1fae5', text: '#065f46', label: 'PAID' },
  outstanding: { bg: '#fee2e2', text: '#991b1b', label: 'OUTSTANDING' },
  partial:     { bg: '#fef3c7', text: '#92400e', label: 'PARTIAL' },
  sponsored:   { bg: '#dbeafe', text: '#1e40af', label: 'SPONSORED' },
  waived:      { bg: '#ede9fe', text: '#5b21b6', label: 'WAIVED' },
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReportCardPreview({ report, studentName, onExportPDF, exportingPdf }: Props) {
  const theory      = Number(report.theory_score)      || 0;
  const practical   = Number(report.practical_score)   || 0;
  const attendance  = Number(report.attendance_score)  || 0;
  const participation = Number(report.participation_score) || 0;
  const computed = Math.round(theory * 0.4 + practical * 0.2 + attendance * 0.2 + participation * 0.2);
  const overall  = Number(report.overall_score) > 0 ? Number(report.overall_score) : computed;
  const grade    = gradeInfo(overall);
  const showCertificate = overall >= 45 || report.has_certificate === true;
  const isDevelopment = report.school_section !== 'school';
  const feeStyle = report.fee_status ? FEE_COLORS[report.fee_status] : null;

  const today = report.report_date
    ? new Date(report.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const milestones = useMemo<string[]>(() => {
    if (Array.isArray(report.learning_milestones)) return report.learning_milestones.filter(Boolean);
    if (typeof report.learning_milestones === 'string' && report.learning_milestones) {
      try { return JSON.parse(report.learning_milestones); } catch { return report.learning_milestones.split('\n').filter(Boolean); }
    }
    return [];
  }, [report.learning_milestones]);

  const qualifiers = [
    { label: 'Project Work',  value: report.projects_grade,     color: '#8b5cf6', bg: '#ede9fe' },
    { label: 'Homework',      value: report.homework_grade,      color: '#0891b2', bg: '#e0f2fe' },
    { label: 'Participation', value: report.participation_grade, color: '#059669', bg: '#d1fae5' },
  ].filter(q => q.value);

  const verifyUrl = `https://rillcod.com/verify/${(report.id || 'preview').toString().slice(0, 8)}`;
  const qrUrl     = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}`;
  const paymentAmount = report.fee_amount && String(report.fee_amount).trim().length > 0
    ? String(report.fee_amount).trim()
    : '20,000';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      style={s.card}
    >
      <LinearGradient
        colors={['#eef2ff55', '#ede9fe22', 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── TOP ACCENT BAR ── */}
      <View style={s.topBar} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoBg}>
            <Text style={s.logoText}>R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>Rillcod Technologies</Text>
            <Text style={s.orgTagline}>Excellence in Educational Technology</Text>
            <Text style={s.orgContact}>📞 08116600091 · ✉ support@rillcod.com</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <View style={s.officialBadge}>
            <Text style={s.officialBadgeText}>Official Record</Text>
          </View>
          <Text style={s.docTitle}>Progress Report</Text>
        </View>
      </View>

      {/* ── STATS BAR ── */}
      <View style={s.statsBar}>
        <View style={s.statsLeft}>
          <View style={s.statCol}>
            <Text style={s.statKey}>ID</Text>
            <Text style={s.statVal}>{(report.id || 'PREVIEW').toString().slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={s.statCol}>
            <Text style={s.statKey}>Date</Text>
            <Text style={s.statVal}>{today}</Text>
          </View>
          {report.school_name ? (
            <View style={s.statCol}>
              <Text style={s.statKey}>School</Text>
              <Text style={s.statVal} numberOfLines={1}>{report.school_name}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.statsRight}>
          {feeStyle && (
            <View style={s.statCol}>
              <Text style={s.statKey}>{report.fee_label || 'Fee'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {report.fee_amount ? <Text style={s.statVal}>₦{report.fee_amount}</Text> : null}
                <View style={[s.feeBadge, { backgroundColor: feeStyle.bg }]}>
                  <Text style={[s.feeBadgeText, { color: feeStyle.text }]}>{feeStyle.label}</Text>
                </View>
              </View>
            </View>
          )}
          <View style={s.statCol}>
            <Text style={s.statKey}>Verify</Text>
            <TouchableOpacity onPress={() => Linking.openURL(verifyUrl)}>
              <Text style={[s.statVal, { color: '#4f46e5' }]}>rillcod.com/verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={s.body}>

        {/* Identity panel */}
        <View style={s.identityPanel}>
          <Text style={s.eyebrow}>Student Participant</Text>
          <Text style={s.studentName}>{studentName || report.student_name || '—'}</Text>
          <View style={s.divider} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Programme</Text>
            <Text style={s.fieldValue}>{report.course_name || '—'}</Text>
          </View>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Class / Section</Text>
            <Text style={s.fieldValue}>{report.section_class || '—'}</Text>
          </View>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>{isDevelopment ? 'Duration' : 'Academic Term'}</Text>
            <Text style={s.fieldValue}>
              {isDevelopment
                ? (report.course_duration || report.report_term || '—')
                : `${report.report_term || '—'}${report.report_period ? ` · ${report.report_period}` : ''}`}
            </Text>
          </View>
          {report.instructor_name ? (
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Instructor</Text>
              <Text style={s.fieldValue}>{report.instructor_name}</Text>
            </View>
          ) : null}
        </View>

        {/* Modules */}
        <View style={s.moduleRow}>
          <View style={s.moduleCurrent}>
            <Text style={s.moduleLabel}>Current Module</Text>
            <Text style={s.moduleValue}>{report.current_module || '—'}</Text>
          </View>
          <View style={s.moduleNext}>
            <Text style={[s.moduleLabel, { color: '#7c3aed' }]}>Upcoming Module</Text>
            <Text style={[s.moduleValue, { color: '#4c1d95' }]}>{report.next_module || '—'}</Text>
          </View>
        </View>

        {/* ── Performance Section ── */}
        <SectionTitle title="Final Performance Assessment" />

        {/* Scoring key legend */}
        <View style={s.scoringKey}>
          {[
            { label: 'Exam',   pts: 40, color: '#4f46e5' },
            { label: 'Eval',   pts: 20, color: '#0891b2' },
            { label: 'Assign', pts: 20, color: '#059669' },
            { label: 'Proj',   pts: 20, color: '#7c3aed' },
          ].map((k, i) => (
            <View key={k.label} style={s.keyItem}>
              <View style={[s.keyDot, { backgroundColor: k.color }]} />
              <Text style={[s.keyLabel, { color: k.color }]}>{k.label}</Text>
              <Text style={s.keyPts}>/{k.pts}</Text>
              {i < 3 && <Text style={s.keySep}>·</Text>}
            </View>
          ))}
          <Text style={s.keyTotal}> = 100</Text>
        </View>

        {/* Metric bars + Grade badge */}
        <View style={s.metricsGrid}>
          <View style={s.barsCol}>
            <MetricBar label="Examination"  value={theory}        color="#6366f1" weight="40%" />
            <MetricBar label="Evaluation"   value={practical}     color="#06b6d4" weight="20%" />
            <MetricBar label="Assignment"   value={attendance}    color="#10b981" weight="20%" />
            <MetricBar label="Proj. Engage" value={participation} color="#8b5cf6" weight="20%" />
          </View>
          <View style={[s.gradeBox, { borderColor: grade.color + '40' }]}>
            <LinearGradient colors={[grade.bg, '#ffffff']} style={StyleSheet.absoluteFill} />
            <Text style={s.gradeLabel}>Final Weighted Grade</Text>
            <Text style={[s.gradeLetter, { color: grade.color }]}>{grade.g}</Text>
            <View style={[s.gradeChip, { backgroundColor: grade.bg }]}>
              <Text style={[s.gradeChipText, { color: grade.color }]}>{grade.label}</Text>
            </View>
            <Text style={[s.gradePct, { color: grade.color }]}>{overall}%</Text>
          </View>
        </View>

        {/* ── Qualifiers ── */}
        {qualifiers.length > 0 && (
          <View style={s.qualifiersRow}>
            {qualifiers.map(q => (
              <View key={q.label} style={[s.qualifier, { backgroundColor: q.bg, borderColor: q.color + '40' }]}>
                <Text style={[s.qualifierLabel, { color: q.color }]}>{q.label}</Text>
                <Text style={s.qualifierValue} numberOfLines={2}>{q.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Strengths / Growth ── */}
        <View style={s.qualGrid}>
          <View style={[s.qualBox, s.strengthBox]}>
            <Text style={s.qualBoxTitle}>Core Strengths</Text>
            <Text style={s.strengthText}>
              {report.key_strengths || 'The student shows consistent effort and a dedicated approach to theoretical concepts.'}
            </Text>
          </View>
          <View style={[s.qualBox, s.growthBox]}>
            <Text style={[s.qualBoxTitle, { color: '#92400e' }]}>Growth Focus</Text>
            <Text style={s.growthText}>
              {report.areas_for_growth || 'Further immersion in practical projects will help build implementation confidence.'}
            </Text>
          </View>
        </View>

        {/* ── Instructor Assessment ── */}
        {report.instructor_assessment ? (
          <View style={s.instructorNote}>
            <Text style={s.instructorNoteLabel}>Instructor Assessment</Text>
            <Text style={s.instructorNoteText}>{report.instructor_assessment}</Text>
          </View>
        ) : null}

        {/* ── Learning Milestones ── */}
        {milestones.length > 0 && (
          <View style={s.milestonesBox}>
            <Text style={s.milestonesTitle}>Learning Milestones</Text>
            {milestones.map((m, i) => (
              <View key={i} style={s.milestoneRow}>
                <Text style={s.milestoneCheck}>✓</Text>
                <Text style={s.milestoneText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Certificate ── */}
        {showCertificate && (
          <MotiView
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 600, delay: 200 }}
            style={s.certificate}
          >
            <LinearGradient colors={['#fffbeb', '#fef9e7']} style={StyleSheet.absoluteFill} />
            <Text style={s.certificateCrown}>👑</Text>
            <Text style={s.certificateTitle}>Academic Excellence Award</Text>
            <Text style={s.certificateText}>
              {report.certificate_text || `This document officially recognises that ${studentName || report.student_name} has successfully completed the intensive study programme in ${report.course_name}.`}
            </Text>
          </MotiView>
        )}

        {/* ── Payment Notice ── */}
        {report.show_payment_notice && (
          <View style={s.paymentNotice}>
            <Text style={s.paymentNoticeTitle}>Next Term Fee Payment</Text>
            <Text style={s.paymentAmount}>₦{paymentAmount} · RILLCOD LTD</Text>
            <Text style={s.paymentBank}>Providus · 7901178957</Text>
            <Text style={s.paymentNote}>Use student name as reference · Send proof to admin</Text>
          </View>
        )}

        {/* ── Signature & QR ── */}
        <View style={s.footer}>
          <View style={s.signatureCol}>
            <Text style={s.sigLabel}>Signatory Authority</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>Mr Osahon</Text>
            <Text style={s.sigRole}>Director, Rillcod Technologies</Text>
          </View>
          <View style={s.qrCol}>
            <Image
              source={{ uri: qrUrl }}
              style={s.qrImage}
              resizeMode="contain"
            />
            <Text style={s.qrVerify}>VERIFY {(report.id || 'PREVIEW').toString().slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* ── PDF Export Buttons ── */}
        {onExportPDF && (
          <View style={s.exportRow}>
            <TouchableOpacity
              style={s.exportBtn}
              onPress={() => onExportPDF(false)}
              disabled={exportingPdf}
            >
              <Text style={s.exportBtnText}>{exportingPdf ? '...' : '📄 Export Standard PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.exportBtn, s.exportBtnModern]}
              onPress={() => onExportPDF(true)}
              disabled={exportingPdf}
            >
              <Text style={[s.exportBtnText, { color: '#4f46e5' }]}>{exportingPdf ? '...' : '✦ Export Modern PDF'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── BOTTOM GRADIENT BAR ── */}
      <LinearGradient
        colors={['#7c3aed', '#4f46e5', '#10b981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.bottomBar}
      />
    </MotiView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 3,
    borderColor: '#1a1a2e',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  topBar: { height: 5, backgroundColor: '#1a1a2e' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    borderLeftWidth: 5,
    borderLeftColor: '#1a1a2e',
    backgroundColor: '#fff',
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  logoBg: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText: { fontFamily: FONT_FAMILY.display, fontSize: 22, color: '#fff' },
  orgName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#111827', textTransform: 'uppercase', letterSpacing: -0.5 },
  orgTagline: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 1 },
  orgContact: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: '#9ca3af', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  officialBadge: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 100 },
  officialBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.8 },
  docTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: '#111827', textTransform: 'uppercase', letterSpacing: -0.5 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statsLeft: { flexDirection: 'row', gap: 16 },
  statsRight: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  statCol: { gap: 2 },
  statKey: { fontFamily: FONT_FAMILY.mono, fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 },
  statVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11, color: '#111827' },
  feeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  feeBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, fontWeight: '900' },

  // Body
  body: { padding: SPACING.lg, gap: 14 },

  // Identity
  identityPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 5,
    borderLeftColor: '#1a1a2e',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: '#fff',
    gap: 6,
  },
  eyebrow: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5 },
  studentName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: '#111827' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 2 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  fieldValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#374151', flex: 2, textAlign: 'right' },

  // Modules
  moduleRow: { flexDirection: 'row', gap: 8 },
  moduleCurrent: { flex: 1, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: RADIUS.md, padding: SPACING.sm, gap: 2 },
  moduleNext:    { flex: 1, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd', borderRadius: RADIUS.md, padding: SPACING.sm, gap: 2 },
  moduleLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
  moduleValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#1e293b', lineHeight: 16 },

  // Scoring key
  scoringKey: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  keyDot: { width: 6, height: 6, borderRadius: 3 },
  keyLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9 },
  keyPts: { fontFamily: FONT_FAMILY.mono, fontSize: 8, color: '#9ca3af' },
  keySep: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: '#d1d5db', marginHorizontal: 2 },
  keyTotal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 9, color: '#6b7280' },

  // Metrics + grade
  metricsGrid: { flexDirection: 'row', gap: 12 },
  barsCol: { flex: 1.6, gap: 10 },
  gradeBox: {
    flex: 1,
    borderWidth: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#1a1a2e',
    borderRadius: RADIUS.xl,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  gradeLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  gradeLetter: { fontFamily: FONT_FAMILY.display, fontSize: 60, lineHeight: 64, textAlign: 'center' },
  gradeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  gradeChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  gradePct: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.lg },

  // Qualifiers
  qualifiersRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  qualifier: { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, gap: 2 },
  qualifierLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '900' },
  qualifierValue: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: '#1e293b', lineHeight: 15 },

  // Strengths / Growth
  qualGrid: { flexDirection: 'row', gap: 10 },
  qualBox: { flex: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
  strengthBox: { backgroundColor: 'rgba(209,250,229,.5)', borderWidth: 1, borderColor: '#a7f3d0' },
  growthBox:   { backgroundColor: 'rgba(255,251,235,.7)', borderWidth: 1, borderColor: '#fde68a' },
  qualBoxTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#065f46', textTransform: 'uppercase', letterSpacing: 0.8 },
  strengthText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: 'rgba(6,95,70,.85)', lineHeight: 18 },
  growthText:   { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: 'rgba(120,53,15,.85)', lineHeight: 18 },

  // Instructor note
  instructorNote: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: RADIUS.md, padding: SPACING.sm, gap: 4 },
  instructorNoteLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
  instructorNoteText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: '#334155', lineHeight: 18 },

  // Milestones
  milestonesBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: RADIUS.md, padding: SPACING.md, gap: 6 },
  milestonesTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
  milestoneRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  milestoneCheck: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 12, color: '#4f46e5', marginTop: 1, flexShrink: 0 },
  milestoneText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: '#1e293b', lineHeight: 18, flex: 1 },

  // Certificate
  certificate: {
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  certificateCrown: { fontSize: 26 },
  certificateTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: '#a16207', textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center' },
  certificateText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: '#b45309', lineHeight: 18, textAlign: 'center', fontStyle: 'italic' },

  // Payment notice
  paymentNotice: { backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fcd34d', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 4 },
  paymentNoticeTitle: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 },
  paymentAmount: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: '#78350f' },
  paymentBank: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#78350f' },
  paymentNote: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: '#b45309', textAlign: 'center' },

  // Signature + QR
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 2,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 16,
  },
  signatureCol: { gap: 4 },
  sigLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  sigLine: { width: 140, height: 1, backgroundColor: '#111827', marginBottom: 4 },
  sigName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: '#111827' },
  sigRole: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' },
  qrCol: { alignItems: 'center', gap: 4 },
  qrImage: { width: 72, height: 72, borderWidth: 2, borderColor: '#f3f4f6', borderRadius: 12 },
  qrVerify: { fontFamily: FONT_FAMILY.mono, fontSize: 8, color: '#111827', textTransform: 'uppercase', letterSpacing: 1.2 },

  // Export buttons
  exportRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.sm },
  exportBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.info, alignItems: 'center' },
  exportBtnModern: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4f46e5' + '60' },
  exportBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 12, color: '#fff', letterSpacing: 0.3 },

  // Footer bar
  bottomBar: { height: 6 },
});

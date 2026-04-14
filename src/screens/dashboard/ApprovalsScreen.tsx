import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { approvalService } from '../../services/approval.service';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { AdminCollectionHeader } from '../../components/ui/AdminCollectionHeader';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';
import { RoleGuard } from '../../components/ui/RoleGuard';

type Tab = 'students' | 'schools' | 'prospective';

interface PendingStudent {
  id: string;
  full_name: string;
  student_email: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  school_id: string | null;
  school_name: string | null;
  current_class: string | null;
  grade_level: string | null;
  enrollment_type: string | null;
  goals: string | null;
  created_at: string;
  status: string;
  registration_payment_at?: string | null;
  registration_paystack_reference?: string | null;
}

interface PendingSchool {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  contact_person: string | null;
  student_count: number | null;
  school_type: string | null;
  status: string;
  created_at: string;
}

interface ProspectiveStudent {
  id: string;
  full_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  school_name: string | null;
  grade: string | null;
  course_interest: string | null;
  created_at: string;
}

interface Credentials {
  email: string;
  password: string;
  name: string;
  roleLabel?: string;
  targetLabel?: string;
  onOpenTarget?: () => void;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function Chip({ label, color = COLORS.textMuted }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '14' }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ code, message }: { code: string; message: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyCode}>{code}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function CredentialsModal({
  creds,
  onDone,
  onShare,
  exporting,
}: {
  creds: Credentials;
  onDone: () => void;
  onShare: () => void;
  exporting: boolean;
}) {
  return (
    <View style={styles.modalOverlay}>
      <MotiView from={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} style={styles.modalBox}>
        <LinearGradient colors={[COLORS.success + '16', 'transparent']} style={StyleSheet.absoluteFill} />
        <Text style={styles.modalCode}>OK</Text>
        <Text style={styles.modalTitle}>Approval complete</Text>
        <Text style={styles.modalName}>{creds.name}</Text>
        {creds.roleLabel ? <Text style={styles.modalRole}>{creds.roleLabel}</Text> : null}

        <View style={styles.credCard}>
          <Text style={styles.credLabel}>Email</Text>
          <Text style={styles.credValue} selectable>{creds.email}</Text>
        </View>

        <View style={[styles.credCard, styles.credCardHighlight]}>
          <Text style={styles.credLabel}>Temporary password</Text>
          <Text style={[styles.credValue, { color: COLORS.success }]} selectable>{creds.password}</Text>
        </View>

        <Text style={styles.modalNote}>Save these credentials now. This view is only shown once.</Text>

        <View style={styles.modalActions}>
          {creds.onOpenTarget ? (
            <TouchableOpacity onPress={creds.onOpenTarget} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryButtonText}>{creds.targetLabel ?? 'Open Record'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onShare} style={styles.modalSecondaryButton} disabled={exporting}>
            <Text style={styles.modalSecondaryButtonText}>{exporting ? 'Exporting...' : 'Share PDF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </MotiView>
    </View>
  );
}

export default function ApprovalsScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [schools, setSchools] = useState<PendingSchool[]>([]);
  const [prospective, setProspective] = useState<ProspectiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [exportingCredentials, setExportingCredentials] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';

  const shareCredentials = useCallback(async () => {
    if (!credentials) return;

    setExportingCredentials(true);
    try {
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
              .card { border: 1px solid #e5e7eb; padding: 24px; }
              .eyebrow { color: #c2410c; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
              h1 { margin: 8px 0 4px; font-size: 28px; }
              .sub { color: #4b5563; margin-bottom: 20px; }
              .row { border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 12px; }
              .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
              .value { font-size: 18px; font-weight: 700; }
              .accent { color: #15803d; }
              .foot { color: #6b7280; margin-top: 18px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="eyebrow">Rillcod Approval Credentials</div>
              <h1>${credentials.name}</h1>
              <div class="sub">${credentials.roleLabel ?? 'Portal account'}</div>
              <div class="row">
                <div class="label">Email</div>
                <div class="value">${credentials.email}</div>
              </div>
              <div class="row">
                <div class="label">Temporary Password</div>
                <div class="value accent">${credentials.password}</div>
              </div>
              <div class="foot">Generated ${new Date().toLocaleString()}. Share securely and prompt the recipient to update their password on first login.</div>
            </div>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${credentials.name} credentials`,
        });
      } else {
        Alert.alert('Export ready', file.uri);
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Could not create credential PDF');
    } finally {
      setExportingCredentials(false);
    }
  }, [credentials]);

  const load = useCallback(async () => {
    try {
      const { pendingStudents, pendingSchools, prospective: prospects } = await approvalService.loadApprovalsQueues();
      setStudents(pendingStudents as PendingStudent[]);
      setSchools(pendingSchools as PendingSchool[]);
      setProspective(prospects as ProspectiveStudent[]);
    } catch (e: any) {
      Alert.alert('Load failed', e?.message ?? 'Could not load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const approveStudent = (student: PendingStudent) => {
    Alert.alert('Approve Student', `Approve ${student.full_name} and create a portal account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(student.id);
          const rawEmail = (student.student_email || student.parent_email || '').trim();
          const email = rawEmail || `student_${student.id.slice(0, 6)}@rillcod.school`;
          const password = genPassword();

          try {
            const { portalUserId } = await approvalService.approvePendingStudentWithAuth({
              student: {
                ...student,
                registration_payment_at: student.registration_payment_at ?? null,
                registration_paystack_reference: student.registration_paystack_reference ?? null,
              },
              email,
              password,
              approvedBy: profile?.id ?? null,
            });

            setStudents((prev) => prev.filter((item) => item.id !== student.id));
            setCredentials({
              email,
              password,
              name: student.full_name,
              roleLabel: 'Student account',
              targetLabel: 'Open Student',
              onOpenTarget: portalUserId
                ? () => navigation.navigate(ROUTES.StudentDetail, { studentId: portalUserId })
                : () => navigation.navigate(ROUTES.Students),
            });
          } catch (err: any) {
            Alert.alert('Approval Failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const rejectStudent = (student: PendingStudent) => {
    Alert.alert('Reject Student', `Reject ${student.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(student.id);
          try {
            await approvalService.rejectPendingStudent(student.id);
            setStudents((prev) => prev.filter((item) => item.id !== student.id));
          } catch (err: any) {
            Alert.alert('Reject failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const approveSchool = (school: PendingSchool) => {
    Alert.alert('Approve School', `Approve ${school.name} and create a school account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(school.id);
          const email = school.email ?? `school_${school.id.slice(0, 6)}@rillcod.school`;
          const password = genPassword();

          try {
            await approvalService.approvePendingSchoolWithAuth({ school, email, password });

            setSchools((prev) => prev.filter((item) => item.id !== school.id));
            setCredentials({
              email,
              password,
              name: school.name,
              roleLabel: 'School account',
              targetLabel: 'Open School',
              onOpenTarget: () => navigation.navigate(ROUTES.SchoolDetail, { schoolId: school.id }),
            });
          } catch (err: any) {
            Alert.alert('Approval Failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const rejectSchool = (school: PendingSchool) => {
    Alert.alert('Reject School', `Reject ${school.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(school.id);
          try {
            await approvalService.rejectPendingSchool(school.id);
            setSchools((prev) => prev.filter((item) => item.id !== school.id));
          } catch (err: any) {
            Alert.alert('Reject failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const approveProspective = (student: ProspectiveStudent) => {
    Alert.alert('Accept Prospect', `Accept ${student.full_name} into the intake pipeline?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setProcessing(student.id);
          try {
            await approvalService.activateProspectiveStudent(student.id);
            setProspective((prev) => prev.filter((item) => item.id !== student.id));
          } catch (err: any) {
            Alert.alert('Accept failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const rejectProspective = (student: ProspectiveStudent) => {
    Alert.alert('Reject prospect', `Dismiss ${student.full_name} from the summer-school queue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(student.id);
          try {
            await approvalService.rejectProspectiveStudent(student.id);
            setProspective((prev) => prev.filter((item) => item.id !== student.id));
          } catch (err: any) {
            Alert.alert('Reject failed', err?.message ?? 'Unknown error');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const tabs = useMemo(
    () => [
      { key: 'students' as Tab, label: 'Students', count: students.length, code: 'ST' },
      { key: 'prospective' as Tab, label: 'Summer', count: prospective.length, code: 'PR' },
      ...(isAdmin ? [{ key: 'schools' as Tab, label: 'Schools', count: schools.length, code: 'SC' }] : []),
    ],
    [isAdmin, students.length, schools.length, prospective.length]
  );

  const totalPending = students.length + schools.length + prospective.length;

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.success} size="large" />
        <Text style={styles.loadText}>Loading approvals...</Text>
      </View>
    );
  }

  return (
    <RoleGuard allow={['admin', 'teacher']} navigation={navigation}>
    <SafeAreaView style={styles.safe}>
      <AdminCollectionHeader
        title="Approvals"
        subtitle={`${totalPending} pending · queue oldest-first · ${isAdmin ? 'admin' : isTeacher ? 'teacher' : 'staff'}`}
        onBack={() => goBackOrTo(navigation, ROUTES.PeopleHub)}
        colors={COLORS}
      />

      <View style={styles.summaryStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalPending}</Text>
          <Text style={styles.summaryLabel}>Queue</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{students.length + schools.length}</Text>
          <Text style={styles.summaryLabel}>Accounts</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{prospective.length}</Text>
          <Text style={styles.summaryLabel}>Prospects</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
          >
            <Text style={[styles.tabCode, tab === item.key && styles.tabCodeActive]}>{item.code}</Text>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            <View style={[styles.tabBadge, tab === item.key && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, tab === item.key && styles.tabBadgeTextActive]}>{item.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.success} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {tab === 'students' &&
          (students.length === 0 ? (
            <EmptyState code="ST" message="No pending student applications." />
          ) : (
            students.map((student, index) => (
              <MotiView
                key={student.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 40 }}
              >
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.success + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTop}>
                    <View style={[styles.codeBox, { backgroundColor: COLORS.success + '16', borderColor: COLORS.success + '30' }]}>
                      <Text style={[styles.codeText, { color: COLORS.success }]}>ST</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{student.full_name}</Text>
                      <Text style={styles.cardSub}>
                        {student.student_email?.trim() || student.parent_email?.trim() || 'Portal email will be generated'}
                      </Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(student.created_at)}</Text>
                  </View>

                  <View style={styles.metaWrap}>
                    {student.registration_payment_at ? (
                      <Chip label="Reg. fee paid" color={COLORS.success} />
                    ) : (
                      <Chip label="Reg. fee unpaid" color={COLORS.textMuted} />
                    )}
                    {student.school_name ? <Chip label={student.school_name} color={COLORS.info} /> : null}
                    {student.current_class ? <Chip label={student.current_class} color={COLORS.primary} /> : null}
                    {student.grade_level ? <Chip label={student.grade_level} color={COLORS.warning} /> : null}
                    {student.enrollment_type ? <Chip label={student.enrollment_type} color={COLORS.success} /> : null}
                  </View>

                  {student.goals ? (
                    <Text style={styles.supportingText} numberOfLines={2}>
                      Goal: {student.goals}
                    </Text>
                  ) : null}
                  {student.parent_name || student.parent_phone || student.parent_email ? (
                    <Text style={styles.supportingText}>
                      Parent: {student.parent_name ?? 'Unknown'}
                      {student.parent_email ? ` · ${student.parent_email}` : ''}
                      {student.parent_phone ? ` · ${student.parent_phone}` : ''}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => rejectStudent(student)}
                      disabled={processing === student.id}
                      style={[styles.rejectButton, processing === student.id && styles.buttonDisabled]}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => approveStudent(student)}
                      disabled={processing === student.id}
                      style={[styles.approveButton, processing === student.id && styles.buttonDisabled]}
                    >
                      {processing === student.id ? (
                        <ActivityIndicator color={COLORS.white100} size="small" />
                      ) : (
                        <Text style={styles.approveText}>Approve and Create</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </MotiView>
            ))
          ))}

        {tab === 'schools' && isAdmin &&
          (schools.length === 0 ? (
            <EmptyState code="SC" message="No pending school applications." />
          ) : (
            schools.map((school, index) => (
              <MotiView
                key={school.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 40 }}
              >
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.info + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTop}>
                    <View style={[styles.codeBox, { backgroundColor: COLORS.info + '16', borderColor: COLORS.info + '30' }]}>
                      <Text style={[styles.codeText, { color: COLORS.info }]}>SC</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{school.name}</Text>
                      <Text style={styles.cardSub}>{school.email ?? 'Account email will be generated'}</Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(school.created_at)}</Text>
                  </View>

                  <View style={styles.metaWrap}>
                    {school.city || school.state ? <Chip label={`${school.city ?? ''}${school.city && school.state ? ', ' : ''}${school.state ?? ''}`} color={COLORS.info} /> : null}
                    {school.school_type ? <Chip label={school.school_type} color={COLORS.primary} /> : null}
                    {school.student_count ? <Chip label={`${school.student_count} students`} color={COLORS.warning} /> : null}
                  </View>

                  {school.contact_person ? <Text style={styles.supportingText}>Contact: {school.contact_person}</Text> : null}
                  {school.phone ? <Text style={styles.supportingText}>Phone: {school.phone}</Text> : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => rejectSchool(school)}
                      disabled={processing === school.id}
                      style={[styles.rejectButton, processing === school.id && styles.buttonDisabled]}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => approveSchool(school)}
                      disabled={processing === school.id}
                      style={[styles.approveButton, processing === school.id && styles.buttonDisabled]}
                    >
                      {processing === school.id ? (
                        <ActivityIndicator color={COLORS.white100} size="small" />
                      ) : (
                        <Text style={styles.approveText}>Approve and Create</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </MotiView>
            ))
          ))}

        {tab === 'prospective' &&
          (prospective.length === 0 ? (
            <EmptyState code="PR" message="No prospective applications right now." />
          ) : (
            prospective.map((student, index) => (
              <MotiView
                key={student.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: index * 40 }}
              >
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.warning + '10', 'transparent']} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTop}>
                    <View style={[styles.codeBox, { backgroundColor: COLORS.warning + '16', borderColor: COLORS.warning + '30' }]}>
                      <Text style={[styles.codeText, { color: COLORS.warning }]}>PR</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{student.full_name}</Text>
                      <Text style={styles.cardSub}>{student.parent_email ?? 'Parent email not provided'}</Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(student.created_at)}</Text>
                  </View>

                  <View style={styles.metaWrap}>
                    {student.school_name ? <Chip label={student.school_name} color={COLORS.info} /> : null}
                    {student.grade ? <Chip label={`Grade ${student.grade}`} color={COLORS.primary} /> : null}
                    {student.course_interest ? <Chip label={student.course_interest} color={COLORS.warning} /> : null}
                  </View>

                  {student.parent_phone ? <Text style={styles.supportingText}>Phone: {student.parent_phone}</Text> : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => rejectProspective(student)}
                      disabled={processing === student.id}
                      style={[styles.rejectButton, processing === student.id && styles.buttonDisabled]}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => approveProspective(student)}
                      disabled={processing === student.id}
                      style={[styles.approveButton, processing === student.id && styles.buttonDisabled]}
                    >
                      {processing === student.id ? (
                        <ActivityIndicator color={COLORS.white100} size="small" />
                      ) : (
                        <Text style={styles.approveText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </MotiView>
            ))
          ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {credentials ? (
        <CredentialsModal
          creds={credentials}
          onDone={() => setCredentials(null)}
          onShare={shareCredentials}
          exporting={exportingCredentials}
        />
      ) : null}
    </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  summaryStrip: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  summaryLabel: {
    marginTop: 4,
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  tabButtonActive: {
    backgroundColor: COLORS.success + '12',
    borderColor: COLORS.success + '50',
  },
  tabCode: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: LETTER_SPACING.wider,
  },
  tabCodeActive: { color: COLORS.success },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.textPrimary },
  tabBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: COLORS.success + '20' },
  tabBadgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 9, color: COLORS.textSecondary },
  tabBadgeTextActive: { color: COLORS.success },
  list: { paddingHorizontal: SPACING.xl },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  codeBox: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.wider,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  cardSub: { marginTop: 2, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardTime: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  chipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  supportingText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.error },
  approveButton: {
    flex: 1.6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  acceptButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warning,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  buttonDisabled: { opacity: 0.6 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textMuted },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bg,
    padding: SPACING.xl,
    overflow: 'hidden',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.success },
  modalTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  modalName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  modalRole: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.success, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  credCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 4,
  },
  credCardHighlight: { borderColor: COLORS.success + '30' },
  credLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
  },
  credValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  modalNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning, textAlign: 'center' },
  modalActions: { width: '100%', flexDirection: 'row', gap: SPACING.sm },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
  },
  modalSecondaryButtonText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  modalButtonText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
});

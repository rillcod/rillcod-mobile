
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { registrationService } from '../../services/registration.service';
import type { Database } from '../../types/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

interface School {
  id: string;
  name: string;
}

interface ParsedUser {
  name: string;
  email: string;
  className?: string;
  password: string;
  status: 'pending' | 'done' | 'error';
  error?: string;
}

interface BatchHistory {
  id: string;
  school_name: string | null;
  class_name: string | null;
  student_count: number | null;
  created_at: string | null;
}

interface BatchResult {
  id: string;
  batch_id: string;
  full_name: string;
  email: string;
  password: string;
  class_name: string | null;
  status: string;
  error: string | null;
  created_at: string | null;
}

type RegisterType = 'student' | 'teacher';
type Step = 'input' | 'preview' | 'result' | 'history';

const GRADE_LEVELS = [
  'Nursery 1', 'Nursery 2',
  'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
];

const CLASS_RE = /\b(JSS\s*[123]|SS[S]?\s*[123]|BASIC\s*[1-6])([A-Za-z])?\b/i;

function detectClass(text: string) {
  const match = text.match(CLASS_RE);
  if (!match) return null;
  const base = match[1].replace(/\s+/g, ' ').trim().toUpperCase();
  const section = (match[2] ?? '').toUpperCase();
  return `${base}${section}`;
}

function isClassHeader(line: string) {
  const clean = line.trim().replace(/[:\-–—.]/g, '').trim();
  return CLASS_RE.test(clean) && clean.replace(CLASS_RE, '').trim() === '';
}

function stripClass(name: string) {
  return name.replace(CLASS_RE, '').replace(/\s{2,}/g, ' ').trim();
}

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function timeAgo(date?: string | null) {
  if (!date) return 'recently';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BulkRegisterScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('input');
  const [type, setType] = useState<RegisterType>('student');
  const [rawText, setRawText] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState({ id: profile?.school_id ?? '', name: profile?.school_name ?? '' });
  const [parsed, setParsed] = useState<ParsedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({ success: 0, failed: 0 });
  const [batchId, setBatchId] = useState<string | null>(null);
  const [history, setHistory] = useState<BatchHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [loadingBatchResults, setLoadingBatchResults] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rows = await registrationService.listRecentBatches({
        isAdmin,
        schoolId: profile?.school_id,
        role: profile?.role,
        createdByUserId: profile?.role === 'teacher' ? profile.id : null,
        limit: 20,
      });
      setHistory(rows as BatchHistory[]);
    } finally {
      setLoadingHistory(false);
    }
  }, [isAdmin, profile?.school_id, profile?.role, profile?.id]);

  const loadBatchResults = useCallback(async (targetBatchId: string) => {
    setSelectedBatchId(targetBatchId);
    setLoadingBatchResults(true);
    try {
      const rows = await registrationService.listResultsForBatch(targetBatchId);
      setBatchResults(rows as BatchResult[]);
    } finally {
      setLoadingBatchResults(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      registrationService
        .listApprovedSchoolSummaries(100)
        .then((data) => setSchools(data as School[]))
        .catch(() => setSchools([]));
    }
    loadHistory();
  }, [isAdmin, loadHistory]);

  const latestBatch = useMemo(() => history[0] ?? null, [history]);

  const parse = () => {
    const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      Alert.alert('Enter at least one name');
      return;
    }
    if (lines.length > 100) {
      Alert.alert('Maximum 100 entries at once');
      return;
    }
    if (isAdmin && !selectedSchool.id) {
      Alert.alert('Select a school first');
      return;
    }

    let contextClass: string | null = null;
    const users: ParsedUser[] = [];

    for (const line of lines) {
      if (isClassHeader(line)) {
        contextClass = detectClass(line);
        continue;
      }

      const inlineClass = detectClass(line);
      const cleanedName = inlineClass ? stripClass(line) : line;
      if (!cleanedName) continue;

      users.push({
        name: cleanedName,
        email: `${slugify(cleanedName)}@rillcod.school`,
        className: inlineClass ?? contextClass ?? undefined,
        password: genPassword(),
        status: 'pending',
      });
    }

    if (users.length === 0) {
      Alert.alert('No valid names found');
      return;
    }

    setParsed(users);
    setStep('preview');
  };

  const editEntry = (idx: number, field: 'name' | 'email', value: string) => {
    setParsed((prev) => prev.map((entry, entryIndex) => {
      if (entryIndex !== idx) return entry;
      const updated = { ...entry, [field]: value };
      if (field === 'name') {
        updated.email = `${slugify(value)}@rillcod.school`;
      }
      return updated;
    }));
  };

  const removeEntry = (idx: number) => {
    setParsed((prev) => prev.filter((_, entryIndex) => entryIndex !== idx));
  };
  const exportResults = useCallback(async (rows: BatchResult[], title: string) => {
    if (rows.length === 0) {
      Alert.alert('No rows to export');
      return;
    }

    setExporting(true);
    try {
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
              h1 { color: #c2410c; margin-bottom: 4px; }
              p { color: #4b5563; margin-top: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 24px; }
              th, td { border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; text-align: left; }
              th { background: #0f172a; color: #ffffff; }
              .ok { color: #15803d; font-weight: 700; }
              .bad { color: #b91c1c; font-weight: 700; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>Generated ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Class</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>${row.full_name}</td>
                    <td>${row.email}</td>
                    <td>${row.password}</td>
                    <td>${row.class_name ?? '-'}</td>
                    <td class="${row.status === 'failed' ? 'bad' : 'ok'}">${row.status}${row.error ? `: ${row.error}` : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `${title} PDF` });
      } else {
        Alert.alert('Export ready', file.uri);
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.message ?? 'Could not generate PDF');
    } finally {
      setExporting(false);
    }
  }, []);

  const submit = async () => {
    if (parsed.length === 0) {
      Alert.alert('Nothing to register');
      return;
    }

    setSaving(true);
    let success = 0;
    let failed = 0;
    const updated = [...parsed];

    const classLabel = gradeLevel || parsed.find((entry) => entry.className)?.className || null;

    let currentBatchId: string;
    try {
      currentBatchId = await registrationService.createBatch({
        school_id: selectedSchool.id || null,
        school_name: selectedSchool.name || null,
        class_name: classLabel,
        student_count: parsed.length,
        created_by: profile?.id ?? null,
      });
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Batch setup failed', e?.message ?? 'Could not create registration batch');
      return;
    }
    setBatchId(currentBatchId);

    for (let i = 0; i < updated.length; i++) {
      const user = updated[i];
      let errorMessage: string | null = null;

      try {
        if (type === 'teacher') {
          const row: Database['public']['Tables']['portal_users']['Insert'] = {
            full_name: user.name.trim(),
            email: user.email.trim(),
            role: 'teacher',
            school_name: selectedSchool.name || null,
            school_id: selectedSchool.id || null,
            is_active: false,
            is_deleted: false,
            section_class: user.className ?? null,
          };
          await registrationService.insertPendingTeacher(row);
        } else {
          const row: Database['public']['Tables']['students']['Insert'] = {
            name: user.name.trim(),
            full_name: user.name.trim(),
            student_email: user.email.trim(),
            school_name: selectedSchool.name || null,
            school_id: selectedSchool.id || null,
            status: 'pending',
            created_by: profile?.id ?? null,
            grade_level: gradeLevel || null,
            current_class: user.className ?? (gradeLevel || null),
          };
          await registrationService.insertProspectiveStudent(row);
        }

        updated[i] = { ...user, status: 'done', error: undefined };
        success++;
      } catch (error: any) {
        errorMessage = error?.message ?? 'Unknown error';
        updated[i] = { ...user, status: 'error', error: errorMessage ?? 'Unknown error' };
        failed++;
      }

      await registrationService.recordBatchResult({
        batch_id: currentBatchId,
        full_name: user.name.trim(),
        email: user.email.trim(),
        password: user.password,
        class_name: user.className ?? (gradeLevel || null),
        status: errorMessage ? 'failed' : 'created',
        error: errorMessage,
      });

      setParsed([...updated]);
    }

    setResults({ success, failed });
    setSaving(false);
    setStep('result');
    await loadHistory();
    await loadBatchResults(currentBatchId);
  };

  const renderInput = () => (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Bulk Register"
        onBack={() => goBackOrTo(navigation, ROUTES.PeopleHub)}
        accentColor={COLORS.primary}
        rightAction={{ label: 'History', onPress: () => setStep('history') }}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.heroCard}>
            <LinearGradient colors={[COLORS.primary + '18', 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={styles.heroEyebrow}>Registration Workspace</Text>
            <Text style={styles.heroTitle}>Single source for batch intake, saved runs, and export follow-up.</Text>
            <Text style={styles.heroMeta}>
              {latestBatch ? `Last batch ${timeAgo(latestBatch.created_at)} · ${latestBatch.student_count ?? 0} records` : 'No saved registration batches yet'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Register As</Text>
            <View style={styles.typeRow}>
              {(['student', 'teacher'] as RegisterType[]).map((entryType) => (
                <TouchableOpacity
                  key={entryType}
                  style={[styles.typePill, type === entryType && styles.typePillActive]}
                  onPress={() => setType(entryType)}
                >
                  <Text style={styles.typeText}>{entryType === 'student' ? 'Students' : 'Teachers'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {isAdmin ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>School</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                {schools.map((school) => (
                  <TouchableOpacity
                    key={school.id}
                    onPress={() => setSelectedSchool({ id: school.id, name: school.name })}
                    style={[styles.pill, selectedSchool.id === school.id && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, selectedSchool.id === school.id && styles.pillTextActive]} numberOfLines={1}>
                      {school.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>School</Text>
              <View style={styles.lockCard}>
                <Text style={styles.lockValue}>{selectedSchool.name || 'No school linked'}</Text>
                <Text style={styles.lockHint}>Using your assigned school automatically.</Text>
              </View>
            </View>
          )}

          {type === 'student' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Default Grade</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setShowGradePicker((value) => !value)}>
                <Text style={[styles.pickerText, !gradeLevel && styles.placeholderText]}>
                  {gradeLevel || 'Select grade'}
                </Text>
                <Text style={styles.pickerChevron}>{showGradePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showGradePicker ? (
                <View style={styles.dropDown}>
                  {GRADE_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => { setGradeLevel(level); setShowGradePicker(false); }}
                      style={[styles.dropItem, gradeLevel === level && styles.dropItemActive]}
                    >
                      <Text style={[styles.dropItemText, gradeLevel === level && styles.dropItemTextActive]}>{level}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Names Or Class Blocks</Text>
            <Text style={styles.hint}>Paste one name per line, or use class headers like `JSS 1A` followed by names underneath.</Text>
            <TextInput
              style={styles.bigInput}
              value={rawText}
              onChangeText={setRawText}
              placeholder={'JSS 1A\nAmara Johnson\nKwame Osei\n\nSS 2\nFatima Hassan'}
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={12}
              textAlignVertical="top"
              autoCapitalize="words"
            />
            <Text style={styles.countLabel}>{rawText.split('\n').filter((line) => line.trim()).length} lines entered</Text>
          </View>

          <TouchableOpacity onPress={parse} style={styles.primaryButton}>
            <LinearGradient colors={COLORS.gradPrimary} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>Preview Batch</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('history')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Open Batch History</Text>
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
  const renderPreview = () => (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={`Preview (${parsed.length})`}
        onBack={() => setStep('input')}
        accentColor={COLORS.warning}
        rightAction={{ label: saving ? 'Saving...' : 'Register', onPress: submit }}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.previewHint}>Review this batch before writing it to the registration queue.</Text>
        {parsed.map((entry, index) => (
          <MotiView key={`${entry.email}-${index}`} from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }}>
            <View style={styles.previewRow}>
              <View style={styles.previewNum}>
                <Text style={styles.previewNumText}>{index + 1}</Text>
              </View>
              <View style={styles.previewBody}>
                <TextInput
                  style={styles.previewName}
                  value={entry.name}
                  onChangeText={(value) => editEntry(index, 'name', value)}
                  placeholder="Full name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.previewEmail}
                  value={entry.email}
                  onChangeText={(value) => editEntry(index, 'email', value)}
                  placeholder="Email"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {entry.className ? <Text style={styles.previewMeta}>Class: {entry.className}</Text> : null}
                <Text style={styles.previewPassword}>Temp password: {entry.password}</Text>
              </View>
              <TouchableOpacity onPress={() => removeEntry(index)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>×</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        ))}

        <View style={styles.previewActions}>
          <TouchableOpacity onPress={() => setStep('input')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Edit Input</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submit}
            disabled={saving || parsed.length === 0}
            style={[styles.submitBtn, (saving || parsed.length === 0) && styles.buttonDisabled]}
          >
            <LinearGradient colors={COLORS.gradPrimary} style={styles.submitGrad}>
              {saving ? <ActivityIndicator color={COLORS.white100} /> : <Text style={styles.submitText}>Register All</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );

  const renderResult = () => (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Registration Complete"
        onBack={() => setStep('input')}
        accentColor={COLORS.success}
        rightAction={{ label: 'History', onPress: () => setStep('history') }}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.resultCard}>
          <LinearGradient colors={[COLORS.success + '12', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.resultTitle}>Batch saved to the mobile registry.</Text>
          <Text style={styles.resultMeta}>Batch ID: {batchId?.slice(0, 8) ?? 'N/A'}</Text>
          <View style={styles.resultStats}>
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatVal, { color: COLORS.success }]}>{results.success}</Text>
              <Text style={styles.resultStatLabel}>Succeeded</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatVal, { color: results.failed > 0 ? COLORS.error : COLORS.textMuted }]}>{results.failed}</Text>
              <Text style={styles.resultStatLabel}>Failed</Text>
            </View>
          </View>
        </View>

        {parsed.map((entry, index) => (
          <View key={`${entry.email}-${index}`} style={[styles.resultRow, { borderColor: entry.status === 'done' ? COLORS.success + '40' : COLORS.error + '40' }]}>
            <Text style={styles.resultStatus}>{entry.status === 'done' ? 'OK' : 'ERR'}</Text>
            <View style={styles.resultBody}>
              <Text style={styles.resultName}>{entry.name}</Text>
              <Text style={styles.resultEmail}>{entry.email}</Text>
              <Text style={styles.resultEmail}>Password: {entry.password}</Text>
              {entry.className ? <Text style={styles.resultEmail}>Class: {entry.className}</Text> : null}
              {entry.error ? <Text style={styles.resultError}>{entry.error}</Text> : null}
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => exportResults(batchResults, `Rillcod Batch ${batchId?.slice(0, 8) ?? ''}`)}
          disabled={exporting || batchResults.length === 0}
          style={[styles.secondaryButton, (exporting || batchResults.length === 0) && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryText}>{exporting ? 'Exporting PDF...' : 'Export Batch PDF'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          setParsed([]);
          setRawText('');
          setGradeLevel('');
          setBatchId(null);
          setStep('input');
        }} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Start Another Batch</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );

  const renderHistory = () => (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Batch History"
        onBack={() => setStep(batchId ? 'result' : 'input')}
        accentColor={COLORS.info}
        rightAction={{ label: 'Refresh', onPress: loadHistory }}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loadingHistory ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : null}

        {history.map((batch) => (
          <TouchableOpacity
            key={batch.id}
            onPress={() => loadBatchResults(batch.id)}
            style={[styles.historyCard, selectedBatchId === batch.id && styles.historyCardActive]}
          >
            <View style={styles.historyTop}>
              <Text style={styles.historyTitle}>{batch.school_name || 'Rillcod Batch'}</Text>
              <Text style={styles.historyCode}>{batch.id.slice(0, 8)}</Text>
            </View>
            <Text style={styles.historyMeta}>
              {batch.student_count ?? 0} records · {batch.class_name || 'Mixed classes'} · {timeAgo(batch.created_at)}
            </Text>
          </TouchableOpacity>
        ))}

        {history.length === 0 && !loadingHistory ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyCode}>RG</Text>
            <Text style={styles.emptyText}>No saved registration batches yet.</Text>
          </View>
        ) : null}

        {selectedBatchId ? (
          <View style={styles.historyDetail}>
            <View style={styles.historyDetailTop}>
              <Text style={styles.sectionTitle}>Batch Results</Text>
              <TouchableOpacity
                onPress={() => exportResults(batchResults, `Rillcod Batch ${selectedBatchId.slice(0, 8)}`)}
                disabled={exporting || batchResults.length === 0}
              >
                <Text style={styles.inlineAction}>{exporting ? 'Exporting...' : 'Export PDF'}</Text>
              </TouchableOpacity>
            </View>

            {loadingBatchResults ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : null}

            {batchResults.map((row) => (
              <View key={row.id} style={styles.batchRow}>
                <View style={styles.batchBadge}>
                  <Text style={styles.batchBadgeText}>{row.status === 'failed' ? 'ER' : 'OK'}</Text>
                </View>
                <View style={styles.batchBody}>
                  <Text style={styles.batchName}>{row.full_name}</Text>
                  <Text style={styles.batchSub}>{row.email}</Text>
                  <Text style={styles.batchSub}>Password: {row.password}</Text>
                  {row.class_name ? <Text style={styles.batchSub}>Class: {row.class_name}</Text> : null}
                  {row.error ? <Text style={styles.resultError}>{row.error}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );

  if (step === 'preview') return renderPreview();
  if (step === 'result') return renderResult();
  if (step === 'history') return renderHistory();

  return renderInput();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  heroCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: 8,
  },
  heroTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 8 },
  heroMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 20 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
    marginBottom: SPACING.sm,
  },
  hint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.sm },
  typeRow: { flexDirection: 'row', gap: SPACING.md },
  typePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
  },
  typePillActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  typeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  pills: { gap: SPACING.sm, paddingVertical: 2 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    maxWidth: 190,
  },
  pillActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.primary },
  lockCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  lockValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  lockHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  picker: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  pickerChevron: { fontSize: 12, color: COLORS.textMuted },
  placeholderText: { color: COLORS.textMuted },
  dropDown: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropItemActive: { backgroundColor: COLORS.primary + '15' },
  dropItemText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  dropItemTextActive: { color: COLORS.primary, fontFamily: FONT_FAMILY.bodySemi },
  bigInput: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    minHeight: 220,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  countLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6, textAlign: 'right' },
  primaryButton: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  primaryGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
  },
  secondaryText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  previewHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.md },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
  },
  previewNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  previewNumText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 11, color: COLORS.primary },
  previewBody: { flex: 1, gap: 4 },
  previewName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, paddingVertical: Platform.OS === 'ios' ? 4 : 2 },
  previewEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, paddingVertical: Platform.OS === 'ios' ? 4 : 2 },
  previewMeta: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  previewPassword: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error + '15', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 14, color: COLORS.error },
  previewActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  backBtn: { paddingHorizontal: SPACING.md, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  submitBtn: { flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  submitGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100, textTransform: 'uppercase', letterSpacing: 1 },
  buttonDisabled: { opacity: 0.5 },
  resultCard: {
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  resultTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, marginBottom: 6 },
  resultMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md },
  resultStats: { flexDirection: 'row', gap: SPACING.xl },
  resultStat: { alignItems: 'center', gap: 4 },
  resultStatVal: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['3xl'] },
  resultStatLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultRow: { flexDirection: 'row', gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard },
  resultStatus: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  resultBody: { flex: 1, gap: 2 },
  resultName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  resultEmail: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  resultError: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.error },
  doneBtn: { paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', marginTop: SPACING.lg },
  doneBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.white100 },
  loader: { marginVertical: SPACING.lg },
  historyCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  historyCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.md },
  historyTitle: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  historyCode: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  historyMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 },
  emptyState: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', backgroundColor: COLORS.bgCard },
  emptyCode: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.primary, marginBottom: 8 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },
  historyDetail: { marginTop: SPACING.xl },
  historyDetailTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  inlineAction: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wider },
  batchRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
  },
  batchBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  batchBadgeText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: COLORS.primary },
  batchBody: { flex: 1, gap: 2 },
  batchName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  batchSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  bottomPad: { height: 36 },
});

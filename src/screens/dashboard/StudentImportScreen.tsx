import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { shareCsv } from '../../lib/csv';
import { parseStudentImportCsv, studentImportService, type ParsedImportStudent } from '../../services/student-import.service';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const TEMPLATE_ROWS: string[][] = [
  ['full_name', 'student_email', 'parent_email', 'parent_name', 'parent_phone', 'grade', 'section', 'enrollment_type'],
  ['Ada Lovelace', 'ada@example.com', 'parent@example.com', 'Mrs Lovelace', '08000000000', 'JSS 2', 'A', 'school'],
];

export default function StudentImportScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedImportStudent[]>([]);
  const [importing, setImporting] = useState(false);

  const canUse = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const onParse = () => {
    setParsed(parseStudentImportCsv(raw));
  };

  const onImport = async () => {
    const valid = parsed.filter((r) => !r._error);
    if (!valid.length) {
      Alert.alert('Import', 'No valid rows. Paste CSV with a header row and tap Parse.');
      return;
    }
    setImporting(true);
    try {
      const res = await studentImportService.importPendingRows(valid, {
        schoolId: profile?.school_id ?? null,
        schoolName: profile?.school_name ?? null,
      });
      Alert.alert(
        'Import finished',
        `${res.success} created · ${res.failed} skipped/failed` + (res.errors.length ? `\n\n${res.errors.slice(0, 8).join('\n')}` : ''),
      );
      if (res.success > 0) setRaw('');
    } catch (e: any) {
      Alert.alert('Import', e?.message ?? 'Failed');
    } finally {
      setImporting(false);
    }
  };

  const exportTemplate = () => void shareCsv('students_import_template.csv', TEMPLATE_ROWS);

  if (!canUse) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Import students" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.muted}>Available to admin, teacher, and school accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Import students"
        subtitle="Paste CSV → pending registrations (matches web columns)"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={exportTemplate} style={[styles.btn, { borderColor: colors.primary, backgroundColor: colors.primaryPale }]}>
          <Text style={[styles.btnText, { color: colors.primary }]}>SHARE TEMPLATE CSV</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.textMuted }]}>Paste file contents</Text>
        <TextInput
          multiline
          value={raw}
          onChangeText={setRaw}
          placeholder="full_name,student_email,parent_email,..."
          placeholderTextColor={colors.textMuted}
          style={[styles.area, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
        />

        <View style={styles.row}>
          <TouchableOpacity onPress={onParse} style={[styles.btn, { flex: 1, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>PARSE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={importing || !parsed.filter((r) => !r._error).length}
            onPress={() => void onImport()}
            style={[
              styles.btn,
              { flex: 1, borderColor: colors.primary, backgroundColor: colors.primary, opacity: importing ? 0.6 : 1 },
            ]}
          >
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.btnText, { color: '#fff' }]}>IMPORT PENDING</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {parsed.length ? `${parsed.length} row(s) · ${parsed.filter((r) => !r._error).length} valid` : 'No preview yet'}
        </Text>

        {parsed.slice(0, 40).map((r) => (
          <View
            key={`${r._row}-${r.full_name}`}
            style={[styles.rowCard, { borderColor: r._error ? colors.error : colors.border, backgroundColor: colors.bgCard }]}
          >
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{r.full_name}</Text>
            <Text style={styles.muted}>{r.student_email}</Text>
            {r._error ? <Text style={{ color: colors.error, fontSize: FONT_SIZE.xs, marginTop: 4 }}>{r._error}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(colors: { bg: string; textPrimary: string; textMuted: string }) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.xl, paddingBottom: 48, gap: SPACING.md },
    center: { flex: 1, justifyContent: 'center', padding: SPACING['2xl'] },
    muted: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: colors.textMuted },
    label: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wide, textTransform: 'uppercase' },
    area: { minHeight: 160, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, fontFamily: FONT_FAMILY.body, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: SPACING.sm },
    btn: { paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: LETTER_SPACING.wide },
    meta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },
    rowCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm },
    rowTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  });
}

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
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { peopleHubService, type PeopleHubSnapshot } from '../../services/peopleHub.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { ROUTES } from '../../navigation/routes';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type HubTile = {
  key: string;
  title: string;
  meta: string;
  route: string;
  accent?: string;
};

function buildInsight(role: string, s: PeopleHubSnapshot): { title: string; detail: string; tone: 'neutral' | 'warn' | 'bad' } {
  if (role === 'parent') {
    return {
      title: 'Family',
      detail:
        s.linkedChildren > 0
          ? `${s.linkedChildren} linked learner profile(s). Open each child for grades, attendance, and invoices.`
          : 'No learners linked to this parent email yet.',
      tone: s.linkedChildren ? 'neutral' : 'warn',
    };
  }
  if (role === 'teacher') {
    const warn = s.teacherEnrolledStudents === 0 && s.teacherClasses > 0;
    return {
      title: 'Your roster',
      detail: `${s.teacherClasses} class(es) · ${s.teacherEnrolledStudents} roster seat(s) across your classes.`,
      tone: warn ? 'warn' : 'neutral',
    };
  }
  if (role === 'school') {
    const issues = s.studentsInactive + s.teachersInactive + s.pendingStudentRegistrations + s.portalInactiveAnyRole;
    return {
      title: 'School directory',
      detail: `${s.studentsTotal} students · ${s.teachersTotal} teachers · ${s.pendingStudentRegistrations} pending registration(s) · ${s.studentsInactive + s.teachersInactive} inactive accounts on file.`,
      tone: issues > 0 ? 'warn' : 'neutral',
    };
  }
  const pipe = s.pendingStudentRegistrations + s.schoolsPending;
  const inactive = s.portalInactiveAnyRole;
  return {
    title: 'Network overview',
    detail: `${s.schoolsTotal} schools (${s.schoolsPending} pending) · ${s.studentsTotal} students · ${s.teachersTotal} active teachers · ${pipe} pipeline queue · ${inactive} inactive portal accounts.`,
    tone: pipe > 0 || inactive > 8 ? 'warn' : pipe > 0 || inactive > 0 ? 'neutral' : 'neutral',
  };
}

export default function PeopleHubScreen({ navigation }: { navigation: { navigate: (name: string, params?: object) => void; goBack: () => void } }) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [snapshot, setSnapshot] = useState<PeopleHubSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id || !profile.role) {
      setSnapshot(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const snap = await peopleHubService.loadSnapshot({
        role: profile.role,
        userId: profile.id,
        schoolId: profile.school_id,
        parentEmail: profile.email,
      });
      setSnapshot(snap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.email, profile?.id, profile?.role, profile?.school_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const role = profile?.role ?? '';

  const directoryTiles: HubTile[] = useMemo(() => {
    if (role === 'parent') {
      return [{ key: 'children', title: 'My children', meta: 'Profiles & school links', route: ROUTES.MyChildren }];
    }
    if (role === 'teacher') {
      return [
        { key: 'stu', title: 'Students', meta: 'Roster & detail screens', route: ROUTES.Students },
        { key: 'par', title: 'Parents', meta: 'Directory & messaging', route: ROUTES.Parents },
      ];
    }
    if (role === 'school') {
      return [
        { key: 'stu', title: 'Students', meta: 'Full CRUD from directory', route: ROUTES.Students },
        { key: 'tch', title: 'Teachers', meta: 'Assignments & detail', route: ROUTES.Teachers },
        { key: 'par', title: 'Parents', meta: 'Linked families', route: ROUTES.Parents },
      ];
    }
    return [
      { key: 'sch', title: 'Schools', meta: 'Partners & billing context', route: ROUTES.Schools },
      { key: 'tch', title: 'Teachers', meta: 'Staff directory', route: ROUTES.Teachers },
      { key: 'stu', title: 'Students', meta: 'Portal learners', route: ROUTES.Students },
      { key: 'par', title: 'Parents', meta: 'Parent portal accounts', route: ROUTES.Parents },
      { key: 'usr', title: 'All portal users', meta: 'Admin CRUD & activation', route: ROUTES.Users },
    ];
  }, [role]);

  const bulkTiles: HubTile[] = useMemo(() => {
    if (role === 'parent') {
      return [
        { key: 'inv', title: 'Child invoices', meta: 'Fees & Paystack', route: ROUTES.ParentInvoices },
        { key: 'fb', title: 'Feedback', meta: 'Contact staff', route: ROUTES.ParentFeedback },
      ];
    }
    if (role === 'teacher') {
      return [
        { key: 'app', title: 'Approvals', meta: 'Pending registrations', route: ROUTES.Approvals },
        { key: 'imp', title: 'Import students', meta: 'CSV intake', route: ROUTES.StudentImport },
        { key: 'br', title: 'Bulk register', meta: 'Batch onboarding', route: ROUTES.BulkRegister },
        { key: 'en', title: 'Enrol students', meta: 'Classes & programs', route: ROUTES.EnrolStudents },
      ];
    }
    if (role === 'school') {
      return [
        { key: 'app', title: 'Approvals', meta: 'Review queue', route: ROUTES.Approvals },
        { key: 'imp', title: 'Import students', meta: 'CSV intake', route: ROUTES.StudentImport },
        { key: 'en', title: 'Enrol students', meta: 'Place in classes', route: ROUTES.EnrolStudents },
      ];
    }
    return [
      { key: 'app', title: 'Approvals', meta: 'Students & schools', route: ROUTES.Approvals },
      { key: 'imp', title: 'Import students', meta: 'CSV → pending', route: ROUTES.StudentImport },
      { key: 'br', title: 'Bulk register', meta: 'Batch flow', route: ROUTES.BulkRegister },
      { key: 'en', title: 'Enrol students', meta: 'Programs & classes', route: ROUTES.EnrolStudents },
      { key: 'wi', title: 'Wipe students', meta: 'Danger zone · bulk deactivate', route: ROUTES.WipeStudents },
    ];
  }, [role]);

  const insight = snapshot && profile ? buildInsight(profile.role, snapshot) : null;
  const borderInsight =
    insight?.tone === 'bad' ? colors.error : insight?.tone === 'warn' ? colors.warning : colors.border;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="People hub" subtitle="One entry for rosters, parents, and bulk ops" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {insight ? (
            <View style={[styles.insight, { borderColor: borderInsight, backgroundColor: colors.bgCard }]}>
              <Text style={[styles.insightEyebrow, { color: colors.primary }]}>SMART DIRECTORY</Text>
              <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>{insight.title}</Text>
              <Text style={[styles.insightBody, { color: colors.textSecondary }]}>{insight.detail}</Text>
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Directories · full CRUD on each screen</Text>
          <View style={styles.grid}>
            {directoryTiles.map((tile) => (
              <TouchableOpacity
                key={tile.key}
                style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                onPress={() => navigation.navigate(tile.route)}
                activeOpacity={0.88}
              >
                <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>{tile.title}</Text>
                <Text style={[styles.tileMeta, { color: colors.textMuted }]}>{tile.meta}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Bulk & pipelines</Text>
          <View style={styles.grid}>
            {bulkTiles.map((tile) => (
              <TouchableOpacity
                key={tile.key}
                style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                onPress={() => navigation.navigate(tile.route)}
                activeOpacity={0.88}
              >
                <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>{tile.title}</Text>
                <Text style={[styles.tileMeta, { color: colors.textMuted }]}>{tile.meta}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {role === 'admin' || role === 'school' ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick create</Text>
              <View style={styles.grid}>
                {role === 'admin' ? (
                  <TouchableOpacity
                    style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    onPress={() => navigation.navigate(ROUTES.AddSchool)}
                  >
                    <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>Add school</Text>
                    <Text style={[styles.tileMeta, { color: colors.textMuted }]}>Create partner record</Text>
                  </TouchableOpacity>
                ) : null}
                {role === 'admin' ? (
                  <TouchableOpacity
                    style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                    onPress={() => navigation.navigate(ROUTES.AddTeacher)}
                  >
                    <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>Add teacher</Text>
                    <Text style={[styles.tileMeta, { color: colors.textMuted }]}>Staff account</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  onPress={() => navigation.navigate(ROUTES.AddStudent)}
                >
                  <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>Add student</Text>
                  <Text style={[styles.tileMeta, { color: colors.textMuted }]}>Single enrolment</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: Record<string, string>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: SPACING.xl, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
    insight: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 6 },
    insightEyebrow: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider },
    insightTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.base },
    insightBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
    sectionLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, letterSpacing: LETTER_SPACING.wider, marginTop: SPACING.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    tile: { width: '47%', flexGrow: 1, minWidth: 140, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 6 },
    tileTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
    tileMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  });

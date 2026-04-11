import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { schoolService } from '../../services/school.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { goBackOrTo } from '../../navigation/goBackOrTo';

// ── Data ─────────────────────────────────────────────────────────────────────

const SCHOOL_TYPES = [
  { value: 'primary', emoji: '🏫', label: 'Primary School', desc: 'Ages 6–12' },
  { value: 'secondary', emoji: '🎓', label: 'Secondary School', desc: 'Ages 12–18' },
  { value: 'both', emoji: '🏛️', label: 'Both', desc: 'Primary & Secondary' },
  { value: 'private_tutoring', emoji: '📖', label: 'Tutoring Centre', desc: 'Private tutoring' },
];

const STUDENT_COUNT_RANGES = ['1–50', '51–100', '101–200', '201–500', '500+'];

const PROGRAMMES_OF_INTEREST = [
  'Python Programming', 'Web Development', 'Data Science',
  'AI & Machine Learning', 'Robotics', 'Scratch & Basics',
  'Cyber Security', 'Mobile Development',
];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}{required && <Text style={{ color: COLORS.error }}> *</Text>}
    </Text>
  );
}

function TextBox({
  value, onChangeText, placeholder, keyboard, multiline, capitalize,
}: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboard?: any; multiline?: boolean; capitalize?: any;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboard}
      autoCapitalize={capitalize ?? 'sentences'}
      multiline={multiline}
    />
  );
}

function SelectScroll({
  options, value, onSelect,
}: { options: string[]; value: string; onSelect: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Partnership Terms Modal ───────────────────────────────────────────────────

function TermsModal({ visible, onAccept, onClose }: { visible: boolean; onAccept: () => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <MotiView
          from={{ translateY: 100, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.termsCard}
        >
          <Text style={styles.termsTitle}>🤝 Partnership Terms</Text>
          <Text style={styles.termsSub}>Rillcod HUB School Partnership Agreement</Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {[
              {
                heading: '1. Revenue Split',
                body: 'Rillcod HUB and the Partner School agree to a 70/30 revenue sharing model — 70% to Rillcod (curriculum, instructors, materials) and 30% to the Partner School.',
              },
              {
                heading: '2. Curriculum',
                body: 'Rillcod provides a structured coding curriculum covering Python, Web Development, AI, Robotics, and more. The school facilitates venue, timetable integration, and student enrolment.',
              },
              {
                heading: '3. Instructors',
                body: 'Rillcod supplies trained instructors or trains school teachers. All teaching materials, devices (where applicable), and assessments are provided by Rillcod.',
              },
              {
                heading: '4. Fees',
                body: 'Student fees are collected by the school and remitted to Rillcod per the agreed schedule. School receives 30% of all fees collected from enrolled students.',
              },
              {
                heading: '5. Duration',
                body: 'Initial partnership term is one academic session (approx. 9 months). Renewal is automatic unless either party gives 30 days written notice.',
              },
              {
                heading: '6. Reporting',
                body: 'Rillcod provides termly progress reports for all enrolled students via the school dashboard. School has access to attendance and performance data.',
              },
              {
                heading: '7. Termination',
                body: 'Either party may terminate with 30 days written notice. Outstanding fee obligations remain binding.',
              },
            ].map(item => (
              <View key={item.heading} style={styles.termSection}>
                <Text style={styles.termHeading}>{item.heading}</Text>
                <Text style={styles.termBody}>{item.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.md }}>
            <TouchableOpacity onPress={onClose} style={[styles.termsBtn, { backgroundColor: COLORS.bgCard }]}>
              <Text style={[styles.termsBtnText, { color: COLORS.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAccept} style={[styles.termsBtn, { flex: 2 }]}>
              <LinearGradient colors={COLORS.gradPrimary as any} style={styles.termsBtnGrad}>
                <Text style={styles.termsBtnText}>✓ I Accept</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

// ── Application Status Checker ────────────────────────────────────────────────

function StatusChecker() {
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const checkStatus = async () => {
    if (!email.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const data = await schoolService.getLatestSchoolApplicationByEmail(email);

      if (!data) {
        setResult({ found: false });
      } else {
        setResult({ found: true, ...data });
      }
    } catch {
      setResult({ found: false });
    } finally {
      setChecking(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: COLORS.warning,
    approved: COLORS.success,
    rejected: COLORS.error,
  };
  const statusEmojis: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
  };

  return (
    <View style={styles.checkerWrap}>
      <Text style={styles.checkerTitle}>Check Application Status</Text>
      <Text style={styles.checkerSub}>Enter the email used during registration</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACING.sm }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          value={email}
          onChangeText={setEmail}
          placeholder="school@email.com"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={checkStatus}
          disabled={checking}
          style={[styles.checkerBtn, checking && { opacity: 0.5 }]}
        >
          <Text style={styles.checkerBtnText}>{checking ? '…' : 'Check'}</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} style={[styles.resultBox, { borderColor: result.found ? (statusColors[result.status] || COLORS.border) : COLORS.border }]}>
          {result.found ? (
            <>
              <Text style={styles.resultName}>{result.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 20 }}>{statusEmojis[result.status] || '🔄'}</Text>
                <Text style={[styles.resultStatus, { color: statusColors[result.status] || COLORS.textMuted }]}>
                  {result.status?.charAt(0).toUpperCase() + result.status?.slice(1)}
                </Text>
              </View>
              {result.status === 'pending' && (
                <Text style={styles.resultNote}>Your application is under review. Our team will reach out within 2–5 business days.</Text>
              )}
              {result.status === 'approved' && (
                <Text style={[styles.resultNote, { color: COLORS.success }]}>Congratulations! Your school has been approved. Please check your email for onboarding details.</Text>
              )}
              {result.status === 'rejected' && (
                <Text style={[styles.resultNote, { color: COLORS.error }]}>Your application was not approved. Please contact us at partnerships@rillcod.com for clarification.</Text>
              )}
            </>
          ) : (
            <Text style={styles.resultNote}>No application found for this email. Please check and try again.</Text>
          )}
        </MotiView>
      )}
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PublicSchoolRegistrationScreen({ navigation }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'status'>('register');

  // Form fields
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [address, setAddress] = useState('');
  const [lga, setLga] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const toggleProgramme = (p: string) => {
    setSelectedProgrammes(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const resetPartnershipForm = () => {
    setSuccessVisible(false);
    setTermsAccepted(false);
    setTermsVisible(false);
    setActiveTab('register');
    setSchoolName('');
    setSchoolType('');
    setPrincipalName('');
    setAddress('');
    setLga('');
    setCity('');
    setState('');
    setPhone('');
    setEmail('');
    setStudentCount('');
    setSelectedProgrammes([]);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!schoolName.trim()) { Alert.alert('Required', 'Please enter the school name.'); return; }
    if (!principalName.trim()) { Alert.alert('Required', 'Please enter the principal name.'); return; }
    if (!phone.trim()) { Alert.alert('Required', 'Please enter a contact phone number.'); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { Alert.alert('Required', 'Please enter a valid email address.'); return; }
    if (!state) { Alert.alert('Required', 'Please select your state.'); return; }
    if (!termsAccepted) { Alert.alert('Partnership Terms', 'Please read and accept the partnership terms to continue.'); return; }

    setSubmitting(true);
    try {
      // `schools` has no `notes` column — keep extra context in `address` for staff review.
      const addressBlock = [address.trim(), notes.trim() ? `Additional information:\n${notes.trim()}` : null]
        .filter(Boolean)
        .join('\n\n') || null;

      await schoolService.registerSchool({
        name: schoolName.trim(),
        school_type: schoolType || null,
        contact_person: principalName.trim(),
        address: addressBlock,
        lga: lga.trim() || null,
        city: city.trim() || null,
        state: state || null,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        student_count: studentCount === '500+' ? 500 : parseInt(studentCount.split('–')[0], 10) || null,
        program_interest: selectedProgrammes.length ? selectedProgrammes : null,
      });
      setSuccessVisible(true);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.glow1} />
      <View style={styles.glow2} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }}>
              <TouchableOpacity onPress={() => goBackOrTo(navigation, ROUTES.Login)} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={COLORS.primaryLight} />
                <Text style={styles.backText}>{navigation.canGoBack?.() ? 'Back' : 'Sign in'}</Text>
              </TouchableOpacity>

              <View style={styles.brandRow}>
                <Image source={require('../../../assets/rillcod-icon.png')} style={styles.brandLogo} resizeMode="contain" />
                <View>
                  <Text style={styles.brandName}>Rillcod HUB</Text>
                  <Text style={styles.brandSub}>School Partnership Programme</Text>
                </View>
              </View>

              <Text style={styles.pageTitle}>Partner With Us</Text>
              <Text style={styles.pageSub}>
                Bring world-class coding education to your students. Our instructors handle everything.
              </Text>
            </MotiView>

            {/* Stats row */}
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 100 }}
              style={styles.statsRow}
            >
              {[
                { n: '50+', label: 'Partner Schools' },
                { n: '5,000+', label: 'Students Taught' },
                { n: '70/30', label: 'Revenue Split' },
                { n: '6', label: 'States Active' },
              ].map(s => (
                <View key={s.label} style={styles.statBox}>
                  <Text style={styles.statNum}>{s.n}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </MotiView>

            {/* Tab switcher */}
            <View style={styles.tabBar}>
              {(['register', 'status'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setActiveTab(t)}
                  style={[styles.tab, activeTab === t && styles.tabActive]}
                >
                  <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                    {t === 'register' ? '📝 Apply' : '🔍 Check Status'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Status Checker */}
            {activeTab === 'status' && <StatusChecker />}

            {/* Registration Form */}
            {activeTab === 'register' && (
              <MotiView
                key="form"
                from={{ opacity: 0, translateX: 20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                style={styles.formCard}
              >
                {/* Section 1 — School Info */}
                <Text style={styles.sectionTitle}>🏫 School Information</Text>
                <View style={styles.sectionDivider} />

                <FieldLabel required>School Name</FieldLabel>
                <TextBox value={schoolName} onChangeText={setSchoolName} placeholder="e.g. Greenfield Secondary School" capitalize="words" />

                <FieldLabel>School Type</FieldLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md }}>
                  {SCHOOL_TYPES.map(st => {
                    const active = schoolType === st.value;
                    return (
                      <TouchableOpacity
                        key={st.value}
                        onPress={() => setSchoolType(st.value)}
                        style={[styles.typeChip, active && styles.typeChipActive]}
                      >
                        <Text style={{ fontSize: 14 }}>{st.emoji}</Text>
                        <View>
                          <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>{st.label}</Text>
                          <Text style={styles.typeChipDesc}>{st.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <FieldLabel>State</FieldLabel>
                <SelectScroll options={NIGERIAN_STATES} value={state} onSelect={setState} />

                <FieldLabel>LGA</FieldLabel>
                <TextBox value={lga} onChangeText={setLga} placeholder="e.g. Ikeja" capitalize="words" />

                <FieldLabel>City</FieldLabel>
                <TextBox value={city} onChangeText={setCity} placeholder="e.g. Lagos" capitalize="words" />

                <FieldLabel>Full Address</FieldLabel>
                <TextBox value={address} onChangeText={setAddress} placeholder="Street address, area" multiline />

                {/* Section 2 — Contact */}
                <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>📞 Contact Details</Text>
                <View style={styles.sectionDivider} />

                <FieldLabel required>Principal / Head Teacher Name</FieldLabel>
                <TextBox value={principalName} onChangeText={setPrincipalName} placeholder="e.g. Mrs. Adaeze Nwosu" capitalize="words" />

                <FieldLabel required>School Phone Number</FieldLabel>
                <TextBox value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboard="phone-pad" capitalize="none" />

                <FieldLabel required>School Email Address</FieldLabel>
                <TextBox value={email} onChangeText={setEmail} placeholder="admin@yourschool.edu.ng" keyboard="email-address" capitalize="none" />

                {/* Section 3 — Capacity & Programme */}
                <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>📊 Capacity & Programmes</Text>
                <View style={styles.sectionDivider} />

                <FieldLabel>Approximate Number of Students</FieldLabel>
                <SelectScroll options={STUDENT_COUNT_RANGES} value={studentCount} onSelect={setStudentCount} />

                <FieldLabel>Programmes of Interest</FieldLabel>
                <Text style={styles.subHint}>Select all that interest you</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md }}>
                  {PROGRAMMES_OF_INTEREST.map(p => {
                    const active = selectedProgrammes.includes(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => toggleProgramme(p)}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {active ? '✓ ' : ''}{p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <FieldLabel>Additional Notes (optional)</FieldLabel>
                <TextBox value={notes} onChangeText={setNotes} placeholder="Anything else you'd like us to know..." multiline />

                {/* Partnership terms */}
                <View style={styles.termsRow}>
                  <TouchableOpacity
                    onPress={() => setTermsAccepted(t => !t)}
                    style={[styles.checkbox, termsAccepted && styles.checkboxActive]}
                  >
                    {termsAccepted && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.termsText}>
                    I have read and agree to the{' '}
                    <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>
                      partnership terms & conditions
                    </Text>
                    {' '}including the 70/30 revenue sharing model.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                    <Text style={styles.primaryBtnText}>
                      {submitting ? 'Submitting…' : '🏫 Submit Partnership Application'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                  Applications are reviewed within 2–5 business days. You will receive an email confirmation with next steps.
                </Text>
              </MotiView>
            )}

            <Text style={styles.footer}>© 2026 Rillcod Technologies Ltd.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Terms Modal */}
      <TermsModal
        visible={termsVisible}
        onAccept={() => { setTermsAccepted(true); setTermsVisible(false); }}
        onClose={() => setTermsVisible(false)}
      />

      {/* Success Modal */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <MotiView
            from={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.successCard}
          >
            <Text style={{ fontSize: 64 }}>🎉</Text>
            <Text style={styles.successTitle}>Application Submitted!</Text>
            <Text style={styles.successSub}>
              Thank you, {principalName}! Your partnership application for{' '}
              <Text style={{ color: COLORS.primaryLight }}>{schoolName}</Text> has been received.
            </Text>
            <Text style={[styles.successSub, { marginTop: 8 }]}>
              Our partnerships team will contact you at{' '}
              <Text style={{ color: COLORS.info }}>{email}</Text>{' '}
              within 2–5 business days.
            </Text>
            <View style={styles.successInfoBox}>
              <Text style={styles.successInfoRow}>📱 WhatsApp: +234 800 RILLCOD</Text>
              <Text style={styles.successInfoRow}>✉️ partnerships@rillcod.com</Text>
              <Text style={styles.successInfoRow}>🌐 www.rillcod.com</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={resetPartnershipForm} activeOpacity={0.85}>
              <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                <Text style={styles.primaryBtnText}>Submit another application</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalGhostBtn}
              onPress={() => {
                setSuccessVisible(false);
                navigation.navigate(ROUTES.Login);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.modalGhostBtnText}>I already have an account — Sign in</Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  glow1: { position: 'absolute', top: -80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: COLORS.primaryGlow, opacity: 0.5 },
  glow2: { position: 'absolute', bottom: 100, right: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(91,33,182,0.08)' },
  scroll: { padding: SPACING.xl, paddingBottom: 60 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.md },
  backText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.lg },
  brandLogo: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden' },
  brandName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  brandSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  pageTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, marginBottom: 4 },
  pageSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 20, marginBottom: SPACING.md },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.lg },
  statBox: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center' },
  statNum: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.primaryLight },
  statLabel: { fontFamily: FONT_FAMILY.body, fontSize: 9, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },

  tabBar: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACING.lg, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  tabTextActive: { color: '#fff' },

  // Form
  formCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  fieldLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  subHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm },

  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pillActive: { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.primaryLight },

  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg },
  typeChipActive: { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary },
  typeChipLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  typeChipLabelActive: { color: COLORS.primaryLight },
  typeChipDesc: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: SPACING.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termsText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1, lineHeight: 20 },
  termsLink: { color: COLORS.primaryLight, textDecorationLine: 'underline' },

  disclaimer: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md, lineHeight: 18 },

  primaryBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md },
  primaryBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },

  // Status checker
  checkerWrap: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.sm },
  checkerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 4 },
  checkerSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  checkerBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  checkerBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },
  resultBox: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.md },
  resultName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  resultStatus: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg },
  resultNote: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },

  // Terms modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  termsCard: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, maxHeight: '80%' },
  termsTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, marginBottom: 4 },
  termsSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.lg },
  termSection: { marginBottom: SPACING.md },
  termHeading: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 4 },
  termBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18 },
  termsBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, alignItems: 'center' },
  termsBtnGrad: { paddingVertical: 12, paddingHorizontal: SPACING.xl, alignItems: 'center' },
  termsBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#fff' },

  // Success modal
  successCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS['2xl'], padding: SPACING.xl, width: '100%', margin: SPACING.xl, alignItems: 'center', gap: SPACING.sm },
  successTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, textAlign: 'center' },
  successSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  successInfoBox: { backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, width: '100%', gap: 6 },
  successInfoRow: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  modalGhostBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm },
  modalGhostBtnText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryLight,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  footer: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, opacity: 0.5 },
});

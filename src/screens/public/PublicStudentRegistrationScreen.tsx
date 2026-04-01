import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Data ─────────────────────────────────────────────────────────────────────

const ENROLLMENT_TYPES = [
  {
    value: 'school',
    emoji: '🤝',
    label: 'School Partnership',
    desc: 'For schools enrolling students in our coding curriculum',
    price: '₦10,000 – ₦25,000/term',
    color: COLORS.info,
    benefits: ['Curriculum integration', 'Teacher training', 'Progress reports'],
  },
  {
    value: 'bootcamp',
    emoji: '⚡',
    label: 'Coding Bootcamp',
    desc: 'Intensive coding program for individuals',
    price: '₦30,000 – ₦55,000',
    color: '#7c3aed',
    benefits: ['Intensive 8-week program', 'Project portfolio', 'Certificate'],
  },
  {
    value: 'online',
    emoji: '💻',
    label: 'Online Course',
    desc: 'Self-paced online learning from anywhere',
    price: '₦25,000 – ₦40,000/month',
    color: COLORS.success,
    benefits: ['Flexible schedule', 'Live sessions', 'Lifetime access'],
  },
  {
    value: 'in_person',
    emoji: '🏫',
    label: 'In-Person Classes',
    desc: 'Attend classes at our physical facility',
    price: '₦50,000+/term',
    color: COLORS.warning,
    benefits: ['Hands-on learning', 'Equipment provided', 'Peer collaboration'],
  },
];

const PROGRAMMES = [
  'Python Programming', 'Web Development', 'Data Science',
  'AI & Machine Learning', 'Robotics', 'Scratch & Basics',
  'Cyber Security', 'Mobile Development',
];

const GRADE_LEVELS = [
  'Nursery 1', 'Nursery 2', 'Primary 1', 'Primary 2', 'Primary 3',
  'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3',
  'SSS 1', 'SSS 2', 'SSS 3', 'University / Adult',
];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={sb.wrap}>
      {Array.from({ length: total }).map((_, i) => (
        <MotiView
          key={i}
          animate={{ backgroundColor: i < step ? COLORS.primary : i === step ? COLORS.primaryLight : COLORS.border }}
          transition={{ type: 'timing', duration: 250 }}
          style={[sb.seg, i === step && sb.segActive]}
        />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, marginVertical: SPACING.md },
  seg: { flex: 1, height: 4, borderRadius: RADIUS.full },
  segActive: { height: 5 },
});

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function TextBox({
  value, onChangeText, placeholder, keyboard, multiline, capitalize, secure,
}: {
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboard?: any; multiline?: boolean; capitalize?: any; secure?: boolean;
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
      secureTextEntry={secure}
      multiline={multiline}
    />
  );
}

function SelectPill({
  options, value, onSelect, color,
}: {
  options: string[]; value: string; onSelect: (v: string) => void; color?: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[
                styles.pill,
                active && { backgroundColor: (color || COLORS.primary) + '33', borderColor: color || COLORS.primary },
              ]}
            >
              <Text style={[styles.pillText, active && { color: color || COLORS.primaryLight }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PublicStudentRegistrationScreen({ navigation }: any) {
  const [step, setStep] = useState(0); // 0=type, 1=student, 2=programme+parent
  const [submitting, setSubmitting] = useState(false);

  // Step 0
  const [enrollmentType, setEnrollmentType] = useState('');

  // Step 1 — student details
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [state, setState] = useState('');

  // Step 2 — parent + programme
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  // Success modal
  const [successVisible, setSuccessVisible] = useState(false);

  const selectedType = ENROLLMENT_TYPES.find(t => t.value === enrollmentType);

  const toggleProgramme = (p: string) => {
    setSelectedProgrammes(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const goNext = () => {
    if (step === 0) {
      if (!enrollmentType) { Alert.alert('Select Type', 'Please choose an enrollment type.'); return; }
      setStep(1);
    } else if (step === 1) {
      if (!fullName.trim()) { Alert.alert('Required', 'Please enter the student\'s full name.'); return; }
      if (!gradeLevel) { Alert.alert('Required', 'Please select a grade level.'); return; }
      setStep(2);
    }
  };

  const goBack = () => {
    if (step === 0) navigation.goBack();
    else setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!parentName.trim() || !parentPhone.trim()) {
      Alert.alert('Required', 'Please fill in parent/guardian name and phone number.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('students').insert({
        name: fullName.trim(),
        full_name: fullName.trim(),
        student_email: parentEmail.trim() || null,
        parent_name: parentName.trim(),
        parent_phone: parentPhone.trim(),
        grade_level: gradeLevel,
        school_name: schoolName.trim() || null,
        course_interest: selectedProgrammes.join(', ') || null,
        enrollment_type: enrollmentType,
        date_of_birth: dateOfBirth.trim() || null,
        gender: gender || null,
        state: state || null,
        notes: message.trim() || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSuccessVisible(true);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const STEP_TITLES = ['Choose Enrollment Type', 'Student Details', 'Programme & Parent'];
  const STEP_SUBS = [
    'Select how your child will learn with Rillcod',
    'Tell us about the student',
    'Programme interest & guardian info',
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Ambient glow */}
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
              <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                <Text style={styles.backText}>← {step === 0 ? 'Back to Login' : 'Back'}</Text>
              </TouchableOpacity>

              <View style={styles.brandRow}>
                <Image source={require('../../../assets/rillcod-icon.png')} style={styles.brandLogo} resizeMode="cover" />
                <Text style={styles.brandName}>Rillcod Academy</Text>
              </View>

              <Text style={styles.pageTitle}>{STEP_TITLES[step]}</Text>
              <Text style={styles.pageSub}>{STEP_SUBS[step]}</Text>

              <StepBar step={step} total={3} />
              <Text style={styles.stepLabel}>Step {step + 1} of 3</Text>
            </MotiView>

            {/* Step 0 — Enrollment type */}
            {step === 0 && (
              <MotiView
                key="step0"
                from={{ opacity: 0, translateX: 20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <View style={{ gap: 12, marginTop: SPACING.lg }}>
                  {ENROLLMENT_TYPES.map(et => {
                    const active = enrollmentType === et.value;
                    return (
                      <TouchableOpacity key={et.value} onPress={() => setEnrollmentType(et.value)} activeOpacity={0.85}>
                        <MotiView
                          animate={{
                            borderColor: active ? et.color : COLORS.border,
                            backgroundColor: active ? et.color + '18' : COLORS.bgCard,
                          }}
                          transition={{ type: 'timing', duration: 180 }}
                          style={styles.typeCard}
                        >
                          <View style={[styles.typeIconWrap, { backgroundColor: et.color + '22' }]}>
                            <Text style={{ fontSize: 26 }}>{et.emoji}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={[styles.typeLabel, active && { color: et.color }]}>{et.label}</Text>
                              <View style={[styles.priceBadge, { backgroundColor: et.color + '22' }]}>
                                <Text style={[styles.priceText, { color: et.color }]}>{et.price}</Text>
                              </View>
                            </View>
                            <Text style={styles.typeDesc}>{et.desc}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {et.benefits.map(b => (
                                <View key={b} style={styles.benefitTag}>
                                  <Text style={styles.benefitText}>✓ {b}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                          {active && (
                            <View style={[styles.checkDot, { backgroundColor: et.color }]}>
                              <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>
                            </View>
                          )}
                        </MotiView>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
                  <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                    <Text style={styles.primaryBtnText}>Continue →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            )}

            {/* Step 1 — Student details */}
            {step === 1 && (
              <MotiView
                key="step1"
                from={{ opacity: 0, translateX: 30 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                style={styles.formCard}
              >
                {selectedType && (
                  <View style={[styles.enrollBadge, { backgroundColor: selectedType.color + '22', borderColor: selectedType.color + '44' }]}>
                    <Text style={{ fontSize: 16 }}>{selectedType.emoji}</Text>
                    <Text style={[styles.enrollBadgeText, { color: selectedType.color }]}>{selectedType.label}</Text>
                    <Text style={[styles.enrollBadgePrice, { color: selectedType.color }]}>{selectedType.price}</Text>
                  </View>
                )}

                <FieldLabel>Student Full Name *</FieldLabel>
                <TextBox value={fullName} onChangeText={setFullName} placeholder="e.g. Chioma Okafor" capitalize="words" />

                <FieldLabel>Date of Birth (optional)</FieldLabel>
                <TextBox value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="DD/MM/YYYY" keyboard="numeric" />

                <FieldLabel>Gender</FieldLabel>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(g)}
                      style={[styles.pill, gender === g && { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary }]}
                    >
                      <Text style={[styles.pillText, gender === g && { color: COLORS.primaryLight }]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FieldLabel>Grade Level *</FieldLabel>
                <SelectPill options={GRADE_LEVELS} value={gradeLevel} onSelect={setGradeLevel} />

                <FieldLabel>{enrollmentType === 'school' ? 'School Name *' : 'School Name (optional)'}</FieldLabel>
                <TextBox value={schoolName} onChangeText={setSchoolName} placeholder="e.g. Greenfield Secondary School" capitalize="words" />

                <FieldLabel>State (optional)</FieldLabel>
                <SelectPill options={NIGERIAN_STATES} value={state} onSelect={setState} />

                <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
                  <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                    <Text style={styles.primaryBtnText}>Next: Programme & Parent →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            )}

            {/* Step 2 — Programme + Parent */}
            {step === 2 && (
              <MotiView
                key="step2"
                from={{ opacity: 0, translateX: 30 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                style={styles.formCard}
              >
                <Text style={styles.sectionTitle}>Programme Interest</Text>
                <Text style={styles.sectionSub}>Select all that apply</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg }}>
                  {PROGRAMMES.map(p => {
                    const active = selectedProgrammes.includes(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => toggleProgramme(p)}
                        style={[styles.pill, active && { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary }]}
                      >
                        <Text style={[styles.pillText, active && { color: COLORS.primaryLight }]}>
                          {active ? '✓ ' : ''}{p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Parent / Guardian Information</Text>

                <FieldLabel>Full Name *</FieldLabel>
                <TextBox value={parentName} onChangeText={setParentName} placeholder="e.g. Mr. Emeka Okafor" capitalize="words" />

                <FieldLabel>Phone Number *</FieldLabel>
                <TextBox value={parentPhone} onChangeText={setParentPhone} placeholder="+234 800 000 0000" keyboard="phone-pad" capitalize="none" />

                <FieldLabel>Email Address (optional)</FieldLabel>
                <TextBox value={parentEmail} onChangeText={setParentEmail} placeholder="parent@email.com" keyboard="email-address" capitalize="none" />

                <FieldLabel>Additional Message (optional)</FieldLabel>
                <TextBox value={message} onChangeText={setMessage} placeholder="Any questions or special requirements..." multiline />

                {/* Fee summary */}
                {selectedType && (
                  <View style={[styles.feeSummary, { borderColor: selectedType.color + '44' }]}>
                    <Text style={styles.feeSummaryTitle}>📋 Registration Summary</Text>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeKey}>Enrollment Type</Text>
                      <Text style={[styles.feeVal, { color: selectedType.color }]}>{selectedType.emoji} {selectedType.label}</Text>
                    </View>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeKey}>Estimated Fee</Text>
                      <Text style={[styles.feeVal, { color: COLORS.success }]}>{selectedType.price}</Text>
                    </View>
                    <View style={styles.feeRow}>
                      <Text style={styles.feeKey}>Student</Text>
                      <Text style={styles.feeVal}>{fullName || '—'}</Text>
                    </View>
                    {selectedProgrammes.length > 0 && (
                      <View style={styles.feeRow}>
                        <Text style={styles.feeKey}>Programmes</Text>
                        <Text style={[styles.feeVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{selectedProgrammes.join(', ')}</Text>
                      </View>
                    )}
                    <View style={[styles.feeNote, { backgroundColor: COLORS.warning + '18' }]}>
                      <Text style={[styles.feeNoteText, { color: COLORS.warning }]}>
                        💡 Payment details will be sent via WhatsApp/email after submission. Our team will contact you within 24 hours.
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                    <Text style={styles.primaryBtnText}>
                      {submitting ? 'Submitting…' : '🚀 Submit Application'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </MotiView>
            )}

            {/* Footer */}
            <Text style={styles.footer}>© 2026 Rillcod Technologies Ltd.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Success Modal */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <MotiView
            from={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.modalCard}
          >
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Application Submitted!</Text>
            <Text style={styles.successSub}>
              Thank you for registering {fullName} with Rillcod Academy. Our admissions team will contact {parentName} within 24–48 hours to confirm enrollment and share payment details.
            </Text>

            <View style={styles.successInfo}>
              <Text style={styles.successInfoRow}>📱 WhatsApp: +234 800 RILLCOD</Text>
              <Text style={styles.successInfoRow}>✉️ info@rillcod.com</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { setSuccessVisible(false); navigation.navigate('Login'); }}
            >
              <LinearGradient colors={COLORS.gradPrimary as any} style={styles.primaryBtnGrad}>
                <Text style={styles.primaryBtnText}>Back to Login</Text>
              </LinearGradient>
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
  glow1: { position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: COLORS.primaryGlow, opacity: 0.5 },
  glow2: { position: 'absolute', bottom: 100, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(91,33,182,0.08)' },
  scroll: { padding: SPACING.xl, paddingBottom: 60 },

  backBtn: { marginBottom: SPACING.md },
  backText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.lg },
  brandLogo: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  brandName: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },

  pageTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, marginBottom: 4 },
  pageSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  stepLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm },

  // Type cards
  typeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    borderWidth: 1.5, borderRadius: RADIUS.xl,
    padding: SPACING.md, position: 'relative',
  },
  typeIconWrap: { width: 52, height: 52, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeLabel: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary },
  typeDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18 },
  priceBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  priceText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10 },
  benefitTag: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  benefitText: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted },
  checkDot: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Form
  formCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.lg },
  fieldLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: 2 },
  sectionSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  enrollBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: SPACING.lg },
  enrollBadgeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, flex: 1 },
  enrollBadgePrice: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs },

  feeSummary: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.lg, gap: 8 },
  feeSummaryTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: 4 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  feeKey: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  feeVal: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },
  feeNote: { borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: 4 },
  feeNoteText: { fontFamily: FONT_FAMILY.body, fontSize: 11, lineHeight: 16 },

  primaryBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md },
  primaryBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS['2xl'], padding: SPACING.xl, width: '100%', alignItems: 'center', gap: SPACING.md },
  successEmoji: { fontSize: 64, marginBottom: 4 },
  successTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary, textAlign: 'center' },
  successSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  successInfo: { backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: SPACING.md, width: '100%', gap: 6 },
  successInfoRow: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  footer: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, opacity: 0.5 },
});

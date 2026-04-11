import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, FlatList, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { cardService } from '../../services/card.service';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  section_class: string | null;
  created_at: string;
}

type Step = 'search' | 'preview';

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function enrollYear(createdAt: string): string {
  return new Date(createdAt).getFullYear().toString();
}

// Decorative dot grid
function DotGrid() {
  const dots: React.ReactElement[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 8; c++) {
      dots.push(
        <View key={`${r}-${c}`} style={[styles.dot, { top: r * 18, left: c * 18 }]} />
      );
    }
  }
  return <View style={styles.dotGrid}>{dots}</View>;
}

// The ID card rendered as a View
function IDCard({ student }: { student: StudentRecord }) {
  const initials = getInitials(student.full_name);
  return (
    <View style={styles.idCard}>
      {/* Background glow */}
      <View style={styles.idCardGlowTop} />
      <View style={styles.idCardGlowBottom} />

      {/* Dot grid decoration */}
      <DotGrid />

      {/* Top bar */}
      <LinearGradient colors={COLORS.gradPrimary as [string, string, ...string[]]} style={styles.idCardTopBar}>
        <View style={styles.idCardTopBarContent}>
          {/* Logo mark placeholder */}
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>R</Text>
          </View>
          <View>
            <Text style={styles.academyName}>RILLCOD ACADEMY</Text>
            <Text style={styles.studentIdLabel}>STUDENT ID CARD</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Avatar + name */}
      <View style={styles.idCardBody}>
        <View style={styles.avatarSection}>
          <LinearGradient colors={['rgba(122,6,6,0.4)', 'rgba(122,6,6,0.1)'] as [string, string]} style={styles.avatarRing}>
            <LinearGradient colors={COLORS.gradPrimary as [string, string, ...string[]]} style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>
          </LinearGradient>
          <Text style={styles.studentFullName}>{student.full_name}</Text>
          <View style={styles.studentRolePill}>
            <Text style={styles.studentRoleText}>Student</Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.infoIcon}>🪪</Text>
              <Text style={styles.infoLabel}>ID Number</Text>
            </View>
            <Text style={styles.infoValue}>{shortId(student.id)}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.infoIcon}>📚</Text>
              <Text style={styles.infoLabel}>Class/Grade</Text>
            </View>
            <Text style={styles.infoValue}>{student.section_class ?? 'N/A'}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.infoIcon}>🏫</Text>
              <Text style={styles.infoLabel}>School</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {student.school_name ?? 'Rillcod Academy'}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Text style={styles.infoIcon}>📅</Text>
              <Text style={styles.infoLabel}>Enrolled</Text>
            </View>
            <Text style={styles.infoValue}>{enrollYear(student.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* Bottom red bar */}
      <LinearGradient colors={COLORS.gradPrimary as [string, string, ...string[]]} style={styles.idCardBottomBar}>
        <Text style={styles.validText}>
          ✦ Valid {enrollYear(student.created_at)}–{Number(enrollYear(student.created_at)) + 1} ✦
        </Text>
        <Text style={styles.websiteText}>rillcod.com</Text>
      </LinearGradient>
    </View>
  );
}

export default function CardBuilderScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('search');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setSearch(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await cardService.searchStudentsForIdCardByName(text, 20);
      setResults((data ?? []) as StudentRecord[]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelect = (student: StudentRecord) => {
    setSelected(student);
    setStep('preview');
  };

  const handleNewCard = () => {
    setSelected(null);
    setSearch('');
    setResults([]);
    setStep('search');
  };

  const handleExportCard = async () => {
    if (!selected) return;
    try {
      setExporting(true);
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; background: #0f172a; padding: 24px; }
              .card { width: 760px; margin: 0 auto; border-radius: 28px; overflow: hidden; background: linear-gradient(180deg, #111827, #0f172a); color: #fff; border: 1px solid rgba(244,164,98,0.3); }
              .top { padding: 24px 28px; background: linear-gradient(90deg, ${COLORS.gradPrimary[0]}, ${COLORS.gradPrimary[1]}); display: flex; align-items: center; gap: 16px; }
              .logo { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; }
              .top h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
              .top p { margin: 4px 0 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }
              .body { padding: 30px 28px; }
              .hero { text-align: center; margin-bottom: 24px; }
              .avatar { width: 92px; height: 92px; border-radius: 46px; background: linear-gradient(135deg, ${COLORS.gradPrimary[0]}, ${COLORS.gradPrimary[1]}); margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; }
              .name { font-size: 28px; font-weight: 700; margin: 0; }
              .pill { display: inline-block; margin-top: 10px; padding: 6px 12px; border-radius: 999px; background: rgba(244,164,98,0.18); color: ${COLORS.primaryLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
              .item { border: 1px solid rgba(148,163,184,0.2); border-radius: 16px; padding: 16px; background: rgba(255,255,255,0.04); }
              .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 8px; }
              .value { font-size: 20px; font-weight: 700; color: #fff; word-break: break-word; }
              .bottom { padding: 16px 28px; background: linear-gradient(90deg, ${COLORS.gradPrimary[0]}, ${COLORS.gradPrimary[1]}); display: flex; justify-content: space-between; font-size: 12px; letter-spacing: 1px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="top">
                <div class="logo">R</div>
                <div>
                  <h1>RILLCOD ACADEMY</h1>
                  <p>Student ID Card</p>
                </div>
              </div>
              <div class="body">
                <div class="hero">
                  <div class="avatar">${getInitials(selected.full_name)}</div>
                  <p class="name">${selected.full_name}</p>
                  <div class="pill">Student</div>
                </div>
                <div class="grid">
                  <div class="item"><div class="label">ID Number</div><div class="value">${shortId(selected.id)}</div></div>
                  <div class="item"><div class="label">Class / Grade</div><div class="value">${selected.section_class ?? 'N/A'}</div></div>
                  <div class="item"><div class="label">School</div><div class="value">${selected.school_name ?? 'Rillcod Academy'}</div></div>
                  <div class="item"><div class="label">Enrolled</div><div class="value">${enrollYear(selected.created_at)}</div></div>
                </div>
              </div>
              <div class="bottom">
                <span>Valid 2025 - 2026</span>
                <span>rillcod.com</span>
              </div>
            </div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Export Ready', uri);
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message ?? 'Unable to export student card.');
    } finally {
      setExporting(false);
    }
  };

  // ---- STEP 1: Search ----
  if (step === 'search') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} style={styles.backBtn} />
          <Text style={styles.headerTitle}>ID Card Builder</Text>
        </View>

        <View style={styles.stepContainer}>
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <View style={styles.stepHero}>
              <LinearGradient colors={['rgba(122,6,6,0.15)', 'rgba(122,6,6,0.03)'] as [string, string]} style={styles.stepHeroCard}>
                <Text style={styles.stepHeroEmoji}>🪪</Text>
                <Text style={styles.stepHeroTitle}>Generate Student ID Card</Text>
                <Text style={styles.stepHeroSubtitle}>Search for a student to generate their ID card</Text>
              </LinearGradient>
            </View>

            <Text style={styles.label}>Search Student by Name</Text>
            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Type student name..."
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
          </MotiView>

          {results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={s => s.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <MotiView
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: index * 40, type: 'timing', duration: 240 }}
                >
                  <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarText}>{getInitials(item.full_name)}</Text>
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultName}>{item.full_name}</Text>
                      <Text style={styles.resultMeta}>
                        {item.school_name ?? 'Rillcod Academy'} · {item.section_class ?? 'No class'}
                      </Text>
                    </View>
                    <Text style={styles.resultArrow}>›</Text>
                  </TouchableOpacity>
                </MotiView>
              )}
              style={{ marginTop: SPACING.md }}
              showsVerticalScrollIndicator={false}
            />
          )}

          {search.length >= 2 && results.length === 0 && !searching && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No students found for "{search}"</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ---- STEP 2: Preview ----
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconBackButton onPress={() => setStep('search')} color={COLORS.textPrimary} style={styles.backBtn} />
        <Text style={styles.headerTitle}>ID Card Preview</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.previewScroll}
      >
        {selected && (
          <MotiView
            from={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
          >
            <IDCard student={selected} />
          </MotiView>
        )}

        {/* Action buttons */}
        <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleExportCard}
              disabled={exporting}
            >
              <LinearGradient colors={COLORS.gradPrimary as [string, string, ...string[]]} style={styles.shareBtnInner}>
                {exporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.shareBtnText}>Share Card PDF</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

          <TouchableOpacity style={styles.newCardBtn} onPress={handleNewCard}>
            <Text style={styles.newCardBtnText}>🔄  New Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary },

  // Step 1
  stepContainer: { flex: 1, paddingHorizontal: SPACING.base },
  stepHero: { marginBottom: SPACING.xl },
  stepHeroCard: { borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderGlow },
  stepHeroEmoji: { fontSize: 48, marginBottom: SPACING.md },
  stepHeroTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm, textAlign: 'center' },
  stepHeroSubtitle: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, textAlign: 'center' },
  label: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary, marginBottom: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 14, marginRight: SPACING.sm },
  searchInput: { flex: 1, paddingVertical: SPACING.md, fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textPrimary },
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.md },
  resultAvatar: { width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.display, color: COLORS.primaryLight },
  resultBody: { flex: 1 },
  resultName: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textPrimary, marginBottom: 3 },
  resultMeta: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },
  resultArrow: { fontSize: 20, color: COLORS.textMuted },
  noResults: { paddingVertical: SPACING.xl, alignItems: 'center' },
  noResultsText: { fontSize: FONT_SIZE.base, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted },

  // Step 2 - Preview
  previewScroll: { paddingHorizontal: SPACING.base, paddingBottom: 60, paddingTop: SPACING.md },
  actionButtons: { gap: SPACING.sm, marginTop: SPACING.xl },
  shareBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  shareBtnInner: { padding: SPACING.md, alignItems: 'center' },
  shareBtnText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.bodySemi, color: '#fff' },
  newCardBtn: { padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  newCardBtnText: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.bodySemi, color: COLORS.textSecondary },

  // ID Card
  idCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    backgroundColor: '#0d0d1a',
    overflow: 'hidden',
    // Glow shadow
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  idCardGlowTop: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(122,6,6,0.15)',
  },
  idCardGlowBottom: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(122,6,6,0.1)',
  },
  dotGrid: {
    position: 'absolute',
    top: 60,
    right: 10,
    opacity: 0.06,
    width: 130,
    height: 90,
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },

  // Top bar
  idCardTopBar: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  idCardTopBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoMarkText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONT_FAMILY.display,
    color: '#fff',
  },
  academyName: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.display,
    color: '#fff',
    letterSpacing: 2,
  },
  studentIdLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.body,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },

  // Card body
  idCardBody: {
    padding: SPACING.xl,
    flexDirection: 'row',
    gap: SPACING.xl,
    alignItems: 'flex-start',
  },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    width: 110,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: FONT_SIZE['2xl'],
    fontFamily: FONT_FAMILY.display,
    color: '#fff',
  },
  studentFullName: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.heading,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  studentRolePill: {
    backgroundColor: COLORS.primaryPale,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  studentRoleText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.bodySemi,
    color: COLORS.primaryLight,
    letterSpacing: 0.5,
  },

  // Info section
  infoSection: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIcon: {
    fontSize: 12,
    width: 18,
  },
  infoLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.body,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.bodySemi,
    color: COLORS.textPrimary,
    maxWidth: 100,
    textAlign: 'right',
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Bottom bar
  idCardBottomBar: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  validText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.bodySemi,
    color: '#fff',
    letterSpacing: 1,
  },
  websiteText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.body,
    color: 'rgba(255,255,255,0.7)',
  },
});

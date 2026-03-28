import React, { useRef, useState } from 'react';
import {
  View, Text, FlatList, Dimensions, TouchableOpacity,
  StyleSheet, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE, LETTER_SPACING } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { t } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

const { width, height } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

const SLIDES = [
  {
    id: '1',
    emoji: '🚀',
    badge: 'Nigeria #1',
    title: t('onboarding.slide1Title'),
    sub: t('onboarding.slide1Sub'),
    accent: COLORS.primary,
    accentGlow: COLORS.primaryGlow,
    stat1: { value: '10K+', label: 'Students' },
    stat2: { value: '50+', label: 'Schools' },
    stat3: { value: '12+', label: 'Programs' },
  },
  {
    id: '2',
    emoji: '🧠',
    badge: 'Expert Instructors',
    title: t('onboarding.slide2Title'),
    sub: t('onboarding.slide2Sub'),
    accent: '#5b21b6',
    accentGlow: 'rgba(91,33,182,0.25)',
    stat1: { value: 'AI', label: 'Intelligence' },
    stat2: { value: 'IoT', label: 'Robotics' },
    stat3: { value: 'Web', label: 'Development' },
  },
  {
    id: '3',
    emoji: '🌍',
    badge: 'Africa & Beyond',
    title: t('onboarding.slide3Title'),
    sub: t('onboarding.slide3Sub'),
    accent: COLORS.accent,
    accentGlow: COLORS.accentGlow,
    stat1: { value: '🏆', label: 'Certified' },
    stat2: { value: '🌐', label: 'Global' },
    stat3: { value: '⚡', label: 'Future-Ready' },
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { light, select } = useHaptics();
  const listRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const goNext = async () => {
    await light();
    if (activeIdx < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIdx + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  const skip = async () => {
    await select();
    navigation.replace('Login');
  };

  const slide = SLIDES[activeIdx];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Dynamic animated background glow */}
      <MotiView
        animate={{ backgroundColor: slide.accentGlow }}
        transition={{ type: 'timing', duration: 600 }}
        style={styles.glowOrb}
      />
      <LinearGradient colors={['rgba(5,5,10,0)', '#05050a']} style={styles.gradOverlay} />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={skip}>
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIdx(idx);
          light();
        }}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width }]}>
            {/* Big emoji illustration */}
            <MotiView
              from={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 100 }}
              style={[styles.emojiWrap, { borderColor: item.accent + '40', shadowColor: item.accent }]}
            >
              <LinearGradient
                colors={[item.accentGlow, 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.emoji}>{item.emoji}</Text>
            </MotiView>

            {/* Badge */}
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 200 }}
              style={[styles.badge, { backgroundColor: item.accent + '20', borderColor: item.accent + '50' }]}
            >
              <Text style={[styles.badgeText, { color: item.accent }]}>{item.badge}</Text>
            </MotiView>

            {/* Title */}
            <MotiText
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 300 }}
              style={styles.title}
            >
              {item.title}
            </MotiText>

            {/* Subtitle */}
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', delay: 450 }}
              style={styles.sub}
            >
              {item.sub}
            </MotiText>

            {/* Stats row */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 550 }}
              style={styles.statsRow}
            >
              {[item.stat1, item.stat2, item.stat3].map((s, i) => (
                <View key={i} style={styles.stat}>
                  <Text style={[styles.statValue, { color: item.accent }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </MotiView>
          </View>
        )}
      />

      {/* Dots indicator */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <MotiView
            key={i}
            animate={{
              width: activeIdx === i ? 24 : 6,
              backgroundColor: activeIdx === i ? slide.accent : COLORS.textMuted,
              opacity: activeIdx === i ? 1 : 0.4,
            }}
            transition={{ type: 'spring', damping: 20 }}
            style={styles.dot}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <PremiumButton
          label={activeIdx === SLIDES.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
          onPress={goNext}
          variant="primary"
        />
        <TouchableOpacity onPress={skip} style={styles.signinLink}>
          <Text style={styles.signinText}>{t('onboarding.signIn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  glowOrb: {
    position: 'absolute',
    top: -100,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.5,
    filter: Platform.OS === 'ios' ? undefined : undefined,
  },
  gradOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    zIndex: 0,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    right: SPACING.xl,
    zIndex: 10,
  },
  skipText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    letterSpacing: LETTER_SPACING.wide,
  },
  slide: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    alignItems: 'center',
  },
  emojiWrap: {
    width: 140,
    height: 140,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    overflow: 'hidden',
  },
  emoji: { fontSize: 72 },
  badge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.base,
  },
  badgeText: {
    fontFamily: FONT_FAMILY.bodySemi,
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wider,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE['3xl'],
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: FONT_SIZE['3xl'] * 1.15,
    marginBottom: SPACING.base,
  },
  sub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: FONT_SIZE.base * 1.7,
    marginBottom: SPACING['2xl'],
    maxWidth: width * 0.82,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.base,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: FONT_FAMILY.display,
    fontSize: FONT_SIZE.xl,
  },
  statLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    zIndex: 1,
  },
  dot: { height: 6, borderRadius: 3 },
  actions: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 48 : SPACING['2xl'],
    gap: SPACING.base,
    zIndex: 1,
  },
  signinLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  signinText: {
    fontFamily: FONT_FAMILY.bodyMed,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    letterSpacing: LETTER_SPACING.wide,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

const { width } = Dimensions.get('window');

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  hardware: string[];
  code: string;
  image_url: string | null;
  updated_at: string;
}

export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId, projectTitle } = route.params;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching or fetch from lab_projects/portfolio_projects
    const fetch = async () => {
      // In a real app, we'd query by projectId.
      // For this STEM demo, I'll provide a rich Mock if not found to demonstrate "Premium" design.
      const mock: ProjectDetail = {
        id: projectId,
        title: projectTitle || 'Arduino Obstacle Avoidance Robot',
        description: 'An autonomous robot built using Arduino Uno, Ultrasonic sensor, and two DC motors. It uses logic to detect obstacles and find a clear path.',
        hardware: ['Arduino Uno', 'Ultrasonic Sensor HC-SR04', 'L298N Motor Driver', '2x DC Motors', 'SG90 Servo'],
        code: `void loop() {
  long distance = readDistance();
  if (distance < 20) {
    stop();
    lookLeft();
    lookRight();
    // Logic for turning...
  } else {
    moveForward();
  }
}`,
        image_url: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&q=80&w=400',
        updated_at: new Date().toISOString(),
      };
      setProject(mock);
      setLoading(false);
    };
    fetch();
  }, [projectId]);

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!project) return null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner Image */}
        <View style={styles.bannerWrap}>
          <Image source={{ uri: project.image_url ?? undefined }} style={styles.bannerImage} />
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
          
          <SafeAreaView style={styles.bannerSafe}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.bannerContent}>
            <View style={styles.tagWrap}>
              <Text style={styles.tagText}>ROBOTICS</Text>
            </View>
            <Text style={styles.title}>{project.title}</Text>
          </View>
        </View>

        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.content}>
          
          {/* Hardware List */}
          <Text style={styles.sectionTitle}>🛠️ Hardware Inventory</Text>
          <View style={styles.hardwareGrid}>
            {project.hardware.map((item, i) => (
              <View key={i} style={styles.hardwareChip}>
                <Text style={styles.hardwareChipText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>📚 Project Theory</Text>
          <Text style={styles.description}>{project.description}</Text>

          {/* Logic/Code Section */}
          <View style={styles.codeHeader}>
            <Text style={styles.sectionTitle}>💻 Lab Protocol (C++)</Text>
            <TouchableOpacity style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>Copy Code</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{project.code}</Text>
          </View>

        </MotiView>
      </ScrollView>

      {/* Floating Action */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.mainAction} activeOpacity={0.8}>
          <LinearGradient colors={COLORS.gradPrimary} style={styles.actionInner}>
            <Text style={styles.actionText}>Export to Lab Report</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 120 },
  bannerWrap: { width: width, height: 320 },
  bannerImage: { ...StyleSheet.absoluteFillObject },
  bannerSafe: { position: 'absolute', top: 10, left: 20 },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backArrow: { color: '#fff', fontSize: 20 },
  bannerContent: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  tagWrap: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginBottom: 10 },
  tagText: { color: '#fff', fontSize: 10, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 1 },
  title: { fontSize: FONT_SIZE['2xl'], fontFamily: FONT_FAMILY.display, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  content: { padding: SPACING.xl, gap: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.heading, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  hardwareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hardwareChip: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md },
  hardwareChipText: { fontSize: 12, fontFamily: FONT_FAMILY.bodyMed, color: COLORS.textSecondary },
  description: { fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.body, color: COLORS.textMuted, lineHeight: 22 },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeContainer: { backgroundColor: '#0a0a14', padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  codeText: { fontSize: 13, fontFamily: FONT_FAMILY.mono, color: '#4ADE80', lineHeight: 20 },
  copyBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  copyBtnText: { fontSize: 10, color: COLORS.textMuted, fontFamily: FONT_FAMILY.bodySemi },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.xl, backgroundColor: 'rgba(0,0,0,0.8)' },
  mainAction: { height: 56, borderRadius: RADIUS.xl, overflow: 'hidden' },
  actionInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: FONT_SIZE.md, fontFamily: FONT_FAMILY.bodyBold },
});

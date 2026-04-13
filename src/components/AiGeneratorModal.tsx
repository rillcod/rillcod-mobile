import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { FONT_FAMILY, FONT_SIZE } from '../constants/typography';
import { RADIUS, SPACING } from '../constants/spacing';
import { expertAiService, AiGenerationRequest } from '../services/expertAi.service';

interface AiGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerated: (data: any) => void;
  type: 'assignment' | 'cbt' | 'lesson-plan' | 'report-feedback' | 'newsletter';
  initialTopic?: string;
  courseName?: string;
}

export function AiGeneratorModal({ visible, onClose, onGenerated, type, initialTopic = '', courseName = '' }: AiGeneratorModalProps) {
  const { colors, isDark } = useTheme();
  const [topic, setTopic] = useState(initialTopic);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const request: AiGenerationRequest = {
        type,
        topic,
        courseName,
        // Additional defaults
        questionCount: 10,
        assignmentType: 'practical',
      };

      const result = await expertAiService.generate(request);
      onGenerated(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={isDark ? 40 : 60} style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={[styles.modal, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.header}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryGlow }]}>
                <Ionicons name="sparkles" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>AI {type.replace('-', ' ')} Generator</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.textSecondary }]}>Topic / Subject</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                value={topic}
                onChangeText={(t) => {
                  setTopic(t);
                  setError(null);
                }}
                placeholder="e.g. Photosynthesis in plants"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

              <Text style={[styles.hint, { color: colors.textMuted }]}>
                AI will generate a complete {type.replace('-', ' ')} based on your topic. This usually takes 10-20 seconds.
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleGenerate}
                disabled={loading}
                style={[styles.generateBtn, { backgroundColor: colors.primary }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color="#fff" />
                    <Text style={styles.generateBtnText}>Generate with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontFamily: FONT_FAMILY.display,
    textTransform: 'capitalize',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 16,
    fontFamily: FONT_FAMILY.body,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.bodySemi,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.body,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONT_FAMILY.bodyBold,
  },
});

/**
 * LessonVoiceReader — floating TTS player (mirrors web NeuralVoiceReader).
 * Uses expo-speech to read lesson content aloud.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Speech from 'expo-speech';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';

interface LessonVoiceReaderProps {
  content: string;
  title?: string;
}

export default function LessonVoiceReader({ content, title }: LessonVoiceReaderProps) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => setSupported(voices.length > 0 || true))
      .catch(() => setSupported(true)); // assume supported on mobile

    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (speaking && !paused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
  }, [speaking, paused, pulseAnim]);

  const stripMarkdown = (text: string) =>
    text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const handlePlay = useCallback(async () => {
    if (loading) return;

    if (paused) {
      await Speech.resume();
      setPaused(false);
      setSpeaking(true);
      return;
    }

    if (speaking) {
      await Speech.pause();
      setPaused(true);
      return;
    }

    setLoading(true);
    const plain = stripMarkdown(content);
    const chunks = plain.match(/.{1,4000}(\s|$)/g) || [plain];
    const totalLength = plain.length;
    let readChars = 0;

    const speakChunk = (index: number) => {
      if (index >= chunks.length) {
        setSpeaking(false);
        setPaused(false);
        setProgress(100);
        return;
      }
      Speech.speak(chunks[index], {
        rate: 0.92,
        pitch: 1.0,
        onStart: () => {
          setLoading(false);
          setSpeaking(true);
        },
        onDone: () => {
          readChars += chunks[index].length;
          setProgress(Math.round((readChars / totalLength) * 100));
          speakChunk(index + 1);
        },
        onStopped: () => {
          setSpeaking(false);
          setPaused(false);
          setLoading(false);
        },
        onError: () => {
          setSpeaking(false);
          setPaused(false);
          setLoading(false);
        },
      });
    };

    speakChunk(0);
  }, [content, speaking, paused, loading]);

  const handleStop = useCallback(async () => {
    await Speech.stop();
    setSpeaking(false);
    setPaused(false);
    setProgress(0);
    setLoading(false);
  }, []);

  if (!supported) return null;

  const isActive = speaking || paused;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.container,
          isActive && styles.containerActive,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        {/* Play/Pause button */}
        <TouchableOpacity
          onPress={handlePlay}
          style={[styles.playBtn, isActive ? styles.playBtnActive : styles.playBtnIdle]}
          activeOpacity={0.82}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.playIcon}>
              {speaking && !paused ? '⏸' : '▶'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.label} numberOfLines={1}>
            {speaking && !paused ? 'Neural Voice Sync' : paused ? 'Paused' : 'Listen to Lesson'}
          </Text>
          {isActive ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          ) : (
            <Text style={styles.sublabel} numberOfLines={1}>
              {title ? `"${title}"` : 'Tap to read aloud'}
            </Text>
          )}
        </View>

        {/* Stop button (only when active) */}
        {isActive && (
          <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
            <Text style={styles.stopIcon}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Speaker icon (idle) */}
        {!isActive && (
          <View style={styles.speakerWrap}>
            <Text style={styles.speakerIcon}>🔊</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(20,20,35,0.92)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minWidth: 200,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  containerActive: {
    borderColor: COLORS.accent + '60',
    backgroundColor: 'rgba(10,10,28,0.96)',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playBtnIdle: {
    backgroundColor: COLORS.info,
    shadowColor: COLORS.info,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  playBtnActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  playIcon: {
    fontSize: 16,
    color: '#fff',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  sublabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  stopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stopIcon: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
  },
  speakerWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  speakerIcon: {
    fontSize: 13,
  },
});

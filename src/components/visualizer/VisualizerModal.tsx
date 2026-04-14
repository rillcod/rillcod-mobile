import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { P5Wrapper } from './P5Wrapper';
import { CodeData, VisualizationType } from '../../types/visualizer';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

interface VisualizerModalProps {
  visible: boolean;
  onClose: () => void;
  type: VisualizationType;
  initialData: CodeData;
}

const { width } = Dimensions.get('window');

/**
 * VisualizerModal - A premium, full-screen HUD for running P5.js code sketches.
 */
export const VisualizerModal: React.FC<VisualizerModalProps> = ({
  visible,
  onClose,
  type,
  initialData,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(initialData.step);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);

  // Sync with initial data when it changes externally (e.g. new project)
  useEffect(() => {
    setData(initialData);
    setCurrentStep(initialData.step);
    setError(null);
  }, [initialData]);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'error') {
        setError(msg.message);
        setIsPlaying(false);
      }
    } catch (e) {
      console.warn('Malformed pipe message:', e);
    }
  };

  // Handle Playback Logic
  useEffect(() => {
    let interval: any;
    if (isPlaying && currentStep < data.totalSteps - 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          const next = prev + 1;
          if (next >= data.totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, data.totalSteps, playbackSpeed]);

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const getVisualTitle = (t: VisualizationType) => {
    switch (t) {
      case 'sorting': return 'Algorithmic Complexity';
      case 'physics': return 'Vector Dynamics';
      case 'turtle': return 'Geometric Logic';
      case 'loops': return 'Iterative Expansion';
      case 'stateMachine': return 'Logic Transitions';
      default: return 'Visualizer';
    }
  };

  const getAccentColor = (t: VisualizationType) => {
    switch (t) {
      case 'sorting': return '#06b6d2'; // cyan
      case 'physics': return '#a855f7'; // purple
      case 'turtle': return '#84cc16'; // lime
      case 'loops': return '#ec4899'; // pink
      case 'stateMachine': return '#f97316'; // orange
      default: return COLORS.primary;
    }
  };

  const accent = getAccentColor(type);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* The Rendering Engine */}
        <P5Wrapper 
          type={type} 
          data={data} 
          isPlaying={isPlaying} 
          speed={playbackSpeed} 
          onMessage={handleMessage}
        />

        {/* HUD: Top Bar */}
        <SafeAreaView style={styles.hudOverlay}>
          <View style={styles.header}>
            <View style={styles.titleColumn}>
              <Text style={styles.engineLabel}>DRILLCOD VISUAL ENGINE</Text>
              <Text style={styles.title}>{getVisualTitle(type)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {error && (
            <AnimatePresence>
              <MotiView
                from={{ opacity: 0, translateY: -20 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -20 }}
                style={styles.errorBanner}
              >
                <Ionicons name="warning" size={16} color="#ef4444" />
                <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Text style={styles.errorClose}>DISMISS</Text>
                </TouchableOpacity>
              </MotiView>
            </AnimatePresence>
          )}
        </SafeAreaView>

        {/* HUD: Metrics & Variables */}
        <View style={styles.metricsWrapper} pointerEvents="none">
          <MotiView
            from={{ opacity: 0, transform: [{ translateX: -20 }] }}
            animate={{ opacity: 1, transform: [{ translateX: 0 }] }}
            style={[styles.metricCard, { borderLeftColor: accent }]}
          >
            <Text style={[styles.metricLabel, { color: accent }]}>EXECUTION REGISTRY</Text>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{String(currentStep + 1).padStart(2, '0')}</Text>
              <Text style={styles.metricSlash}>/ {String(data.totalSteps).padStart(2, '0')} STPS</Text>
            </View>
          </MotiView>

          {Object.entries(data.variables).length > 0 && (
            <MotiView
              from={{ opacity: 0, transform: [{ translateX: -20 }] }}
              animate={{ opacity: 1, transform: [{ translateX: 0 }] }}
              transition={{ delay: 100 }}
              style={[styles.metricCard, { borderLeftColor: '#a855f7', marginTop: SPACING.md }]}
            >
              <Text style={[styles.metricLabel, { color: '#a855f7' }]}>MEMORY HEAP</Text>
              {Object.entries(data.variables).map(([key, val]) => (
                <View key={key} style={styles.variableRow}>
                  <Text style={styles.varLabel}>{key}:</Text>
                  <Text style={styles.varValue}>{typeof val === 'number' ? val.toFixed(1) : String(val)}</Text>
                </View>
              ))}
            </MotiView>
          )}
        </View>

        {/* Control Surface */}
        <View style={styles.controlSurface}>
          <BlurView intensity={80} tint="dark" style={styles.controlsBlur}>
            <View style={styles.controlsRow}>
              <TouchableOpacity onPress={handleRestart} style={styles.miniCtrl}>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
              </TouchableOpacity>

              <View style={styles.mainCtrls}>
                <TouchableOpacity
                  onPress={() => setCurrentStep((p) => Math.max(0, p - 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="play-back" size={24} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsPlaying(!isPlaying)}
                  style={[styles.playBtn, { backgroundColor: accent }]}
                >
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setCurrentStep((p) => Math.min(data.totalSteps - 1, p + 1))}
                  style={styles.stepBtn}
                >
                  <Ionicons name="play-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setPlaybackSpeed((s) => (s >= 4 ? 0.5 : s * 2))}
                style={styles.speedBadge}
              >
                <Text style={styles.speedText}>{playbackSpeed}x</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hudOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? SPACING.xl : 0,
  },
  titleColumn: { gap: 2 },
  engineLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  title: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsWrapper: { position: 'absolute', top: 120, left: SPACING.xl, zIndex: 5 },
  metricCard: {
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    padding: SPACING.lg,
    borderLeftWidth: 3,
    minWidth: 140,
  },
  metricLabel: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  metricValue: {
    fontFamily: FONT_FAMILY.display,
    fontSize: 24,
    color: '#fff',
  },
  metricSlash: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  variableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  varLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  varValue: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  controlSurface: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30,
    left: SPACING.xl,
    right: SPACING.xl,
  },
  controlsBlur: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  miniCtrl: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.md,
  },
  mainCtrls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xl },
  stepBtn: { padding: 8 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  speedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    minWidth: 44,
    alignItems: 'center',
  },
  speedText: {
    color: '#fff',
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#ef4444',
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    flex: 1,
  },
  errorClose: {
    color: '#fff',
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
  },
});

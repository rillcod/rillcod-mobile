/**
 * LessonBlockRenderer — rich native renderer for AI-generated lesson blocks.
 * Mirrors the web's CanvaRenderer with native mobile equivalents.
 * Block types: heading, text, code, image, callout, activity, quiz, scratch, illustration, math, mermaid, video, motion_graphic
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Linking, Alert,
} from 'react-native';
import { MotiView } from 'moti';
import { Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Scratch block categories ──────────────────────────────────────────────────
type ScratchCat = 'event' | 'motion' | 'looks' | 'sound' | 'control' | 'sensing' | 'operator' | 'variable' | 'custom';

const SCRATCH_PALETTE: Record<ScratchCat, { bg: string; border: string; text: string; icon: string }> = {
  event:    { bg: '#FFD500', border: '#CC9900', text: '#1a1a00', icon: '🚩' },
  motion:   { bg: '#4C97FF', border: '#2E6CC4', text: '#fff',    icon: '🔵' },
  looks:    { bg: '#9966FF', border: '#6633CC', text: '#fff',    icon: '💬' },
  sound:    { bg: '#CF63CF', border: '#8E3A8E', text: '#fff',    icon: '🔊' },
  control:  { bg: '#FFAB19', border: '#CC7A00', text: '#fff',    icon: '🔄' },
  sensing:  { bg: '#5CB1D6', border: '#2E7EA6', text: '#fff',    icon: '❓' },
  operator: { bg: '#59C059', border: '#2E8E2E', text: '#fff',    icon: '➕' },
  variable: { bg: '#FF8C1A', border: '#CC5500', text: '#fff',    icon: '📦' },
  custom:   { bg: '#FF6680', border: '#CC2244', text: '#fff',    icon: '⚙️' },
};

function categorizeScratch(text: string): ScratchCat {
  const t = text.toLowerCase();
  if (/when|broadcast|receive|clicked|flag|start/.test(t)) return 'event';
  if (/move|turn|go to|glide|point|set x|set y|bounce|position/.test(t)) return 'motion';
  if (/say|think|show|hide|costume|size|effect|looks/.test(t)) return 'looks';
  if (/play sound|stop sound|volume|note|instrument/.test(t)) return 'sound';
  if (/forever|repeat|if|else|wait|stop|clone/.test(t)) return 'control';
  if (/touching|key|mouse|ask|answer|distance|timer/.test(t)) return 'sensing';
  if (/\+|\-|\*|\/|=|>|<|and|or|not|random|round/.test(t)) return 'operator';
  if (/set|change|show variable|hide variable|add to|list/.test(t)) return 'variable';
  return 'custom';
}

const SCRATCH_KEYWORDS = /^(when|move|turn|go to|say|think|show|hide|play|repeat|forever|if |wait|stop|set|change|broadcast|switch|next|ask|glide|point)/i;

function ScratchBlockPiece({ text }: { text: string }) {
  const cat = categorizeScratch(text);
  const p = SCRATCH_PALETTE[cat];
  return (
    <View style={[scratchStyles.block, { backgroundColor: p.bg, borderColor: p.border }]}>
      <Text style={scratchStyles.icon}>{p.icon}</Text>
      <Text style={[scratchStyles.text, { color: p.text }]}>{text}</Text>
    </View>
  );
}

const scratchStyles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: 2,
    minWidth: 180,
  },
  icon: { fontSize: 14 },
  text: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.xs, letterSpacing: 0.3, flex: 1, flexWrap: 'wrap' },
});

// ── Interactive Quiz Block ────────────────────────────────────────────────────
function QuizBlock({ block }: { block: any }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
  };

  return (
    <View style={blockStyles.quizCard}>
      <View style={blockStyles.quizHeader}>
        <Text style={blockStyles.quizLabel}>❓ QUICK CHECK</Text>
        <Text style={blockStyles.quizQuestion}>{block.question}</Text>
      </View>
      <View style={{ gap: SPACING.sm }}>
        {(block.options || []).map((opt: string, idx: number) => {
          const isCorrect = idx === block.correctAnswer;
          const isSelected = selected === idx;
          let bg = COLORS.bg;
          let border = COLORS.border;
          let textColor = COLORS.textSecondary;
          if (revealed) {
            if (isCorrect) { bg = COLORS.success + '18'; border = COLORS.success + '80'; textColor = COLORS.success; }
            else if (isSelected) { bg = COLORS.error + '18'; border = COLORS.error + '80'; textColor = COLORS.error; }
            else { textColor = COLORS.textMuted; }
          }
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelect(idx)}
              disabled={revealed}
              style={[blockStyles.quizOption, { backgroundColor: bg, borderColor: border }]}
              activeOpacity={0.8}
            >
              <View style={[blockStyles.optionBadge, { backgroundColor: revealed && isCorrect ? COLORS.success + '30' : COLORS.bgCard, borderColor: revealed && isCorrect ? COLORS.success : COLORS.border }]}>
                <Text style={[blockStyles.optionBadgeText, { color: revealed && isCorrect ? COLORS.success : COLORS.textMuted }]}>
                  {String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={[blockStyles.optionText, { color: textColor }]}>{opt}</Text>
              {revealed && isCorrect && <Text style={{ color: COLORS.success }}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      {revealed && (
        <MotiView from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} style={blockStyles.quizResult}>
          <Text style={[blockStyles.quizResultText, { color: selected === block.correctAnswer ? COLORS.success : COLORS.warning }]}>
            {selected === block.correctAnswer ? '🎉 Correct! Well done.' : `📚 The answer is: ${block.options?.[block.correctAnswer]}`}
          </Text>
          {block.explanation ? (
            <Text style={blockStyles.quizExplanation}>{block.explanation}</Text>
          ) : null}
        </MotiView>
      )}
    </View>
  );
}

// ── Motion Graphic Block (native animations) ──────────────────────────────────
function MotionGraphicBlock({ type, concept, label }: { type: string; concept?: string; label?: string }) {
  const COLORS_CYCLE = [
    { bg: COLORS.info + '33', border: COLORS.info + '66', text: COLORS.info },
    { bg: COLORS.primary + '33', border: COLORS.primary + '66', text: COLORS.primary },
    { bg: COLORS.success + '33', border: COLORS.success + '66', text: COLORS.success },
    { bg: COLORS.warning + '33', border: COLORS.warning + '66', text: COLORS.warning },
    { bg: COLORS.accent + '33', border: COLORS.accent + '66', text: COLORS.accent },
  ];

  const displayLabel = concept || label || type;
  const t = type?.toLowerCase();

  if (t === 'wave') {
    return (
      <View style={mgStyles.container}>
        <Text style={mgStyles.typeLabel}>{displayLabel.toUpperCase()}</Text>
        <View style={mgStyles.waveRow}>
          {Array.from({ length: 12 }).map((_, i) => {
            const col = COLORS_CYCLE[i % COLORS_CYCLE.length];
            return (
              <MotiView
                key={i}
                from={{ height: 8 }}
                animate={{ height: 8 + Math.sin(i * 0.8) * 32 + 32 }}
                transition={{ type: 'timing', duration: 900 + i * 80, loop: true, repeatReverse: true }}
                style={[mgStyles.waveBar, { backgroundColor: col.bg, borderTopColor: col.border, borderTopWidth: 2 }]}
              />
            );
          })}
        </View>
      </View>
    );
  }

  if (t === 'orbit') {
    return (
      <View style={mgStyles.container}>
        <Text style={mgStyles.typeLabel}>{displayLabel.toUpperCase()}</Text>
        <View style={mgStyles.orbitContainer}>
          {[60, 90, 120].map((r, i) => {
            const col = COLORS_CYCLE[i % COLORS_CYCLE.length];
            return (
              <View key={i} style={[mgStyles.orbitRing, { width: r * 2, height: r * 2, borderColor: col.border + '44' }]}>
                <MotiView
                  from={{ rotate: '0deg' }}
                  animate={{ rotate: i % 2 === 0 ? '360deg' : '-360deg' }}
                  transition={{ type: 'timing', duration: 5000 + i * 2000, loop: true }}
                  style={mgStyles.orbitDotContainer}
                >
                  <View style={[mgStyles.orbitDot, { backgroundColor: col.bg, borderColor: col.border }]} />
                </MotiView>
              </View>
            );
          })}
          <View style={mgStyles.orbitCenter}>
            <View style={[mgStyles.orbitCenterDot, { backgroundColor: COLORS.primary + '66', borderColor: COLORS.primary }]} />
          </View>
        </View>
      </View>
    );
  }

  if (t === 'particles') {
    const positions = Array.from({ length: 12 }).map((_, i) => ({
      x: (Math.sin(i * 1.3) * 90 + 120),
      y: (Math.cos(i * 1.7) * 50 + 70),
      col: COLORS_CYCLE[i % COLORS_CYCLE.length],
      delay: i * 200,
    }));
    return (
      <View style={mgStyles.container}>
        <Text style={mgStyles.typeLabel}>{displayLabel.toUpperCase()}</Text>
        <View style={mgStyles.particleArea}>
          {positions.map((p, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0, 1.4, 0] }}
              transition={{ type: 'timing', duration: 2500, loop: true, delay: p.delay }}
              style={[mgStyles.particle, { left: p.x, top: p.y, backgroundColor: p.col.bg, borderColor: p.col.border }]}
            />
          ))}
          <Text style={mgStyles.particleLabel}>LIVE</Text>
        </View>
      </View>
    );
  }

  // Default: pulse
  return (
    <View style={mgStyles.container}>
      <Text style={mgStyles.typeLabel}>{displayLabel.toUpperCase()}</Text>
      <View style={mgStyles.pulseContainer}>
        {[80, 110, 140].map((s, i) => (
          <MotiView
            key={i}
            from={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.2 + i * 0.4, opacity: 0 }}
            transition={{ type: 'timing', duration: 2000, loop: true, delay: i * 600 }}
            style={[mgStyles.pulseRing, { width: s, height: s, borderColor: COLORS.info + '55' }]}
          />
        ))}
        <View style={mgStyles.pulseCore}>
          <View style={[mgStyles.pulseCoreInner, { backgroundColor: COLORS.info + '44', borderColor: COLORS.info }]} />
        </View>
      </View>
    </View>
  );
}

// ── Illustration / Key Concepts grid ─────────────────────────────────────────
const ILLUS_COLORS = [
  { accent: COLORS.info,    bg: COLORS.info + '14' },
  { accent: '#8B5CF6',      bg: '#8B5CF614' },
  { accent: COLORS.primary, bg: COLORS.primary + '14' },
  { accent: COLORS.success, bg: COLORS.success + '14' },
  { accent: COLORS.error,   bg: COLORS.error + '14' },
  { accent: COLORS.warning, bg: COLORS.warning + '14' },
];

function IllustrationBlock({ block }: { block: any }) {
  const items: { label: string; value: string }[] = block.items || [];
  return (
    <View style={blockStyles.illustrationWrap}>
      {block.title && <Text style={blockStyles.illustrationTitle}>{block.title}</Text>}
      <View style={blockStyles.illustrationGrid}>
        {items.map((item, idx) => {
          const col = ILLUS_COLORS[idx % ILLUS_COLORS.length];
          return (
            <MotiView
              key={idx}
              from={{ opacity: 0, translateX: idx % 2 === 0 ? -12 : 12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: idx * 80 }}
              style={[blockStyles.illustrationItem, { backgroundColor: col.bg, borderLeftColor: col.accent }]}
            >
              <View style={[blockStyles.illustrationNum, { backgroundColor: col.accent }]}>
                <Text style={blockStyles.illustrationNumText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[blockStyles.illustrationLabel, { color: col.accent }]}>{item.label}</Text>
                <Text style={blockStyles.illustrationValue}>{item.value}</Text>
              </View>
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Block Renderer ───────────────────────────────────────────────────────
interface LessonBlock {
  type?: string;
  content?: string;
  title?: string;
  url?: string;
  caption?: string;
  style?: string;
  question?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  steps?: string[];
  blocks?: string[];
  instructions?: string;
  items?: { label: string; value: string }[];
  language?: string;
  fileName?: string;
  concept?: string;
  label?: string;
  [key: string]: unknown;
}

function Block({ block, index }: { block: LessonBlock; index: number }) {
  const t = (block.type || 'text').toLowerCase();

  if (t === 'heading' || t === 'title') {
    return (
      <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 30 }} style={blockStyles.headingWrap}>
        <View style={blockStyles.headingAccent} />
        <Text style={blockStyles.heading}>{block.content || block.title}</Text>
      </MotiView>
    );
  }

  if (t === 'text' || t === 'paragraph') {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 20 }}>
        <Text style={blockStyles.bodyText}>{block.content}</Text>
      </MotiView>
    );
  }

  if (t === 'code') {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }} style={blockStyles.codeWrap}>
        <View style={blockStyles.codeHeader}>
          <Text style={blockStyles.codeLabel}>{(block.language || 'CODE').toUpperCase()}</Text>
          <View style={blockStyles.codeDots}>
            {['#FF5F57','#FEBC2E','#28C840'].map((c, i) => (
              <View key={i} style={[blockStyles.codeDot, { backgroundColor: c }]} />
            ))}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={blockStyles.code}>{block.content}</Text>
        </ScrollView>
      </MotiView>
    );
  }

  if (t === 'image') {
    return (
      <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 30 }} style={blockStyles.imageWrap}>
        <Image source={{ uri: block.url }} style={blockStyles.image} resizeMode="cover" />
        {block.caption && <Text style={blockStyles.imageCaption}>{block.caption}</Text>}
      </MotiView>
    );
  }

  if (t === 'callout' || t === 'note' || t === 'tip' || t === 'warning') {
    const isWarning = block.style === 'warning' || t === 'warning';
    const color = isWarning ? COLORS.error : COLORS.info;
    const emoji = isWarning ? '⚠️' : t === 'tip' ? '💡' : 'ℹ️';
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}
        style={[blockStyles.callout, { backgroundColor: color + '10', borderColor: color + '40' }]}
      >
        <Text style={blockStyles.calloutIcon}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[blockStyles.calloutLabel, { color }]}>{isWarning ? 'IMPORTANT' : t === 'tip' ? 'PRO TIP' : 'KEY INSIGHT'}</Text>
          <Text style={[blockStyles.calloutText, { color: color + 'EE' }]}>{block.content}</Text>
        </View>
      </MotiView>
    );
  }

  if (t === 'activity') {
    const steps: string[] = block.steps || [];
    const hasScratch = steps.filter(s => SCRATCH_KEYWORDS.test(s.trim())).length >= Math.ceil(steps.length / 2);
    const [viewMode, setViewMode] = useState<'steps' | 'blocks'>(hasScratch ? 'blocks' : 'steps');

    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }} style={blockStyles.activityCard}>
        <LinearGradient colors={[COLORS.success + '20', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={blockStyles.activityHeader}>
          <Text style={blockStyles.activityEmoji}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={blockStyles.activityEyebrow}>INTERACTIVE LAB</Text>
            <Text style={blockStyles.activityTitle}>{block.title || 'Practical Activity'}</Text>
          </View>
        </View>
        {hasScratch && (
          <View style={blockStyles.activityToggle}>
            {(['steps', 'blocks'] as const).map((mode) => (
              <TouchableOpacity key={mode} onPress={() => setViewMode(mode)}
                style={[blockStyles.activityToggleBtn, viewMode === mode && blockStyles.activityToggleBtnActive]}
              >
                <Text style={[blockStyles.activityToggleText, viewMode === mode && blockStyles.activityToggleTextActive]}>
                  {mode === 'steps' ? '📋 Steps' : '🧩 Blocks'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {viewMode === 'blocks' ? (
          <View style={blockStyles.scratchWrap}>
            <Text style={blockStyles.scratchWatermark}>SCRATCH BLOCKS</Text>
            {steps.map((s, i) => <ScratchBlockPiece key={i} text={s} />)}
          </View>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {steps.length > 0 ? steps.map((step, si) => (
              <View key={si} style={blockStyles.stepRow}>
                <View style={blockStyles.stepNum}><Text style={blockStyles.stepNumText}>{si + 1}</Text></View>
                <Text style={blockStyles.stepText}>{step}</Text>
              </View>
            )) : (
              <Text style={blockStyles.bodyText}>{block.instructions || block.content}</Text>
            )}
          </View>
        )}
      </MotiView>
    );
  }

  if (t === 'scratch') {
    const blocks: string[] = block.blocks || [];
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }} style={blockStyles.scratchCard}>
        <View style={blockStyles.scratchHeader}>
          <Text style={blockStyles.scratchHeaderText}>🧩 SCRATCH BLOCK MISSION</Text>
          <Text style={blockStyles.scratchSubText}>Visual Coding Lab · KG to Basic 6</Text>
        </View>
        <View style={blockStyles.scratchWrap}>
          <Text style={blockStyles.scratchWatermark}>SCRATCH BLOCKS</Text>
          {(blocks.length ? blocks : ['when flag clicked', 'say "Hello, World!" for 2 seconds', 'move 10 steps']).map((s, i) => (
            <ScratchBlockPiece key={i} text={s} />
          ))}
        </View>
        {block.instructions && (
          <View style={blockStyles.scratchInstructions}>
            <Text style={blockStyles.scratchInstructionsLabel}>🚩 Step-by-Step Guide</Text>
            <Text style={blockStyles.scratchInstructionsText}>{block.instructions}</Text>
          </View>
        )}
      </MotiView>
    );
  }

  if (t === 'quiz') {
    return <QuizBlock key={index} block={block} />;
  }

  if (t === 'illustration' || t === 'key_concepts' || t === 'concepts') {
    return <IllustrationBlock key={index} block={block} />;
  }

  if (t === 'motion_graphic' || t === 'motion' || t === 'animation') {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}>
        <MotionGraphicBlock type={(block.content || block.label || block.concept || 'pulse') as string} concept={block.concept as string} label={block.label as string} />
      </MotiView>
    );
  }

  if (t === 'math' || t === 'formula') {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}
        style={blockStyles.mathCard}
      >
        <LinearGradient colors={['#4F46E515', 'transparent']} style={StyleSheet.absoluteFill} />
        <Text style={blockStyles.mathLabel}>∑ MATHEMATICAL SYNTHESIS</Text>
        <Text style={blockStyles.mathFormula}>{block.content}</Text>
      </MotiView>
    );
  }

  if (t === 'mermaid' || t === 'diagram' || t === 'flowchart' || t === 'mindmap') {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}
        style={blockStyles.mermaidCard}
      >
        <View style={blockStyles.mermaidHeader}>
          <View style={blockStyles.mermaidDot} />
          <Text style={blockStyles.mermaidLabel}>LEARNING ADVENTURE MAP</Text>
        </View>
        <View style={blockStyles.mermaidBody}>
          <Text style={blockStyles.mermaidCode}>{block.content}</Text>
        </View>
        <Text style={blockStyles.mermaidNote}>📊 Diagram — open on web for full visual rendering</Text>
      </MotiView>
    );
  }

  if (t === 'video') {
    const url = block.url || '';
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}>
        <TouchableOpacity style={blockStyles.videoCard} onPress={() => url ? Linking.openURL(url).catch(() => Alert.alert('Video', 'Could not open video link.')) : null}>
          <LinearGradient colors={[COLORS.error + '22', COLORS.error + '08']} style={StyleSheet.absoluteFill} />
          <Text style={blockStyles.videoIcon}>▶</Text>
          <View style={{ flex: 1 }}>
            <Text style={blockStyles.videoLabel}>🎬 VIDEO LESSON</Text>
            <Text style={blockStyles.videoCaption}>{block.caption || block.title || 'Tap to open video'}</Text>
          </View>
          <Text style={blockStyles.videoOpen}>OPEN</Text>
        </TouchableOpacity>
      </MotiView>
    );
  }

  if (t === 'file') {
    const url = block.url || '';
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 30 }}>
        <TouchableOpacity style={blockStyles.fileCard} onPress={() => url ? Linking.openURL(url).catch(() => Alert.alert('File', 'Could not open file.')) : null}>
          <Text style={blockStyles.fileIcon}>📎</Text>
          <View style={{ flex: 1 }}>
            <Text style={blockStyles.fileName}>{block.fileName || block.title || 'Resource File'}</Text>
            <Text style={blockStyles.fileMeta}>TAP TO DOWNLOAD</Text>
          </View>
          <Text style={[blockStyles.videoOpen, { color: COLORS.info }]}>↓</Text>
        </TouchableOpacity>
      </MotiView>
    );
  }

  // Fallback: render as styled text card
  const title = typeof block.title === 'string' ? block.title : typeof block.type === 'string' ? block.type : `Block ${index + 1}`;
  const body = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? block, null, 2);
  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 20 }} style={blockStyles.fallbackCard}>
      {title && <Text style={blockStyles.fallbackTitle}>{title.toUpperCase()}</Text>}
      <Text style={blockStyles.bodyText}>{body}</Text>
    </MotiView>
  );
}

// ── Smart text → blocks parser ────────────────────────────────────────────────
/**
 * Converts plain text (lesson_notes / content) into an array of rich LessonBlocks.
 * Handles markdown-like patterns: headings, code fences, callouts, numbered lists,
 * scratch-like steps, mermaid fences, math, and plain paragraphs.
 */
export function parseTextToBlocks(text: string | null | undefined): LessonBlock[] {
  if (!text?.trim()) return [];

  // 1. Try JSON first — maybe the content is already structured blocks
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) return parsed;
      if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed.blocks;
      if (parsed.sections && Array.isArray(parsed.sections)) return parsed.sections;
    } catch { /* not JSON — fall through */ }
  }

  const blocks: LessonBlock[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Skip blank lines
    if (!line) { i++; continue; }

    // ── Mermaid fence ─────────────────────────────────────────────────────────
    if (line.startsWith('```mermaid') || line.startsWith('~~~mermaid')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('~~~')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'mermaid', content: codeLines.join('\n').trim() });
      i++;
      continue;
    }

    // ── Generic code fence ────────────────────────────────────────────────────
    if (line.startsWith('```') || line.startsWith('~~~')) {
      const lang = line.slice(3).trim() || 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('~~~')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', language: lang, content: codeLines.join('\n') });
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push({ type: 'heading', content: line.replace(/^#+\s+/, '') });
      i++;
      continue;
    }

    // ── Callout / Note / Tip / Warning ────────────────────────────────────────
    if (/^>\s*⚠️|^>\s*warning:|^>\s*!warning/i.test(line)) {
      blocks.push({ type: 'callout', style: 'warning', content: line.replace(/^>\s*(⚠️|warning:|!warning)/i, '').trim() });
      i++;
      continue;
    }
    if (/^>\s*💡|^>\s*tip:|^>\s*!tip/i.test(line)) {
      blocks.push({ type: 'tip', content: line.replace(/^>\s*(💡|tip:|!tip)/i, '').trim() });
      i++;
      continue;
    }
    if (/^>\s/.test(line)) {
      blocks.push({ type: 'note', content: line.replace(/^>\s*/, '').trim() });
      i++;
      continue;
    }

    // ── Math formula ──────────────────────────────────────────────────────────
    if (/^\$\$/.test(line)) {
      const mathLines: string[] = [];
      const startLine = line.replace(/^\$\$/, '').trim();
      if (startLine) mathLines.push(startLine);
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        mathLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'math', content: mathLines.join(' ').trim() || line });
      i++;
      continue;
    }

    // ── Numbered list / Scratch-like steps ────────────────────────────────────
    if (/^(\d+\.|[-*•])\s+/.test(line)) {
      const steps: string[] = [];
      while (i < lines.length && /^(\d+\.|[-*•])\s+/.test(lines[i].trim())) {
        steps.push(lines[i].trim().replace(/^(\d+\.|[-*•])\s+/, ''));
        i++;
      }
      const hasScratch = steps.filter(s => SCRATCH_KEYWORDS.test(s)).length >= Math.ceil(steps.length / 2);
      if (hasScratch) {
        blocks.push({ type: 'activity', title: 'Steps', steps });
      } else if (steps.length >= 4) {
        // Turn into illustration if items look like label: value
        const colonItems = steps.filter(s => s.includes(':'));
        if (colonItems.length >= Math.ceil(steps.length / 2)) {
          blocks.push({
            type: 'illustration',
            items: steps.map(s => {
              const idx = s.indexOf(':');
              return idx > -1
                ? { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() }
                : { label: `Point ${steps.indexOf(s) + 1}`, value: s };
            }),
          });
        } else {
          blocks.push({ type: 'activity', steps });
        }
      } else {
        blocks.push({ type: 'activity', steps });
      }
      continue;
    }

    // ── Bold/all-caps heading-like lines ──────────────────────────────────────
    if (/^\*\*[^*]+\*\*$/.test(line) || /^[A-Z][A-Z\s]{6,}:?$/.test(line)) {
      const clean = line.replace(/\*\*/g, '').replace(/:$/, '');
      blocks.push({ type: 'heading', content: clean });
      i++;
      continue;
    }

    // ── Collect consecutive plain-text lines into one paragraph ───────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^(\d+\.|[-*•])\s/.test(lines[i].trim()) &&
      !/^(```|~~~|>|\$\$|\*\*[^*]+\*\*$)/.test(lines[i].trim()) &&
      !/^[A-Z][A-Z\s]{6,}:?$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      const para = paraLines.join(' ');
      blocks.push({ type: 'text', content: para });
    }
  }

  return blocks;
}

interface LessonBlockRendererProps {
  blocks: LessonBlock[];
  lessonType?: string | null;
}

export default function LessonBlockRenderer({ blocks, lessonType }: LessonBlockRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <View style={blockStyles.root}>
      {blocks.map((block, i) => <Block key={i} block={block} index={i} />)}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const blockStyles = StyleSheet.create({
  root: { gap: SPACING.lg },

  // Heading
  headingWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  headingAccent: { width: 4, height: 22, borderRadius: 2, backgroundColor: COLORS.primary },
  heading: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary, flex: 1, flexWrap: 'wrap' },

  // Body text
  bodyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.base, color: COLORS.textSecondary, lineHeight: FONT_SIZE.base * 1.65 },

  // Code block
  codeWrap: { backgroundColor: '#0d0d1a', borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff15' },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  codeLabel: { fontFamily: FONT_FAMILY.bodyMed, fontSize: FONT_SIZE.xs, color: '#aaa', letterSpacing: 1 },
  codeDots: { flexDirection: 'row', gap: 6 },
  codeDot: { width: 10, height: 10, borderRadius: 5 },
  code: { fontFamily: 'Courier New', fontSize: FONT_SIZE.sm, color: '#e2e8f0', padding: SPACING.md, lineHeight: FONT_SIZE.sm * 1.7 },

  // Image
  imageWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  image: { width: '100%', height: 200 },
  imageCaption: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.sm, textTransform: 'uppercase', letterSpacing: 1 },

  // Callout
  callout: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 2, alignItems: 'flex-start' },
  calloutIcon: { fontSize: 20, marginTop: 2 },
  calloutLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  calloutText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: FONT_SIZE.sm * 1.6 },

  // Activity
  activityCard: { backgroundColor: COLORS.bgCard, borderWidth: 2, borderColor: COLORS.success + '33', borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.md, overflow: 'hidden' },
  activityHeader: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  activityEmoji: { fontSize: 28, backgroundColor: COLORS.success + '20', padding: SPACING.sm, borderRadius: RADIUS.md },
  activityEyebrow: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.success, letterSpacing: 2, textTransform: 'uppercase' },
  activityTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  activityToggle: { flexDirection: 'row', gap: SPACING.sm },
  activityToggleBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  activityToggleBtnActive: { borderColor: COLORS.success, backgroundColor: COLORS.success + '20' },
  activityToggleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  activityToggleTextActive: { color: COLORS.success, fontFamily: FONT_FAMILY.bodySemi },
  stepRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.success + '22', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs, color: COLORS.success },
  stepText: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.6, paddingTop: 4 },

  // Scratch
  scratchCard: { backgroundColor: '#0f0f23', borderWidth: 2, borderColor: '#FFD50030', borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.md },
  scratchHeader: { gap: 4 },
  scratchHeaderText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#FFD500' },
  scratchSubText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: '#FFD50060' },
  scratchWrap: { backgroundColor: '#141428', borderRadius: RADIUS.md, padding: SPACING.md, gap: 2, position: 'relative' },
  scratchWatermark: { position: 'absolute', top: 8, right: 12, fontFamily: FONT_FAMILY.display, fontSize: 8, color: '#FFD50020', letterSpacing: 2 },
  scratchInstructions: { backgroundColor: '#FFD50010', borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
  scratchInstructionsLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#FFD500', letterSpacing: 1, textTransform: 'uppercase' },
  scratchInstructionsText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: '#FFD500CC', lineHeight: FONT_SIZE.sm * 1.6 },

  // Quiz
  quizCard: { backgroundColor: COLORS.bgCard, borderWidth: 1.5, borderColor: COLORS.primary + '33', borderRadius: RADIUS.lg, padding: SPACING.base, gap: SPACING.md },
  quizHeader: { gap: SPACING.xs },
  quizLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.warning, letterSpacing: 1.5, textTransform: 'uppercase' },
  quizQuestion: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, lineHeight: FONT_SIZE.base * 1.5 },
  quizOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1 },
  optionBadge: { width: 28, height: 28, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionBadgeText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs },
  optionText: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: FONT_SIZE.sm * 1.5 },
  quizResult: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, gap: SPACING.xs },
  quizResultText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  quizExplanation: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.6 },

  // Illustration
  illustrationWrap: { gap: SPACING.md },
  illustrationTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.xs },
  illustrationGrid: { gap: SPACING.sm },
  illustrationItem: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, borderLeftWidth: 4, alignItems: 'flex-start' },
  illustrationNum: { width: 24, height: 24, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  illustrationNumText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xs, color: '#fff' },
  illustrationLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  illustrationValue: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: FONT_SIZE.sm * 1.5 },

  // Math
  mathCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: '#4F46E533', borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center', gap: SPACING.sm, overflow: 'hidden' },
  mathLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#4F46E5', letterSpacing: 2, textTransform: 'uppercase' },
  mathFormula: { fontFamily: 'Courier New', fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, textAlign: 'center', lineHeight: FONT_SIZE.lg * 1.5 },

  // Mermaid
  mermaidCard: { backgroundColor: '#0d0d1a', borderWidth: 1, borderColor: '#4F46E520', borderRadius: RADIUS.lg, overflow: 'hidden' },
  mermaidHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  mermaidDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },
  mermaidLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: '#4F46E580', letterSpacing: 2, textTransform: 'uppercase' },
  mermaidBody: { padding: SPACING.md },
  mermaidCode: { fontFamily: 'Courier New', fontSize: FONT_SIZE.xs, color: '#a0aec0', lineHeight: FONT_SIZE.xs * 1.8 },
  mermaidNote: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: '#4F46E560', textAlign: 'center', paddingBottom: SPACING.sm, paddingHorizontal: SPACING.md },

  // Video
  videoCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.error + '33', borderRadius: RADIUS.lg, overflow: 'hidden' },
  videoIcon: { fontSize: 24, color: COLORS.error, fontFamily: FONT_FAMILY.display },
  videoLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, color: COLORS.error, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  videoCaption: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  videoOpen: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primary, letterSpacing: 1 },

  // File
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.info + '33', borderRadius: RADIUS.lg },
  fileIcon: { fontSize: 20 },
  fileName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  fileMeta: { fontFamily: FONT_FAMILY.body, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },

  // Fallback
  fallbackCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.xs },
  fallbackTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase' },

  // Motion Graphic
  // (defined inline in each variant)
});

// Motion graphic styles (defined separately to avoid circular ref)
const mgStyles = StyleSheet.create({
  container: { backgroundColor: '#0d0d1a', borderRadius: RADIUS.lg, padding: SPACING.base, alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: '#ffffff10' },
  typeLabel: { fontFamily: FONT_FAMILY.display, fontSize: 10, color: COLORS.info + '80', letterSpacing: 3, textTransform: 'uppercase' },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80, width: '100%', paddingHorizontal: SPACING.sm },
  waveBar: { flex: 1, borderRadius: RADIUS.sm, minWidth: 8 },
  orbitContainer: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  orbitRing: { position: 'absolute', borderRadius: 1000, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  orbitDotContainer: { position: 'absolute', top: 0, left: '50%', width: 12, height: 12, marginLeft: -6 },
  orbitDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  orbitCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbitCenterDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  particleArea: { width: '100%', height: 160, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  particleLabel: { fontFamily: FONT_FAMILY.display, fontSize: 42, color: '#ffffff08', letterSpacing: 12 },
  pulseContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', borderRadius: 1000, borderWidth: 1 },
  pulseCore: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pulseCoreInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2 },
});

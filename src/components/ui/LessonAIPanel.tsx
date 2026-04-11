/**
 * LessonAIPanel — AI tools panel embedded in lesson detail.
 * Mirrors web LessonAITools.tsx but as a mobile-native component.
 *
 * Features:
 *  - Quick AI Tutor chat (ask anything about the lesson)
 *  - AI Image Synthesis (Pollinations)
 *  - AI Video Finder (YouTube via OpenRouter)
 *  - AI Graphic/Diagram Generator (Mermaid flowcharts, infographics)
 *  - Quick-action chips: Summarize · Explain · Quiz me · Key facts
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { MotiView } from 'moti';
import { callAI, pollinationsImageUrl } from '../../lib/openrouter';
import LessonBlockRenderer from './LessonBlockRenderer';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { RADIUS, SPACING } from '../../constants/spacing';

type Tab = 'tutor' | 'image' | 'video' | 'graphic';

const QUICK_PROMPTS = (title: string, grade?: string) => [
  { label: 'Summarize', prompt: `Summarize the lesson "${title}" in 5 bullet points for ${grade || 'secondary'} students.` },
  { label: 'Explain', prompt: `Explain the key concept in "${title}" in simple terms with a real-world Nigerian example.` },
  { label: 'Quiz me', prompt: `Give me 5 short-answer quiz questions about "${title}" suitable for ${grade || 'secondary'} level.` },
  { label: 'Key facts', prompt: `List 7 must-know facts about "${title}" that every ${grade || 'secondary'} student should remember.` },
  { label: 'Study tips', prompt: `What are 4 practical study tips for mastering "${title}"?` },
  { label: 'Real-world', prompt: `Give 3 real-world applications of "${title}" in Nigeria or Africa.` },
];

type ChatMsg = { role: 'user' | 'ai'; text: string };

interface LessonAIPanelProps {
  lessonTitle: string;
  lessonNotes?: string | null;
  courseTitle?: string | null;
  gradeLevel?: string | null;
}

function TutorTab({ lessonTitle, lessonNotes, courseTitle, gradeLevel }: LessonAIPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const quickPrompts = QUICK_PROMPTS(lessonTitle, gradeLevel ?? undefined);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError(null);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const systemPrompt = `You are a friendly, expert STEM tutor at Rillcod Academy helping a Nigerian student.
Lesson: "${lessonTitle}"${courseTitle ? ` — Course: ${courseTitle}` : ''}${gradeLevel ? ` — Grade: ${gradeLevel}` : ''}
${lessonNotes ? `Lesson notes context: ${lessonNotes.slice(0, 400)}` : ''}
RULES:
- Clear, step-by-step explanations.
- Use Nigerian / African real-world examples (NEPA, mobile money, Eko Bridge, Nollywood).
- For coding questions show a short working code snippet with comments.
- Warm, enthusiastic tone — like a brilliant older sibling who loves STEM.
- Responses under 280 words. Use bullet points for clarity.`;

      const msgs = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));

      const reply = await callAI({
        messages: [
          { role: 'system', content: systemPrompt },
          ...msgs,
          { role: 'user', content: text.trim() },
        ],
        maxTokens: 512,
        temperature: 0.72,
        timeoutMs: 25000,
      });

      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message || 'AI error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, lessonTitle, courseTitle, gradeLevel, lessonNotes]);

  return (
    <View style={tt.wrap}>
      {/* Quick chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tt.chipScroll} contentContainerStyle={tt.chipRow}>
        {quickPrompts.map(q => (
          <TouchableOpacity key={q.label} onPress={() => send(q.prompt)} disabled={loading} style={tt.chip}>
            <Text style={tt.chipText}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chat history */}
      {messages.length > 0 && (
        <ScrollView ref={scrollRef} style={tt.chatScroll} contentContainerStyle={tt.chatContent} showsVerticalScrollIndicator={false}>
          {messages.map((m, i) => (
            <View key={i} style={[tt.bubble, m.role === 'user' ? tt.userBubble : tt.aiBubble]}>
              <Text style={[tt.bubbleText, m.role === 'user' ? tt.userText : tt.aiText]}>{m.text}</Text>
            </View>
          ))}
          {loading && (
            <View style={[tt.bubble, tt.aiBubble]}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          )}
        </ScrollView>
      )}

      {messages.length === 0 && (
        <View style={tt.empty}>
          <Text style={tt.emptyEmoji}>🧠</Text>
          <Text style={tt.emptyText}>Ask me anything about this lesson...</Text>
        </View>
      )}

      {error ? <Text style={tt.error}>{error}</Text> : null}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={tt.inputRow}>
          <TextInput
            style={tt.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            placeholder="Ask about this lesson..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            style={[tt.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={tt.sendIcon}>✦</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ImageTab({ lessonTitle, gradeLevel }: { lessonTitle: string; gradeLevel?: string | null }) {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = () => {
    const p = prompt || lessonTitle;
    const url = pollinationsImageUrl(p, 800, 500);
    setLoading(true);
    setImageUrl(url);
  };

  return (
    <View style={img.wrap}>
      <Text style={img.hint}>AI-generated educational illustration (Pollinations · Flux)</Text>
      <TextInput
        style={img.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder={`e.g. "${lessonTitle}" diagram...`}
        placeholderTextColor="rgba(255,255,255,0.25)"
      />
      <TouchableOpacity onPress={generate} style={img.btn}>
        <Text style={img.btnText}>Generate Image</Text>
      </TouchableOpacity>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={img.preview}
          resizeMode="cover"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      )}
      {loading && !imageUrl && <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />}
    </View>
  );
}

function VideoTab({ lessonTitle }: { lessonTitle: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; url: string; channel: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const find = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reply = await callAI({
        messages: [
          {
            role: 'system',
            content: 'You are an educational YouTube video finder. Return ONLY a JSON object with fields: title (string), channel (string), url (full YouTube URL). No explanation.',
          },
          {
            role: 'user',
            content: `Find the best free YouTube educational video about "${prompt || lessonTitle}". Return JSON only.`,
          },
        ],
        maxTokens: 200,
        temperature: 0.3,
        responseFormatJsonObject: true,
      });
      const parsed = JSON.parse(reply);
      if (parsed.url) setResult(parsed);
      else throw new Error('No video found');
    } catch (e: any) {
      setError('Could not find a video. Try a different topic.');
    } finally {
      setLoading(false);
    }
  }, [prompt, lessonTitle]);

  return (
    <View style={vid.wrap}>
      <Text style={vid.hint}>AI finds the best educational YouTube video for this topic</Text>
      <TextInput
        style={vid.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder={`Topic or lesson title...`}
        placeholderTextColor="rgba(255,255,255,0.25)"
      />
      <TouchableOpacity onPress={find} disabled={loading} style={[vid.btn, loading && { opacity: 0.6 }]}>
        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={vid.btnText}>Find Educational Video</Text>}
      </TouchableOpacity>
      {error ? <Text style={vid.error}>{error}</Text> : null}
      {result && (
        <TouchableOpacity
          style={vid.resultCard}
          onPress={() => Linking.openURL(result.url)}
          activeOpacity={0.85}
        >
          <Text style={vid.resultTitle} numberOfLines={2}>{result.title}</Text>
          <Text style={vid.resultChannel}>{result.channel}</Text>
          <Text style={vid.openLink}>Open on YouTube →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

type RichBlock = { type: string; content?: string; title?: string; items?: { label: string; value: string }[] };

function GraphicTab({ lessonTitle }: { lessonTitle: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<RichBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (type: string) => {
    setLoading(type);
    setError(null);
    setBlocks(null);
    const topic = prompt.trim() || lessonTitle;
    try {
      if (type === 'flowchart' || type === 'mindmap') {
        // Generate Mermaid code and wrap in a mermaid block
        const reply = await callAI({
          messages: [
            { role: 'system', content: 'You are an expert educational diagram creator. Output only clean Mermaid diagram code with no markdown fences.' },
            { role: 'user', content: `Create a Mermaid ${type === 'mindmap' ? 'mindmap' : 'flowchart TD'} for: "${topic}". Return only the raw Mermaid code.` },
          ],
          maxTokens: 500,
          temperature: 0.4,
        });
        const cleanCode = reply.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        setBlocks([{ type: 'mermaid', content: cleanCode, title: topic }]);
      } else if (type === 'infographic') {
        // Generate structured illustration blocks
        const reply = await callAI({
          messages: [
            { role: 'system', content: 'You are an infographic designer for a Nigerian school. Return ONLY valid JSON — no markdown fences. Format: {"title": string, "items": [{"label": string, "value": string}]}. Max 6 items.' },
            { role: 'user', content: `Create an infographic for: "${topic}". Return JSON only.` },
          ],
          maxTokens: 500,
          temperature: 0.5,
          responseFormatJsonObject: true,
        });
        try {
          const parsed = JSON.parse(reply);
          setBlocks([{ type: 'illustration', title: parsed.title || topic, items: parsed.items || [] }]);
        } catch {
          setBlocks([{ type: 'text', content: reply }]);
        }
      } else {
        // Key points → illustration block
        const reply = await callAI({
          messages: [
            { role: 'system', content: 'You are an educational content expert. Return ONLY valid JSON — no markdown. Format: {"items": [{"label": string, "value": string}]}. Exactly 6 key points.' },
            { role: 'user', content: `Give 6 key points about: "${topic}". Each with a short label and a 1-2 sentence explanation. Return JSON only.` },
          ],
          maxTokens: 500,
          temperature: 0.5,
          responseFormatJsonObject: true,
        });
        try {
          const parsed = JSON.parse(reply);
          setBlocks([{ type: 'illustration', title: `Key Points: ${topic}`, items: parsed.items || [] }]);
        } catch {
          setBlocks([{ type: 'text', content: reply }]);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Generation failed.');
    } finally {
      setLoading(null);
    }
  }, [prompt, lessonTitle]);

  return (
    <View style={gfx.wrap}>
      <Text style={gfx.hint}>AI-powered diagrams, infographics, and concept maps</Text>
      <TextInput
        style={gfx.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Concept to visualise..."
        placeholderTextColor="rgba(255,255,255,0.25)"
      />
      <View style={gfx.btnGrid}>
        {[
          { key: 'flowchart', label: 'Flowchart', color: COLORS.info },
          { key: 'mindmap', label: 'Mind Map', color: '#8b5cf6' },
          { key: 'infographic', label: 'Infographic', color: '#f59e0b' },
          { key: 'keypoints', label: 'Key Points', color: COLORS.success },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => generate(t.key)}
            disabled={!!loading}
            style={[gfx.typeBtn, { borderColor: t.color + '60', backgroundColor: t.color + '12' }]}
          >
            {loading === t.key ? (
              <ActivityIndicator size="small" color={t.color} />
            ) : (
              <Text style={[gfx.typeBtnText, { color: t.color }]}>{t.label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={gfx.error}>{error}</Text> : null}
      {blocks && (
        <View style={{ marginTop: SPACING.md }}>
          <LessonBlockRenderer blocks={blocks as any} />
        </View>
      )}
    </View>
  );
}

export default function LessonAIPanel({ lessonTitle, lessonNotes, courseTitle, gradeLevel }: LessonAIPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tutor');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'tutor', label: 'AI Tutor', icon: '🧠' },
    { key: 'image', label: 'Image', icon: '🎨' },
    { key: 'video', label: 'Video', icon: '▶️' },
    { key: 'graphic', label: 'Diagram', icon: '📊' },
  ];

  return (
    <View style={panel.wrap}>
      {/* Toggle header */}
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={panel.header} activeOpacity={0.88}>
        <View style={panel.headerLeft}>
          <View style={panel.headerIcon}>
            <Text style={panel.headerIconText}>✦</Text>
          </View>
          <View>
            <Text style={panel.headerTitle}>AI Learning Suite</Text>
            <Text style={panel.headerSub}>Tutor · Image · Video · Diagrams</Text>
          </View>
        </View>
        <Text style={panel.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
          {/* Tab bar */}
          <View style={panel.tabBar}>
            {tabs.map(t => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[panel.tab, activeTab === t.key && panel.tabActive]}
              >
                <Text style={panel.tabIcon}>{t.icon}</Text>
                <Text style={[panel.tabLabel, activeTab === t.key && panel.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          <View style={panel.body}>
            {activeTab === 'tutor' && (
              <TutorTab
                lessonTitle={lessonTitle}
                lessonNotes={lessonNotes}
                courseTitle={courseTitle}
                gradeLevel={gradeLevel}
              />
            )}
            {activeTab === 'image' && (
              <ImageTab lessonTitle={lessonTitle} gradeLevel={gradeLevel} />
            )}
            {activeTab === 'video' && (
              <VideoTab lessonTitle={lessonTitle} />
            )}
            {activeTab === 'graphic' && (
              <GraphicTab lessonTitle={lessonTitle} />
            )}
          </View>
        </MotiView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panel = StyleSheet.create({
  wrap: {
    marginTop: SPACING.xl,
    backgroundColor: 'rgba(10,10,24,0.96)',
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accent + '20',
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 16, color: COLORS.accent },
  headerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },
  headerSub: { fontFamily: FONT_FAMILY.mono, fontSize: 10, color: COLORS.accent, marginTop: 2 },
  chevron: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabActive: { backgroundColor: COLORS.accent + '14', borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.4 },
  tabLabelActive: { color: COLORS.accent },
  body: { padding: SPACING.lg },
});

const tt = StyleSheet.create({
  wrap: { gap: 12 },
  chipScroll: { marginBottom: 4 },
  chipRow: { gap: 8, flexDirection: 'row', paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: RADIUS.full,
  },
  chipText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 },
  chatScroll: { maxHeight: 240 },
  chatContent: { gap: 8 },
  bubble: {
    padding: 10,
    borderRadius: RADIUS.lg,
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.accent + '22',
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  bubbleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: 'rgba(255,255,255,0.85)' },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyEmoji: { fontSize: 28 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  error: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.error, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: '#fff',
    paddingVertical: 0,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { fontSize: 14, color: '#fff' },
});

const img = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: '#fff',
  },
  btn: {
    backgroundColor: '#f97316',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff', letterSpacing: 0.4 },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

const vid = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: '#fff',
  },
  btn: {
    backgroundColor: '#0891b2',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff', letterSpacing: 0.4 },
  error: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.error },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#0891b2' + '40',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
  },
  resultTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm, color: '#fff' },
  resultChannel: { fontFamily: FONT_FAMILY.mono, fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  openLink: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, color: '#0891b2', marginTop: 4 },
});

const gfx = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontFamily: FONT_FAMILY.mono, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FONT_FAMILY.body,
    fontSize: FONT_SIZE.sm,
    color: '#fff',
  },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeBtnText: { fontFamily: FONT_FAMILY.bodyBold, fontSize: FONT_SIZE.sm },
  error: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: COLORS.error },
  resultScroll: { maxHeight: 280, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.lg, padding: 12 },
  resultText: { fontFamily: FONT_FAMILY.mono, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
});

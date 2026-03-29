/**
 * AIScreen — 3-tab AI hub
 *  Tutor  : Study Assistant chat (all users)
 *  Create : AI content generator — Lesson / Assignment / CBT (admin/teacher)
 *  Code   : AI code gen + live execution via Piston API (all users)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Keyboard, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { callAI, pollinationsImageUrl, type ChatMessage } from '../../lib/openrouter';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['🧠 Tutor', '✨ Create', '💻 Code'] as const;
type Tab = typeof TABS[number];

const GRADE_LEVELS = ['KG', 'Basic 1–3', 'Basic 4–6', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];

const CREATE_TYPES = [
  { key: 'lesson',     emoji: '📖', label: 'Full Lesson',     desc: 'Complete lesson with blocks, activities, quiz' },
  { key: 'lesson-notes', emoji: '📝', label: 'Lesson Notes',  desc: 'Concise study notes for students' },
  { key: 'assignment', emoji: '📋', label: 'Assignment',      desc: 'Task with objectives and deliverables' },
  { key: 'cbt',        emoji: '🎯', label: 'CBT Questions',   desc: '10 multiple-choice exam questions' },
  { key: 'report-feedback', emoji: '📊', label: 'Report Feedback', desc: 'Teacher comments for a student' },
];

const CODE_LANGS = [
  { key: 'python',     label: 'Python',     pistonLang: 'python',     pistonVer: '3.10.0', starter: '# Write your Python code here\nprint("Hello, Rillcod!")\n' },
  { key: 'javascript', label: 'JavaScript', pistonLang: 'javascript', pistonVer: '18.15.0', starter: '// Write your JavaScript code here\nconsole.log("Hello, Rillcod!");\n' },
  { key: 'html',       label: 'HTML',       pistonLang: null,          pistonVer: null, starter: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello, Rillcod!</h1>\n</body>\n</html>\n' },
];

const SYSTEM_TUTOR = (name: string) => `You are a friendly, encouraging STEM tutor at Rillcod Academy helping a Nigerian student.
Student name: ${name || 'Student'}.
RULES:
- Clear, step-by-step explanations.
- Use Nigerian / African real-world examples (NEPA, mobile money, Eko Bridge, Nollywood).
- For coding questions show a short working code snippet with comments.
- Warm, enthusiastic tone — like a brilliant older sibling who loves STEM.
- Responses under 280 words. Use bullet points for clarity.`;

const SYSTEM_CREATOR = `You are an expert curriculum designer for Rillcod Academy (Nigeria).
Always output ONLY valid minified JSON unless told otherwise.
British English. Fun, engaging, kid-friendly tone for KG–SS3 students.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchApiKey(): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'openrouter_api_key')
    .single();
  return data?.value ?? '';
}

async function runCode(lang: string, version: string, code: string): Promise<string> {
  try {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, version, files: [{ content: code }] }),
    });
    const json = await res.json();
    const stdout = json?.run?.stdout ?? '';
    const stderr = json?.run?.stderr ?? '';
    if (stderr && !stdout) return `Error:\n${stderr}`;
    return stdout || stderr || '(no output)';
  } catch {
    return 'Could not connect to code runner.';
  }
}

function buildCreatePrompt(type: string, topic: string, grade: string, subject: string): string {
  const ctx = `Grade: ${grade || 'JSS1'}, Subject: ${subject || 'STEM'}, Topic: ${topic}`;
  switch (type) {
    case 'lesson':
      return `Create a complete lesson for ${ctx}. Return JSON: { title, objectives: string[], hook: string, blocks: [{type,title,content}], activities: [{title,steps:string[]}], quiz: [{question,options:string[],answer:number}] }`;
    case 'lesson-notes':
      return `Write concise study notes for ${ctx}. Plain text, use headers (##), bullet points. Max 400 words.`;
    case 'assignment':
      return `Design an assignment for ${ctx}. Return JSON: { title, description, objectives: string[], tasks: string[], deliverables: string[], dueIn: string }`;
    case 'cbt':
      return `Generate 10 multiple-choice questions for ${ctx}. Return JSON: { title, questions: [{question, options: string[4], answer: number, explanation: string}] }`;
    case 'report-feedback':
      return `Write teacher report feedback for a student studying ${ctx}. Include: strengths, areas for improvement, encouragement. Return JSON: { strengths: string[], improvements: string[], comment: string }`;
    default:
      return `Generate educational content for ${ctx}. Topic: ${topic}.`;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SelectPill({ options, value, onSelect, size = 'sm' }: { options: string[]; value: string; onSelect: (v: string) => void; size?: 'sm' | 'xs' }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
        {options.map(o => {
          const active = value === o;
          return (
            <TouchableOpacity key={o} onPress={() => onSelect(o)}
              style={[styles.pill, active && styles.pillActive]}>
              <Text style={[size === 'xs' ? styles.pillTextXs : styles.pillText, active && styles.pillTextActive]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ChatBubble({ role, text, loading }: { role: 'user' | 'ai'; text?: string; loading?: boolean }) {
  const isUser = role === 'user';
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}
    >
      {!isUser && (
        <Image source={require('../../../assets/rillcod-icon.png')} style={styles.bubbleAvatar} resizeMode="cover" />
      )}
      <View style={[styles.bubbleBody, isUser ? styles.bubbleBodyUser : styles.bubbleBodyAI]}>
        {loading ? (
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <MotiView key={i} from={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ loop: true, delay: i * 200, type: 'timing', duration: 500 }}
                style={styles.typingDot} />
            ))}
          </View>
        ) : (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{text}</Text>
        )}
      </View>
    </MotiView>
  );
}

// ── Tab: Tutor ────────────────────────────────────────────────────────────────

function TutorTab({ apiKey, profile }: { apiKey: string; profile: any }) {
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    Keyboard.dismiss();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const aiMessages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_TUTOR(profile?.full_name) + (topic ? `\nCurrent topic: ${topic}` : '') },
        ...history,
        { role: 'user', content: msg },
      ];

      const reply = await callAI({ messages: aiMessages, maxTokens: 512, temperature: 0.7, apiKey });
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      {/* Topic bar */}
      <View style={styles.topicBar}>
        <Text style={styles.topicLabel}>Topic:</Text>
        <TextInput
          style={styles.topicInput}
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. Python loops, photosynthesis…"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.chatScroll} showsVerticalScrollIndicator={false}>
        {messages.length === 0 && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyChat}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={{ width: 56, height: 56, borderRadius: 14 }} resizeMode="cover" />
            <Text style={styles.emptyChatTitle}>AI Study Tutor</Text>
            <Text style={styles.emptyChatSub}>Ask me anything about your lessons — coding, science, maths, AI, robotics.</Text>
            {[
              'Explain Python for loops with an example',
              'What is artificial intelligence?',
              'Help me understand binary numbers',
            ].map(s => (
              <TouchableOpacity key={s} onPress={() => { setInput(s); }} style={styles.suggChip}>
                <Text style={styles.suggText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </MotiView>
        )}
        {messages.map((m, i) => <ChatBubble key={i} role={m.role} text={m.text} />)}
        {loading && <ChatBubble role="ai" loading />}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your tutor…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
          onSubmitEditing={send}
        />
        <TouchableOpacity onPress={send} disabled={loading || !input.trim()} style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}>
          <LinearGradient colors={COLORS.gradPrimary as any} style={styles.sendBtnGrad}>
            <Text style={{ fontSize: 18 }}>➤</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tab: Create ───────────────────────────────────────────────────────────────

function CreateTab({ apiKey }: { apiKey: string }) {
  const [type, setType] = useState('lesson');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('JSS 1');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) { Alert.alert('Enter a topic', 'Please type a topic before generating.'); return; }
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setImageUrl(null);

    try {
      const prompt = buildCreatePrompt(type, topic.trim(), grade, subject.trim());
      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_CREATOR },
        { role: 'user', content: prompt },
      ];
      const raw = await callAI({ messages, maxTokens: 2048, temperature: 0.8, apiKey });
      setResult(raw);

      // Auto-generate illustration for lesson types
      if (type === 'lesson' || type === 'lesson-notes') {
        setImageUrl(pollinationsImageUrl(`${subject || 'STEM'} - ${topic}`));
      }
    } catch (err: any) {
      Alert.alert('Generation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedType = CREATE_TYPES.find(t => t.key === type)!;

  const renderResult = () => {
    if (!result) return null;
    // Try to parse JSON — show formatted; otherwise raw text
    let parsed: any = null;
    try {
      // Strip ```json fences if present
      const clean = result.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    } catch { /* plain text */ }

    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.resultCard}>
        {/* Illustration */}
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} resizeMode="cover" />
        )}

        {parsed ? (
          <View style={{ gap: SPACING.sm }}>
            {parsed.title && <Text style={styles.resultTitle}>{parsed.title}</Text>}
            {parsed.objectives && (
              <View>
                <Text style={styles.resultSection}>🎯 Objectives</Text>
                {(parsed.objectives as string[]).map((o, i) => <Text key={i} style={styles.resultItem}>• {o}</Text>)}
              </View>
            )}
            {parsed.hook && (
              <View>
                <Text style={styles.resultSection}>⚡ Hook</Text>
                <Text style={styles.resultBody}>{parsed.hook}</Text>
              </View>
            )}
            {parsed.description && (
              <View>
                <Text style={styles.resultSection}>📋 Description</Text>
                <Text style={styles.resultBody}>{parsed.description}</Text>
              </View>
            )}
            {parsed.tasks && (
              <View>
                <Text style={styles.resultSection}>✅ Tasks</Text>
                {(parsed.tasks as string[]).map((t, i) => <Text key={i} style={styles.resultItem}>• {t}</Text>)}
              </View>
            )}
            {parsed.questions && (
              <View>
                <Text style={styles.resultSection}>❓ Questions ({parsed.questions.length})</Text>
                {(parsed.questions as any[]).slice(0, 3).map((q, i) => (
                  <View key={i} style={styles.questionCard}>
                    <Text style={styles.questionText}>{i + 1}. {q.question}</Text>
                    {q.options?.map((opt: string, oi: number) => (
                      <Text key={oi} style={[styles.questionOpt, oi === q.answer && styles.questionOptCorrect]}>
                        {oi === q.answer ? '✓ ' : '   '}{opt}
                      </Text>
                    ))}
                  </View>
                ))}
                {parsed.questions.length > 3 && <Text style={styles.resultMuted}>+{parsed.questions.length - 3} more questions</Text>}
              </View>
            )}
            {parsed.strengths && (
              <View>
                <Text style={styles.resultSection}>💪 Strengths</Text>
                {(parsed.strengths as string[]).map((s, i) => <Text key={i} style={styles.resultItem}>✓ {s}</Text>)}
                <Text style={styles.resultSection}>📈 Areas to Improve</Text>
                {(parsed.improvements as string[]).map((s, i) => <Text key={i} style={styles.resultItem}>→ {s}</Text>)}
                <Text style={styles.resultSection}>💬 Comment</Text>
                <Text style={styles.resultBody}>{parsed.comment}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.resultBody}>{result}</Text>
        )}
      </MotiView>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.createScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Type selector */}
      <Text style={styles.sectionLabel}>Content Type</Text>
      <View style={{ gap: 8, marginBottom: SPACING.md }}>
        {CREATE_TYPES.map(ct => (
          <TouchableOpacity key={ct.key} onPress={() => setType(ct.key)} activeOpacity={0.8}>
            <MotiView
              animate={{ backgroundColor: type === ct.key ? COLORS.primary + '22' : COLORS.bgCard, borderColor: type === ct.key ? COLORS.primary : COLORS.border }}
              transition={{ type: 'timing', duration: 150 }}
              style={styles.typeRow}
            >
              <Text style={{ fontSize: 22 }}>{ct.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeRowLabel, type === ct.key && { color: COLORS.primaryLight }]}>{ct.label}</Text>
                <Text style={styles.typeRowDesc}>{ct.desc}</Text>
              </View>
              {type === ct.key && <Text style={{ color: COLORS.primary, fontSize: 16 }}>✓</Text>}
            </MotiView>
          </TouchableOpacity>
        ))}
      </View>

      {/* Inputs */}
      <Text style={styles.sectionLabel}>Grade Level</Text>
      <SelectPill options={GRADE_LEVELS} value={grade} onSelect={setGrade} size="xs" />

      <Text style={styles.sectionLabel}>Subject (optional)</Text>
      <TextInput
        style={styles.fieldInput}
        value={subject}
        onChangeText={setSubject}
        placeholder="e.g. Python, Mathematics, Robotics"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.sectionLabel}>Topic *</Text>
      <TextInput
        style={[styles.fieldInput, { height: 70, textAlignVertical: 'top' }]}
        value={topic}
        onChangeText={setTopic}
        placeholder={`e.g. ${selectedType.key === 'cbt' ? 'Variables and Data Types' : 'Introduction to Python Loops'}`}
        placeholderTextColor={COLORS.textMuted}
        multiline
      />

      <TouchableOpacity onPress={generate} disabled={loading} style={[styles.genBtn, loading && { opacity: 0.6 }]}>
        <LinearGradient colors={COLORS.gradPrimary as any} style={styles.genBtnGrad}>
          {loading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.genBtnText}> Generating…</Text></>
            : <Text style={styles.genBtnText}>{selectedType.emoji} Generate {selectedType.label}</Text>
          }
        </LinearGradient>
      </TouchableOpacity>

      {renderResult()}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Tab: Code Lab ─────────────────────────────────────────────────────────────

function CodeTab({ apiKey }: { apiKey: string }) {
  const [lang, setLang] = useState(CODE_LANGS[0]);
  const [code, setCode] = useState(CODE_LANGS[0].starter);
  const [aiPrompt, setAiPrompt] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectLang = (key: string) => {
    const l = CODE_LANGS.find(l => l.key === key)!;
    setLang(l);
    setCode(l.starter);
    setOutput(null);
  };

  const handleRun = async () => {
    if (!lang.pistonLang) { setOutput('⚠️ Live execution not available for HTML. Preview in a browser.'); return; }
    setRunning(true);
    setOutput(null);
    const result = await runCode(lang.pistonLang, lang.pistonVer!, code);
    setOutput(result);
    setRunning(false);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) { Alert.alert('Enter a task', 'Describe what you want the code to do.'); return; }
    setGenerating(true);
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a coding instructor at Rillcod Academy. Generate clean, well-commented ${lang.label} code for Nigerian students.
Output ONLY the code — no explanation, no markdown fences. Start directly with the code.`,
        },
        { role: 'user', content: `Write ${lang.label} code that: ${aiPrompt.trim()}` },
      ];
      const result = await callAI({ messages, maxTokens: 512, temperature: 0.5, apiKey });
      // Strip any accidental markdown fences
      setCode(result.replace(/^```[\w]*\n?/i, '').replace(/\n?```$/i, '').trim());
      setOutput(null);
    } catch (err: any) {
      Alert.alert('AI Error', err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.codeScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Language selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
        {CODE_LANGS.map(l => (
          <TouchableOpacity key={l.key} onPress={() => selectLang(l.key)}
            style={[styles.langBtn, lang.key === l.key && styles.langBtnActive]}>
            <Text style={[styles.langBtnText, lang.key === l.key && { color: COLORS.primaryLight }]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI generate row */}
      <View style={styles.aiPromptRow}>
        <TextInput
          style={styles.aiPromptInput}
          value={aiPrompt}
          onChangeText={setAiPrompt}
          placeholder="Describe what to code (AI will write it)…"
          placeholderTextColor={COLORS.textMuted}
        />
        <TouchableOpacity onPress={handleAIGenerate} disabled={generating} style={[styles.aiGenBtn, generating && { opacity: 0.5 }]}>
          <LinearGradient colors={['#7c3aed', '#5b21b6']} style={styles.aiGenBtnGrad}>
            <Text style={{ color: '#fff', fontSize: 13, fontFamily: FONT_FAMILY.bodySemi }}>
              {generating ? '…' : '✨ AI'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Code editor */}
      <View style={styles.editorWrap}>
        <View style={styles.editorHeader}>
          <View style={styles.editorDots}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => <View key={c} style={[styles.editorDot, { backgroundColor: c }]} />)}
          </View>
          <Text style={styles.editorLang}>{lang.label}</Text>
          <TouchableOpacity onPress={() => setCode(lang.starter)} style={styles.editorResetBtn}>
            <Text style={styles.editorResetText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="ascii-capable"
        />
      </View>

      {/* Run button */}
      <TouchableOpacity onPress={handleRun} disabled={running} style={[styles.runBtn, running && { opacity: 0.6 }]}>
        <LinearGradient colors={[COLORS.success, '#059669']} style={styles.runBtnGrad}>
          {running
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.runBtnText}> Running…</Text></>
            : <Text style={styles.runBtnText}>▶ Run Code</Text>
          }
        </LinearGradient>
      </TouchableOpacity>

      {/* Output */}
      {output !== null && (
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} style={styles.outputWrap}>
          <Text style={styles.outputHeader}>Output</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.outputText}>{output}</Text>
          </ScrollView>
        </MotiView>
      )}

      {/* AI code tips */}
      <View style={styles.tipsBox}>
        <Text style={styles.tipsTitle}>💡 Try these prompts</Text>
        {[
          'Print numbers 1–10 using a loop',
          'Check if a number is even or odd',
          'Make a simple calculator',
        ].map(tip => (
          <TouchableOpacity key={tip} onPress={() => setAiPrompt(tip)} style={styles.tipRow}>
            <Text style={styles.tipText}>→ {tip}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AIScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [apiKey, setApiKey] = useState('');
  const [keyLoading, setKeyLoading] = useState(true);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    fetchApiKey()
      .then(k => setApiKey(k))
      .finally(() => setKeyLoading(false));
  }, []);

  const visibleTabs = isStaff ? TABS : TABS.filter(t => t !== '✨ Create');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={styles.headerLogo} resizeMode="cover" />
            <Text style={styles.headerTitle}>AI Hub</Text>
          </View>
          <Text style={styles.headerSub}>Powered by Rillcod Intelligence</Text>
        </View>
        {keyLoading && <ActivityIndicator color={COLORS.primaryLight} size="small" />}
      </View>

      {/* No key warning */}
      {!keyLoading && !apiKey && (
        <View style={styles.noKeyBanner}>
          <Text style={styles.noKeyText}>⚠️ AI API key not configured — contact your admin.</Text>
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {visibleTabs.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === '🧠 Tutor' && <TutorTab apiKey={apiKey} profile={profile} />}
        {tab === '✨ Create' && isStaff && <CreateTab apiKey={apiKey} />}
        {tab === '💻 Code' && <CodeTab apiKey={apiKey} />}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: COLORS.textPrimary },
  headerLogo: { width: 28, height: 28, borderRadius: 8 },
  headerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  headerSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  noKeyBanner: { marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.warning + '22', borderWidth: 1, borderColor: COLORS.warning + '44', borderRadius: RADIUS.md, padding: SPACING.sm },
  noKeyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning },

  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 3, gap: 2 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.md },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  tabBtnTextActive: { color: '#fff' },

  // Tutor
  topicBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: Platform.OS === 'ios' ? 8 : 4 },
  topicLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  topicInput: { flex: 1, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary },

  chatScroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  emptyChat: { alignItems: 'center', gap: 10, paddingVertical: SPACING.xl },
  emptyChatTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  emptyChatSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  suggChip: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  suggText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  bubble: { flexDirection: 'row', marginBottom: SPACING.sm, alignItems: 'flex-end', gap: 8 },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleAI: { justifyContent: 'flex-start' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 8, flexShrink: 0 },
  bubbleBody: { maxWidth: '80%', borderRadius: RADIUS.lg, padding: SPACING.sm + 2 },
  bubbleBodyUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleBodyAI: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  chatInput: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, maxHeight: 100 },
  sendBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  sendBtnGrad: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Create
  createScroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  sectionLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, marginTop: SPACING.sm },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  pillActive: { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary },
  pillText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  pillTextXs: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.primaryLight },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  typeRowLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  typeRowDesc: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  fieldInput: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  genBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md },
  genBtnGrad: { flexDirection: 'row', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  genBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },

  resultCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg, marginTop: SPACING.lg, gap: SPACING.sm },
  resultImage: { width: '100%', height: 160, borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
  resultTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary },
  resultSection: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SPACING.sm, marginBottom: 4 },
  resultItem: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  resultBody: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 20 },
  resultMuted: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  questionCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: 6 },
  questionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textPrimary, marginBottom: 4 },
  questionOpt: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 18 },
  questionOptCorrect: { color: COLORS.success },

  // Code
  codeScroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  langBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  langBtnActive: { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary },
  langBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  aiPromptRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  aiPromptInput: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  aiGenBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  aiGenBtnGrad: { paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8, alignItems: 'center', justifyContent: 'center' },

  editorWrap: { backgroundColor: '#0d1117', borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.sm },
  editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: '#161b22', gap: SPACING.sm },
  editorDots: { flexDirection: 'row', gap: 5 },
  editorDot: { width: 10, height: 10, borderRadius: 5 },
  editorLang: { flex: 1, fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#8b949e' },
  editorResetBtn: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#21262d', borderRadius: 4 },
  editorResetText: { fontFamily: FONT_FAMILY.body, fontSize: 11, color: '#8b949e' },
  codeInput: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: '#e6edf3', padding: SPACING.md, minHeight: 200, textAlignVertical: 'top', letterSpacing: 0 },

  runBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  runBtnGrad: { flexDirection: 'row', paddingVertical: 13, alignItems: 'center', justifyContent: 'center', gap: 6 },
  runBtnText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: '#fff' },

  outputWrap: { backgroundColor: '#0d1117', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  outputHeader: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: '#8b949e', marginBottom: 6 },
  outputText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: '#28c840' },

  tipsBox: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 8 },
  tipsTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  tipRow: { paddingVertical: 4 },
  tipText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

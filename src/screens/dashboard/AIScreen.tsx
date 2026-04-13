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
import { callAI, type ChatMessage } from '../../lib/openrouter';
import { analyticsService } from '../../services/analytics.service';
import { assignmentService } from '../../services/assignment.service';
import { cbtService } from '../../services/cbt.service';
import { courseService } from '../../services/course.service';
import { gamificationService } from '../../services/gamification.service';
import { appSettingsService } from '../../services/app-settings.service';
import { expertAiService } from '../../services/expertAi.service';
import { LESSON_AI_PRESET_SUBJECTS, lessonCoverImageUrl } from '../../lib/lessonAiPort';
import {
  buildQuickLessonAiRequest,
  runLessonAiFullGeneration,
  runLessonAiNotesGeneration,
  trackLessonAiEvent,
} from '../../lib/lessonAiIntegration';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { IconBackButton } from '../../components/ui/IconBackButton';
import { ROUTES } from '../../navigation/routes';
import type { Database, Json } from '../../types/supabase';

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
  { key: 'newsletter',      emoji: '🗞️', label: 'Newsletter',      desc: 'visionary school newsletters' },
  { key: 'daily-missions',  emoji: '🚀', label: 'Daily Missions',  desc: 'Progressive missions and micro tasks' },
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

type AIProfile = {
  id?: string;
  full_name?: string | null;
  role?: string;
  school_id?: string | null;
  school_name?: string | null;
};

type TutorContext = {
  activeCourse: string | null;
  activeProgram: string | null;
  recentLessonTitles: string[];
  recentAssignmentTitles: string[];
  totalPoints: number;
  streak: number;
};

type CodeCategory = 'coding' | 'web' | 'ai' | 'design' | 'hardware' | 'research';

type BuilderMessage = {
  role: 'user' | 'ai';
  text: string;
};

const CODE_CATEGORIES: { key: CodeCategory; label: string }[] = [
  { key: 'coding', label: 'Coding' },
  { key: 'web', label: 'Web' },
  { key: 'ai', label: 'AI' },
  { key: 'design', label: 'Design' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'research', label: 'Research' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function logAIEvent(profile: AIProfile | null | undefined, eventType: string, metadata: Json) {
  if (!profile?.id) return;
  await analyticsService.trackEvent(
    profile.id,
    eventType,
    metadata as Record<string, unknown>,
    { schoolId: profile.school_id, userAgent: Platform.OS },
  );
}

function extractCodeBlock(content: string): string | null {
  const match = content.match(/```[\w+-]*\n([\s\S]*?)```/);
  if (match?.[1]?.trim()) return match[1].trim();
  const stripped = content.replace(/^```[\w+-]*\n?/i, '').replace(/\n?```$/i, '').trim();
  return stripped || null;
}

async function fetchTutorContext(profile: AIProfile | null | undefined): Promise<TutorContext> {
  if (!profile?.id) {
    return {
      activeCourse: null,
      activeProgram: null,
      recentLessonTitles: [],
      recentAssignmentTitles: [],
      totalPoints: 0,
      streak: 0,
    };
  }

  const [contentCtx, pointsData] = await Promise.all([
    courseService.getAiTutorContentContext({
      id: profile.id,
      role: profile.role,
      school_id: profile.school_id,
    }),
    gamificationService.getUserStats(profile.id),
  ]);

  return {
    activeCourse: contentCtx.activeCourse,
    activeProgram: contentCtx.activeProgram,
    recentLessonTitles: contentCtx.recentLessonTitles,
    recentAssignmentTitles: contentCtx.recentAssignmentTitles,
    totalPoints: pointsData?.total_points ?? 0,
    streak: pointsData?.current_streak ?? 0,
  };
}

function buildCreatePrompt(type: string, topic: string, grade: string, subject: string): string {
  // Deprecated: Moving to expertAiService
  return "";
}

function parseGenerated(result: string): any | null {
  try {
    const clean = result.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function stringifyBlockContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return '';
}

function buildLessonLayout(parsed: any): Json {
  const blocks = asArray(parsed?.blocks).map((block: any, index: number) => ({
    id: `ai-block-${index + 1}`,
    type: typeof block?.type === 'string' ? block.type : 'content',
    title: typeof block?.title === 'string' ? block.title : `Block ${index + 1}`,
    content: stringifyBlockContent(block?.content),
  }));

  const activities = asArray(parsed?.activities).map((activity: any, index: number) => ({
    id: `ai-activity-${index + 1}`,
    type: 'activity',
    title: typeof activity?.title === 'string' ? activity.title : `Activity ${index + 1}`,
    content: stringifyBlockContent(activity?.steps),
  }));

  const quiz = asArray(parsed?.quiz).map((item: any, index: number) => ({
    id: `ai-quiz-${index + 1}`,
    type: 'quiz',
    title: `Checkpoint ${index + 1}`,
    content: JSON.stringify({
      question: item?.question ?? '',
      options: asArray(item?.options),
      answer: typeof item?.answer === 'number' ? item.answer : 0,
    }),
  }));

  return [...blocks, ...activities, ...quiz] as unknown as Json;
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

function TutorTab({ profile }: { profile: any }) {
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [context, setContext] = useState<TutorContext>({
    activeCourse: null,
    activeProgram: null,
    recentLessonTitles: [],
    recentAssignmentTitles: [],
    totalPoints: 0,
    streak: 0,
  });
  const scrollRef = useRef<ScrollView>(null);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const next = await fetchTutorContext(profile);
      setContext(next);
    } finally {
      setContextLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

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
        {
          role: 'system',
          content:
            SYSTEM_TUTOR(profile?.full_name) +
            (topic ? `\nCurrent topic: ${topic}` : '') +
            (context.activeCourse ? `\nActive course: ${context.activeCourse}` : '') +
            (context.activeProgram ? `\nProgramme: ${context.activeProgram}` : '') +
            (context.recentLessonTitles.length ? `\nRecent lessons: ${context.recentLessonTitles.slice(0, 3).join(', ')}` : '') +
            (context.recentAssignmentTitles.length ? `\nRecent assignments: ${context.recentAssignmentTitles.slice(0, 3).join(', ')}` : ''),
        },
        ...history,
        { role: 'user', content: msg },
      ];

      const reply = await callAI({ messages: aiMessages, maxTokens: 512, temperature: 0.7 });
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
      await logAIEvent(profile, 'ai_tutor_message', {
        topic: topic || null,
        prompt: msg,
        activeCourse: context.activeCourse,
        activeProgram: context.activeProgram,
      } as Json);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const suggestionPool = [
    context.activeCourse ? `Break down ${context.activeCourse} for me in simple steps` : null,
    context.recentLessonTitles[0] ? `Help me revise ${context.recentLessonTitles[0]}` : null,
    context.recentAssignmentTitles[0] ? `How should I approach ${context.recentAssignmentTitles[0]}?` : null,
    profile?.role === 'teacher' ? 'Turn this topic into a clear class explanation' : 'Explain Python for loops with an example',
    profile?.role === 'student' ? 'Give me 3 quick practice questions from my current lessons' : 'What is artificial intelligence?',
    'Help me understand binary numbers',
  ].filter(Boolean) as string[];

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
        <View style={styles.contextStrip}>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>Role</Text>
            <Text style={styles.contextValue}>{profile?.role || 'user'}</Text>
          </View>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>Course</Text>
            <Text style={styles.contextValue}>{contextLoading ? 'Loading...' : context.activeCourse || 'Not linked yet'}</Text>
          </View>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>Streak</Text>
            <Text style={styles.contextValue}>{contextLoading ? '...' : `${context.streak} day${context.streak === 1 ? '' : 's'}`}</Text>
          </View>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>XP</Text>
            <Text style={styles.contextValue}>{contextLoading ? '...' : String(context.totalPoints)}</Text>
          </View>
        </View>
        {messages.length === 0 && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyChat}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={{ width: 56, height: 56, borderRadius: 14 }} resizeMode="cover" />
            <Text style={styles.emptyChatTitle}>AI Study Tutor</Text>
            <Text style={styles.emptyChatSub}>Ask me anything about your lessons — coding, science, maths, AI, robotics.</Text>
            {suggestionPool.slice(0, 5).map(s => (
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

function CreateTab({ profile, navigation }: { profile: AIProfile | null; navigation: any }) {
  const [type, setType] = useState('lesson');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('JSS 1');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const parsedResult = result ? parseGenerated(result) : null;

  const generate = async () => {
    if (!topic.trim()) { Alert.alert('Enter a topic', 'Please type a topic before generating.'); return; }
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setImageUrl(null);
    setLastSavedId(null);

    try {
      if (type === 'lesson') {
        const req = buildQuickLessonAiRequest({
          topic: topic.trim(),
          gradeLevel: grade,
          subject: subject.trim() || undefined,
          durationMinutes: 60,
          lessonMode: 'academic',
        });
        const { payload: data } = await runLessonAiFullGeneration(req);
        setResult(JSON.stringify(data));
        void trackLessonAiEvent(profile?.id ?? null, profile?.school_id ?? null, 'full', {
          source: 'ai_screen_create',
        });
      } else if (type === 'lesson-notes') {
        const req = buildQuickLessonAiRequest({
          topic: topic.trim(),
          gradeLevel: grade,
          subject: subject.trim() || undefined,
          durationMinutes: 60,
        });
        setResult(JSON.stringify(data));
        void trackLessonAiEvent(profile?.id ?? null, profile?.school_id ?? null, 'notes', {
          source: 'ai_screen_create',
        });
      } else {
        const data = await expertAiService.generate({
          type: type as any,
          topic: topic.trim(),
          gradeLevel: grade,
          subject: subject.trim() || undefined,
          programName: profile?.school_name ?? undefined,
        });
        setResult(JSON.stringify(data));
      }

      if (type === 'lesson' || type === 'lesson-notes') {
        setImageUrl(lessonCoverImageUrl(topic, subject || undefined));
      }
    } catch (err: any) {
      Alert.alert('Generation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveGenerated = async () => {
    if (!parsedResult) {
      Alert.alert('Nothing to save', 'Generate valid structured content first.');
      return;
    }
    if (!profile?.id) {
      Alert.alert('Profile missing', 'Sign in again to continue.');
      return;
    }

    setSaving(true);
    try {
      if (type === 'lesson' || type === 'lesson-notes') {
        const webLayout = type === 'lesson' && Array.isArray(parsedResult.content_layout) ? parsedResult.content_layout : null;
        const lessonInsert: Database['public']['Tables']['lessons']['Insert'] = {
          title: parsedResult.title || topic.trim(),
          description:
            parsedResult.description ||
            parsedResult.hook ||
            (type === 'lesson-notes' ? `Study notes: ${topic.trim()}` : `AI lesson for ${topic.trim()}`),
          content: type === 'lesson' ? JSON.stringify(parsedResult) : String(parsedResult.lesson_notes ?? result ?? ''),
          content_layout:
            type === 'lesson' ? (webLayout ? (webLayout as unknown as Json) : buildLessonLayout(parsedResult)) : null,
          lesson_notes:
            type === 'lesson-notes'
              ? String(parsedResult.lesson_notes ?? '')
              : parsedResult.lesson_notes
                ? String(parsedResult.lesson_notes)
                : null,
          lesson_type:
            type === 'lesson-notes'
              ? 'reading'
              : typeof parsedResult.lesson_type === 'string'
                ? parsedResult.lesson_type
                : 'hands-on',
          status: 'draft',
          duration_minutes:
            typeof parsedResult.duration_minutes === 'number' ? parsedResult.duration_minutes : 60,
          created_by: profile.id,
          school_id: profile.school_id ?? null,
          school_name: profile.school_name ?? null,
        };

        const lessonId = await courseService.insertLessonReturningId(lessonInsert);
        setLastSavedId(lessonId);

        if (type === 'lesson' && Array.isArray(parsedResult.objectives)) {
          const objs = parsedResult.objectives.filter((x: unknown) => typeof x === 'string') as string[];
          const layoutArr = (webLayout ?? []) as any[];
          const activityText = layoutArr
            .filter((b) => b?.type === 'activity')
            .map((b) => [b.title, b.instructions].filter(Boolean).join('\n'))
            .join('\n\n');
          const assessmentText = layoutArr
            .filter((b) => b?.type === 'quiz' || b?.type === 'assignment-block')
            .map((b) => (b.type === 'quiz' ? `Quiz: ${b.question}` : `${b.title || 'Assignment'}: ${b.instructions || ''}`))
            .join('\n\n');
          if (objs.length || activityText || assessmentText) {
            await courseService.upsertLessonPlan({
              lesson_id: lessonId,
              objectives: objs.length ? objs.join('\n') : null,
              activities: activityText || null,
              assessment_methods: assessmentText || null,
            });
          }
        }

        Alert.alert('Saved', 'Lesson draft created successfully.', [
          { text: 'Stay here' },
          { text: 'Open lesson', onPress: () => navigation.navigate(ROUTES.LessonDetail, { lessonId: lessonId }) },
        ]);
      } else if (type === 'assignment') {
        const assignmentInsert: Database['public']['Tables']['assignments']['Insert'] = {
          title: parsedResult.title || topic.trim(),
          description: parsedResult.description || `AI-generated assignment for ${topic.trim()}`,
          instructions: [
            asArray(parsedResult.objectives).length ? `Objectives:\n- ${asArray(parsedResult.objectives).join('\n- ')}` : '',
            asArray(parsedResult.tasks).length ? `Tasks:\n- ${asArray(parsedResult.tasks).join('\n- ')}` : '',
            asArray(parsedResult.deliverables).length ? `Deliverables:\n- ${asArray(parsedResult.deliverables).join('\n- ')}` : '',
          ].filter(Boolean).join('\n\n'),
          assignment_type: 'project',
          is_active: false,
          max_points: 100,
          metadata: parsedResult as Json,
          created_by: profile.id,
          school_id: profile.school_id ?? null,
          school_name: profile.school_name ?? null,
        };

        const savedAsgn = await assignmentService.createAssignmentReturningSummary(assignmentInsert);
        setLastSavedId(savedAsgn.id);
        Alert.alert('Saved', 'Assignment draft created successfully.', [
          { text: 'Close' },
          { text: 'Open assignment', onPress: () => navigation.navigate(ROUTES.AssignmentDetail, { assignmentId: savedAsgn.id, title: savedAsgn.title }) },
        ]);
      } else if (type === 'cbt') {
        const questions = asArray(parsedResult.questions);
        const examInsert: Database['public']['Tables']['cbt_exams']['Insert'] = {
          title: parsedResult.title || topic.trim(),
          description: `AI-generated CBT for ${topic.trim()}`,
          duration_minutes: 30,
          passing_score: 50,
          total_questions: questions.length || 10,
          is_active: false,
          created_by: profile.id,
          school_id: profile.school_id ?? null,
          metadata: parsedResult as Json,
        };

        const examId = await cbtService.createExamReturningId(examInsert);

        if (questions.length) {
          const questionRows: Database['public']['Tables']['cbt_questions']['Insert'][] = questions.map((question: any, index: number) => ({
            exam_id: examId,
            question_text: question?.question || `Question ${index + 1}`,
            options: asArray(question?.options) as unknown as Json,
            correct_answer: question?.answer !== undefined ? String(question.answer) : null,
            question_type: 'multiple_choice',
            points: 1,
            order_index: index + 1,
            metadata: { explanation: question?.explanation ?? '' } as unknown as Json,
          }));
          await cbtService.insertCbtQuestions(questionRows);
        }

        setLastSavedId(examId);
        Alert.alert('Saved', 'CBT draft created successfully.', [
          { text: 'Close' },
          { text: 'Open CBT', onPress: () => navigation.navigate(ROUTES.CBTExamination, { examId: examId }) },
        ]);
      } else {
        Alert.alert('Generated', 'This content type is ready to copy into your workflow, but it does not map directly to a saved table yet.');
      }
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not save AI content.');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = CREATE_TYPES.find(t => t.key === type)!;

  const renderResult = () => {
    if (!result) return null;
    const parsed = parsedResult;

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
            {parsed.missions && (
              <View>
                <Text style={styles.resultSection}>🚀 Missions</Text>
                {asArray(parsed.missions).slice(0, 4).map((mission: any, index: number) => (
                  <Text key={index} style={styles.resultItem}>• {mission?.title || `Mission ${index + 1}`} {mission?.xp ? `(${mission.xp} XP)` : ''}</Text>
                ))}
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

        <View style={styles.resultActions}>
          {(type === 'lesson' || type === 'lesson-notes' || type === 'assignment' || type === 'cbt') && !!parsed && (
            <TouchableOpacity onPress={saveGenerated} disabled={saving} style={[styles.secondaryAction, saving && { opacity: 0.6 }]}>
              <Text style={styles.secondaryActionText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
            </TouchableOpacity>
          )}
          {lastSavedId && <Text style={styles.savedHint}>Saved to database</Text>}
        </View>
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
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginBottom: SPACING.sm }}
      >
        {LESSON_AI_PRESET_SUBJECTS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSubject(s)}
            style={[
              styles.subjectChip,
              subject === s && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '18' },
            ]}
          >
            <Text style={[styles.subjectChipText, subject === s && { color: COLORS.primaryLight }]} numberOfLines={1}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.quickPromptLabel}>Quick prompts</Text>
      <SelectPill
        options={['Intro to Python', 'Robotics Sensors', 'Algebra Basics', 'HTML Forms', 'Renewable Energy']}
        value={topic}
        onSelect={setTopic}
        size="xs"
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

function CodeTab({ profile }: { profile: AIProfile | null }) {
  const [lang, setLang] = useState(CODE_LANGS[0]);
  const [code, setCode] = useState(CODE_LANGS[0].starter);
  const [aiPrompt, setAiPrompt] = useState('');
  const [category, setCategory] = useState<CodeCategory>('coding');
  const [builderMessages, setBuilderMessages] = useState<BuilderMessage[]>([]);
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
      const history = builderMessages.slice(-8).map(message => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.text,
      })) as ChatMessage[];

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a coding instructor at Rillcod Academy. Generate clean, well-commented ${lang.label} code for Nigerian students.
Output ONLY the code — no explanation, no markdown fences. Start directly with the code.`,
        },
        ...history,
        { role: 'user', content: `Write ${lang.label} code that: ${aiPrompt.trim()}` },
      ];
      const result = await callAI({ messages, maxTokens: 1400, temperature: 0.5 });
      const extractedCode = extractCodeBlock(result);
      if (extractedCode) setCode(extractedCode);
      setBuilderMessages(prev => [...prev, { role: 'user', text: aiPrompt.trim() }, { role: 'ai', text: result }]);
      setOutput(null);
      await logAIEvent(profile, 'ai_code_builder', {
        language: lang.key,
        category,
        prompt: aiPrompt.trim(),
      } as Json);
    } catch (err: any) {
      Alert.alert('AI Error', err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.codeScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionLabel}>Builder Mode</Text>
      <SelectPill
        options={CODE_CATEGORIES.map(item => item.label)}
        value={CODE_CATEGORIES.find(item => item.key === category)?.label || 'Coding'}
        onSelect={(label) => {
          const next = CODE_CATEGORIES.find(item => item.label === label);
          if (next) setCategory(next.key);
        }}
        size="xs"
      />

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

      {builderMessages.length > 0 && (
        <View style={styles.builderThread}>
          {builderMessages.slice(-4).map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} role={message.role === 'user' ? 'user' : 'ai'} text={message.text} />
          ))}
        </View>
      )}

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
  const [openRouterReady, setOpenRouterReady] = useState<boolean | null>(null);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';

  const visibleTabs = isStaff ? TABS : [TABS[0], TABS[2]];

  useEffect(() => {
    let cancelled = false;
    appSettingsService.isOpenRouterConfigured().then((ok) => {
      if (!cancelled) setOpenRouterReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <IconBackButton onPress={() => navigation.goBack()} color={COLORS.textPrimary} size={20} style={styles.backBtn} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../../assets/rillcod-icon.png')} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.headerTitle}>AI Studio</Text>
          </View>
          <Text style={styles.headerSub}>Web-grade AI workflows, tuned for mobile</Text>
        </View>
      </View>

      <View style={styles.engineBanner}>
        <Text style={styles.engineBannerText}>
          AI runs through a secure server proxy; your OpenRouter key is not stored on the device.
        </Text>
      </View>

      {openRouterReady === false ? (
        <View style={styles.noKeyBanner}>
          <Text style={styles.noKeyText}>
            Cloud AI is not configured for this project yet (missing server OpenRouter key in app settings). Tutor and Create may fail until an
            admin sets `openrouter_api_key` in the dashboard or deployment secrets.
          </Text>
        </View>
      ) : null}

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
        {tab === TABS[0] && <TutorTab profile={profile} />}
        {tab === TABS[1] && isStaff && <CreateTab profile={profile} navigation={navigation} />}
        {tab === TABS[2] && <CodeTab profile={profile} />}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  headerTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE['2xl'], color: COLORS.textPrimary },
  headerSub: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  refreshBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  refreshBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  noKeyBanner: { marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.warning + '22', borderWidth: 1, borderColor: COLORS.warning + '44', borderRadius: RADIUS.md, padding: SPACING.sm },
  noKeyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.warning },
  engineBanner: { marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: COLORS.primary + '14', borderWidth: 1, borderColor: COLORS.primary + '2d', borderRadius: RADIUS.md, padding: SPACING.sm },
  engineBannerText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },

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
  contextStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  contextCard: { minWidth: 110, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  contextLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  contextValue: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },

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
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    maxWidth: 200,
  },
  subjectChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  quickPromptLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4 },
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
  resultActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, marginTop: SPACING.sm },
  secondaryAction: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '18', borderWidth: 1, borderColor: COLORS.primary + '40' },
  secondaryActionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.primaryLight },
  savedHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.success },

  // Code
  codeScroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  langBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  langBtnActive: { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary },
  langBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },

  aiPromptRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  aiPromptInput: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  aiGenBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  aiGenBtnGrad: { paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8, alignItems: 'center', justifyContent: 'center' },
  builderThread: { marginBottom: SPACING.md },

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

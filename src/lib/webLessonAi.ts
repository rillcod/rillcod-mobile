/**
 * Mobile parity with web `/api/ai/generate` lesson + lesson-notes flows:
 * same system prompt (`WEB_LESSON_AI_SYSTEM`) and equivalent user prompts / model behaviour.
 */
import { callAI } from './openrouter';
import { WEB_LESSON_AI_SYSTEM } from './webLessonAiSystem';

export type WebLessonMode = 'academic' | 'project' | 'interactive';

export interface WebLessonGenRequest {
  topic: string;
  gradeLevel: string;
  subject?: string;
  durationMinutes: number;
  /** Hint from the lesson form (hands-on, video, …). */
  contentType?: string;
  /** Defaults to academic when omitted (e.g. AIScreen quick create). */
  lessonMode?: WebLessonMode;
  courseName?: string;
  programName?: string;
  siblingLessons?: string[];
}

/** Mirrors web lesson JSON shape used by LessonEditor + AIScreen. */
export interface WebFullLessonPayload {
  title?: string;
  description?: string;
  lesson_notes?: string;
  objectives?: string[];
  duration_minutes?: number;
  lesson_type?: string;
  video_url?: string | null;
  content_layout?: unknown[];
  hook?: string;
}

const WEB_AI_LESSON_MODELS = [
  'google/gemini-2.0-flash-001',
  'x-ai/grok-2-1212',
  'moonshotai/kimi-k2.5',
  'deepseek/deepseek-chat-v3-5',
  'deepseek/deepseek-chat',
];

const WEB_AI_LESSON_NOTES_MODELS = [
  'google/gemini-2.0-flash-001',
  'deepseek/deepseek-chat',
  'meta-llama/llama-3.3-70b-instruct',
];

function isYoungLearnerGrade(gradeLevel: string): boolean {
  const g = gradeLevel.toLowerCase();
  if (g.includes('kg') || g.includes('nursery') || g.includes('early')) return true;
  return /\bbasic\s*[1-6]\b/.test(g) || g.includes('primary');
}

function curriculumContext(req: WebLessonGenRequest): string {
  const bits: string[] = [];
  if (req.programName?.trim()) bits.push(`Programme: ${req.programName.trim()}`);
  if (req.courseName?.trim()) bits.push(`Course: ${req.courseName.trim()}`);
  if (req.subject?.trim()) bits.push(`Subject focus: ${req.subject.trim()}`);
  if (req.contentType?.trim()) bits.push(`Preferred lesson format on our platform: ${req.contentType.trim()}`);
  if (!bits.length) return '';
  return `\n\nCurriculum context:\n${bits.join('\n')}`;
}

function siblingBlock(req: WebLessonGenRequest): string {
  const s = (req.siblingLessons ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (!s.length) return '';
  return `\n\nOther lesson titles already in this course (differentiate; do not copy titles):\n- ${s.slice(0, 15).join('\n- ')}`;
}

function modeBlock(mode: WebLessonMode): string {
  switch (mode) {
    case 'project':
      return `\n\nLesson style: PROJECT-FIRST. Weight content_layout toward hands-on "activity" blocks and at least one "assignment-block" Level-Up Challenge. Keep theory short and motivating.`;
    case 'interactive':
      return `\n\nLesson style: INTERACTIVE. Include multiple "quiz" checkpoints and at least one "activity" with clear steps. Balance fun and rigour.`;
    default:
      return `\n\nLesson style: ACADEMIC. Clear objectives, one strong hook in description, mix of illustration/code-map and practice.`;
  }
}

function youngLearnerBlock(req: WebLessonGenRequest): string {
  if (!isYoungLearnerGrade(req.gradeLevel)) return '';
  return `

YOUNG LEARNER OVERRIDE (${req.gradeLevel}):
- Prefer "scratch" blocks where logical (visual blocks + short fixing guide) and simple "illustration" key-point cards.
- Keep code-map components very short. Avoid long prose in lesson_notes; use headings and bullets.
- Quizzes: 3–4 options max, playful wording.`;
}

export function buildWebLessonUserPrompt(req: WebLessonGenRequest): string {
  const ctx = curriculumContext(req);
  const sib = siblingBlock(req);
  const mode = modeBlock(req.lessonMode ?? 'academic');
  const young = youngLearnerBlock(req);

  return `Create ONE complete lesson as a single JSON object (no markdown fences, no commentary).

TOPIC: ${req.topic.trim()}
GRADE LEVEL: ${req.gradeLevel}
TARGET DURATION (minutes): ${req.durationMinutes}${ctx}${sib}${mode}${young}

Required JSON keys:
- "title": short, exciting, unique
- "description": 2–4 sentences; include a hook
- "lesson_notes": teacher-facing notes; headings like "The Adventure Ahead", "The Secret Sauce", "Your Level-Up Mission"; bullets; British English; concise
- "objectives": array of 3–6 strings (measurable, kid-friendly)
- "duration_minutes": number (align with ${req.durationMinutes})
- "lesson_type": one of: hands-on, video, interactive, workshop, coding, reading
- "video_url": string or null (placeholder ok if none)
- "content_layout": array of blocks; MUST include varied types from the system rules (illustration, code-map, activity, assignment-block, quiz; add "scratch" for KG–Basic 6 where appropriate)

Each block in content_layout MUST include a "type" field. Follow the schemas in the system message exactly.`;
}

export function buildWebLessonNotesUserPrompt(req: WebLessonGenRequest): string {
  const ctx = curriculumContext(req);
  const sib = siblingBlock(req);
  const young = youngLearnerBlock(req);

  return `Produce teacher-facing LESSON NOTES only for Rillcod (British English, kid-friendly tone).

TOPIC: ${req.topic.trim()}
GRADE LEVEL: ${req.gradeLevel}
TARGET DURATION (minutes): ${req.durationMinutes}${ctx}${sib}${young}

Return a single JSON object with exactly one key:
{ "lesson_notes": "<string>" }

The string must use clear headings and bullets (you may use markdown inside the string). No other keys. No markdown fences around the JSON.`;
}

export function safeParseWebAiJson(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error('AI returned invalid JSON. Try again or shorten the topic.');
}

export async function generateWebFullLesson(req: WebLessonGenRequest): Promise<WebFullLessonPayload> {
  const raw = await callAI({
    messages: [
      { role: 'system', content: WEB_LESSON_AI_SYSTEM },
      { role: 'user', content: buildWebLessonUserPrompt(req) },
    ],
    maxTokens: 8192,
    temperature: 0.55,
    models: WEB_AI_LESSON_MODELS,
    timeoutMs: 120000,
    responseFormatJsonObject: true,
  });
  return safeParseWebAiJson(raw) as WebFullLessonPayload;
}

export async function generateWebLessonNotesOnly(req: WebLessonGenRequest): Promise<{ lesson_notes: string }> {
  const raw = await callAI({
    messages: [
      { role: 'system', content: WEB_LESSON_AI_SYSTEM },
      { role: 'user', content: buildWebLessonNotesUserPrompt(req) },
    ],
    maxTokens: 2000,
    temperature: 0.6,
    models: WEB_AI_LESSON_NOTES_MODELS,
    timeoutMs: 90000,
    responseFormatJsonObject: false,
  });
  try {
    const parsed = safeParseWebAiJson(raw) as { lesson_notes?: string };
    const notes = parsed?.lesson_notes != null ? String(parsed.lesson_notes) : '';
    if (notes.trim()) return { lesson_notes: notes };
  } catch {
    /* model may return markdown/plain text when JSON mode is off */
  }
  const fallback = raw.trim();
  if (!fallback) throw new Error('Empty AI response for lesson notes. Try again.');
  return { lesson_notes: fallback };
}

/** Bounded retries for flaky OpenRouter / network / JSON-parse failures (mobile-first robustness). */
export interface LessonAiRetryOpts {
  /** Total attempts including the first try; clamped to 1–5. Default 3. */
  attempts?: number;
  /** Base delay before retry 2; doubled each subsequent retry. Default 900ms. */
  baseDelayMs?: number;
}

export async function runWithLessonAiRetry<T>(fn: () => Promise<T>, opts?: LessonAiRetryOpts): Promise<T> {
  const attempts = Math.min(5, Math.max(1, opts?.attempts ?? 3));
  const base = opts?.baseDelayMs ?? 900;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, base * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function generateWebFullLessonWithRetry(
  req: WebLessonGenRequest,
  opts?: LessonAiRetryOpts,
): Promise<WebFullLessonPayload> {
  return runWithLessonAiRetry(() => generateWebFullLesson(req), opts);
}

export async function generateWebLessonNotesOnlyWithRetry(
  req: WebLessonGenRequest,
  opts?: LessonAiRetryOpts,
): Promise<{ lesson_notes: string }> {
  return runWithLessonAiRetry(() => generateWebLessonNotesOnly(req), opts);
}

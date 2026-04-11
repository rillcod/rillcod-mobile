/**
 * Shared lesson-AI UX helpers (web-aligned subject chips + cover imagery via Pollinations).
 * Use `lessonAiIntegration.ts` for full flows (normalize, retry, telemetry); `webLessonAi.ts` for raw prompts.
 */
import { pollinationsImageUrl } from './openrouter';

export const LESSON_AI_PRESET_SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Physics',
  'Chemistry',
  'Biology',
  'ICT / Coding',
  'Social Studies',
  'Civic',
  'Basic Tech',
  'Fine Art',
  'Music',
  'French',
  'Business',
  'Economics',
  'Geography',
  'History',
] as const;

export type LessonAiPresetSubject = (typeof LESSON_AI_PRESET_SUBJECTS)[number];

/** Same visual pipeline as AIScreen Create tab; stable for Image `source={{ uri }}`. */
export function lessonCoverImageUrl(topic: string, subject?: string | null, width = 768, height = 512): string {
  const t = topic.trim();
  const s = (subject ?? '').trim();
  const prompt = s ? `${s} — ${t}` : t || 'STEM learning';
  return pollinationsImageUrl(prompt, width, height);
}

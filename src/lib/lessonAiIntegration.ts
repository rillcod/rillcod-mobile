/**
 * Single integration surface for web-aligned lesson AI on mobile.
 * Screens call these helpers instead of duplicating retry / normalize / cover / telemetry.
 */
import { analyticsService } from '../services/analytics.service';
import {
  generateWebFullLessonWithRetry,
  generateWebLessonNotesOnlyWithRetry,
  type LessonAiRetryOpts,
  type WebFullLessonPayload,
  type WebLessonGenRequest,
} from './webLessonAi';
import { lessonCoverImageUrl } from './lessonAiPort';

const ALLOWED_LESSON_TYPES = new Set([
  'hands-on',
  'video',
  'interactive',
  'workshop',
  'coding',
  'reading',
]);

/** Returns trimmed topic or throws with a short message for UI catch / Alert. */
export function requireLessonAiTopic(topic: string): string {
  const t = topic.trim();
  if (!t) {
    throw new Error('Enter a lesson topic first.');
  }
  return t;
}

/** Coerce AI JSON into safe shapes before saving or rendering. */
export function normalizeWebLessonPayload(p: WebFullLessonPayload): WebFullLessonPayload {
  const rawLayout = (p as { content_layout?: unknown }).content_layout;
  const content_layout = Array.isArray(rawLayout) ? rawLayout : [];
  const objectives = Array.isArray(p.objectives)
    ? (p.objectives as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : [];
  const lesson_type =
    typeof p.lesson_type === 'string' && ALLOWED_LESSON_TYPES.has(p.lesson_type) ? p.lesson_type : 'hands-on';
  const duration_minutes =
    typeof p.duration_minutes === 'number' &&
    Number.isFinite(p.duration_minutes) &&
    p.duration_minutes > 0 &&
    p.duration_minutes <= 480
      ? Math.round(p.duration_minutes)
      : undefined;

  return {
    ...p,
    content_layout,
    objectives,
    lesson_type,
    duration_minutes,
  };
}

export interface LessonAiFullGenerationResult {
  payload: WebFullLessonPayload;
  coverImageUrl: string;
  layoutJson: string;
  objectives: string[];
}

/** Full lesson JSON + layout string + cover URL (Pollinations; optional display). */
export async function runLessonAiFullGeneration(
  req: WebLessonGenRequest,
  opts?: LessonAiRetryOpts,
): Promise<LessonAiFullGenerationResult> {
  const raw = await generateWebFullLessonWithRetry(req, opts);
  const payload = normalizeWebLessonPayload(raw);
  const coverImageUrl = lessonCoverImageUrl(req.topic, req.subject);
  const layoutJson = JSON.stringify(payload.content_layout ?? [], null, 2);
  const objectives = payload.objectives ?? [];
  return { payload, coverImageUrl, layoutJson, objectives };
}

export async function runLessonAiNotesGeneration(
  req: WebLessonGenRequest,
  opts?: LessonAiRetryOpts,
): Promise<{ lesson_notes: string }> {
  return generateWebLessonNotesOnlyWithRetry(req, opts);
}

/** AIScreen Create tab — builds the same request shape as web quick-create. */
export function buildQuickLessonAiRequest(params: {
  topic: string;
  gradeLevel: string;
  subject?: string;
  durationMinutes?: number;
  lessonMode?: WebLessonGenRequest['lessonMode'];
}): WebLessonGenRequest {
  return {
    topic: params.topic.trim(),
    gradeLevel: params.gradeLevel,
    subject: params.subject?.trim() || undefined,
    durationMinutes: params.durationMinutes ?? 60,
    lessonMode: params.lessonMode ?? 'academic',
  };
}

/** Non-blocking activity log for product/debug (never throws). */
export async function trackLessonAiEvent(
  userId: string | null | undefined,
  schoolId: string | null | undefined,
  kind: 'full' | 'notes',
  meta: Record<string, unknown> = {},
): Promise<void> {
  if (!userId) return;
  try {
    await analyticsService.trackEvent(
      userId,
      kind === 'full' ? 'lesson_ai_full_lesson' : 'lesson_ai_notes_only',
      meta,
      { schoolId: schoolId ?? null },
    );
  } catch {
    /* ignore */
  }
}

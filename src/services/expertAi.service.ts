import { callAI } from '../lib/openrouter';
import { WEB_LESSON_AI_SYSTEM } from '../lib/webLessonAiSystem';

export type GenerateType = 
  | 'lesson' 
  | 'lesson-notes' 
  | 'lesson-plan' 
  | 'library-content' 
  | 'assignment' 
  | 'cbt' 
  | 'report-feedback' 
  | 'cbt-grading' 
  | 'newsletter' 
  | 'code-generation' 
  | 'daily-missions' 
  | 'lesson-hook' 
  | 'custom';

export interface AiGenerationRequest {
  type: GenerateType;
  topic: string;
  studentName?: string;
  gradeLevel?: string;
  subject?: string;
  durationMinutes?: number;
  termWeeks?: number;
  contentType?: string;
  lessonMode?: 'academic' | 'project' | 'interactive';
  attendance?: string;
  assignments?: string;
  currentContent?: any;
  questionCount?: number;
  mcqCount?: number;
  theoryCount?: number;
  tone?: string;
  audience?: string;
  // For grading
  questions?: any[];
  studentAnswers?: Record<string, string>;
  // For assignment generation
  assignmentType?: string;
  // For daily missions & hooks
  xp?: number;
  streak?: number;
  lessonsDone?: number;
  avgScore?: number;
  nextLesson?: string;
  program?: string;
  // For report feedback
  theoryScore?: number | string;
  practicalScore?: number | string;
  participationScore?: number | string;
  overallScore?: number | string;
  overallGrade?: string;
  proficiencyLevel?: string;
  courseName?: string;
  programName?: string;
  prompt?: string;
  siblingLessons?: string[];
}

const MODELS = [
  "google/gemini-2.0-flash-001",
  "deepseek/deepseek-chat",
  "x-ai/grok-2-1212",
  "meta-llama/llama-3.3-70b-instruct",
  "qwen/qwen-2.5-72b-instruct:free"
];

export class ExpertAiService {
  
  private buildPrompt(req: AiGenerationRequest): string {
    switch (req.type) {
      case 'custom':
        return req.prompt || req.topic;
        
      case 'cbt-grading':
        return `You are an AI Grader for Rillcod Technologies. Grade the following student's responses for a CBT exam.
Questions and Rubrics: ${JSON.stringify(req.questions)}
Student Answers: ${JSON.stringify(req.studentAnswers)}

Return a JSON object with this exact shape:
{
  "scores": {
    "question_id": number // score awarded for this question (0 to max points)
  },
  "feedback": "string — overall encouraging feedback and specific points for improvement",
  "rationale": {
    "question_id": "string — brief explanation for the assigned score (internal use)"
  }
}

Important: Be fair but encouraging. For 'essay' questions, look for key concepts.`;

      case 'report-feedback': {
        const overallScore = Number(req.overallScore ?? 0);
        const theory = Number(req.theoryScore ?? 0);
        const practical = Number(req.practicalScore ?? 0);
        const participation = Number(req.participationScore ?? 0);
        const proficiency = req.proficiencyLevel ?? 'intermediate';

        const band = (n: number) =>
          n >= 85 ? 'outstanding' :
          n >= 75 ? 'excellent' :
          n >= 65 ? 'very good' :
          n >= 55 ? 'good' :
          n >= 45 ? 'satisfactory' :
          n >= 35 ? 'fair' : 'needs improvement';

        const scores = { Theory: theory, Practical: practical, Participation: participation };
        const weakest = Object.entries(scores).sort(([, a], [, b]) => a - b)[0][0];
        const strongest = Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];

        return `You are an experienced Nigerian school administrator writing brief, professional student report card comments.

Student: "${req.studentName ?? 'The student'}"
Course: "${req.courseName ?? 'the course'}"
Current Topic/Module: "${req.topic}"
Overall performance: ${band(overallScore)}
Theory: ${band(theory)} | Practical: ${band(practical)} | Participation: ${band(participation)}
Strongest area: ${strongest} | Area needing most attention: ${weakest}
Proficiency level: ${proficiency}

RULES:
1. Write EXACTLY 2-3 short, clear sentences per section.
2. NEVER include any numbers, percentages, or scores in your output.
3. Use simple, everyday English.
4. Be SPECIFIC to the course or programme.
5. Sound warm, honest, and encouraging.

Return ONLY this JSON:
{
  "key_strengths": "sentences praising achievements...",
  "areas_for_growth": "sentences with actionable direction..."
}`;
      }

      case 'assignment':
        return `Generate an assignment for Rillcod Technologies students.
Topic: "${req.topic}"
Grade level: ${req.gradeLevel ?? 'Basic 1–SS3'}
Subject: ${req.subject ?? req.courseName ?? 'Coding & Technology'}
${req.programName ? `Programme: "${req.programName}"` : ''}
${req.courseName ? `Course: "${req.courseName}" — all questions and scenarios MUST relate to this course` : ''}
Assignment type hint: ${req.assignmentType ?? 'auto-detect'}
Max Points: 100

Return a JSON object with this exact shape:
{
  "title": "string — clear assignment title",
  "description": "string — brief overview",
  "instructions": "string — detailed step-by-step instructions for the student",
  "assignment_type": "string — one of: homework, project, quiz, coding, exam, presentation",
  "metadata": {
    "deliverables": ["string — only for project type, e.g. 'A working Python script', 'Screenshot of output', 'Written explanation'"],
    "rubric": [
      { "criterion": "string — e.g. 'Code Functionality'", "description": "string — what earns full marks", "maxPoints": 25 }
    ]
  },
  "questions": [
    {
      "question_text": "string",
      "question_type": "string — one of: multiple_choice, true_false, fill_blank, essay, coding_blocks, block_sequence",
      "options": ["string — only for multiple_choice/true_false"],
      "correct_answer": "string",
      "points": 10,
      "metadata": {
        "logic_sentence": "string — only for coding_blocks, e.g. 'When [BLANK] clicked, move [BLANK] steps'",
        "logic_blocks": ["string — only for coding_blocks, all available block options"],
        "blocks": ["string — only for block_sequence: ALL available blocks including distractors"],
        "correct_sequence": ["string — only for block_sequence: correct order of blocks"]
      }
    }
  ]
}

RULES:
- For 'coding_blocks': correct_answer = comma-separated blocks for [BLANK] slots in order. logic_sentence uses [BLANK] for each gap.
- For 'block_sequence': correct_answer = comma-separated correct sequence. blocks[] includes the correct ones PLUS 1-2 distractor blocks mixed in.
- For 'project': include deliverables[] with 3-5 concrete items, and rubric[] with 3-4 criteria summing to ~100 pts.
- For visual/Scratch/block coding topics (grade Basic 1-JSS1): include at least 1 block_sequence question.
- For programming topics (JSS2-SS3): include at least 1 coding_blocks and 1 coding challenge question.
- Include at least 5 questions total.`;

      case 'cbt': {
        const qCount    = req.questionCount ?? 10;
        const mcqCount  = req.mcqCount  ?? qCount;
        const openCount = req.theoryCount ?? 0;
        const totalQ    = mcqCount + openCount;

        const mcqInstruction = mcqCount > 0
          ? `SECTION A — Objective/MCQ: Generate EXACTLY ${mcqCount} multiple-choice or true/false questions. Each MUST have an "options" array of 4 choices and a "correct_answer". Set "question_type" to "multiple_choice" or "true_false".`
          : '';
        const theoryInstruction = openCount > 0
          ? `SECTION B — Theory/Open: Generate EXACTLY ${openCount} open-ended questions (essay, fill_blank, or coding_blocks). These MUST have NO "options" array (or empty []). Set "question_type" to "essay", "fill_blank", or "coding_blocks" as appropriate.`
          : '';

        return `Generate a Computer Based Test (CBT) for Rillcod Technologies.
Topic: "${req.topic}"
Grade level: ${req.gradeLevel ?? 'Basic 1–SS3'}
Subject: ${req.subject ?? req.courseName ?? 'Coding & Technology'}
${req.programName ? `Programme: "${req.programName}"` : ''}
${req.courseName ? `Course: "${req.courseName}" — all questions MUST be framed within this course's scope and context` : ''}
Total questions required: EXACTLY ${totalQ}. You MUST generate all ${totalQ} — do not stop early.

${mcqInstruction}
${theoryInstruction}

Return a JSON object with this exact shape:
{
  "title": "string — exam title",
  "description": "string — brief exam description",
  "duration_minutes": ${Math.max(30, totalQ * 2)},
  "passing_score": 70,
  "questions": [
    {
      "question_text": "string — for code-based questions wrap the code snippet in triple backtick fences with the language, e.g. \`\`\`python\\nprint('hello')\\n\`\`\`",
      "question_type": "string — one of: multiple_choice, true_false, fill_blank, essay, coding_blocks",
      "options": ["string — ONLY for MCQ/true_false; omit or use [] for open-ended"],
      "correct_answer": "string",
      "points": 5,
      "metadata": {
        "logic_sentence": "string — only for coding_blocks",
        "logic_blocks": ["string"]
      }
    }
  ]
}

CRITICAL:
- questions array MUST contain exactly ${totalQ} items total.
- Cover the topic comprehensively across different difficulty levels.`; }

      case 'lesson-plan':
        return `Generate a HIGH-ACTION lesson plan for a Rillcod Technologies instructor.
Topic: "${req.topic}"
Grade level: ${req.gradeLevel ?? 'Basic 1–SS3'}

Return a JSON object with this exact shape:
{
  "plan_data": {
    "course_title": "string",
    "description": "string",
    "teaching_strategy": "string",
    "weeks": [
      {
        "week": 1,
        "theme": "string",
        "topics": ["string"],
        "teacher_instructions": ["string"],
        "activities": ["string"]
      }
    ],
    "assessment_strategy": "string",
    "materials": ["string"]
  }
}`;

      case 'newsletter':
        return `Generate a premium, visionary academic newsletter for Rillcod Technologies.
Topic/Event: "${req.topic}"
Target Audience: ${req.audience ?? 'All School Stakeholders'}

RULES:
- Do NOT use markdown symbols (#, *, etc.). Use plain text ONLY.
- Use ALL CAPS for section headings (e.g. "INTRODUCTION").
- Use British English.

Return a JSON object:
{
  "title": "string",
  "content": "string",
  "summary": "string"
}`;

      default:
        // Fallback for lesson/notes handled by existing builders if possible, or generic here
        return `Generate content for topic: "${req.topic}" for grade ${req.gradeLevel}. Return JSON format.`;
    }
  }

  private safeParseJSON(raw: string): any {
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      const match = stripped.match(/(\{[\s\S]*\})/);
      if (match) {
        try {
          const cleaned = match[1]
            .replace(/,\s*([\}\]])/g, '$1')
            .replace(/\/\/.*/g, '');
          return JSON.parse(cleaned);
        } catch { /* fail */ }
      }
      throw new Error('AI returned malformed data — please try again');
    }
  }

  async generate(req: AiGenerationRequest, attempts = 3): Promise<any> {
    const systemPrompt = WEB_LESSON_AI_SYSTEM;
    const userPrompt = this.buildPrompt(req);

    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const raw = await callAI({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          maxTokens: req.type === 'cbt' || req.type === 'lesson' ? 4000 : 2048,
          temperature: 0.7,
          models: MODELS,
          timeoutMs: 50000,
          responseFormatJsonObject: true
        });

        return this.safeParseJSON(raw);
      } catch (err: any) {
        lastErr = err;
        if (i < attempts - 1) {
          // exponentialish backoff
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    throw lastErr;
  }
}

export const expertAiService = new ExpertAiService();

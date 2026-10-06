import { z } from "zod";
import { subjects } from "./constants";

const id = z.string().min(1).max(500);
const text = z.string().max(500_000);
export const LetterSchema = z.enum(["A", "B", "C", "D", "E"]);
export const InstantSchema = z.iso.datetime({ offset: true });
export const StudyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const ms = Date.parse(`${value}T00:00:00Z`);
    return (
      Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
    );
  }, "Data inexistente.");
export const ErrorCauseSchema = z.enum([
  "concept",
  "method",
  "prerequisite",
  "calculation",
  "interpretation",
  "time",
]);
export const QuestionRevisionSchema = z.object({
  id,
  revision: id,
  subject: z.enum(subjects),
  edition: id,
  period: z.enum(["matutino", "vespertino"]),
  originalNumber: z.number().int().min(1).max(200),
  subjectNumber: z.number().int().min(1).max(200),
  topics: z.array(id),
  skills: z.array(id),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  assessmentOnly: z.boolean().optional(),
  learning: z
    .object({
      concept: text,
      workedExample: text,
      prerequisites: z.array(
        z.object({ subject: z.enum(subjects), skill: id }),
      ),
      reviewed: z.boolean(),
      source: text,
      reviewer: text,
    })
    .optional(),
  rawText: text,
  stem: text,
  options: z
    .array(z.object({ letter: LetterSchema, text }))
    .max(5)
    .refine(
      (options) =>
        new Set(options.map((o) => o.letter)).size === options.length,
      "Alternativas duplicadas.",
    ),
  assets: z.array(
    z.object({
      path: id,
      alt: text,
      required: z.boolean(),
      verified: z.boolean(),
      source: text,
      anchor: z.object({
        target: z.enum(["stem", "support", "option"]),
        optionLetter: LetterSchema.nullable(),
        afterBlock: z.number().int().nonnegative(),
      }),
    }),
  ),
  source: z.object({
    file: id,
    section: text,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    originalPdf: id.optional(),
    page: z.number().int().positive().optional(),
  }),
  quality: z.object({
    reviewed: z.boolean(),
    ocr: z.boolean(),
    uncertain: z.boolean(),
    textComplete: z.boolean(),
    assetsComplete: z.boolean(),
    taxonomyReviewed: z.boolean(),
    annulled: z.boolean(),
    reviewer: id.optional(),
    reviewedAt: InstantSchema.optional(),
  }),
  key: z
    .object({
      letter: LetterSchema,
      revision: id,
      verified: z.boolean(),
      source: text,
      location: text,
      reviewer: text,
    })
    .nullable(),
  annulment: z
    .object({
      revision: id,
      verified: z.boolean(),
      source: text,
      location: text,
      reviewer: text,
    })
    .nullable(),
  explanation: z
    .object({
      text,
      reviewed: z.boolean(),
      authorKind: z.enum(["official", "prepared"]),
      author: text,
      source: text,
      reviewer: text,
    })
    .nullable(),
});
export const ReviewPolicySchema = z.object({
  initialDays: z.number().int().min(1).max(365),
  repeatDays: z.number().int().min(1).max(365),
  maintenanceDays: z.number().int().min(1).max(365),
  recoverySuccesses: z.number().int().min(2).max(10),
  minEvidenceDays: z.number().int().min(1).max(365),
});
export const SettingsSchema = z.object({
  timezone: id.refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Fuso desconhecido."),
  dailyMinutes: z.union([
    z.literal(30),
    z.literal(60),
    z.literal(90),
    z.literal(120),
  ]),
  studyWeekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(5)
    .refine((days) => new Set(days).size === days.length, "Dias repetidos."),
  targetExamDate: StudyDateSchema,
  reviewPolicy: ReviewPolicySchema,
});
export const AttemptInputSchema = z.object({
  submissionId: id,
  sessionId: id,
  questionId: id,
  questionRevision: id,
  response: LetterSchema.nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  guessed: z.boolean(),
  doubt: z.boolean(),
  usedHint: z.boolean(),
  consulted: z.boolean(),
  activeMs: z.number().int().nonnegative().max(86_400_000),
});
export const AttemptSchema = AttemptInputSchema.extend({
  id,
  at: InstantSchema,
  studyDate: StudyDateSchema,
  mode: z.enum(["study", "assessment"]),
  firstAttempt: z.boolean(),
  priorFeedbackAt: InstantSchema.nullable(),
  priorFeedbackDate: StudyDateSchema.nullable(),
  skillFeedback: z
    .array(
      z.object({
        subject: z.enum(subjects),
        skill: id,
        at: InstantSchema,
        studyDate: StudyDateSchema,
      }),
    )
    .optional(),
});
export const DraftRecordSchema = AttemptInputSchema.extend({
  updatedAt: InstantSchema,
});
export const GradeSchema = z.object({
  id: z.string().min(1).max(1100),
  attemptId: id,
  keyRevision: id.nullable(),
  decisionRevision: z.string().min(1).max(510),
  questionRevision: id,
  correct: z.boolean().nullable(),
  kind: z.enum(["initial", "regrade"]),
  exclusionReason: z.literal("annulled").nullable(),
  at: InstantSchema,
  order: z.number().int().nonnegative().optional(),
});
export const FeedbackEventSchema = z.object({
  id: z.string().min(1).max(1100),
  attemptId: id,
  questionId: id,
  questionRevision: id.optional(),
  at: InstantSchema,
  studyDate: StudyDateSchema,
});
export const StudySessionSchema = z
  .object({
    id,
    purpose: z.enum(["practice", "guided", "benchmark"]).optional(),
    order: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    mode: z.enum(["study", "assessment"]),
    status: z.enum(["active", "completed"]),
    questions: z.array(z.object({ id, revision: id })).min(1),
    startedAt: InstantSchema,
    deadlineAt: InstantSchema.nullable(),
    completedAt: InstantSchema.nullable(),
  })
  .refine(
    (session) =>
      (session.purpose !== "benchmark" || session.mode === "assessment") &&
      (session.purpose !== "guided" || session.mode === "study"),
    "Finalidade incompatível com o modo da sessão.",
  );
export const GapSchema = z.object({
  questionId: id,
  status: z.enum(["open", "in_review", "recovered"]),
  cause: ErrorCauseSchema.nullable(),
  note: text,
  evidenceAttemptIds: z.array(id),
  lastFailureDate: StudyDateSchema,
});
export const ReviewSchema = z.object({
  questionId: id,
  dueDate: StudyDateSchema,
  kind: z.enum(["gap", "maintenance"]),
  lastEvidenceDate: StudyDateSchema.nullable(),
});
export const DailyPlanSchema = z.object({
  date: StudyDateSchema,
  tasks: z.array(
    z.object({
      questionId: id,
      minutes: z.number().int().positive().max(120),
      reason: z.enum(["review", "gap", "maintenance", "new"]),
    }),
  ),
  deferredQuestionIds: z.array(id),
});
export const questionRevisionSchema = QuestionRevisionSchema;
export const settingsSchema = SettingsSchema;
export const attemptInputSchema = AttemptInputSchema;

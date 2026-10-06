export type Letter = "A" | "B" | "C" | "D" | "E";
export type StudyDate = string;
export type Instant = string;
export type Subject =
  "matematica" | "biologia" | "portugues-literatura" | "fisica" | "quimica";
export type Blocker =
  | "ocr"
  | "uncertain"
  | "missing_text"
  | "missing_options"
  | "missing_assets"
  | "unreviewed"
  | "missing_key"
  | "missing_explanation"
  | "missing_skills"
  | "annulled";
export type ErrorCause =
  | "concept"
  | "method"
  | "prerequisite"
  | "calculation"
  | "interpretation"
  | "time";

export interface QuestionRevision {
  id: string;
  revision: string;
  subject: Subject;
  edition: string;
  period: "matutino" | "vespertino";
  originalNumber: number;
  subjectNumber: number;
  topics: string[];
  skills: string[];
  difficulty?: "easy" | "medium" | "hard";
  assessmentOnly?: boolean;
  learning?: {
    concept: string;
    workedExample: string;
    prerequisites: { subject: Subject; skill: string }[];
    reviewed: boolean;
    source: string;
    reviewer: string;
  };
  rawText: string;
  stem: string;
  options: { letter: Letter; text: string }[];
  assets: {
    path: string;
    alt: string;
    required: boolean;
    verified: boolean;
    source: string;
    anchor: {
      target: "stem" | "support" | "option";
      optionLetter: Letter | null;
      afterBlock: number;
    };
  }[];
  source: {
    file: string;
    section: string;
    sha256: string;
    originalPdf?: string;
    page?: number;
  };
  quality: {
    reviewed: boolean;
    ocr: boolean;
    uncertain: boolean;
    textComplete: boolean;
    assetsComplete: boolean;
    taxonomyReviewed: boolean;
    annulled: boolean;
    reviewer?: string;
    reviewedAt?: Instant;
  };
  key: null | {
    letter: Letter;
    revision: string;
    verified: boolean;
    source: string;
    location: string;
    reviewer: string;
  };
  annulment: null | {
    revision: string;
    verified: boolean;
    source: string;
    location: string;
    reviewer: string;
  };
  explanation: null | {
    text: string;
    reviewed: boolean;
    authorKind: "official" | "prepared";
    author: string;
    source: string;
    reviewer: string;
  };
}
export interface AttemptInput {
  submissionId: string;
  sessionId: string;
  questionId: string;
  questionRevision: string;
  response: Letter | null;
  confidence: "low" | "medium" | "high";
  guessed: boolean;
  doubt: boolean;
  usedHint: boolean;
  consulted: boolean;
  activeMs: number;
}
export interface Attempt extends AttemptInput {
  id: string;
  at: Instant;
  studyDate: StudyDate;
  mode: "study" | "assessment";
  firstAttempt: boolean;
  priorFeedbackAt: Instant | null;
  priorFeedbackDate: StudyDate | null;
  /** Exposures already committed before this attempt; never inferred later. */
  skillFeedback?: {
    subject: Subject;
    skill: string;
    at: Instant;
    studyDate: StudyDate;
  }[];
}
export interface DraftRecord extends AttemptInput {
  updatedAt: Instant;
}
export interface Grade {
  id: string;
  attemptId: string;
  keyRevision: string | null;
  decisionRevision: string;
  questionRevision: string;
  correct: boolean | null;
  kind: "initial" | "regrade";
  exclusionReason: "annulled" | null;
  at: Instant;
  /** Durable application order resolves decisions recorded in the same instant. */
  order?: number;
}
export interface FeedbackEvent {
  id: string;
  attemptId: string;
  questionId: string;
  /** Snapshot of the correction shown; absent in legacy events. */
  questionRevision?: string;
  at: Instant;
  studyDate: StudyDate;
}
export interface StudySession {
  id: string;
  purpose?: "practice" | "guided" | "benchmark";
  /** Local transactional start order; absent in older backups. */
  order?: number;
  mode: "study" | "assessment";
  status: "active" | "completed";
  questions: { id: string; revision: string }[];
  startedAt: Instant;
  deadlineAt: Instant | null;
  completedAt: Instant | null;
}
export interface Gap {
  questionId: string;
  status: "open" | "in_review" | "recovered";
  cause: ErrorCause | null;
  note: string;
  evidenceAttemptIds: string[];
  lastFailureDate: StudyDate;
}
export interface Review {
  questionId: string;
  dueDate: StudyDate;
  kind: "gap" | "maintenance";
  lastEvidenceDate: StudyDate | null;
}
export interface ReviewPolicy {
  initialDays: number;
  repeatDays: number;
  maintenanceDays: number;
  recoverySuccesses: number;
  minEvidenceDays: number;
}
export interface Settings {
  timezone: string;
  dailyMinutes: 30 | 60 | 90 | 120;
  studyWeekdays: number[];
  targetExamDate: StudyDate;
  reviewPolicy: ReviewPolicy;
}
export interface LearningHistory {
  attempts: Attempt[];
  grades: Grade[];
  feedback: FeedbackEvent[];
  sessions: StudySession[];
}
export interface LearningProjection {
  gaps: Gap[];
  reviews: Review[];
}
export interface PlanTask {
  questionId: string;
  minutes: number;
  reason: "review" | "gap" | "maintenance" | "new";
}
export interface DailyPlan {
  date: StudyDate;
  tasks: PlanTask[];
  deferredQuestionIds: string[];
}

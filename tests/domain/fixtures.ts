import type {
  Attempt,
  Grade,
  LearningHistory,
  QuestionRevision,
  StudySession,
} from "../../src/content/types";

// Synthetic content stays in tests; these records do not certify the corpus.
export function question(
  overrides: Partial<QuestionRevision> = {},
): QuestionRevision {
  return {
    id: "test-q1",
    revision: "r1",
    subject: "matematica",
    edition: "test",
    period: "matutino",
    originalNumber: 1,
    subjectNumber: 1,
    topics: ["topic"],
    skills: ["skill"],
    rawText: "Synthetic test",
    stem: "Synthetic test",
    options: ["A", "B", "C", "D", "E"].map((letter) => ({
      letter: letter as "A",
      text: letter,
    })),
    assets: [],
    source: {
      file: "test",
      section: "test",
      sha256: "0".repeat(64),
      originalPdf: "synthetic-test.pdf",
      page: 1,
    },
    quality: {
      reviewed: true,
      ocr: false,
      uncertain: false,
      textComplete: true,
      assetsComplete: true,
      taxonomyReviewed: true,
      annulled: false,
      reviewer: "test",
      reviewedAt: "2026-10-02T12:00:00Z",
    },
    key: {
      letter: "B",
      revision: "k1",
      verified: true,
      source: "test",
      location: "test",
      reviewer: "test",
    },
    annulment: null,
    explanation: {
      text: "Synthetic explanation",
      reviewed: true,
      authorKind: "prepared",
      author: "test",
      source: "test",
      reviewer: "test",
    },
    ...overrides,
  };
}
export function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "a1",
    submissionId: "sub1",
    sessionId: "s1",
    questionId: "test-q1",
    questionRevision: "r1",
    response: "B",
    confidence: "high",
    guessed: false,
    doubt: false,
    usedHint: false,
    consulted: false,
    activeMs: 100,
    at: "2026-10-02T12:00:00Z",
    studyDate: "2026-10-02",
    mode: "study",
    firstAttempt: true,
    priorFeedbackAt: null,
    priorFeedbackDate: null,
    ...overrides,
  };
}
export function grade(
  a: Attempt,
  correct = true,
  overrides: Partial<Grade> = {},
): Grade {
  return {
    id: `grade-${a.id}`,
    attemptId: a.id,
    keyRevision: "k1",
    decisionRevision: "key:k1",
    questionRevision: "r1",
    correct,
    kind: "initial",
    exclusionReason: null,
    at: a.at,
    ...overrides,
  };
}
export function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s1",
    mode: "study",
    status: "active",
    questions: [{ id: "test-q1", revision: "r1" }],
    startedAt: "2026-10-02T12:00:00Z",
    deadlineAt: null,
    completedAt: null,
    ...overrides,
  };
}
export function history(
  attempts: Attempt[],
  grades = attempts.map((a) => grade(a)),
  sessions: StudySession[] = [],
): LearningHistory {
  return { attempts, grades, feedback: [], sessions };
}

import { expect, it } from "vitest";
import { readyQuestion } from "./fixtures";
import { getBlockers, canPractice, isReady } from "../../src/content/quality";
import { contentAvailability } from "../../src/content/quality";
import {
  QuestionRevisionSchema,
  StudySessionSchema,
  AttemptSchema,
} from "../../src/content/schema";

it("requires nonempty reviewed skills and keeps reserved items out of practice", () => {
  expect(getBlockers(readyQuestion({ skills: [] }))).toContain(
    "missing_skills",
  );
  expect(isReady(readyQuestion({ skills: [" "] }))).toBe(false);
  const reserved = {
    ...readyQuestion(),
    assessmentOnly: true,
    difficulty: "medium" as const,
  };
  expect(isReady(reserved)).toBe(true);
  expect(canPractice(reserved)).toBe(false);
});

it("preserves optional pedagogical metadata without adding it to old records", () => {
  const old = readyQuestion();
  expect(QuestionRevisionSchema.parse(old)).toEqual(old);
  const q = {
    ...old,
    assessmentOnly: true,
    difficulty: "hard",
    learning: {
      concept: "Conceito conferido",
      workedExample: "Exemplo conferido",
      prerequisites: [{ subject: "matematica", skill: "somar" }],
      reviewed: true,
      source: "Original p. 1",
      reviewer: "Conferente",
    },
  };
  expect(QuestionRevisionSchema.parse(q)).toEqual(q);
});

it("rejects purposes incompatible with the session mode", () => {
  const session = {
    id: "s",
    mode: "study",
    status: "active",
    questions: [{ id: "q", revision: "v1" }],
    startedAt: "2026-10-02T12:00:00Z",
    deadlineAt: null,
    completedAt: null,
  };
  expect(
    StudySessionSchema.safeParse({ ...session, purpose: "benchmark" }).success,
  ).toBe(false);
  expect(
    StudySessionSchema.safeParse({ ...session, purpose: "guided" }).success,
  ).toBe(true);
  expect(
    StudySessionSchema.safeParse({
      ...session,
      mode: "assessment",
      purpose: "guided",
    }).success,
  ).toBe(false);
});

it("preserves the immutable skill feedback baseline", () => {
  const attempt = {
    id: "a",
    submissionId: "a",
    sessionId: "s",
    questionId: "q",
    questionRevision: "v1",
    response: "A",
    confidence: "high",
    guessed: false,
    doubt: false,
    usedHint: false,
    consulted: false,
    activeMs: 1000,
    at: "2026-10-02T12:00:00Z",
    studyDate: "2026-10-02",
    mode: "study",
    firstAttempt: true,
    priorFeedbackAt: null,
    priorFeedbackDate: null,
    skillFeedback: [
      {
        subject: "matematica",
        skill: "somar",
        at: "2026-10-01T12:00:00Z",
        studyDate: "2026-10-01",
      },
    ],
  };
  expect(AttemptSchema.parse(attempt)).toEqual(attempt);
});

it("counts certified reserved content separately from available practice", () => {
  expect(
    contentAvailability([
      readyQuestion(),
      readyQuestion({
        id: "reserved",
        assessmentOnly: true,
        difficulty: "easy",
      }),
      readyQuestion({ id: "blocked", key: null }),
    ]),
  ).toEqual({
    ready: 2,
    practiceReady: 1,
    reservedReady: 1,
    blockedForTraining: 2,
  });
});

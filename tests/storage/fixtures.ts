import "fake-indexeddb/auto";
import { StudyDb } from "../../src/storage/db";
import type { AttemptInput, QuestionRevision } from "../../src/content/types";
export const now = "2026-10-02T12:00:00.000Z";
export function readyQuestion(
  id = "fixture-q",
  revision = "v1",
): QuestionRevision {
  return {
    id,
    revision,
    subject: "matematica",
    edition: "2024-1",
    period: "matutino",
    originalNumber: 1,
    subjectNumber: 1,
    topics: ["fixture"],
    skills: ["fixture"],
    rawText: "Questão sintética de teste",
    stem: "Quanto é 1 + 1?",
    options: ["A", "B", "C", "D", "E"].map((letter, index) => ({
      letter: letter as "A" | "B" | "C" | "D" | "E",
      text: String(index + 1),
    })),
    assets: [],
    source: {
      file: "fixture",
      section: "1",
      sha256: "a".repeat(64),
      originalPdf: "fixture.pdf",
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
      reviewer: "fixture",
      reviewedAt: now,
    },
    key: {
      letter: "B",
      revision: "key-v1",
      verified: true,
      source: "fixture",
      location: "page 1",
      reviewer: "fixture",
    },
    annulment: null,
    explanation: {
      text: "1 + 1 = 2",
      reviewed: true,
      authorKind: "prepared",
      author: "fixture",
      source: "fixture",
      reviewer: "fixture",
    },
  };
}
export async function createTestDb() {
  const db = new StudyDb(`test-${crypto.randomUUID()}`);
  await db.open();
  return db;
}
export function makeInput(
  sessionId: string,
  overrides: Partial<AttemptInput> = {},
): AttemptInput {
  return {
    submissionId: crypto.randomUUID(),
    sessionId,
    questionId: "fixture-q",
    questionRevision: "v1",
    response: "A",
    confidence: "high",
    guessed: false,
    doubt: false,
    usedHint: false,
    consulted: false,
    activeMs: 1000,
    ...overrides,
  };
}

import { afterEach, expect, it } from "vitest";
import { createTestDb, makeInput, now, readyQuestion } from "./fixtures";
import {
  startSession,
  submitAttempt,
  regradeAttempt,
  updateGapNote,
} from "../../src/storage/study-service";
import type { StudyDb } from "../../src/storage/db";
let db: StudyDb;
afterEach(async () => {
  if (db) await db.delete();
});
it("appends verified key revisions and annulments without changing original history", async () => {
  db = await createTestDb();
  const q = readyQuestion();
  const session = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const original = await submitAttempt(db, makeInput(session.id), now);
  await updateGapNote(db, q.id, "concept", "Não apagar");
  const revised = {
    ...q,
    revision: "v2",
    key: { ...q.key!, letter: "A" as const, revision: "key-v2" },
  };
  const grade = await regradeAttempt(
    db,
    original.id,
    revised,
    "2026-10-03T12:00:00Z",
  );
  expect(grade.correct).toBe(true);
  expect(grade.kind).toBe("regrade");
  const annulled = {
    ...q,
    revision: "v3",
    key: null,
    quality: { ...q.quality, annulled: true },
    annulment: {
      revision: "annul-v1",
      verified: true,
      source: "fixture",
      location: "page 1",
      reviewer: "fixture",
    },
  };
  const annul = await regradeAttempt(
    db,
    original.id,
    annulled,
    "2026-10-04T12:00:00Z",
  );
  expect(annul).toMatchObject({
    keyRevision: null,
    decisionRevision: "annulment:annul-v1",
    correct: null,
    exclusionReason: "annulled",
  });
  expect(
    (await regradeAttempt(db, original.id, annulled, "2026-10-05T12:00:00Z"))
      .id,
  ).toBe(annul.id);
  expect(await db.grades.count()).toBe(3);
  expect(await db.questionSnapshots.count()).toBe(3);
  expect(await db.attempts.get(original.id)).toEqual(original);
  expect(await db.questionSnapshots.get([q.id, q.revision])).toEqual(q);
});
it("rejects mismatched question identity and unverified decision", async () => {
  db = await createTestDb();
  const q = readyQuestion();
  const s = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const a = await submitAttempt(db, makeInput(s.id), now);
  await expect(
    regradeAttempt(db, a.id, { ...q, id: "other" }, now),
  ).rejects.toThrow();
  await expect(
    regradeAttempt(
      db,
      a.id,
      { ...q, revision: "v2", key: { ...q.key!, verified: false } },
      now,
    ),
  ).rejects.toThrow();
  expect(await db.grades.count()).toBe(1);
});

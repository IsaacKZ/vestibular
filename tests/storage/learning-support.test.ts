import { afterEach, expect, test } from "vitest";
import type { StudyDb } from "../../src/storage/db";
import type { QuestionRevision } from "../../src/content/types";
import { exportBackup, previewImport, mergeBackup } from "../../src/storage/backup";
import { completeAssessment, completeStudySession, loadHistory, revealFeedback, revealLearningSupport, startSession, submitAttempt } from "../../src/storage/study-service";
import { createTestDb, makeInput, now, readyQuestion } from "./fixtures";
const dbs: StudyDb[] = [];
const later = "2026-10-03T12:00:00.000Z";
async function create() { const db = await createTestDb(); dbs.push(db); return db; }
afterEach(async () => { await Promise.all(dbs.splice(0).map((db) => db.delete())); });
function current(): QuestionRevision {
  return { ...readyQuestion("fixture-q", "v2"), skills: ["new-skill"], learning: {
    concept: "Current reviewed concept", workedExample: "Current reviewed example", prerequisites: [],
    reviewed: true, source: "Study support", reviewer: "Codex",
  } };
}
async function attempted(db: StudyDb, mode: "study" | "assessment" = "study") {
  const session = await startSession(db, { questions: [readyQuestion()], mode, durationMs: mode === "assessment" ? 60_000 : null }, now);
  const attempt = await submitAttempt(db, makeInput(session.id), now);
  return { session, attempt };
}

test("current reviewed support records a separate immutable revision without changing old attempt or grade and restores in backup", async () => {
  const db = await create(); const { attempt } = await attempted(db);
  const before = await loadHistory(db); const old = await db.questionSnapshots.get(["fixture-q", "v1"]);
  const event = await revealLearningSupport(db, attempt.id, current(), later, "token");
  expect(event).toMatchObject({ id: `support:${attempt.id}:token`, questionRevision: "v2", at: later });
  expect(await db.questionSnapshots.get(["fixture-q", "v2"])).toEqual(current());
  expect((await loadHistory(db)).attempts).toEqual(before.attempts);
  expect((await loadHistory(db)).grades).toEqual(before.grades);
  expect(await db.questionSnapshots.get(["fixture-q", "v1"])).toEqual(old);
  const correction = await revealFeedback(db, attempt.id, later, "token");
  expect(correction.questionRevision).toBe("v1");
  expect(correction.id).not.toBe(event.id);
  const backup = await exportBackup(db, later); const target = await create();
  expect(await previewImport(target, backup)).toMatchObject({ valid: true });
  await mergeBackup(target, backup);
  expect(await target.feedback.get(event.id)).toEqual(event);
  expect(await target.questionSnapshots.get(["fixture-q", "v2"])).toEqual(current());
});

test("token retries return original event before conflicting or invalid new catalogue metadata are considered", async () => {
  const db = await create(); const { attempt } = await attempted(db);
  const original = await revealLearningSupport(db, attempt.id, current(), later, "retry");
  const changed = { ...current(), learning: { ...current().learning!, concept: "Changed without revision", reviewed: false } };
  expect(await revealLearningSupport(db, attempt.id, changed, "2026-10-04T12:00:00Z", "retry")).toEqual(original);
  expect(await revealLearningSupport(db, attempt.id, { ...current(), revision: "v3" }, later, "retry")).toEqual(original);
  expect(await db.feedback.count()).toBe(1);
  expect(await db.questionSnapshots.get(["fixture-q", "v2"])).toEqual(current());
  expect(await db.questionSnapshots.get(["fixture-q", "v3"])).toBeUndefined();
});

test("support rejects missing attempts, mismatched identity, unready content, unreviewed support and invalid tokens without writes", async () => {
  const db = await create(); const { attempt } = await attempted(db);
  await expect(revealLearningSupport(db, "missing", current(), later)).rejects.toThrow(/Tentativa/);
  await expect(revealLearningSupport(db, attempt.id, { ...current(), id: "other" }, later)).rejects.toThrow(/Questão/);
  await expect(revealLearningSupport(db, attempt.id, { ...current(), quality: { ...current().quality, reviewed: false } }, later)).rejects.toThrow(/pronta/);
  await expect(revealLearningSupport(db, attempt.id, { ...current(), learning: undefined, explanation: null }, later)).rejects.toThrow(/apoio conferido/);
  for (const token of ["", " ", "a".repeat(501)]) await expect(revealLearningSupport(db, attempt.id, current(), later, token)).rejects.toThrow(/exposição/);
  expect(await db.feedback.count()).toBe(0);
  expect(await db.questionSnapshots.count()).toBe(1);
});

test("chronology and assessment gates also protect retries and do not persist support snapshots", async () => {
  const db = await create(); const { attempt, session } = await attempted(db, "assessment");
  await expect(revealLearningSupport(db, attempt.id, current(), later)).rejects.toThrow(/avaliação/);
  await completeAssessment(db, session.id, "2026-10-02T12:00:30Z");
  await expect(revealLearningSupport(db, attempt.id, current(), "2026-10-02T12:00:29Z")).rejects.toThrow(/anterior/);
  const event = await revealLearningSupport(db, attempt.id, current(), later, "gate");
  await expect(revealLearningSupport(db, attempt.id, current(), "2026-10-02T11:59:59Z", "gate")).rejects.toThrow(/anterior/);
  await startSession(db, { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 }, later);
  await expect(revealLearningSupport(db, attempt.id, current(), later, "gate")).rejects.toThrow(/protegida/);
  expect(await db.feedback.toArray()).toEqual([event]);
});

test("a conflicting current snapshot rolls back the entire exposure and concurrent token requests persist once", async () => {
  const db = await create(); const { attempt } = await attempted(db);
  await db.questionSnapshots.add({ ...current(), stem: "Existing conflicting revision" });
  await expect(revealLearningSupport(db, attempt.id, current(), later)).rejects.toThrow(/Conflito/);
  expect(await db.feedback.count()).toBe(0);
  await db.questionSnapshots.delete(["fixture-q", "v2"]);
  const events = await Promise.all([revealLearningSupport(db, attempt.id, current(), later, "same"), revealLearningSupport(db, attempt.id, current(), later, "same")]);
  expect(events[0]).toEqual(events[1]);
  expect(await db.feedback.count()).toBe(1);
});

test("new support skills enter future submission baselines without rewriting historical evidence", async () => {
  const db = await create(); const { attempt } = await attempted(db);
  const old = await db.attempts.get(attempt.id);
  const target = { ...readyQuestion("target"), skills: ["new-skill"] };
  const beforeSession = await startSession(db, { questions: [target], mode: "study", durationMs: null }, now);
  const before = await submitAttempt(db, makeInput(beforeSession.id, { questionId: "target" }), now);
  const exposure = await revealLearningSupport(db, attempt.id, current(), later);
  await completeStudySession(db, beforeSession.id, later);
  const nextSession = await startSession(db, { questions: [target], mode: "study", durationMs: null }, "2026-10-04T12:00:00Z");
  const after = await submitAttempt(db, makeInput(nextSession.id, { questionId: "target" }), "2026-10-04T12:00:00Z");
  expect(after.skillFeedback).toEqual([{ subject: "matematica", skill: "new-skill", at: exposure.at, studyDate: exposure.studyDate }]);
  expect(await db.attempts.get(attempt.id)).toEqual(old);
  expect(await db.attempts.get(before.id)).toEqual(before);
  expect(before.skillFeedback).toEqual([]);
  expect((await previewImport(await create(), await exportBackup(db, later))).valid).toBe(true);
});

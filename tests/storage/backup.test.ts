import { afterEach, expect, it } from "vitest";
import { createTestDb, makeInput, now, readyQuestion } from "./fixtures";
import {
  startSession,
  submitAttempt,
  saveDraft,
  updateGapNote,
  saveSettings,
  getSettings,
} from "../../src/storage/study-service";
import {
  exportBackup,
  previewImport,
  mergeBackup,
} from "../../src/storage/backup";
import type { StudyDb } from "../../src/storage/db";
const dbs: StudyDb[] = [];
async function create() {
  const db = await createTestDb();
  dbs.push(db);
  return db;
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()));
});
it("restores complete history and drafts idempotently including unanswered snapshots", async () => {
  const source = await create();
  const s = await startSession(
    source,
    {
      questions: [readyQuestion(), readyQuestion("unanswered")],
      mode: "study",
      durationMs: null,
    },
    now,
  );
  await submitAttempt(source, makeInput(s.id), now);
  await updateGapNote(source, "fixture-q", "method", "Backup note");
  await saveDraft(
    source,
    makeInput(s.id, { questionId: "unanswered" }),
    "2026-10-02T12:01:00Z",
  );
  const backup = await exportBackup(source, now);
  const target = await create();
  expect((await previewImport(target, backup)).valid).toBe(true);
  await mergeBackup(target, backup);
  await mergeBackup(target, backup);
  expect(await exportBackup(target, now)).toEqual(backup);
  expect(await target.questionSnapshots.count()).toBe(2);
});
it("refuses future formats, dangling references, conflicting IDs and partial imports", async () => {
  const db = await create();
  const s = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  await submitAttempt(db, makeInput(s.id), now);
  const backup = await exportBackup(db, now);
  expect((await previewImport(db, { ...backup, schemaVersion: 2 })).valid).toBe(
    false,
  );
  const broken = structuredClone(backup);
  broken.data.questionSnapshots = [];
  expect((await previewImport(await create(), broken)).valid).toBe(false);
  const conflict = structuredClone(backup);
  conflict.data.attempts[0].response = "C";
  expect((await previewImport(db, conflict)).conflicts.length).toBeGreaterThan(
    0,
  );
  await expect(mergeBackup(db, conflict)).rejects.toThrow();
  expect(await exportBackup(db, now)).toEqual(backup);
});
it("protects existing settings and rejects duplicate IDs within an envelope", async () => {
  const source = await create();
  const backup = await exportBackup(source, now);
  const target = await create();
  const settings = await getSettings(target);
  await saveSettings(target, { ...settings, dailyMinutes: 30 });
  expect((await previewImport(target, backup)).conflicts).toContain(
    "settings:current",
  );
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  await submitAttempt(source, makeInput(s.id), now);
  const duplicated = await exportBackup(source, now);
  duplicated.data.attempts.push({
    ...duplicated.data.attempts[0],
    response: "C",
  });
  expect((await previewImport(target, duplicated)).valid).toBe(false);
});
it("rejects unknown nested data instead of silently discarding it", async () => {
  const source = await create();
  const backup = await exportBackup(source, now);
  const unknown = structuredClone(backup) as unknown as {
    data: { settings: Record<string, unknown> };
  };
  unknown.data.settings.unknownField = "cannot import";
  expect((await previewImport(source, unknown)).valid).toBe(false);
  await expect(mergeBackup(source, unknown as never)).rejects.toThrow();
});
it("rolls a valid import back entirely when a later store fails", async () => {
  const source = await create();
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  await submitAttempt(source, makeInput(s.id), now);
  const backup = await exportBackup(source, now);
  const target = await create();
  target.submissionReceipts.hook("creating", () => {
    throw new Error("import disk failure");
  });
  await expect(mergeBackup(target, backup)).rejects.toThrow(
    "import disk failure",
  );
  expect(await target.sessions.count()).toBe(0);
  expect(await target.attempts.count()).toBe(0);
  expect(await target.questionSnapshots.count()).toBe(0);
});
it("refuses assessment feedback before completion and initial grades before the attempt", async () => {
  const source = await create();
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
    now,
  );
  const { completeAssessment, revealFeedback } =
    await import("../../src/storage/study-service");
  const a = await submitAttempt(source, makeInput(s.id), now);
  await completeAssessment(source, s.id, "2026-10-02T12:00:30Z");
  await revealFeedback(source, a.id, "2026-10-02T12:00:40Z");
  const backup = await exportBackup(source, now);
  const earlyFeedback = structuredClone(backup);
  earlyFeedback.data.feedback[0].at = "2026-10-02T12:00:10Z";
  expect((await previewImport(await create(), earlyFeedback)).valid).toBe(
    false,
  );
  const earlyGrade = structuredClone(backup);
  earlyGrade.data.grades[0].at = "2026-10-02T11:59:00Z";
  expect((await previewImport(await create(), earlyGrade)).valid).toBe(false);
});
it("roundtrips an expired assessment completed from a durable draft", async () => {
  const source = await create();
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
    now,
  );
  await saveDraft(source, makeInput(s.id, { response: "B" }), now);
  const { completeAssessment } =
    await import("../../src/storage/study-service");
  await completeAssessment(source, s.id, "2026-10-02T14:00:00Z");
  const backup = await exportBackup(source, now);
  const target = await create();
  expect((await previewImport(target, backup)).valid).toBe(true);
  await mergeBackup(target, backup);
  expect(await exportBackup(target, now)).toEqual(backup);
});
it("preserves multiple feedback exposure events for the same historical attempt", async () => {
  const source = await create();
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  const a = await submitAttempt(source, makeInput(s.id), now);
  const { revealFeedback } = await import("../../src/storage/study-service");
  await revealFeedback(source, a.id, "2026-10-02T12:01:00Z", "visit-1");
  await revealFeedback(source, a.id, "2026-10-05T12:01:00Z", "visit-2");
  const backup = await exportBackup(source, now);
  const target = await create();
  await mergeBackup(target, backup);
  expect(await target.feedback.count()).toBe(2);
});
it("rejects an exposure date inconsistent with the recorded event and duplicate daily tasks", async () => {
  const source = await create();
  const s = await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  const a = await submitAttempt(source, makeInput(s.id), now);
  const { revealFeedback } = await import("../../src/storage/study-service");
  await revealFeedback(source, a.id, "2026-10-02T12:01:00Z");
  const next = await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    "2026-10-05T12:00:00Z",
  );
  await submitAttempt(source, makeInput(next.id), "2026-10-05T12:01:00Z");
  const backup = await exportBackup(source, now);
  const broken = structuredClone(backup);
  broken.data.attempts[1].priorFeedbackDate = "2026-10-01";
  expect((await previewImport(await create(), broken)).valid).toBe(false);
  const plan = structuredClone(backup);
  const task = {
    questionId: "future-catalogue-q",
    minutes: 10,
    reason: "new" as const,
  };
  plan.data.plans = [
    { date: "2026-10-02", tasks: [task, task], deferredQuestionIds: [] },
  ];
  expect((await previewImport(await create(), plan)).valid).toBe(false);
});
it("refuses active sessions containing blocked snapshots while preserving historic annulment regrades", async () => {
  const source = await create();
  await startSession(
    source,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  const backup = await exportBackup(source, now);
  const blocked = structuredClone(backup);
  blocked.data.questionSnapshots[0].quality.ocr = true;
  expect((await previewImport(await create(), blocked)).valid).toBe(false);
  const { submitAttempt, regradeAttempt } =
    await import("../../src/storage/study-service");
  const a = await submitAttempt(
    source,
    makeInput(backup.data.sessions[0].id),
    now,
  );
  const q = readyQuestion("fixture-q", "annulled-v2");
  q.quality.annulled = true;
  q.key = null;
  q.annulment = {
    revision: "annul-1",
    verified: true,
    source: "fixture",
    location: "page 1",
    reviewer: "fixture",
  };
  await regradeAttempt(source, a.id, q, "2026-10-03T12:00:00Z");
  const history = await exportBackup(source, now);
  const target = await create();
  expect((await previewImport(target, history)).valid).toBe(true);
  await mergeBackup(target, history);
  expect(await exportBackup(target, now)).toEqual(history);
});

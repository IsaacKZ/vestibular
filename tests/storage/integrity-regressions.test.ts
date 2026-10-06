import { afterEach, expect, it } from "vitest";
import { createTestDb, makeInput, now, readyQuestion } from "./fixtures";
import type { StudyDb } from "../../src/storage/db";
import type { QuestionRevision } from "../../src/content/types";
import {
  completeAssessment,
  completeStudySession,
  getSettings,
  loadHistory,
  loadProjection,
  regradeAttempt,
  revealFeedback,
  saveDraft,
  startSession,
  submitAttempt,
  updateGapNote,
} from "../../src/storage/study-service";
import {
  exportBackup,
  mergeBackup,
  previewImport,
} from "../../src/storage/backup";
import { projectLearning } from "../../src/domain/learning";
import { latestGrades } from "../../src/domain/attempts";

const databases: StudyDb[] = [];
async function create() {
  const db = await createTestDb();
  databases.push(db);
  return db;
}
async function answer(
  db: StudyDb,
  at = now,
  response: "A" | "B" = "A",
  q = readyQuestion(),
) {
  const session = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    at,
  );
  const attempt = await submitAttempt(
    db,
    makeInput(session.id, {
      questionId: q.id,
      questionRevision: q.revision,
      response,
    }),
    at,
  );
  await completeStudySession(db, session.id, at);
  return attempt;
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

it("merges compatible device histories and rebuilds evidence from their combined events", async () => {
  const local = await create();
  await answer(local);
  await updateGapNote(local, "fixture-q", "method", "Minha anotação");
  const baseline = await exportBackup(local, now);
  const remote = await create();
  await mergeBackup(remote, baseline);
  await answer(local, "2026-10-05T12:00:00Z", "B");
  await answer(remote, "2026-10-03T12:00:00Z");
  const backup = await exportBackup(remote, "2026-10-05T12:00:00Z");
  expect((await previewImport(local, backup)).valid).toBe(true);
  await mergeBackup(local, backup);
  const history = await loadHistory(local);
  const expected = projectLearning(
    history,
    "2026-10-05T12:00:00Z",
    (await getSettings(local)).reviewPolicy,
  );
  expected.gaps[0].note = "Minha anotação";
  expected.gaps[0].cause = "method";
  expect(await loadProjection(local)).toEqual(expected);
  expect(expected.gaps[0]).toMatchObject({
    status: "open",
    evidenceAttemptIds: [],
    lastFailureDate: "2026-10-03",
  });
  const merged = await exportBackup(local, now);
  await mergeBackup(local, backup);
  expect(await exportBackup(local, now)).toEqual(merged);
});

it("rebuilds imported statuses and due dates instead of trusting saved projections", async () => {
  const source = await create();
  await answer(source);
  const backup = await exportBackup(source, now);
  backup.data.gaps[0].status = "recovered";
  backup.data.reviews[0] = {
    questionId: "fixture-q",
    dueDate: "2099-01-01",
    kind: "maintenance",
    lastEvidenceDate: null,
  };
  const target = await create();
  await mergeBackup(target, backup);
  expect(await loadProjection(target)).toEqual(await loadProjection(source));
});

it("merges blank and nonempty annotations without erasing notes or causes", async () => {
  const source = await create();
  await answer(source);
  const blank = await exportBackup(source, now);
  const local = await create();
  await mergeBackup(local, blank);
  await updateGapNote(local, "fixture-q", "concept", "Local");
  await mergeBackup(local, blank);
  expect(await local.gaps.get("fixture-q")).toMatchObject({
    cause: "concept",
    note: "Local",
  });
  await updateGapNote(source, "fixture-q", "method", "Remota");
  const annotated = await exportBackup(source, now);
  const target = await create();
  await mergeBackup(target, blank);
  await mergeBackup(target, annotated);
  expect(await target.gaps.get("fixture-q")).toMatchObject({
    cause: "method",
    note: "Remota",
  });
});

it("rejects differing nonempty learner annotations without a partial merge", async () => {
  const source = await create();
  await answer(source);
  const baseline = await exportBackup(source, now);
  const target = await create();
  await mergeBackup(target, baseline);
  await updateGapNote(source, "fixture-q", "concept", "Fonte");
  await updateGapNote(target, "fixture-q", "method", "Destino");
  const before = await exportBackup(target, now);
  expect(
    (await previewImport(target, await exportBackup(source, now))).conflicts,
  ).toContain("gaps:fixture-q:note");
  await expect(
    mergeBackup(target, await exportBackup(source, now)),
  ).rejects.toThrow();
  expect(await exportBackup(target, now)).toEqual(before);
});

it("rejects submission tokens owned by another pending draft and still completes that assessment", async () => {
  const db = await create();
  const study = await startSession(
    db,
    { questions: [readyQuestion("study")], mode: "study", durationMs: null },
    now,
  );
  const assessment = await startSession(
    db,
    {
      questions: [readyQuestion("assessment")],
      mode: "assessment",
      durationMs: 60_000,
    },
    now,
  );
  await saveDraft(
    db,
    makeInput(assessment.id, {
      questionId: "assessment",
      submissionId: "shared",
      response: "B",
    }),
    now,
  );
  await expect(
    submitAttempt(
      db,
      makeInput(study.id, { questionId: "study", submissionId: "shared" }),
      now,
    ),
  ).rejects.toThrow(/conflito/i);
  await completeAssessment(db, assessment.id, "2026-10-02T12:02:00Z");
  expect((await db.attempts.toArray()).map((a) => a.response)).toEqual(["B"]);
  expect(
    (await previewImport(await create(), await exportBackup(db, now))).valid,
  ).toBe(true);
});

it("rejects oversized notes before writing and roundtrips the largest accepted note", async () => {
  const db = await create();
  await answer(db);
  await expect(
    updateGapNote(db, "fixture-q", null, "x".repeat(500_001)),
  ).rejects.toThrow();
  expect((await db.gaps.get("fixture-q"))?.note).toBe("");
  await updateGapNote(db, "fixture-q", "method", "x".repeat(500_000));
  const backup = await exportBackup(db, now);
  const target = await create();
  await mergeBackup(target, backup);
  expect(await exportBackup(target, now)).toEqual(backup);
});

it("accepts the full exposure token length while rejecting larger tokens", async () => {
  const db = await create();
  const attempt = await answer(db);
  await revealFeedback(db, attempt.id, now, "x".repeat(500));
  await expect(
    revealFeedback(db, attempt.id, now, "x".repeat(501)),
  ).rejects.toThrow();
  const backup = await exportBackup(db, now);
  const target = await create();
  await mergeBackup(target, backup);
  expect(await exportBackup(target, now)).toEqual(backup);
});

it("rejects impossible local dates without requiring the current settings timezone", async () => {
  const db = await create();
  const attempt = await answer(db);
  await revealFeedback(db, attempt.id, now);
  const backup = await exportBackup(db, now);
  const badAttempt = structuredClone(backup);
  badAttempt.data.attempts[0].studyDate = "2026-11-01";
  expect((await previewImport(await create(), badAttempt)).valid).toBe(false);
  const badFeedback = structuredClone(backup);
  badFeedback.data.feedback[0].studyDate = "2026-11-01";
  expect((await previewImport(await create(), badFeedback)).valid).toBe(false);
  backup.data.attempts[0].studyDate = "2026-10-01";
  expect((await previewImport(await create(), backup)).valid).toBe(true);
});

function revisedQuestion(
  revision: string,
  keyRevision: string,
  letter: "A" | "B",
): QuestionRevision {
  const q = readyQuestion("fixture-q", revision);
  q.key = { ...q.key!, revision: keyRevision, letter };
  return q;
}
it("persists decision order across reload and backup when regrades share one instant", async () => {
  const db = await create();
  const attempt = await answer(
    db,
    now,
    "A",
    revisedQuestion("v1", "z-original", "B"),
  );
  await regradeAttempt(
    db,
    attempt.id,
    revisedQuestion("v2", "z-second", "B"),
    now,
  );
  const last = await regradeAttempt(
    db,
    attempt.id,
    revisedQuestion("v3", "a-last", "A"),
    now,
  );
  db.close();
  await db.open();
  expect(latestGrades((await loadHistory(db)).grades).get(attempt.id)?.id).toBe(
    last.id,
  );
  expect(last.order).toBe(2);
  const backup = await exportBackup(db, now);
  backup.data.grades.reverse();
  const target = await create();
  await mergeBackup(target, backup);
  expect(
    latestGrades((await loadHistory(target)).grades).get(attempt.id)?.id,
  ).toBe(last.id);
  expect(await loadProjection(target)).toEqual(await loadProjection(db));
});

it("rejects ambiguous same-instant regrades while accepting an initial and one legacy regrade", async () => {
  const db = await create();
  const attempt = await answer(db);
  await regradeAttempt(
    db,
    attempt.id,
    revisedQuestion("v2", "key-v2", "A"),
    now,
  );
  const legacy = await exportBackup(db, now);
  for (const grade of legacy.data.grades) delete grade.order;
  expect((await previewImport(await create(), legacy)).valid).toBe(true);
  await regradeAttempt(
    db,
    attempt.id,
    revisedQuestion("v3", "key-v3", "B"),
    now,
  );
  const ambiguous = await exportBackup(db, now);
  for (const grade of ambiguous.data.grades) delete grade.order;
  expect(
    (await previewImport(await create(), ambiguous)).conflicts.some((c) =>
      c.includes("ordem"),
    ),
  ).toBe(true);
  const equal = await exportBackup(db, now);
  for (const grade of equal.data.grades)
    if (grade.kind === "regrade") grade.order = 1;
  expect((await previewImport(await create(), equal)).valid).toBe(false);
});

it("restores annulment regrades with learner notes but without stale scheduled reviews", async () => {
  const db = await create();
  const attempt = await answer(db);
  await updateGapNote(db, "fixture-q", "method", "Não apagar");
  const q = readyQuestion("fixture-q", "annulled-v2");
  q.quality.annulled = true;
  q.key = null;
  q.annulment = {
    revision: "annulment-v2",
    verified: true,
    source: "fixture",
    location: "page 1",
    reviewer: "fixture",
  };
  await regradeAttempt(db, attempt.id, q, "2026-10-03T12:00:00Z");
  const backup = await exportBackup(db, now);
  backup.data.reviews = [
    {
      questionId: "fixture-q",
      dueDate: "2099-01-01",
      kind: "gap",
      lastEvidenceDate: null,
    },
  ];
  const target = await create();
  await mergeBackup(target, backup);
  expect(await target.reviews.count()).toBe(0);
  expect(await target.gaps.get("fixture-q")).toMatchObject({
    cause: "method",
    note: "Não apagar",
    status: "recovered",
    evidenceAttemptIds: [],
  });
});

it("captures an already committed reread at the same instant and excludes it from retention", async () => {
  const db = await create();
  const wrong = await answer(db);
  await revealFeedback(db, wrong.id, now, "first-visit");
  const rereadAt = "2026-10-05T12:00:00Z";
  await revealFeedback(db, wrong.id, rereadAt, "reread");
  const correct = await answer(db, rereadAt, "B");
  expect(correct.priorFeedbackDate).toBe("2026-10-05");
  expect(correct.priorFeedbackAt).toBe("2026-10-05T12:00:00.000Z");
  expect((await loadProjection(db)).gaps[0].evidenceAttemptIds).toEqual([]);
  const backup = await exportBackup(db, rereadAt);
  const target = await create();
  expect((await previewImport(target, backup)).valid).toBe(true);
  await mergeBackup(target, backup);
  expect(await exportBackup(target, rereadAt)).toEqual(backup);
  expect((await loadProjection(target)).gaps[0].evidenceAttemptIds).toEqual([]);
});

it("roundtrips a grade with the largest accepted official revision", async () => {
  const db = await create();
  const revision = "k".repeat(500);
  const attempt = await answer(
    db,
    now,
    "A",
    revisedQuestion("v1", revision, "B"),
  );
  expect((await loadHistory(db)).grades[0].decisionRevision).toBe(
    `key:${revision}`,
  );
  const backup = await exportBackup(db, now);
  const target = await create();
  expect((await previewImport(target, backup)).valid).toBe(true);
  await mergeBackup(target, backup);
  expect((await loadHistory(target)).grades[0].attemptId).toBe(attempt.id);
  expect(await exportBackup(target, now)).toEqual(backup);
});

it("rejects conflicting equal-instant decision order introduced by two device histories atomically", async () => {
  const local = await create();
  const attempt = await answer(local);
  const remote = await create();
  await mergeBackup(remote, await exportBackup(local, now));
  await regradeAttempt(
    local,
    attempt.id,
    revisedQuestion("v2", "local-key", "A"),
    now,
  );
  await regradeAttempt(
    remote,
    attempt.id,
    revisedQuestion("v3", "remote-key", "B"),
    now,
  );
  const incoming = await exportBackup(remote, now);
  const before = await exportBackup(local, now);
  expect(
    (await previewImport(local, incoming)).conflicts.some((conflict) =>
      conflict.includes("ordem"),
    ),
  ).toBe(true);
  await expect(mergeBackup(local, incoming)).rejects.toThrow(/ordem/);
  expect(await exportBackup(local, now)).toEqual(before);
});

it("rebuilds released assessment evidence at its durable completion instant", async () => {
  const source = await create();
  const session = await startSession(
    source,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
    now,
  );
  await submitAttempt(source, makeInput(session.id), now);
  await completeAssessment(source, session.id, "2026-10-02T12:00:30Z");
  const expected = await loadProjection(source);
  expect(expected.gaps).toHaveLength(1);
  const backup = await exportBackup(source, now);
  const target = await create();
  await mergeBackup(target, backup);
  expect(await loadProjection(target)).toEqual(expected);
});

it("keeps local assessment evidence when merging an older unrelated backup", async () => {
  const remote = await create();
  const older = await exportBackup(remote, now);
  const local = await create();
  const startedAt = "2026-10-09T12:00:00Z";
  const session = await startSession(
    local,
    {
      questions: [readyQuestion()],
      mode: "assessment",
      durationMs: 172_800_000,
    },
    startedAt,
  );
  await submitAttempt(local, makeInput(session.id), startedAt);
  await completeAssessment(local, session.id, "2026-10-10T12:00:00Z");
  const before = await loadProjection(local);
  expect(before.gaps).toHaveLength(1);
  await mergeBackup(local, older);
  expect(await loadProjection(local)).toEqual(before);
});

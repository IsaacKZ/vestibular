import { afterEach, expect, it } from "vitest";
import type { StudyDb } from "../../src/storage/db";
import { createTestDb, readyQuestion, makeInput, now } from "./fixtures";
import {
  startSession,
  saveDraft,
  submitAttempt,
  revealFeedback,
  regradeAttempt,
  completeAssessment,
  completeStudySession,
  loadHistory,
} from "../../src/storage/study-service";
import { projectSkillEvidence } from "../../src/domain/skill-evidence";
import {
  exportBackup,
  previewImport,
  mergeBackup,
} from "../../src/storage/backup";

const databases: StudyDb[] = [];
async function database() {
  const db = await createTestDb();
  databases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

it.each(["study", "assessment"] as const)(
  "restores mixed legacy %s sessions again after submitting an item with valid skills",
  async (mode) => {
    const db = await database();
    const q1 = readyQuestion();
    const q2 = readyQuestion("valid-skills");
    const session = await startSession(
      db,
      {
        questions: [q1, q2],
        mode,
        durationMs: mode === "assessment" ? 60000 : null,
      },
      now,
    );
    const oldAttempt = await submitAttempt(db, makeInput(session.id), now);
    const legacy = await exportBackup(db, now);
    legacy.data.questionSnapshots.find((q) => q.id === q1.id)!.skills = [];
    delete legacy.data.sessions[0].purpose;
    delete legacy.data.sessions[0].order;
    delete legacy.data.attempts[0].skillFeedback;
    const restored = await database();
    expect((await previewImport(restored, legacy)).valid).toBe(true);
    await mergeBackup(restored, legacy);
    const input = makeInput(session.id, { questionId: q2.id, response: "B" });
    await saveDraft(restored, input, now);
    const resumed = await submitAttempt(restored, input, now);
    expect(resumed.skillFeedback).toEqual([]);
    if (mode === "assessment")
      await completeAssessment(restored, session.id, now);
    else await completeStudySession(restored, session.id, now);
    const backup = await exportBackup(restored, now);
    const again = await database();
    expect((await previewImport(again, backup)).valid).toBe(true);
    await mergeBackup(again, backup);
    expect(await again.attempts.get(resumed.id)).toEqual(resumed);
    expect(
      (await again.attempts.get(oldAttempt.id))?.skillFeedback,
    ).toBeUndefined();
    const invalid = structuredClone(backup);
    invalid.data.attempts.find((a) => a.id === oldAttempt.id)!.skillFeedback =
      [];
    expect((await previewImport(await database(), invalid)).valid).toBe(false);
  },
);

const introAt = "2026-10-01T12:00:00.000Z";
const feedbackAt = "2026-10-10T12:00:00.000Z";
const rollbackAt = "2026-10-08T12:00:00.000Z";

it.each([null, "B"] as const)(
  "completes an expired assessment with response %s after later related feedback",
  async (response) => {
    const db = await database();
    const introduction = await startSession(
      db,
      { questions: [readyQuestion()], mode: "study", durationMs: null },
      "2026-09-20T12:00:00.000Z",
    );
    await submitAttempt(
      db,
      makeInput(introduction.id),
      "2026-09-20T12:00:00.000Z",
    );
    const q = readyQuestion("expired-assessment");
    const assessment = await startSession(
      db,
      { questions: [q], mode: "assessment", durationMs: 60000 },
      introAt,
    );
    const input = makeInput(assessment.id, {
      questionId: q.id,
      response,
      ...(response === null
        ? {
            submissionId: `completion:${assessment.id}:${q.id}`,
            confidence: "low" as const,
            activeMs: 0,
          }
        : {}),
    });
    if (response !== null)
      await saveDraft(db, input, "2026-10-01T12:00:10.000Z");
    const laterAt = "2026-10-02T12:00:00.000Z";
    const other = readyQuestion("later-feedback");
    const practice = await startSession(
      db,
      { questions: [other], mode: "study", durationMs: null },
      laterAt,
    );
    const exposureAttempt = await submitAttempt(
      db,
      makeInput(practice.id, { questionId: other.id }),
      laterAt,
    );
    await revealFeedback(db, exposureAttempt.id, laterAt);
    const completionAt = "2026-10-03T12:00:00.000Z";
    const completed = await completeAssessment(db, assessment.id, completionAt);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe(assessment.deadlineAt);
    const attempt = (
      await db.attempts.where("sessionId").equals(assessment.id).toArray()
    )[0];
    expect(attempt.response).toBe(response);
    expect(attempt.at).toBe(assessment.deadlineAt);
    expect(attempt.skillFeedback).toBeUndefined();
    expect(attempt.priorFeedbackAt).toBeNull();
    expect(attempt.consulted).toBe(false);
    const grade = (
      await db.grades.where("attemptId").equals(attempt.id).toArray()
    )[0];
    expect(grade.at).toBe(assessment.deadlineAt);
    expect(grade.correct).toBe(response === "B");
    expect(await db.drafts.count()).toBe(0);
    expect(
      projectSkillEvidence(
        await loadHistory(db),
        await db.questionSnapshots.toArray(),
        completionAt,
      ).flatMap((row) => row.events.map((event) => event.attemptId)),
    ).not.toContain(attempt.id);
    expect(await completeAssessment(db, assessment.id, completionAt)).toEqual(
      completed,
    );
    expect(await submitAttempt(db, input, completionAt)).toEqual(attempt);
    expect(await db.attempts.count()).toBe(3);
    const backup = await exportBackup(db, completionAt);
    const restored = await database();
    expect((await previewImport(restored, backup)).valid).toBe(true);
    await mergeBackup(restored, backup);
    expect(await restored.attempts.get(attempt.id)).toEqual(attempt);
    expect(await restored.sessions.get(assessment.id)).toEqual(completed);
  },
);

it.each([
  {
    name: "the same item despite a different skill",
    id: "fixture-q",
    subject: "matematica" as const,
    skill: "unrelated",
    legacy: false,
  },
  {
    name: "the displayed correction skill",
    id: "next",
    subject: "matematica" as const,
    skill: "corrected",
    legacy: false,
  },
  {
    name: "an ambiguous legacy original skill",
    id: "next",
    subject: "matematica" as const,
    skill: "fixture",
    legacy: true,
  },
  {
    name: "an ambiguous legacy correction skill",
    id: "next",
    subject: "matematica" as const,
    skill: "corrected",
    legacy: true,
  },
])(
  "rejects new drafts and submissions with a clock earlier than committed feedback for $name",
  async ({ id, subject, skill, legacy }) => {
    const db = await database();
    const q = readyQuestion();
    const intro = await startSession(
      db,
      { questions: [q], mode: "study", durationMs: null },
      introAt,
    );
    const introInput = makeInput(intro.id);
    const a = await submitAttempt(db, introInput, introAt);
    const revised = {
      ...q,
      revision: "v2",
      skills: ["corrected"],
      key: { ...q.key!, revision: "key-v2" },
    };
    await regradeAttempt(db, a.id, revised, introAt);
    const event = await revealFeedback(db, a.id, feedbackAt);
    if (legacy) {
      delete event.questionRevision;
      await db.feedback.put(event);
    }
    const target = {
      ...readyQuestion(id, "target-v1"),
      subject,
      skills: [skill],
    };
    const next = await startSession(
      db,
      { questions: [target], mode: "study", durationMs: null },
      rollbackAt,
    );
    const input = makeInput(next.id, {
      questionId: target.id,
      questionRevision: target.revision,
      response: "B",
    });
    const before = await exportBackup(db, feedbackAt);
    const writes = await Promise.allSettled([
      saveDraft(db, input, rollbackAt),
      submitAttempt(db, input, rollbackAt),
    ]);
    expect(writes.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    for (const result of writes)
      if (result.status === "rejected")
        expect(result.reason.message).toMatch(/anterior.*feedback/i);
    expect(await exportBackup(db, feedbackAt)).toEqual(before);
    // A persisted submission remains retryable even after a later exposure and clock rollback.
    expect(await submitAttempt(db, introInput, rollbackAt)).toEqual(a);
    await saveDraft(db, input, feedbackAt);
    const accepted = await submitAttempt(db, input, feedbackAt);
    expect(accepted.priorFeedbackAt).toBe(id === q.id ? feedbackAt : null);
    expect(accepted.skillFeedback).toEqual(
      legacy
        ? undefined
        : id === q.id
          ? []
          : [{ subject, skill, at: feedbackAt, studyDate: "2026-10-10" }],
    );
    expect(
      (
        await previewImport(
          await database(),
          await exportBackup(db, feedbackAt),
        )
      ).valid,
    ).toBe(true);
  },
);

it.each([
  {
    name: "another subject",
    subject: "fisica" as const,
    skill: "corrected",
    legacy: false,
  },
  {
    name: "an unrelated skill",
    subject: "matematica" as const,
    skill: "other",
    legacy: true,
  },
  {
    name: "a skill excluded from the displayed correction",
    subject: "matematica" as const,
    skill: "fixture",
    legacy: false,
  },
])(
  "allows new drafts and submissions despite later feedback for $name",
  async ({ subject, skill, legacy }) => {
    const db = await database();
    const q = readyQuestion();
    const intro = await startSession(
      db,
      { questions: [q], mode: "study", durationMs: null },
      introAt,
    );
    const a = await submitAttempt(db, makeInput(intro.id), introAt);
    await regradeAttempt(
      db,
      a.id,
      {
        ...q,
        revision: "v2",
        skills: ["corrected"],
        key: { ...q.key!, revision: "key-v2" },
      },
      introAt,
    );
    const event = await revealFeedback(db, a.id, feedbackAt);
    if (legacy) {
      delete event.questionRevision;
      await db.feedback.put(event);
    }
    const target = { ...readyQuestion("unrelated"), subject, skills: [skill] };
    const next = await startSession(
      db,
      { questions: [target], mode: "study", durationMs: null },
      rollbackAt,
    );
    const input = makeInput(next.id, { questionId: target.id });
    await saveDraft(db, input, rollbackAt);
    expect((await submitAttempt(db, input, rollbackAt)).skillFeedback).toEqual(
      [],
    );
    expect(
      (
        await previewImport(
          await database(),
          await exportBackup(db, feedbackAt),
        )
      ).valid,
    ).toBe(true);
  },
);

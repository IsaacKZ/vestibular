import { afterEach, describe, expect, it } from "vitest";
import { createTestDb, makeInput, now, readyQuestion } from "./fixtures";
import {
  startSession,
  saveDraft,
  submitAttempt,
  revealFeedback,
  completeAssessment,
  updateGapNote,
  loadProjection,
  updateDailyPlan,
  getSettings,
} from "../../src/storage/study-service";
import type { StudyDb } from "../../src/storage/db";
const databases: StudyDb[] = [];
async function setup(
  mode: "study" | "assessment" = "study",
  questions = [readyQuestion()],
) {
  const db = await createTestDb();
  databases.push(db);
  const session = await startSession(
    db,
    { questions, mode, durationMs: mode === "assessment" ? 60_000 : null },
    now,
  );
  return { db, session, input: makeInput(session.id) };
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
describe("durable study history", () => {
  it("saves every session revision, even without an answer", async () => {
    const { db } = await setup();
    await startSession(
      db,
      {
        questions: [readyQuestion("fixture-q", "v2")],
        mode: "study",
        durationMs: null,
      },
      now,
    );
    expect(await db.questionSnapshots.count()).toBe(2);
  });
  it("returns one attempt for repeated submission and rejects changed payload", async () => {
    const { db, input } = await setup();
    const a = await submitAttempt(db, input, now);
    expect((await submitAttempt(db, input, "2026-10-02T13:00:00Z")).id).toBe(
      a.id,
    );
    await expect(
      submitAttempt(db, { ...input, response: "B" }, now),
    ).rejects.toThrow(/conflito/i);
    expect(await db.attempts.count()).toBe(1);
    expect(await db.grades.count()).toBe(1);
  });
  it("rolls all writes back when the receipt cannot be persisted", async () => {
    const { db, input } = await setup();
    db.submissionReceipts.hook("creating", () => {
      throw new Error("disk failure");
    });
    await expect(submitAttempt(db, input, now)).rejects.toThrow("disk failure");
    expect(await db.attempts.count()).toBe(0);
    expect(await db.grades.count()).toBe(0);
    expect(await db.feedback.count()).toBe(0);
    expect(await db.gaps.count()).toBe(0);
  });
  it("captures prior same-question feedback and preserves notes after recalculation", async () => {
    const { db, input } = await setup();
    const a = await submitAttempt(db, input, now);
    await revealFeedback(db, a.id, "2026-10-02T12:01:00Z");
    await updateGapNote(db, input.questionId, "calculation", "Minha nota");
    const session = await startSession(
      db,
      { questions: [readyQuestion()], mode: "study", durationMs: null },
      "2026-10-05T12:00:00Z",
    );
    const b = await submitAttempt(
      db,
      makeInput(session.id, { response: "B" }),
      "2026-10-05T12:01:00Z",
    );
    expect(b.firstAttempt).toBe(false);
    expect(b.priorFeedbackAt).toBe("2026-10-02T12:01:00.000Z");
    expect((await loadProjection(db)).gaps[0]).toMatchObject({
      note: "Minha nota",
      cause: "calculation",
    });
  });
  it("keeps drafts across reopen and rejects changes at the deadline", async () => {
    const { db, session, input } = await setup("assessment");
    await saveDraft(db, { ...input, response: "B" }, now);
    db.close();
    await db.open();
    expect(
      (await db.drafts.get([session.id, input.questionId]))?.response,
    ).toBe("B");
    await expect(saveDraft(db, input, "2026-10-02T12:01:00Z")).rejects.toThrow(
      /prazo/i,
    );
    await expect(
      submitAttempt(db, input, "2026-10-02T12:01:00Z"),
    ).rejects.toThrow(/prazo/i);
  });
  it("publishes assessment history only after atomic idempotent completion using saved drafts and skips", async () => {
    const { db, session, input } = await setup("assessment", [
      readyQuestion(),
      readyQuestion("unanswered"),
    ]);
    await saveDraft(db, { ...input, response: "B" }, "2026-10-02T12:00:30Z");
    expect((await loadProjection(db)).gaps).toHaveLength(0);
    const ended = await completeAssessment(
      db,
      session.id,
      "2026-10-02T14:00:00Z",
    );
    expect(ended.completedAt).toBe("2026-10-02T12:01:00.000Z");
    await completeAssessment(db, session.id, "2026-10-02T14:01:00Z");
    expect(await db.attempts.count()).toBe(2);
    const attempts = await db.attempts.toArray();
    expect(attempts.find((a) => a.questionId === "fixture-q")?.response).toBe(
      "B",
    );
    expect(
      attempts.find((a) => a.questionId === "unanswered")?.response,
    ).toBeNull();
    expect((await loadProjection(db)).gaps.map((g) => g.questionId)).toEqual([
      "unanswered",
    ]);
    await revealFeedback(db, attempts[0].id, "2026-10-02T14:02:00Z");
  });
  it("does not reveal assessment feedback until completion", async () => {
    const { db, input, session } = await setup("assessment");
    const a = await submitAttempt(db, input, now);
    await expect(revealFeedback(db, a.id, now)).rejects.toThrow();
    expect(await db.feedback.count()).toBe(0);
    expect((await loadProjection(db)).gaps).toHaveLength(0);
    await completeAssessment(db, session.id, now);
    await revealFeedback(db, a.id, now);
    expect((await loadProjection(db)).gaps).toHaveLength(1);
  });
  it("persists a daily plan within capacity without moving reviews", async () => {
    const { db, input } = await setup();
    await submitAttempt(db, input, now);
    const before = await db.reviews.toArray();
    const settings = await getSettings(db);
    await updateDailyPlan(
      db,
      {
        date: "2026-10-02",
        tasks: [
          { questionId: input.questionId, minutes: 10, reason: "review" },
        ],
        deferredQuestionIds: [],
      },
      settings,
    );
    expect(await db.plans.count()).toBe(1);
    expect(await db.reviews.toArray()).toEqual(before);
    await expect(
      updateDailyPlan(
        db,
        {
          date: "2026-10-02",
          tasks: [
            { questionId: input.questionId, minutes: 130, reason: "review" },
          ],
          deferredQuestionIds: [],
        },
        settings,
      ),
    ).rejects.toThrow();
  });
});
it("does not rewind projections when an old submission token is retried", async () => {
  const { db, input } = await setup();
  await submitAttempt(db, input, now);
  const second = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    "2026-10-05T12:00:00Z",
  );
  await submitAttempt(
    db,
    makeInput(second.id, { response: "B" }),
    "2026-10-05T12:00:00Z",
  );
  const before = await loadProjection(db);
  await submitAttempt(db, input, now);
  expect(await loadProjection(db)).toEqual(before);
});
it("rejects attempts with active time beyond the validated contract", async () => {
  const { db, input } = await setup();
  await expect(
    submitAttempt(db, { ...input, activeMs: 86_400_001 }, now),
  ).rejects.toThrow();
  expect(await db.attempts.count()).toBe(0);
});
it("rolls completion back as a unit and allows retry with the durable draft", async () => {
  const { db, session, input } = await setup("assessment", [
    readyQuestion(),
    readyQuestion("unanswered"),
  ]);
  await saveDraft(db, { ...input, response: "B" }, now);
  const hook = () => {
    throw new Error("completion disk failure");
  };
  db.submissionReceipts.hook("creating", hook);
  await expect(
    completeAssessment(db, session.id, "2026-10-02T12:02:00Z"),
  ).rejects.toThrow("completion disk failure");
  expect(await db.attempts.count()).toBe(0);
  expect((await db.sessions.get(session.id))?.status).toBe("active");
  expect(await db.drafts.count()).toBe(1);
  db.submissionReceipts.hook("creating").unsubscribe(hook);
  await completeAssessment(db, session.id, "2026-10-02T12:02:00Z");
  expect(await db.attempts.count()).toBe(2);
});
it("uses the captured session revision after a new catalogue revision is stored", async () => {
  const { db, input } = await setup();
  const revised = readyQuestion("fixture-q", "v2");
  revised.key = { ...revised.key!, letter: "A", revision: "key-v2" };
  await startSession(
    db,
    { questions: [revised], mode: "study", durationMs: null },
    now,
  );
  const attempt = await submitAttempt(db, input, now);
  expect(
    (await db.grades.where("attemptId").equals(attempt.id).first())?.correct,
  ).toBe(false);
  expect(attempt.questionRevision).toBe("v1");
});
it("rejects a snapshot overwrite without adding a session", async () => {
  const { db } = await setup();
  const altered = readyQuestion();
  altered.stem = "Changed under same revision";
  await expect(
    startSession(
      db,
      { questions: [altered], mode: "study", durationMs: null },
      now,
    ),
  ).rejects.toThrow(/conflito/i);
  expect(await db.sessions.count()).toBe(1);
  expect((await db.questionSnapshots.get(["fixture-q", "v1"]))?.stem).toBe(
    readyQuestion().stem,
  );
});
it("records one attempt under simultaneous identical submissions", async () => {
  const { db, input } = await setup();
  const attempts = await Promise.all([
    submitAttempt(db, input, now),
    submitAttempt(db, input, now),
  ]);
  expect(attempts[0].id).toBe(attempts[1].id);
  expect(await db.attempts.count()).toBe(1);
});
it("rejects a draft token already used by another attempt or pending question", async () => {
  const { db, input } = await setup();
  await submitAttempt(db, input, now);
  const assessment = await startSession(
    db,
    {
      questions: [readyQuestion(), readyQuestion("other")],
      mode: "assessment",
      durationMs: 60_000,
    },
    now,
  );
  await expect(
    saveDraft(
      db,
      makeInput(assessment.id, { submissionId: input.submissionId }),
      now,
    ),
  ).rejects.toThrow(/conflito/i);
  const draft = makeInput(assessment.id);
  await saveDraft(db, draft, now);
  await expect(
    saveDraft(db, { ...draft, questionId: "other" }, now),
  ).rejects.toThrow(/conflito/i);
  expect(await db.drafts.count()).toBe(1);
});
it("captures a new feedback exposure on rereading and keeps each visit token idempotent", async () => {
  const { db, input } = await setup();
  const initial = await submitAttempt(db, input, now);
  await revealFeedback(db, initial.id, "2026-10-02T12:01:00Z", "visit-1");
  const reread = await revealFeedback(
    db,
    initial.id,
    "2026-10-05T12:00:00Z",
    "visit-2",
  );
  expect(
    (await revealFeedback(db, initial.id, "2026-10-05T12:00:01Z", "visit-2"))
      .id,
  ).toBe(reread.id);
  expect(await db.feedback.count()).toBe(2);
  const later = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    "2026-10-05T12:01:00Z",
  );
  const answer = await submitAttempt(
    db,
    makeInput(later.id, { response: "B" }),
    "2026-10-05T12:02:00Z",
  );
  expect(answer.priorFeedbackDate).toBe("2026-10-05");
  expect((await loadProjection(db)).gaps[0].evidenceAttemptIds).toEqual([]);
  expect((await db.attempts.get(initial.id))?.priorFeedbackDate).toBeNull();
});
it("completes study sessions only after every question has a durable attempt", async () => {
  const { completeStudySession } =
    await import("../../src/storage/study-service");
  const { db, session, input } = await setup("study", [
    readyQuestion(),
    readyQuestion("other"),
  ]);
  await submitAttempt(db, input, now);
  await expect(completeStudySession(db, session.id, now)).rejects.toThrow();
  expect((await db.sessions.get(session.id))?.status).toBe("active");
  await submitAttempt(
    db,
    makeInput(session.id, { questionId: "other" }),
    "2026-10-02T12:01:00Z",
  );
  await expect(completeStudySession(db, session.id, now)).rejects.toThrow();
  const completed = await completeStudySession(
    db,
    session.id,
    "2026-10-02T12:02:00Z",
  );
  expect(completed).toMatchObject({
    status: "completed",
    completedAt: "2026-10-02T12:02:00.000Z",
  });
  expect(
    await completeStudySession(db, session.id, "2026-10-02T13:00:00Z"),
  ).toEqual(completed);
  expect(await db.attempts.count()).toBe(2);
});
it("blocks historical feedback and new sessions for questions in an active assessment", async () => {
  const { db, session: study, input } = await setup();
  const attempt = await submitAttempt(db, input, now);
  await revealFeedback(db, attempt.id, "2026-10-02T12:00:10Z", "old-visit");
  const assessment = await startSession(
    db,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
    "2026-10-02T12:00:20Z",
  );
  await expect(
    startSession(
      db,
      { questions: [readyQuestion()], mode: "study", durationMs: null },
      "2026-10-02T12:00:30Z",
    ),
  ).rejects.toThrow(/avaliação/i);
  await expect(
    startSession(
      db,
      { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
      "2026-10-02T12:00:30Z",
    ),
  ).rejects.toThrow(/avaliação/i);
  await expect(
    revealFeedback(db, attempt.id, "2026-10-02T12:00:30Z", "old-visit"),
  ).rejects.toThrow(/avaliação/i);
  await expect(
    revealFeedback(db, attempt.id, "2026-10-02T12:00:30Z", "new-visit"),
  ).rejects.toThrow(/avaliação/i);
  expect(await db.feedback.count()).toBe(1);
  expect((await db.sessions.get(study.id))?.status).toBe("active");
  const other = await startSession(
    db,
    { questions: [readyQuestion("other")], mode: "study", durationMs: null },
    "2026-10-02T12:00:30Z",
  );
  const otherAttempt = await submitAttempt(
    db,
    makeInput(other.id, { questionId: "other" }),
    "2026-10-02T12:00:30Z",
  );
  await revealFeedback(db, otherAttempt.id, "2026-10-02T12:00:30Z");
  await completeAssessment(db, assessment.id, "2026-10-02T12:00:40Z");
  await revealFeedback(db, attempt.id, "2026-10-02T12:00:50Z", "new-visit");
  await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    "2026-10-02T12:00:50Z",
  );
});
it("blocks submission from an already open study session while the same question is assessed", async () => {
  const { db, input } = await setup();
  const assessment = await startSession(
    db,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60_000 },
    now,
  );
  await expect(submitAttempt(db, input, now)).rejects.toThrow(/avaliação/i);
  expect(await db.attempts.count()).toBe(0);
  await completeAssessment(db, assessment.id, "2026-10-02T12:00:30Z");
  await submitAttempt(db, input, "2026-10-02T12:00:40Z");
  expect(await db.attempts.count()).toBe(2);
});

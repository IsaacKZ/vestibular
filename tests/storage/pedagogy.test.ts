import { afterEach, expect, it } from "vitest";
import { createTestDb, readyQuestion, makeInput, now } from "./fixtures";
import {
  startSession,
  saveDraft,
  submitAttempt,
  revealFeedback,
  updateDailyPlan,
  completeStudySession,
  completeAssessment,
  regradeAttempt,
} from "../../src/storage/study-service";
import {
  exportBackup,
  previewImport,
  mergeBackup,
} from "../../src/storage/backup";
import { defaultSettings } from "../../src/content/constants";
import type { StudyDb } from "../../src/storage/db";
const databases: StudyDb[] = [];
async function database() {
  const db = await createTestDb();
  databases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

it("protects reserved items from ordinary practice and validates benchmark eligibility", async () => {
  const db = await database();
  const q = {
    ...readyQuestion(),
    assessmentOnly: true,
    difficulty: "medium" as const,
  };
  await expect(
    startSession(db, { questions: [q], mode: "study", durationMs: null }, now),
  ).rejects.toThrow(/reservad/i);
  await expect(
    startSession(
      db,
      {
        questions: [readyQuestion()],
        mode: "assessment",
        purpose: "benchmark",
        durationMs: 60000,
      },
      now,
    ),
  ).rejects.toThrow(/reservad/i);
  await expect(
    startSession(
      db,
      {
        questions: [{ ...q, difficulty: undefined }],
        mode: "assessment",
        purpose: "benchmark",
        durationMs: 60000,
      },
      now,
    ),
  ).rejects.toThrow(/dificuldade/i);
  expect(await db.sessions.count()).toBe(0);
});

it("serializes two tabs consuming a reserved item and rejects already exposed sessions", async () => {
  const db = await database();
  const q = {
    ...readyQuestion(),
    assessmentOnly: true,
    difficulty: "medium" as const,
  };
  const input = {
    questions: [q],
    mode: "assessment" as const,
    purpose: "benchmark" as const,
    durationMs: 60000,
  };
  const results = await Promise.allSettled([
    startSession(db, input, now),
    startSession(db, input, now),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.sessions.count()).toBe(1);
  const session = (await db.sessions.toArray())[0];
  await db.sessions.put({
    ...session,
    status: "completed",
    completedAt: "2026-10-02T12:00:10.000Z",
  });
  await expect(
    startSession(db, input, "2026-10-02T12:01:00.000Z"),
  ).rejects.toThrow(/inédit|expost/i);
});

it("marks guided attempts as assisted durably, including idempotent retries and backup", async () => {
  const db = await database();
  const session = await startSession(
    db,
    {
      questions: [readyQuestion()],
      mode: "study",
      purpose: "guided",
      durationMs: null,
    },
    now,
  );
  const input = makeInput(session.id, { consulted: false });
  const attempt = await submitAttempt(db, input, now);
  expect(attempt.consulted).toBe(true);
  await completeStudySession(db, session.id, now);
  expect(await submitAttempt(db, input, now)).toEqual(attempt);
  const backup = await exportBackup(db, now);
  const restored = await database();
  expect((await previewImport(restored, backup)).valid).toBe(true);
  await mergeBackup(restored, backup);
  expect((await restored.attempts.toArray())[0].consulted).toBe(true);
});

it("captures committed feedback from another item with the same subject and skill", async () => {
  const db = await database();
  const first = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  const a = await submitAttempt(db, makeInput(first.id), now);
  await revealFeedback(db, a.id, now);
  const q2 = readyQuestion("second");
  const second = await startSession(
    db,
    { questions: [q2], mode: "study", durationMs: null },
    now,
  );
  const b = await submitAttempt(
    db,
    makeInput(second.id, { questionId: q2.id }),
    now,
  );
  expect(b.skillFeedback).toEqual([
    {
      subject: "matematica",
      skill: "fixture",
      at: now,
      studyDate: "2026-10-02",
    },
  ]);
  await revealFeedback(db, b.id, "2026-10-03T12:00:00.000Z");
  expect((await db.attempts.get(b.id))?.skillFeedback).toEqual(b.skillFeedback);
  const q3 = { ...readyQuestion("other-subject"), subject: "fisica" as const };
  const third = await startSession(
    db,
    { questions: [q3], mode: "study", durationMs: null },
    now,
  );
  expect(
    (await submitAttempt(db, makeInput(third.id, { questionId: q3.id }), now))
      .skillFeedback,
  ).toEqual([]);
  const restored = await database();
  const backup = await exportBackup(db, "2026-10-03T12:00:00.000Z");
  expect((await previewImport(restored, backup)).valid).toBe(true);
  const invalid = structuredClone(backup);
  invalid.data.attempts.find(
    (item) => item.id === b.id,
  )!.skillFeedback![0].skill = "forged";
  expect((await previewImport(restored, invalid)).valid).toBe(false);
});

it("accepts overdue reviews by actual minutes and restores them without a fraction cap", async () => {
  const db = await database();
  const settings = { ...defaultSettings, dailyMinutes: 60 as const };
  const plan = {
    date: "2026-10-02",
    tasks: Array.from({ length: 8 }, (_, i) => ({
      questionId: `q${i}`,
      minutes: 5,
      reason: "review" as const,
    })),
    deferredQuestionIds: [],
  };
  await updateDailyPlan(db, plan, settings);
  expect(await db.plans.get(plan.date)).toEqual(plan);
  const restored = await database();
  expect(
    (await previewImport(restored, await exportBackup(db, now))).valid,
  ).toBe(true);
  await expect(
    updateDailyPlan(
      db,
      { ...plan, tasks: plan.tasks.map((t) => ({ ...t, minutes: 10 })) },
      settings,
    ),
  ).rejects.toThrow(/capacidade/i);
});

it("restores legacy attempts without skills or new fields while keeping them out of new practice", async () => {
  const db = await database();
  const session = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  await submitAttempt(db, makeInput(session.id), now);
  const legacy = await exportBackup(db, now);
  legacy.data.questionSnapshots[0].skills = [];
  delete legacy.data.sessions[0].purpose;
  delete legacy.data.sessions[0].order;
  delete legacy.data.attempts[0].skillFeedback;
  const restored = await database();
  expect((await previewImport(restored, legacy)).valid).toBe(true);
  await mergeBackup(restored, legacy);
  expect((await restored.attempts.toArray())[0].skillFeedback).toBeUndefined();
});

it("records the feedback revision actually shown after a content correction", async () => {
  const db = await database();
  const q = readyQuestion();
  const s = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const a = await submitAttempt(db, makeInput(s.id), now);
  const revised = {
    ...q,
    revision: "v2",
    skills: ["new-skill"],
    key: { ...q.key!, revision: "key-v2" },
  };
  await regradeAttempt(db, a.id, revised, now);
  const event = await revealFeedback(db, a.id, now);
  expect(event.questionRevision).toBe("v2");
  const next = { ...readyQuestion("next"), skills: ["new-skill"] };
  const s2 = await startSession(
    db,
    { questions: [next], mode: "study", durationMs: null },
    now,
  );
  const b = await submitAttempt(
    db,
    makeInput(s2.id, { questionId: next.id }),
    now,
  );
  expect(b.skillFeedback).toHaveLength(1);
  expect(b.skillFeedback![0].skill).toBe("new-skill");
});

it("keeps skill exposure unknown after restoring feedback without its displayed revision", async () => {
  const db = await database();
  const q = { ...readyQuestion(), skills: ["old-skill"] };
  const session = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const attempt = await submitAttempt(db, makeInput(session.id), now);
  await regradeAttempt(
    db,
    attempt.id,
    {
      ...q,
      revision: "v2",
      skills: ["new-skill"],
      key: { ...q.key!, revision: "key-v2" },
    },
    now,
  );
  await revealFeedback(db, attempt.id, now);
  const legacy = await exportBackup(db, now);
  delete legacy.data.feedback[0].questionRevision;
  const restored = await database();
  await mergeBackup(restored, legacy);
  for (const skill of ["old-skill", "new-skill"]) {
    const next = { ...readyQuestion(skill), skills: [skill] };
    const nextSession = await startSession(
      restored,
      { questions: [next], mode: "study", durationMs: null },
      now,
    );
    const nextAttempt = await submitAttempt(
      restored,
      makeInput(nextSession.id, { questionId: next.id }),
      now,
    );
    expect(nextAttempt.skillFeedback).toBeUndefined();
  }
  const sameItem = await startSession(
    restored,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const retry = await submitAttempt(restored, makeInput(sameItem.id), now);
  expect(retry.priorFeedbackAt).toBe(now);
  expect(retry.priorFeedbackDate).toBe("2026-10-02");
  expect(retry.skillFeedback).toBeUndefined();
  const roundtrip = await database();
  expect(
    (await previewImport(roundtrip, await exportBackup(restored, now))).valid,
  ).toBe(true);
});

it("rejects skill baseline proof attributed to a legacy feedback revision", async () => {
  const db = await database();
  const session = await startSession(
    db,
    { questions: [readyQuestion()], mode: "study", durationMs: null },
    now,
  );
  const first = await submitAttempt(db, makeInput(session.id), now);
  await revealFeedback(db, first.id, now);
  const q = readyQuestion("next");
  const next = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  await submitAttempt(db, makeInput(next.id, { questionId: q.id }), now);
  const backup = await exportBackup(db, now);
  delete backup.data.feedback[0].questionRevision;
  const restored = await database();
  expect((await previewImport(restored, backup)).valid).toBe(false);
});

it("resolves legacy uncertainty only with later known exposure to every affected target skill", async () => {
  const db = await database();
  const q = { ...readyQuestion(), skills: ["old-skill"] };
  const first = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    now,
  );
  const attempt = await submitAttempt(db, makeInput(first.id), now);
  await regradeAttempt(
    db,
    attempt.id,
    {
      ...q,
      revision: "v2",
      skills: ["new-skill"],
      key: { ...q.key!, revision: "key-v2" },
    },
    now,
  );
  const legacyEvent = await revealFeedback(db, attempt.id, now);
  delete legacyEvent.questionRevision;
  await db.feedback.put(legacyEvent);
  const known = { ...readyQuestion("known"), skills: ["old-skill"] };
  const knownSession = await startSession(
    db,
    { questions: [known], mode: "study", durationMs: null },
    now,
  );
  const knownAttempt = await submitAttempt(
    db,
    makeInput(knownSession.id, { questionId: known.id }),
    now,
  );
  await revealFeedback(db, knownAttempt.id, now);
  const next = { ...readyQuestion("next"), skills: ["old-skill"] };
  const simultaneous = await startSession(
    db,
    { questions: [next], mode: "study", durationMs: null },
    now,
  );
  expect(
    (
      await submitAttempt(
        db,
        makeInput(simultaneous.id, { questionId: next.id }),
        now,
      )
    ).skillFeedback,
  ).toBeUndefined();
  const later = "2026-10-03T12:00:00.000Z";
  await revealFeedback(db, knownAttempt.id, later);
  const resolved = await startSession(
    db,
    { questions: [next], mode: "study", durationMs: null },
    later,
  );
  expect(
    (
      await submitAttempt(
        db,
        makeInput(resolved.id, { questionId: next.id }),
        later,
      )
    ).skillFeedback,
  ).toEqual([
    {
      subject: "matematica",
      skill: "old-skill",
      at: later,
      studyDate: "2026-10-03",
    },
  ]);
  const combined = {
    ...readyQuestion("combined"),
    skills: ["old-skill", "new-skill"],
  };
  const unresolved = await startSession(
    db,
    { questions: [combined], mode: "study", durationMs: null },
    later,
  );
  expect(
    (
      await submitAttempt(
        db,
        makeInput(unresolved.id, { questionId: combined.id }),
        later,
      )
    ).skillFeedback,
  ).toBeUndefined();
  const unrelated = {
    ...readyQuestion("unrelated"),
    subject: "fisica" as const,
    skills: ["old-skill"],
  };
  const otherSubject = await startSession(
    db,
    { questions: [unrelated], mode: "study", durationMs: null },
    later,
  );
  expect(
    (
      await submitAttempt(
        db,
        makeInput(otherSubject.id, { questionId: unrelated.id }),
        later,
      )
    ).skillFeedback,
  ).toEqual([]);
  const restored = await database();
  expect(
    (await previewImport(restored, await exportBackup(db, later))).valid,
  ).toBe(true);
});

it.each([now, "2026-10-02T11:59:00.000Z"])(
  "roundtrips study after a completed benchmark when its clock is %s",
  async (studyAt) => {
    const db = await database();
    const reserved = {
      ...readyQuestion(),
      assessmentOnly: true,
      difficulty: "medium" as const,
    };
    const benchmark = await startSession(
      db,
      {
        questions: [reserved],
        mode: "assessment",
        purpose: "benchmark",
        durationMs: 60000,
      },
      now,
    );
    await completeAssessment(db, benchmark.id, now);
    const released = {
      ...reserved,
      revision: "v2",
      assessmentOnly: false,
      key: { ...reserved.key!, revision: "key-v2" },
    };
    const practice = await startSession(
      db,
      { questions: [released], mode: "study", durationMs: null },
      studyAt,
    );
    expect(practice.order).toBeGreaterThan(benchmark.order!);
    await submitAttempt(
      db,
      makeInput(practice.id, { questionRevision: "v2" }),
      studyAt,
    );
    const restored = await database();
    const backup = await exportBackup(db, now);
    expect((await previewImport(restored, backup)).valid).toBe(true);
    await mergeBackup(restored, backup);
    expect(await restored.sessions.count()).toBe(2);
    const invalid = structuredClone(backup);
    invalid.data.sessions.find((item) => item.id === practice.id)!.order =
      benchmark.order!;
    expect((await previewImport(await database(), invalid)).valid).toBe(false);
    await expect(
      startSession(
        restored,
        {
          questions: [reserved],
          mode: "assessment",
          purpose: "benchmark",
          durationMs: 60000,
        },
        now,
      ),
    ).rejects.toThrow(/inédit|expost/i);
  },
);

it("completes restored legacy assessments missing only skills and roundtrips their attempts", async () => {
  const db = await database();
  const session = await startSession(
    db,
    { questions: [readyQuestion()], mode: "assessment", durationMs: 60000 },
    now,
  );
  const legacy = await exportBackup(db, now);
  legacy.data.questionSnapshots[0].skills = [];
  delete legacy.data.sessions[0].purpose;
  delete legacy.data.sessions[0].order;
  const restored = await database();
  await mergeBackup(restored, legacy);
  await expect(
    startSession(
      restored,
      {
        questions: legacy.data.questionSnapshots,
        mode: "assessment",
        durationMs: 60000,
      },
      now,
    ),
  ).rejects.toThrow(/não pronta/i);
  expect((await completeAssessment(restored, session.id, now)).status).toBe(
    "completed",
  );
  expect((await restored.attempts.toArray())[0].skillFeedback).toBeUndefined();
  const again = await database();
  const completed = await exportBackup(restored, now);
  expect((await previewImport(again, completed)).valid).toBe(true);
  await mergeBackup(again, completed);
  expect((await again.sessions.get(session.id))?.status).toBe("completed");
});

it.each(["study", "assessment"] as const)(
  "continues responses in a restored legacy %s session missing only skills",
  async (mode) => {
    const db = await database();
    const session = await startSession(
      db,
      {
        questions: [readyQuestion()],
        mode,
        durationMs: mode === "assessment" ? 60000 : null,
      },
      now,
    );
    const legacy = await exportBackup(db, now);
    legacy.data.questionSnapshots[0].skills = [];
    delete legacy.data.sessions[0].purpose;
    delete legacy.data.sessions[0].order;
    const restored = await database();
    await mergeBackup(restored, legacy);
    const input = makeInput(session.id, { response: "B" });
    await saveDraft(restored, input, now);
    const attempt = await submitAttempt(restored, input, now);
    expect(attempt.response).toBe("B");
    expect(attempt.skillFeedback).toBeUndefined();
    if (mode === "assessment")
      await completeAssessment(restored, session.id, now);
    else await completeStudySession(restored, session.id, now);
    const completed = await exportBackup(restored, now);
    expect((await previewImport(await database(), completed)).valid).toBe(true);
  },
);

it.each([
  { mode: "study" as const, skills: [" "] },
  { mode: "assessment" as const, skills: [" "] },
  { mode: "study" as const, skills: ["fixture", " "] },
  { mode: "assessment" as const, skills: ["fixture", " "] },
])(
  "roundtrips resumed legacy $mode sessions with invalid skills $skills",
  async ({ mode, skills }) => {
    const db = await database();
    const session = await startSession(
      db,
      {
        questions: [readyQuestion()],
        mode,
        durationMs: mode === "assessment" ? 60000 : null,
      },
      now,
    );
    const legacy = await exportBackup(db, now);
    legacy.data.questionSnapshots[0].skills = skills;
    delete legacy.data.sessions[0].purpose;
    delete legacy.data.sessions[0].order;
    const restored = await database();
    await mergeBackup(restored, legacy);
    const input = makeInput(session.id, { response: "B" });
    await saveDraft(restored, input, now);
    const attempt = await submitAttempt(restored, input, now);
    expect(attempt.skillFeedback).toBeUndefined();
    if (mode === "assessment")
      await completeAssessment(restored, session.id, now);
    else await completeStudySession(restored, session.id, now);
    const backup = await exportBackup(restored, now);
    const roundtrip = await database();
    expect((await previewImport(roundtrip, backup)).valid).toBe(true);
    await mergeBackup(roundtrip, backup);
    expect((await roundtrip.attempts.get(attempt.id))?.response).toBe("B");
  },
);

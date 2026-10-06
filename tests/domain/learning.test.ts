import { describe, expect, it } from "vitest";
import { projectLearning } from "../../src/domain/learning";
import { defaultSettings } from "../../src/content/constants";
import { attempt, grade, history, session } from "./fixtures";
const policy = defaultSettings.reviewPolicy,
  now = "2026-11-01T12:00:00Z";
describe("learning gaps", () => {
  it.each([
    { response: null },
    { confidence: "low" },
    { doubt: true },
    { guessed: true },
    { usedHint: true },
    { consulted: true },
  ] as const)(
    "opens a gap for uncertain, assisted, or skipped answers: %j",
    (flags) => {
      const a = attempt(flags),
        p = projectLearning(history([a]), now, policy);
      expect(p.gaps[0]).toMatchObject({
        status: "open",
        cause: null,
        note: "",
        evidenceAttemptIds: [],
      });
      expect(p.reviews[0].dueDate).toBe("2026-10-05");
    },
  );
  it("opens an error gap without diagnosing its cause from time", () => {
    for (const activeMs of [1, 1000000]) {
      const a = attempt({ activeMs });
      expect(
        projectLearning(history([a], [grade(a, false)]), now, policy).gaps[0]
          .cause,
      ).toBe(null);
    }
  });
  it("schedules maintenance for an independent first success", () => {
    const p = projectLearning(history([attempt()]), now, policy);
    expect(p.gaps).toEqual([]);
    expect(p.reviews[0]).toMatchObject({
      kind: "maintenance",
      dueDate: "2026-10-16",
    });
  });
  it("publishes assessment results only after completion", () => {
    const a = attempt({ mode: "assessment" }),
      g = grade(a, false),
      s = session({ mode: "assessment" });
    expect(projectLearning(history([a], [g], [s]), now, policy)).toEqual({
      gaps: [],
      reviews: [],
    });
    expect(
      projectLearning(
        history([a], [g], [{ ...s, status: "completed", completedAt: a.at }]),
        now,
        policy,
      ).gaps,
    ).toHaveLength(1);
  });
  it("keeps a completed assessment private in projections before its completion instant", () => {
    const a = attempt({ mode: "assessment" }),
      completedAt = "2026-10-03T12:00:00Z",
      h = history(
        [a],
        [grade(a, false)],
        [
          session({
            mode: "assessment",
            status: "completed",
            completedAt,
          }),
        ],
      );
    expect(projectLearning(h, "2026-10-03T11:59:59Z", policy)).toEqual({
      gaps: [],
      reviews: [],
    });
    expect(projectLearning(h, completedAt, policy).gaps).toHaveLength(1);
  });
  it("uses the last explicit regrade and excludes annulled attempts", () => {
    const a = attempt();
    const p = projectLearning(
      history(
        [a],
        [
          grade(a),
          grade(a, false, {
            id: "g2",
            kind: "regrade",
            at: "2026-10-03T12:00:00Z",
          }),
        ],
      ),
      now,
      policy,
    );
    expect(p.gaps[0].status).toBe("open");
    expect(
      projectLearning(
        history(
          [a],
          [
            grade(a),
            grade(a, true, {
              id: "g3",
              correct: null,
              exclusionReason: "annulled",
              at: now,
            }),
          ],
        ),
        now,
        policy,
      ),
    ).toEqual({ gaps: [], reviews: [] });
  });
  it("opens the gap from the last of two opposite regrades at the same instant", () => {
    const a = attempt(),
      initial = grade(a, false, { order: 0 }),
      firstRegrade = grade(a, true, {
        id: "z-first-regrade",
        kind: "regrade",
        at: "2026-10-03T12:00:00Z",
        order: 1,
      }),
      lastRegrade = grade(a, false, {
        id: "a-last-regrade",
        kind: "regrade",
        at: "2026-10-03T12:00:00Z",
        order: 2,
      });
    expect(
      projectLearning(
        history([a], [lastRegrade, initial, firstRegrade]),
        now,
        policy,
      ),
    ).toMatchObject({
      gaps: [{ questionId: a.questionId, status: "open" }],
      reviews: [{ kind: "gap", dueDate: "2026-10-05" }],
    });
  });
});

describe("exam calendar", () => {
  it("caps new reviews at an upcoming exam without fabricating evidence", () => {
    const h = history([attempt()], [grade(attempt(), false)]);
    const p = projectLearning(h, now, policy, "2026-10-03");
    expect(p.reviews[0].dueDate).toBe("2026-10-03");
    expect(p.gaps[0].evidenceAttemptIds).toEqual([]);
    expect(p.gaps[0].status).toBe("open");
  });
  it("caps maintenance returns as well as gap returns", () => {
    expect(
      projectLearning(history([attempt()]), now, policy, "2026-10-04")
        .reviews[0].dueDate,
    ).toBe("2026-10-04");
  });
  it("preserves reviews generated after the exam rather than backdating them", () => {
    expect(
      projectLearning(history([attempt()]), now, policy, "2026-10-01")
        .reviews[0].dueDate,
    ).toBe("2026-10-16");
  });
  it("does not award retention when an exam-capped return is too early", () => {
    const first = attempt(),
      repeat = attempt({
        id: "a2",
        firstAttempt: false,
        at: "2026-10-03T12:00:00Z",
        studyDate: "2026-10-03",
      });
    const p = projectLearning(
      history([first, repeat], [grade(first, false), grade(repeat)]),
      now,
      policy,
      "2026-10-03",
    );
    expect(p.gaps[0]).toMatchObject({ status: "open", evidenceAttemptIds: [] });
  });
});

it("requires minimum spacing after the last immutable feedback baseline for retention", () => {
  const first = attempt(),
    repeat = attempt({
      id: "a2",
      firstAttempt: false,
      at: "2026-10-08T12:00:00Z",
      studyDate: "2026-10-08",
      priorFeedbackAt: "2026-10-07T12:00:00Z",
      priorFeedbackDate: "2026-10-07",
    });
  expect(
    projectLearning(
      history([first, repeat], [grade(first, false), grade(repeat)]),
      now,
      policy,
    ).gaps[0],
  ).toMatchObject({ status: "open", evidenceAttemptIds: [] });
});

import { describe, expect, it } from "vitest";
import { computeMetrics } from "../../src/domain/metrics";
import { attempt, grade, history, question, session } from "./fixtures";
import { defaultSettings } from "../../src/content/constants";
const filter = { from: "2026-10-01", to: "2026-10-31" };
describe("honest progress denominators", () => {
  it("separates first attempts, repeats, and assisted results", () => {
    const a = attempt(),
      b = attempt({
        id: "a2",
        firstAttempt: false,
        studyDate: "2026-10-05",
        at: "2026-10-05T12:00:00Z",
        consulted: true,
      });
    expect(
      computeMetrics(
        history([a, b], [grade(a, false), grade(b)]),
        [question()],
        filter,
      ),
    ).toMatchObject({
      newItems: 1,
      repeatAttempts: 1,
      firstAttemptCorrect: 0,
      firstAttemptTotal: 1,
      independentCorrect: 0,
      independentTotal: 1,
      assistedCorrect: 1,
      assistedTotal: 1,
      activeMs: 200,
      retentionEvidence: 0,
      transferEvidence: 0,
    });
  });
  it("finds the real first attempt before filtering the reporting period", () => {
    const a = attempt({ studyDate: "2026-09-30", at: "2026-09-30T12:00:00Z" }),
      b = attempt({ id: "a2", firstAttempt: false });
    expect(computeMetrics(history([a, b]), [question()], filter)).toMatchObject(
      { newItems: 0, repeatAttempts: 1, firstAttemptTotal: 0 },
    );
  });
  it("uses latest regrades, records decision revisions, and excludes annulments from denominators", () => {
    const a = attempt();
    const regrade = grade(a, false, {
      id: "g2",
      kind: "regrade",
      keyRevision: "k2",
      decisionRevision: "key:k2",
      at: "2026-10-03T12:00:00Z",
    });
    expect(
      computeMetrics(history([a], [grade(a), regrade]), [question()], filter),
    ).toMatchObject({
      firstAttemptCorrect: 0,
      keyRevisions: ["k2"],
      decisionRevisions: ["key:k2"],
    });
    const annulled = grade(a, true, {
      id: "g3",
      correct: null,
      kind: "regrade",
      keyRevision: null,
      decisionRevision: "annulment:c1",
      exclusionReason: "annulled",
      at: "2026-10-04T12:00:00Z",
    });
    expect(
      computeMetrics(
        history([a], [grade(a), regrade, annulled]),
        [question()],
        filter,
      ),
    ).toMatchObject({
      annulledExcluded: 1,
      firstAttemptTotal: 0,
      independentTotal: 0,
      activeMs: 100,
      keyRevisions: [],
      decisionRevisions: ["annulment:c1"],
    });
  });
  it("has zero denominators for empty history and active assessments", () => {
    expect(computeMetrics(history([]), [], filter)).toMatchObject({
      independentTotal: 0,
      firstAttemptTotal: 0,
    });
    const a = attempt({ mode: "assessment" }),
      s = session({ mode: "assessment" });
    expect(
      computeMetrics(history([a], [grade(a)], [s]), [question()], filter),
    ).toMatchObject({ newItems: 0, activeMs: 0, firstAttemptTotal: 0 });
  });
  it("excludes an annulment after an initial grade at the same instant", () => {
    const a = attempt(),
      initial = grade(a, false, { id: "z-initial", order: 0 }),
      annulled = grade(a, true, {
        id: "a-annulled",
        kind: "regrade",
        order: 1,
        correct: null,
        keyRevision: null,
        decisionRevision: "annulment:c1",
        exclusionReason: "annulled",
      });
    expect(
      computeMetrics(history([a], [annulled, initial]), [question()], filter),
    ).toMatchObject({
      annulledExcluded: 1,
      firstAttemptTotal: 0,
      independentTotal: 0,
      decisionRevisions: ["annulment:c1"],
    });
  });
  it("counts transfer only for a delayed new independent success with an immutable exposure baseline", () => {
    const a = attempt(),
      b = attempt({
        id: "a2",
        questionId: "test-q2",
        at: "2026-10-05T12:00:00Z",
        studyDate: "2026-10-05",
        skillFeedback: [],
      });
    const snapshots = [question(), question({ id: "test-q2" })];
    expect(
      computeMetrics(history([a, b]), snapshots, filter).transferEvidence,
    ).toBe(1);
    for (const flags of [
      { consulted: true },
      { confidence: "low" as const },
      { priorFeedbackAt: a.at, priorFeedbackDate: a.studyDate },
    ])
      expect(
        computeMetrics(history([a, { ...b, ...flags }]), snapshots, filter)
          .transferEvidence,
      ).toBe(0);
    expect(
      computeMetrics(
        history([a, b], [grade(a), grade(b, false)]),
        snapshots,
        filter,
      ).transferEvidence,
    ).toBe(0);
    expect(
      computeMetrics(
        history([a, b]),
        [question(), question({ id: "test-q2", skills: ["different"] })],
        filter,
      ).transferEvidence,
    ).toBe(0);
  });
  it("counts retention without giving later feedback the power to invalidate it", () => {
    const a = attempt(),
      b = attempt({
        id: "a2",
        firstAttempt: false,
        at: "2026-10-05T12:00:00Z",
        studyDate: "2026-10-05",
        priorFeedbackAt: a.at,
        priorFeedbackDate: a.studyDate,
      });
    const h = history([a, b], [grade(a, false), grade(b)]);
    h.feedback.push({
      id: "fb",
      attemptId: b.id,
      questionId: b.questionId,
      at: "2026-10-05T12:01:00Z",
      studyDate: b.studyDate,
    });
    expect(computeMetrics(h, [question()], filter).retentionEvidence).toBe(1);
  });
  it("does not infer prior introduction from simultaneous submissions", () => {
    const a = attempt(),
      b = attempt({ id: "a2", questionId: "test-q2" });
    expect(
      computeMetrics(
        history([a, b]),
        [question(), question({ id: "test-q2" })],
        filter,
      ).transferEvidence,
    ).toBe(0);
  });
  it("does not relabel a later study attempt as first while the original assessment is closed", () => {
    const a = attempt({ mode: "assessment" }),
      b = attempt({
        id: "a2",
        firstAttempt: false,
        at: "2026-10-03T12:00:00Z",
        studyDate: "2026-10-03",
      });
    expect(
      computeMetrics(
        history([a, b], undefined, [session({ mode: "assessment" })]),
        [question()],
        filter,
      ),
    ).toMatchObject({ firstAttemptTotal: 0, newItems: 0, repeatAttempts: 1 });
  });
  it("applies the learner review interval to retention counts", () => {
    const a = attempt(),
      b = attempt({
        id: "a2",
        firstAttempt: false,
        at: "2026-10-05T12:00:00Z",
        studyDate: "2026-10-05",
      });
    const h = history([a, b], [grade(a, false), grade(b)]);
    const policy = { ...defaultSettings.reviewPolicy, minEvidenceDays: 7 };
    expect(
      computeMetrics(h, [question()], filter, policy).retentionEvidence,
    ).toBe(0);
  });
  it("preserves the immutable first submission when two attempts share a timestamp", () => {
    const original = attempt({ id: "z-original" }),
      repeat = attempt({ id: "a-repeat", firstAttempt: false });
    expect(
      computeMetrics(
        history([repeat, original], [grade(original, false), grade(repeat)]),
        [question()],
        filter,
      ),
    ).toMatchObject({
      firstAttemptCorrect: 0,
      firstAttemptTotal: 1,
      repeatAttempts: 1,
    });
  });
});

describe("delayed skill application", () => {
  const first = attempt({ skillFeedback: [] });
  const later = attempt({
    id: "a2",
    questionId: "test-q2",
    at: "2026-10-05T12:00:00Z",
    studyDate: "2026-10-05",
    skillFeedback: [],
  });
  const snapshots = [question(), question({ id: "test-q2" })];
  it("rejects immediate successes and submissions without exposure baselines", () => {
    for (const candidate of [
      { ...later, at: "2026-10-03T12:00:00Z", studyDate: "2026-10-03" },
      { ...later, skillFeedback: undefined },
      { ...later, questionId: first.questionId, firstAttempt: false },
    ])
      expect(
        computeMetrics(history([first, candidate]), snapshots, filter)
          .transferEvidence,
      ).toBe(0);
  });
  it("keeps an opportunity denominator including independent incorrect work", () => {
    expect(
      computeMetrics(
        history([first, later], [grade(first), grade(later, false)]),
        snapshots,
        filter,
      ),
    ).toMatchObject({
      transferEvidence: 0,
      transferOpportunities: 1,
      skillEvidence: [
        {
          subject: "matematica",
          skill: "skill",
          opportunities: 1,
          correct: 0,
          distinctItems: 1,
          dates: [later.studyDate],
          consistent: false,
        },
      ],
    });
  });
  it("requires the configured delay after shared skill feedback", () => {
    const candidate = {
      ...later,
      skillFeedback: [
        {
          subject: "matematica" as const,
          skill: "skill",
          at: "2026-10-04T12:00:00Z",
          studyDate: "2026-10-04",
        },
      ],
    };
    expect(
      computeMetrics(history([first, candidate]), snapshots, filter)
        .transferEvidence,
    ).toBe(0);
    expect(
      computeMetrics(history([first, later]), snapshots, filter, {
        ...defaultSettings.reviewPolicy,
        minEvidenceDays: 7,
      }).transferEvidence,
    ).toBe(0);
  });
  it("does not let feedback persisted after submission rewrite its evidence", () => {
    const h = history([first, later]);
    h.feedback.push({
      id: "fb",
      attemptId: first.id,
      questionId: first.questionId,
      at: "2026-10-05T12:01:00Z",
      studyDate: later.studyDate,
    });
    expect(computeMetrics(h, snapshots, filter).transferEvidence).toBe(1);
  });
  it("scopes introductions by subject even when skill labels match", () => {
    expect(
      computeMetrics(
        history([first, later]),
        [question(), question({ id: "test-q2", subject: "fisica" })],
        filter,
      ).transferEvidence,
    ).toBe(0);
  });
  it("requires two separated successful evidence items for a consistent signal", () => {
    const third = attempt({
      id: "a3",
      questionId: "test-q3",
      at: "2026-10-08T12:00:00Z",
      studyDate: "2026-10-08",
      skillFeedback: [],
    });
    const allSnapshots = [...snapshots, question({ id: "test-q3" })];
    expect(
      computeMetrics(history([first, later]), snapshots, filter)
        .skillEvidence[0].consistent,
    ).toBe(false);
    expect(
      computeMetrics(history([first, later, third]), allSnapshots, filter)
        .skillEvidence[0],
    ).toMatchObject({
      opportunities: 2,
      correct: 2,
      distinctItems: 2,
      dates: [later.studyDate, third.studyDate],
      consistent: true,
    });
    expect(
      computeMetrics(
        history([
          first,
          later,
          { ...third, at: "2026-10-05T13:00:00Z", studyDate: later.studyDate },
        ]),
        allSnapshots,
        filter,
      ).skillEvidence[0].consistent,
    ).toBe(false);
  });
  it("preserves declared difficulty comparisons without treating all items as equivalent", () => {
    expect(
      computeMetrics(
        history([first, later]),
        [
          question({ difficulty: "easy" }),
          question({ id: "test-q2", difficulty: "hard" }),
        ],
        filter,
      ).skillEvidence[0].difficultyComparisons,
    ).toEqual([{ from: "easy", to: "hard", opportunities: 1, correct: 1 }]);
  });
  it("uses only released attempts and grading decisions available as of the report", () => {
    const completedAt = "2026-10-06T12:00:00Z";
    const candidate = { ...later, mode: "assessment" as const };
    const h = history(
      [first, candidate],
      [
        grade(first),
        grade(candidate),
        grade(candidate, false, {
          id: "regrade",
          kind: "regrade",
          at: "2026-10-07T12:00:00Z",
        }),
      ],
      [session({ mode: "assessment", status: "completed", completedAt })],
    );
    expect(
      computeMetrics(
        h,
        snapshots,
        filter,
        defaultSettings.reviewPolicy,
        later.at,
      ).transferEvidence,
    ).toBe(0);
    expect(
      computeMetrics(
        h,
        snapshots,
        filter,
        defaultSettings.reviewPolicy,
        completedAt,
      ).transferEvidence,
    ).toBe(1);
    expect(
      computeMetrics(
        h,
        snapshots,
        filter,
        defaultSettings.reviewPolicy,
        "2026-10-07T12:00:00Z",
      ).transferEvidence,
    ).toBe(0);
  });
  it("filters evidence opportunities by period without losing the earlier introduction", () => {
    expect(
      computeMetrics(history([first, later]), snapshots, {
        from: later.studyDate,
        to: later.studyDate,
      }),
    ).toMatchObject({
      transferEvidence: 1,
      transferOpportunities: 1,
    });
    expect(
      computeMetrics(history([first, later]), snapshots, {
        from: first.studyDate,
        to: first.studyDate,
      }),
    ).toMatchObject({
      transferEvidence: 0,
      transferOpportunities: 0,
    });
  });
});

it("does not show unrelated skill rows for a topic outside the report", () => {
  const first = attempt({ skillFeedback: [] }),
    later = attempt({
      id: "a2",
      questionId: "test-q2",
      at: "2026-10-05T12:00:00Z",
      studyDate: "2026-10-05",
      skillFeedback: [],
    });
  expect(
    computeMetrics(
      history([first, later]),
      [question(), question({ id: "test-q2" })],
      { ...filter, topic: "another-topic" },
    ),
  ).toMatchObject({
    transferEvidence: 0,
    transferOpportunities: 0,
    skillEvidence: [],
  });
});

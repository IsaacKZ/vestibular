import { describe, expect, it } from "vitest";
import { buildDailyPlan, estimateTaskMinutes } from "../../src/domain/planning";
import { defaultSettings, subjects } from "../../src/content/constants";
import { attempt, history, question, session } from "./fixtures";
import type { LearningProjection } from "../../src/content/types";
const items = Array.from({ length: 30 }, (_, i) => question({ id: `q${i}` }));
const projection: LearningProjection = {
  gaps: [],
  reviews: items.slice(0, 20).map((q) => ({
    questionId: q.id,
    dueDate: "2026-10-01",
    kind: "gap",
    lastEvidenceDate: null,
  })),
};
describe("daily capacity", () => {
  it("fills capacity with overdue reviews before introducing new items", () => {
    const p = buildDailyPlan(
      items,
      history([]),
      projection,
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks).toHaveLength(12);
    expect(p.tasks.every((t) => t.reason === "review")).toBe(true);
    expect(p.tasks.reduce((sum, t) => sum + t.minutes, 0)).toBe(120);
    expect(p.deferredQuestionIds).toHaveLength(8);
    expect(projection.reviews[0].dueDate).toBe("2026-10-01");
  });
  it("interleaves five subjects and different skills even when IDs group the catalogue", () => {
    const grouped = subjects.flatMap((subject, s) =>
      Array.from({ length: 12 }, (_, i) =>
        question({
          id: `${s}-${i}`,
          subject,
          originalNumber: i + 1,
          skills: [i < 6 ? "method-a" : "method-b"],
        }),
      ),
    );
    const p = buildDailyPlan(
      grouped,
      history([]),
      { gaps: [], reviews: [] },
      defaultSettings,
      "2026-10-02",
    );
    const selected = p.tasks.map((t) =>
      grouped.find((q) => q.id === t.questionId)!,
    );
    expect(new Set(selected.slice(0, 5).map((q) => q.subject))).toEqual(
      new Set(subjects),
    );
    for (const subject of subjects) {
      expect(
        new Set(
          selected
            .filter((q) => q.subject === subject)
            .flatMap((q) => q.skills),
        ),
      ).toEqual(new Set(["method-a", "method-b"]));
    }
  });
  it("uses median active time with a correction margin and fits actual minutes", () => {
    const timed = [5, 9, 25].map((minutes, i) =>
      attempt({ id: `a${i}`, activeMs: minutes * 60_000 }),
    );
    const p = buildDailyPlan(
      [
        question(),
        ...Array.from({ length: 8 }, (_, i) => question({ id: `new-${i}` })),
      ],
      history(timed),
      {
        gaps: [],
        reviews: [
          {
            questionId: "test-q1",
            dueDate: "2026-10-01",
            kind: "gap",
            lastEvidenceDate: null,
          },
        ],
      },
      { ...defaultSettings, dailyMinutes: 30 },
      "2026-10-02",
    );
    expect(p.tasks.map((t) => t.minutes)).toEqual([12, 12]);
    expect(
      p.tasks.reduce((total, t) => total + t.minutes, 0),
    ).toBeLessThanOrEqual(30);
  });
  it("clamps estimates to five and thirty minutes and retains the twelve-task ceiling", () => {
    const fast = question({ id: "fast" });
    const slow = question({ id: "slow" });
    const projection: LearningProjection = {
      gaps: [],
      reviews: [fast, slow].map((q) => ({
        questionId: q.id,
        dueDate: "2026-10-01",
        kind: "gap",
        lastEvidenceDate: null,
      })),
    };
    const p = buildDailyPlan(
      [fast, slow],
      history([
        attempt({ questionId: "fast", activeMs: 60_000 }),
        attempt({
          id: "slow-attempt",
          questionId: "slow",
          activeMs: 60 * 60_000,
        }),
      ]),
      projection,
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks.map((t) => t.minutes)).toEqual([5, 30]);
    const fastHistory = history([attempt({ activeMs: 60_000 })]);
    expect(
      buildDailyPlan(
        items,
        fastHistory,
        { gaps: [], reviews: [] },
        defaultSettings,
        "2026-10-02",
      ).tasks,
    ).toHaveLength(12);
  });
  it("ignores unreleased assessment times when estimating the load", () => {
    const h = history(
      [attempt({ mode: "assessment", activeMs: 60 * 60_000 })],
      [],
      [session({ mode: "assessment" })],
    );
    const p = buildDailyPlan(
      [question()],
      h,
      { gaps: [], reviews: [] },
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks[0].minutes).toBe(10);
  });
  it("does not use spare minutes for new items while a due review remains deferred", () => {
    const qs = [
      question({ id: "r1" }),
      question({ id: "r2" }),
      question({ id: "seen-fast", subject: "biologia" }),
      question({ id: "new-fast", subject: "biologia" }),
    ];
    const h = history([
      attempt({ questionId: "r1", activeMs: 20 * 60_000 }),
      attempt({ id: "a2", questionId: "r2", activeMs: 20 * 60_000 }),
      attempt({ id: "a3", questionId: "seen-fast", activeMs: 60_000 }),
    ]);
    const p = buildDailyPlan(
      qs,
      h,
      {
        gaps: [],
        reviews: ["r1", "r2"].map((questionId) => ({
          questionId,
          dueDate: "2026-10-01",
          kind: "gap",
          lastEvidenceDate: null,
        })),
      },
      { ...defaultSettings, dailyMinutes: 30 },
      "2026-10-02",
    );
    expect(p.tasks.map((t) => t.questionId)).toEqual(["r1"]);
    expect(p.deferredQuestionIds).toEqual(["r2"]);
  });
  it("excludes reserved items from both overdue and new tasks", () => {
    const reserved = { ...question({ id: "reserved" }), assessmentOnly: true };
    const p = buildDailyPlan(
      [reserved, question({ id: "practice" })],
      history([]),
      {
        gaps: [],
        reviews: [
          {
            questionId: "reserved",
            dueDate: "2026-10-01",
            kind: "gap",
            lastEvidenceDate: null,
          },
        ],
      },
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks.map((t) => t.questionId)).toEqual(["practice"]);
  });
  it("keeps future attempts from changing an earlier plan or marking new items seen", () => {
    const qs = [question({ id: "new" }), question({ id: "other" })];
    const before = buildDailyPlan(
      qs,
      history([]),
      { gaps: [], reviews: [] },
      defaultSettings,
      "2026-10-02",
    );
    const later = history([
      attempt({
        questionId: "new",
        at: "2026-10-05T12:00:00Z",
        studyDate: "2026-10-05",
        activeMs: 60 * 60_000,
      }),
    ]);
    expect(
      buildDailyPlan(
        qs,
        later,
        { gaps: [], reviews: [] },
        defaultSettings,
        "2026-10-02",
      ),
    ).toEqual(before);
  });
  it("does not use an assessment released after the plan date", () => {
    const h = history(
      [attempt({ mode: "assessment", activeMs: 60 * 60_000 })],
      [],
      [
        session({
          mode: "assessment",
          status: "completed",
          completedAt: "2026-10-05T12:00:00Z",
        }),
      ],
    );
    const p = buildDailyPlan(
      [question()],
      h,
      { gaps: [], reviews: [] },
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks).toEqual([
      { questionId: "test-q1", reason: "new", minutes: 10 },
    ]);
  });
  it("uses the attempted revision's immutable subject and skills for timing groups", () => {
    const target = question({ id: "target" });
    const original = question({
      id: "changed",
      subject: "matematica",
      skills: ["skill"],
    });
    const current = question({
      id: "changed",
      revision: "r2",
      subject: "biologia",
      skills: ["other"],
    });
    const other = question({
      id: "other",
      subject: "biologia",
      skills: ["other"],
    });
    const h = history([
      attempt({ questionId: "changed", activeMs: 20 * 60_000 }),
      attempt({ id: "short", questionId: "other", activeMs: 60_000 }),
    ]);
    expect(
      estimateTaskMinutes(
        target,
        h,
        [target, current, other],
        "2026-10-02",
        "UTC",
        [original, other],
      ),
    ).toBe(25);
  });
  it("respects thirty minutes, days off, empty and blocked catalogues", () => {
    expect(
      buildDailyPlan(
        items,
        history([]),
        projection,
        { ...defaultSettings, dailyMinutes: 30 },
        "2026-10-02",
      ).tasks,
    ).toHaveLength(3);
    expect(
      buildDailyPlan(
        items,
        history([]),
        projection,
        defaultSettings,
        "2026-10-03",
      ).tasks,
    ).toEqual([]);
    expect(
      buildDailyPlan(
        [],
        history([]),
        { gaps: [], reviews: [] },
        defaultSettings,
        "2026-10-02",
      ).tasks,
    ).toEqual([]);
    expect(
      buildDailyPlan(
        [question({ key: null })],
        history([]),
        { gaps: [], reviews: [] },
        defaultSettings,
        "2026-10-02",
      ).tasks,
    ).toEqual([]);
  });
  it("prioritizes open gaps, then maintenance, then unattempted questions with unique IDs", () => {
    const p = buildDailyPlan(
      [
        question({ id: "new" }),
        question({ id: "gap" }),
        question({ id: "maintenance" }),
      ],
      history([]),
      {
        gaps: [
          {
            questionId: "gap",
            status: "open",
            cause: null,
            note: "",
            evidenceAttemptIds: [],
            lastFailureDate: "2026-10-02",
          },
        ],
        reviews: [
          {
            questionId: "maintenance",
            kind: "maintenance",
            dueDate: "2026-10-02",
            lastEvidenceDate: "2026-09-18",
          },
        ],
      },
      defaultSettings,
      "2026-10-02",
    );
    expect(p.tasks.map((t) => t.reason)).toEqual(["gap", "maintenance", "new"]);
  });
  it("does not turn future gap returns into immediate attempts", () => {
    const gap = {
      questionId: "gap",
      status: "in_review" as const,
      cause: null,
      note: "",
      evidenceAttemptIds: ["e1"],
      lastFailureDate: "2026-10-02",
    };
    const p = buildDailyPlan(
      [question({ id: "gap" }), question({ id: "new" })],
      history([]),
      {
        gaps: [gap],
        reviews: [
          {
            questionId: "gap",
            dueDate: "2026-10-19",
            kind: "gap",
            lastEvidenceDate: "2026-10-05",
          },
        ],
      },
      defaultSettings,
      "2026-10-06",
    );
    expect(p.tasks.map((t) => t.questionId)).toEqual(["new"]);
  });
});

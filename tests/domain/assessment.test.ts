import { describe, expect, it } from "vitest";
import { selectAssessment } from "../../src/domain/assessment";
import { subjects } from "../../src/content/constants";
import { attempt, history, question, session } from "./fixtures";
const config = {
  count: 2,
  durationMinutes: 30,
  subjects: ["matematica"] as const,
  edition: null,
};
describe("partial assessment selection", () => {
  it("fails insufficient ready inventory without manufacturing questions", () => {
    expect(() =>
      selectAssessment(
        [question()],
        { ...config, subjects: [...config.subjects] },
        7,
      ),
    ).toThrow("Questões prontas insuficientes");
  });
  it("selects only unique ready matching items reproducibly", () => {
    const a = question({ id: "a" }),
      b = question({ id: "b" }),
      c = question({ id: "c" });
    const items = [
      a,
      a,
      b,
      c,
      question({ id: "blocked", key: null }),
      question({ id: "bio", subject: "biologia" }),
    ];
    const cfg = { ...config, subjects: [...config.subjects] };
    const selection = selectAssessment(items, cfg, 7);
    expect(selection).toEqual(selectAssessment(items, cfg, 7));
    expect(new Set(selection.map((q) => q.id)).size).toBe(2);
    expect(selection.every((q) => ["a", "b", "c"].includes(q.id))).toBe(true);
    expect(() =>
      selectAssessment(items, { ...cfg, edition: "missing" }, 7),
    ).toThrow();
  });
  it("rejects invalid count and duration", () => {
    for (const cfg of [
      { ...config, count: 0 },
      { ...config, count: 1.5 },
      { ...config, durationMinutes: 0 },
    ])
      expect(() =>
        selectAssessment([], { ...cfg, subjects: [...cfg.subjects] }, 7),
      ).toThrow();
  });
  it("excludes reserved questions from legacy practice selections", () => {
    expect(() =>
      selectAssessment(
        [question({ assessmentOnly: true })],
        { ...config, count: 1, subjects: [...config.subjects] },
        7,
      ),
    ).toThrow("Questões prontas insuficientes");
  });
  it("uses only ready reserved items with declared difficulty and skills for benchmarks", () => {
    const items = [
      question({ id: "valid", assessmentOnly: true, difficulty: "medium" }),
      question({ id: "practice", difficulty: "medium" }),
      question({ id: "unknown", assessmentOnly: true }),
      question({
        id: "unskilled",
        assessmentOnly: true,
        difficulty: "medium",
        skills: [],
      }),
      question({
        id: "blocked",
        assessmentOnly: true,
        difficulty: "medium",
        key: null,
      }),
    ];
    expect(
      selectAssessment(
        items,
        {
          ...config,
          count: 1,
          subjects: [...config.subjects],
          purpose: "benchmark",
        },
        7,
      ).map((q) => q.id),
    ).toEqual(["valid"]);
  });
  it("filters declared difficulty for either purpose", () => {
    const items = [
      question({ id: "easy", difficulty: "easy" }),
      question({ id: "hard", difficulty: "hard" }),
      question({ id: "unknown" }),
    ];
    expect(
      selectAssessment(
        items,
        {
          ...config,
          count: 1,
          subjects: [...config.subjects],
          difficulty: "hard",
        },
        7,
      ).map((q) => q.id),
    ).toEqual(["hard"]);
    expect(() =>
      selectAssessment(
        items,
        { ...config, subjects: [...config.subjects], difficulty: "hard" },
        7,
      ),
    ).toThrow("Questões prontas insuficientes");
  });
  it.each([
    "attempt",
    "feedback",
    "active unanswered session",
    "completed session",
  ])("never reuses a benchmark item exposed by %s", (exposure) => {
    const seen = question({
      id: "seen",
      assessmentOnly: true,
      difficulty: "easy",
    });
    const unseen = question({
      id: "unseen",
      assessmentOnly: true,
      difficulty: "easy",
    });
    const prior = history([]);
    if (exposure === "attempt")
      prior.attempts = [attempt({ questionId: seen.id })];
    else if (exposure === "feedback")
      prior.feedback = [
        {
          id: "f",
          attemptId: "a",
          questionId: seen.id,
          at: "2026-10-02T12:00:00Z",
          studyDate: "2026-10-02",
        },
      ];
    else
      prior.sessions = [
        session({
          questions: [{ id: seen.id, revision: "old" }],
          status: exposure === "completed session" ? "completed" : "active",
        }),
      ];
    const cfg = {
      ...config,
      count: 1,
      subjects: [...config.subjects],
      purpose: "benchmark" as const,
    };
    expect(
      selectAssessment([seen, unseen], cfg, 7, prior).map((q) => q.id),
    ).toEqual(["unseen"]);
    expect(() =>
      selectAssessment([seen, unseen], { ...cfg, count: 2 }, 7, prior),
    ).toThrow("Questões reservadas inéditas insuficientes");
  });
  it("distributes selection across available subjects before taking a second item", () => {
    const items = [
      ...Array.from({ length: 15 }, (_, i) => question({ id: `a-${i}` })),
      ...subjects
        .filter((s) => s !== "matematica")
        .map((subject) => question({ id: subject, subject })),
    ];
    for (const seed of [1, 7, 42]) {
      const selected = selectAssessment(
        items,
        { ...config, count: 5, subjects: [...subjects] },
        seed,
      );
      expect(new Set(selected.map((q) => q.subject)).size).toBe(5);
    }
  });
});

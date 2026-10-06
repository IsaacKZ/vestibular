import { expect, test } from "vitest";
import { defaultSettings } from "../../src/content/constants";
import { fitDailyPlan } from "../../src/features/today/fitDailyPlan";
import type { DailyPlan } from "../../src/content/types";
test("reducing a saved plan preserves overdue priority, date and deferred items", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: Array.from({ length: 12 }, (_, i) => ({
      questionId: `question-${i}`,
      minutes: 10,
      reason: i < 4 ? "review" : "new",
    })),
    deferredQuestionIds: ["overdue-older"],
  };
  const result = fitDailyPlan(saved, { ...defaultSettings, dailyMinutes: 30 });
  expect(result.tasks.map((t) => t.questionId)).toEqual([
    "question-0",
    "question-1",
    "question-2",
  ]);
  expect(result.date).toBe(saved.date);
  expect(result.deferredQuestionIds).toContain("overdue-older");
  expect(result.deferredQuestionIds).toContain("question-3");
  expect(
    result.deferredQuestionIds.some((id) =>
      result.tasks.some((t) => t.questionId === id),
    ),
  ).toBe(false);
  expect(saved.tasks).toHaveLength(12);
});
test("fits variable durations by actual minutes while allowing all eight reviews", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: [5, 5, 10, 10, 15, 15, 25, 30].map((minutes, i) => ({
      questionId: `r${i}`,
      minutes,
      reason: "review",
    })),
    deferredQuestionIds: ["older"],
  };
  const result = fitDailyPlan(saved, defaultSettings);
  expect(result.tasks).toHaveLength(8);
  expect(result.tasks.reduce((total, t) => total + t.minutes, 0)).toBe(115);
  expect(result.deferredQuestionIds).toEqual(["older"]);
});
test("keeps twelve tasks as a separate limit for short estimates", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: Array.from({ length: 15 }, (_, i) => ({
      questionId: `q${i}`,
      minutes: 5,
      reason: "new",
    })),
    deferredQuestionIds: [],
  };
  const result = fitDailyPlan(saved, defaultSettings);
  expect(result.tasks).toHaveLength(12);
  expect(result.deferredQuestionIds).toEqual(["q12", "q13", "q14"]);
});
test("retains short tasks after a long task exceeds the actual budget", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: [25, 10, 5].map((minutes, i) => ({
      questionId: `q${i}`,
      minutes,
      reason: "review",
    })),
    deferredQuestionIds: [],
  };
  const result = fitDailyPlan(saved, { ...defaultSettings, dailyMinutes: 30 });
  expect(result.tasks.map((t) => t.questionId)).toEqual(["q0", "q2"]);
  expect(result.deferredQuestionIds).toEqual(["q1"]);
});

test("does not introduce new tasks into spare time while a review cannot fit", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: [
      { questionId: "first", minutes: 25, reason: "review" },
      { questionId: "deferred-review", minutes: 10, reason: "review" },
      { questionId: "new", minutes: 5, reason: "new" },
    ],
    deferredQuestionIds: [],
  };
  const result = fitDailyPlan(saved, { ...defaultSettings, dailyMinutes: 30 });
  expect(result.tasks.map((task) => task.questionId)).toEqual(["first"]);
  expect(result.deferredQuestionIds).toEqual(["deferred-review", "new"]);
});

test("reserves reduced capacity for reviews even when the saved order puts a new task first", () => {
  const saved: DailyPlan = {
    date: "2026-10-02",
    tasks: [
      { questionId: "new", minutes: 25, reason: "new" },
      { questionId: "review", minutes: 10, reason: "review" },
    ],
    deferredQuestionIds: [],
  };
  const result = fitDailyPlan(saved, { ...defaultSettings, dailyMinutes: 30 });
  expect(result.tasks).toEqual([saved.tasks[1]]);
  expect(result.deferredQuestionIds).toEqual(["new"]);
});

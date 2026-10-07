import { expect, test } from "vitest";
import type { ErrorCause, QuestionRevision } from "../../src/content/types";
import {
  learningSupport,
  remediationAction,
  selectRemediationQuestions,
} from "../../src/domain/remediation";
import { question } from "./fixtures";

const learning = {
  concept: "Reviewed concept",
  workedExample: "Reviewed worked example",
  prerequisites: [{ subject: "fisica" as const, skill: "units" }],
  reviewed: true,
  source: "Reviewed source",
  reviewer: "Reviewer",
};

test("each diagnosed cause supplies a short, distinct action and self explanation", () => {
  const causes: ErrorCause[] = [
    "concept",
    "method",
    "prerequisite",
    "calculation",
    "interpretation",
    "time",
  ];
  const actions = causes.map(remediationAction);
  expect(new Set(actions.map((a) => a.action)).size).toBe(6);
  expect(new Set(actions.map((a) => a.selfExplanation)).size).toBe(6);
  expect(remediationAction("calculation").action).toMatch(/sinal|cálculo/);
  expect(remediationAction("interpretation").action).toMatch(
    /unidade|enunciado/,
  );
  expect(remediationAction(null).selfExplanation).toMatch(/Qual etapa/);
});

test("reviewed learning requires source and reviewer, then falls back to a reviewed explanation", () => {
  const q = question({ learning });
  expect(learningSupport(q)).toMatchObject({
    kind: "learning",
    concept: learning.concept,
    workedExample: learning.workedExample,
  });
  expect(
    learningSupport(question({ learning: { ...learning, source: " " } })),
  ).toMatchObject({ kind: "explanation", text: "Synthetic explanation" });
  expect(
    learningSupport(question({ learning: { ...learning, reviewer: " " } })),
  ).toMatchObject({ kind: "explanation" });
  expect(
    learningSupport(question({ learning: { ...learning, reviewed: false } })),
  ).toMatchObject({ kind: "explanation" });
  expect(
    learningSupport(
      question({
        learning: { ...learning, reviewed: false },
        explanation: { ...q.explanation!, reviewed: false },
      }),
    ),
  ).toBeNull();
  expect(
    learningSupport(
      question({ explanation: { ...q.explanation!, source: " " } }),
    ),
  ).toBeNull();
});

test("followup is a different ready item with a shared skill in the same subject", () => {
  const current = question();
  const shared = question({ id: "shared", skills: ["other", "skill"] });
  const catalogue: QuestionRevision[] = [
    current,
    question({ id: "different-skill", skills: ["unrelated"] }),
    question({ id: "different-subject", subject: "fisica" }),
    question({ id: "reserved", assessmentOnly: true }),
    question({
      id: "blocked",
      quality: { ...current.quality, reviewed: false },
    }),
    question({ id: "protected" }),
    shared,
    shared,
  ];
  expect(
    selectRemediationQuestions(current, catalogue, "followup", [
      "protected",
    ]).map((q) => q.id),
  ).toEqual(["shared"]);
});

test("prerequisite uses only reviewed links and matches both subject and skill", () => {
  const current = question({ learning });
  const prerequisites = [
    question({ id: "wrong-subject", skills: ["units"] }),
    question({ id: "wrong-skill", subject: "fisica" }),
    question({
      id: "reserved",
      subject: "fisica",
      skills: ["units"],
      assessmentOnly: true,
    }),
    question({ id: "right", subject: "fisica", skills: ["units"] }),
  ];
  expect(
    selectRemediationQuestions(current, prerequisites, "prerequisite").map(
      (q) => q.id,
    ),
  ).toEqual(["right"]);
  expect(
    selectRemediationQuestions(
      question({ learning: { ...learning, reviewed: false } }),
      prerequisites,
      "prerequisite",
    ),
  ).toEqual([]);
  expect(
    selectRemediationQuestions(
      question({ learning: { ...learning, source: " " } }),
      prerequisites,
      "prerequisite",
    ),
  ).toEqual([]);
  expect(
    selectRemediationQuestions(question(), prerequisites, "prerequisite"),
  ).toEqual([]);
});

test("missing ready alternatives remains explicit instead of reusing the current item", () => {
  const q = question();
  expect(selectRemediationQuestions(q, [q], "followup")).toEqual([]);
});


test("unstarted items come first stably and exposed alternatives remain available", () => {
  const current = question({ learning });
  const items = ["seen-a", "new-a", "seen-b", "new-b"].map((id) => question({ id }));
  expect(selectRemediationQuestions(current, items, "followup", [], ["seen-a", "seen-b"]).map((q) => q.id))
    .toEqual(["new-a", "new-b", "seen-a", "seen-b"]);
  expect(selectRemediationQuestions(current, items, "followup", ["new-a", "new-b"], ["seen-a", "seen-b"]).map((q) => q.id))
    .toEqual(["seen-a", "seen-b"]);
  const links = items.map((q) => ({ ...q, subject: "fisica" as const, skills: ["units"] }));
  expect(selectRemediationQuestions(current, links, "prerequisite", [], ["seen-a", "seen-b"]).map((q) => q.id))
    .toEqual(["new-a", "new-b", "seen-a", "seen-b"]);
});

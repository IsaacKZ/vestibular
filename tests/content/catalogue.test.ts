import { describe, expect, it } from "vitest";
import { filterQuestions, buildMixedList } from "../../src/content/catalogue";
import { emptyHistory } from "../../src/content/constants";
import { readyQuestion } from "./fixtures";
import { attempt } from "../domain/fixtures";
describe("catalogue filtering and mixed lists", () => {
  it("uses OR within topics and AND between filter categories", () => {
    const q = readyQuestion();
    expect(
      filterQuestions([q], {
        topics: ["inexistente", "geometria"],
        skills: ["calcular"],
        subject: "matematica",
      }),
    ).toEqual([q]);
    expect(
      filterQuestions([q], { topics: ["geometria"], edition: "2025/1" }),
    ).toEqual([]);
  });
  it("separates inventory and readiness", () => {
    const q = readyQuestion(),
      blocked = readyQuestion({ id: "blocked", key: null });
    expect(filterQuestions([q, blocked], { readiness: "ready" })).toEqual([q]);
    expect(filterQuestions([q, blocked], { readiness: "blocked" })).toEqual([
      blocked,
    ]);
  });
  it("selects ready unique items reproducibly without filling with duplicates", () => {
    const q = readyQuestion(),
      blocked = readyQuestion({ id: "blocked", key: null });
    expect(buildMixedList([q, q, blocked], emptyHistory(), 10, 7)).toEqual([q]);
    const items = Array.from({ length: 12 }, (_, i) =>
      readyQuestion({ id: `q-${i}`, topics: [`topic-${i % 3}`] }),
    );
    expect(buildMixedList(items, emptyHistory(), 4, 7)).toEqual(
      buildMixedList([...items].reverse(), emptyHistory(), 4, 7),
    );
    expect(buildMixedList(items, emptyHistory(), 0, 7)).toEqual([]);
  });
  it("keeps biology terminology grouped by topic", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      readyQuestion({
        id: `bio-${i}`,
        subject: "biologia",
        topics: [i % 2 ? "botânica" : "ecologia"],
      }),
    );
    const list = buildMixedList(items, emptyHistory(), 6, 7);
    expect(
      list.slice(0, 3).every((q) => q.topics[0] === list[0].topics[0]),
    ).toBe(true);
    expect(list.slice(3).every((q) => q.topics[0] === list[3].topics[0])).toBe(
      true,
    );
  });
  it("alternates introduced exact topics instead of exhausting a single method", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      readyQuestion({
        id: `exact-${i}`,
        topics: [i < 3 ? "álgebra" : "geometria"],
      }),
    );
    const history = emptyHistory();
    const list = buildMixedList(items, history, 6, 7);
    expect(list[0].topics[0]).not.toBe(list[1].topics[0]);
    expect(list[2].topics[0]).not.toBe(list[3].topics[0]);
  });
  it("includes every available subject before a large biology block consumes the limit", () => {
    const items = [
      ...Array.from({ length: 14 }, (_, i) =>
        readyQuestion({
          id: `bio-${i}`,
          subject: "biologia",
          topics: ["ecologia"],
        }),
      ),
      ...(
        ["matematica", "fisica", "quimica", "portugues-literatura"] as const
      ).map((subject) =>
        readyQuestion({ id: subject, subject, topics: [subject] }),
      ),
    ];
    const list = buildMixedList(items, emptyHistory(), 10, 1);
    expect(list).toHaveLength(10);
    expect(new Set(list.map((q) => q.subject)).size).toBe(5);
    const bioPositions = list.flatMap((q, i) =>
      q.subject === "biologia" ? [i] : [],
    );
    expect(bioPositions.at(-1)! - bioPositions[0] + 1).toBe(
      bioPositions.length,
    );
  });
  it("alternates introduced skills within a shared exact topic", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      readyQuestion({
        id: `method-${i}`,
        topics: ["geometria"],
        skills: [i < 4 ? "calcular área" : "calcular volume"],
      }),
    );
    const history = emptyHistory();
    history.attempts = [0, 4].map((i) =>
      attempt({ questionId: `method-${i}` }),
    );
    const list = buildMixedList(items, history, 8, 7);
    expect(
      list.every((q, i) => i === 0 || q.skills[0] !== list[i - 1].skills[0]),
    ).toBe(true);
    expect(buildMixedList([...items].reverse(), history, 8, 7)).toEqual(list);
  });
  it("reserves other subjects even when many introduced biology topics lead the ranking", () => {
    const biology = Array.from({ length: 14 }, (_, i) =>
      readyQuestion({
        id: `bio-topic-${i}`,
        subject: "biologia",
        topics: [`biologia-${i}`],
      }),
    );
    const items = [
      ...biology,
      ...(
        ["matematica", "fisica", "quimica", "portugues-literatura"] as const
      ).map((subject) =>
        readyQuestion({ id: subject, subject, topics: [subject] }),
      ),
    ];
    const history = emptyHistory();
    history.attempts = biology.map((q) => attempt({ questionId: q.id }));
    const list = buildMixedList(items, history, 10, 1);
    expect(list).toHaveLength(10);
    expect(new Set(list.map((q) => q.subject)).size).toBe(5);
  });
  it("does not split the same introduced skill into adjacent topic groups", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) =>
        readyQuestion({
          id: `shared-${i}`,
          topics: [`topic-${i}`],
          skills: ["proporção"],
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        readyQuestion({
          id: `other-${i}`,
          topics: ["único"],
          skills: ["equação"],
        }),
      ),
    ];
    const history = emptyHistory();
    history.attempts = ["shared-0", "other-0"].map((questionId) =>
      attempt({ questionId }),
    );
    const list = buildMixedList(items, history, 8, 7);
    expect(
      list.every((q, i) => i === 0 || q.skills[0] !== list[i - 1].skills[0]),
    ).toBe(true);
  });
});

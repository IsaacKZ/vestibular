import { describe, expect, it } from "vitest";
import { assertContentIntegrity } from "../../scripts/audit-content";
import { readyQuestion } from "./fixtures";
describe("published content audit", () => {
  it("rejects a blocked question in the training export", () => {
    const q = readyQuestion({ key: null });
    expect(() => assertContentIntegrity([q], [q])).toThrow(/pront|treino/i);
  });
  it("rejects omitted ready questions and modified training revisions", () => {
    const q = readyQuestion();
    expect(() => assertContentIntegrity([q], [])).toThrow(/pront|treino/i);
    expect(() =>
      assertContentIntegrity([q], [{ ...q, stem: "Texto divergente" }]),
    ).toThrow(/diverg/i);
  });
  it("accepts the exact current ready subset, including an empty training export", () => {
    const q = readyQuestion();
    expect(() => assertContentIntegrity([q], [q])).not.toThrow();
    expect(() =>
      assertContentIntegrity([{ ...q, key: null }], []),
    ).not.toThrow();
  });
});

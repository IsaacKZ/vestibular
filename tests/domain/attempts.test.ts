import { describe, expect, it } from "vitest";
import {
  gradeAttempt,
  canRevealFeedback,
  isReleasedAttempt,
  latestGrades,
} from "../../src/domain/attempts";
import { attempt, grade, question, session } from "./fixtures";

describe("grading and feedback authorization", () => {
  it("grades answer and skip using the verified key revision", () => {
    expect(
      gradeAttempt(attempt(), question(), "2026-10-02T13:00:00Z"),
    ).toMatchObject({
      correct: true,
      keyRevision: "k1",
      decisionRevision: "key:k1",
      order: 0,
    });
    expect(
      gradeAttempt(
        attempt({ response: null }),
        question(),
        "2026-10-02T13:00:00Z",
      ).correct,
    ).toBe(false);
  });
  it("rejects an unverified key and a different question identity", () => {
    expect(() =>
      gradeAttempt(attempt(), question({ key: null }), "2026-10-02T13:00:00Z"),
    ).toThrow();
    expect(() =>
      gradeAttempt(
        attempt(),
        question({ id: "other" }),
        "2026-10-02T13:00:00Z",
      ),
    ).toThrow();
  });
  it("requires a verified sourced annulment and excludes it with its own decision", () => {
    const q = question();
    q.quality.annulled = true;
    expect(() => gradeAttempt(attempt(), q, "2026-10-02T13:00:00Z")).toThrow();
    q.annulment = {
      revision: "cancel1",
      verified: true,
      source: "test",
      location: "test",
      reviewer: "test",
    };
    expect(
      gradeAttempt(attempt(), q, "2026-10-02T13:00:00Z", "regrade"),
    ).toMatchObject({
      correct: null,
      keyRevision: null,
      decisionRevision: "annulment:cancel1",
      kind: "regrade",
      order: 1,
      exclusionReason: "annulled",
    });
  });
  it("keeps active and unknown assessments closed on every projection", () => {
    const a = attempt({ mode: "assessment" }),
      s = session({ mode: "assessment" });
    expect(canRevealFeedback(s)).toBe(false);
    expect(isReleasedAttempt(a, [s])).toBe(false);
    expect(isReleasedAttempt(a, [])).toBe(false);
    expect(isReleasedAttempt(a, [{ ...s, status: "completed" }])).toBe(true);
    expect(isReleasedAttempt(attempt(), [])).toBe(true);
  });
});

describe("explicit grade ordering", () => {
  it("applies a legacy regrade after an initial grade at the same instant regardless of array order", () => {
    const a = attempt(),
      initial = grade(a, false, { id: "z-initial" }),
      annulled = grade(a, true, {
        id: "a-annulled",
        kind: "regrade",
        correct: null,
        keyRevision: null,
        decisionRevision: "annulment:c1",
        exclusionReason: "annulled",
      });
    for (const rows of [
      [annulled, initial],
      [initial, annulled],
    ])
      expect(latestGrades(rows).get(a.id)).toEqual(annulled);
  });

  it("applies the latest explicit order among opposite regrades at the same instant", () => {
    const a = attempt(),
      initial = grade(a, false, { order: 0 }),
      firstRegrade = grade(a, true, {
        id: "z-first-regrade",
        kind: "regrade",
        decisionRevision: "key:k2",
        order: 1,
      }),
      lastRegrade = grade(a, false, {
        id: "a-last-regrade",
        kind: "regrade",
        decisionRevision: "key:k3",
        order: 2,
      });
    const rows = [lastRegrade, initial, firstRegrade];
    expect(latestGrades(rows).get(a.id)).toEqual(lastRegrade);
    expect(latestGrades([...rows].reverse()).get(a.id)).toEqual(lastRegrade);
  });

  it("uses the event instant before explicit order", () => {
    const a = attempt(),
      older = grade(a, true, { id: "z-older", kind: "regrade", order: 5 }),
      newer = grade(a, false, {
        id: "a-newer",
        kind: "regrade",
        order: 1,
        at: "2026-10-03T12:00:00Z",
      });
    expect(latestGrades([newer, older]).get(a.id)).toEqual(newer);
  });

  it("keeps a deterministic fallback for rows with the same instant and order", () => {
    const a = attempt(),
      lower = grade(a, false, { id: "a", kind: "regrade", order: 1 }),
      higher = grade(a, true, { id: "z", kind: "regrade", order: 1 });
    for (const rows of [
      [higher, lower],
      [lower, higher],
    ])
      expect(latestGrades(rows).get(a.id)).toEqual(higher);
  });
});

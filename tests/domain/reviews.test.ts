import { describe, expect, it } from "vitest";
import {
  projectLearning,
  isRetentionEvidence,
} from "../../src/domain/learning";
import { defaultSettings } from "../../src/content/constants";
import { attempt, grade, history } from "./fixtures";
const policy = defaultSettings.reviewPolicy,
  now = "2026-11-01T12:00:00Z";
const failed = attempt();
const returned = (date: string, id = date) =>
  attempt({
    id,
    at: `${date}T12:00:00Z`,
    studyDate: date,
    firstAttempt: false,
    priorFeedbackAt: failed.at,
    priorFeedbackDate: failed.studyDate,
  });
describe("delayed independent evidence", () => {
  it("credits two separated returns and retains maintenance after item recovery", () => {
    const first = returned("2026-10-05"),
      second = returned("2026-10-19");
    const initial = history([failed], [grade(failed, false)]);
    expect(projectLearning(initial, now, policy).reviews[0].dueDate).toBe(
      "2026-10-05",
    );
    const one = history([failed, first], [grade(failed, false), grade(first)]);
    expect(projectLearning(one, now, policy).reviews[0].dueDate).toBe(
      "2026-10-19",
    );
    const two = history(
      [failed, first, second],
      [grade(failed, false), grade(first), grade(second)],
    );
    expect(projectLearning(two, now, policy).gaps[0]).toMatchObject({
      status: "recovered",
      evidenceAttemptIds: [first.id, second.id],
    });
    expect(projectLearning(two, now, policy).reviews[0]).toMatchObject({
      kind: "maintenance",
      dueDate: "2026-11-02",
    });
  });
  it("rejects same day, feedback immediately before return, help, and insufficient spacing", () => {
    for (const a of [
      returned("2026-10-02"),
      returned("2026-10-04"),
      { ...returned("2026-10-05"), consulted: true },
      {
        ...returned("2026-10-05"),
        priorFeedbackDate: "2026-10-05",
        priorFeedbackAt: "2026-10-05T10:00:00Z",
      },
    ]) {
      expect(isRetentionEvidence(a, grade(a), "2026-10-02", null, policy)).toBe(
        false,
      );
    }
    const a = returned("2026-10-07");
    expect(
      isRetentionEvidence(a, grade(a), "2026-10-02", "2026-10-05", policy),
    ).toBe(false);
  });
  it("uses stored Brazilian dates when UTC has crossed midnight", () => {
    const a = returned("2026-10-04");
    a.at = "2026-10-05T01:00:00Z";
    expect(isRetentionEvidence(a, grade(a), "2026-10-02", null, policy)).toBe(
      false,
    );
  });
  it("rejects same-day feedback recorded before a submission at the same instant", () => {
    const a = returned("2026-10-05");
    a.priorFeedbackAt = a.at;
    a.priorFeedbackDate = a.studyDate;
    expect(isRetentionEvidence(a, grade(a), "2026-10-02", null, policy)).toBe(
      false,
    );
  });
  it("rejects prior-day feedback without the configured minimum spacing", () => {
    const a = returned("2026-10-05");
    a.priorFeedbackAt = a.at;
    a.priorFeedbackDate = "2026-10-04";
    expect(isRetentionEvidence(a, grade(a), "2026-10-02", null, policy)).toBe(
      false,
    );
  });
  it("rejects equal-instant feedback across a study-day boundary even with a one-day policy", () => {
    const a = returned("2026-10-05");
    a.priorFeedbackAt = a.at;
    a.priorFeedbackDate = "2026-10-04";
    expect(
      isRetentionEvidence(a, grade(a), "2026-10-02", null, {
        ...policy,
        minEvidenceDays: 1,
      }),
    ).toBe(false);
  });
  it("does not remove evidence when the return itself receives later feedback", () => {
    const a = returned("2026-10-05"),
      h = history([failed, a], [grade(failed, false), grade(a)]);
    const before = projectLearning(h, now, policy);
    h.feedback.push({
      id: "f",
      attemptId: a.id,
      questionId: a.questionId,
      at: "2026-10-05T12:01:00Z",
      studyDate: a.studyDate,
    });
    expect(projectLearning(h, now, policy)).toEqual(before);
  });
  it("reopens a recovered item and restarts evidence after another failure", () => {
    const a = returned("2026-10-05"),
      b = returned("2026-10-19"),
      c = returned("2026-10-20");
    const p = projectLearning(
      history(
        [failed, a, b, c],
        [grade(failed, false), grade(a), grade(b), grade(c, false)],
      ),
      now,
      policy,
    );
    expect(p.gaps[0]).toMatchObject({
      status: "open",
      lastFailureDate: "2026-10-20",
      evidenceAttemptIds: [],
    });
    expect(p.reviews[0].dueDate).toBe("2026-10-23");
  });
});

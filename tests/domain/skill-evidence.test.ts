import { describe, expect, it } from "vitest";
import { projectSkillEvidence } from "../../src/domain/skill-evidence";
import { defaultSettings } from "../../src/content/constants";
import { attempt, grade, history, question } from "./fixtures";

const asOf = "2026-11-01T12:00:00Z";
const first = attempt({ skillFeedback: [] });
const later = attempt({
  id: "a2",
  questionId: "test-q2",
  at: "2026-10-05T12:00:00Z",
  studyDate: "2026-10-05",
  skillFeedback: [],
});
const snapshots = [question(), question({ id: "test-q2" })];
const project = (candidate = later) =>
  projectSkillEvidence(history([first, candidate]), snapshots, asOf);

describe("immutable per-skill evidence", () => {
  it("rejects same-instant feedback even if its captured calendar date is older", () => {
    const candidate = {
      ...later,
      skillFeedback: [
        {
          subject: "matematica" as const,
          skill: "skill",
          at: later.at,
          studyDate: first.studyDate,
        },
      ],
    };
    expect(project(candidate)[0]).toMatchObject({
      opportunities: 0,
      correct: 0,
    });
  });
  it.each([
    { consulted: true },
    { usedHint: true },
    { guessed: true },
    { doubt: true },
    { confidence: "low" as const },
    { response: null },
  ])("excludes non-independent opportunities: %j", (flags) => {
    expect(project({ ...later, ...flags })[0]).toMatchObject({
      opportunities: 0,
      correct: 0,
    });
  });
  it("uses subject-scoped feedback and accepts genuinely spaced exposure", () => {
    const candidate = {
      ...later,
      skillFeedback: [
        {
          subject: "fisica" as const,
          skill: "skill",
          at: later.at,
          studyDate: later.studyDate,
        },
        {
          subject: "matematica" as const,
          skill: "skill",
          at: first.at,
          studyDate: first.studyDate,
        },
      ],
    };
    expect(project(candidate)[0]).toMatchObject({
      opportunities: 1,
      correct: 1,
    });
  });
  it("does not count annulled results as skill opportunities", () => {
    const h = history(
      [first, later],
      [
        grade(first),
        grade(later, true, {
          exclusionReason: "annulled",
          correct: null,
        }),
      ],
    );
    expect(projectSkillEvidence(h, snapshots, asOf)[0]).toMatchObject({
      opportunities: 0,
      correct: 0,
    });
  });
  it("uses the submission snapshot taxonomy instead of a later content revision", () => {
    const updated = question({
      id: later.questionId,
      revision: "r2",
      skills: ["new-skill"],
    });
    expect(
      projectSkillEvidence(
        history([first, later]),
        [...snapshots, updated],
        asOf,
      )[0],
    ).toMatchObject({ skill: "skill", opportunities: 1, correct: 1 });
  });
  it("never strengthens unknown item difficulty into an equivalence claim", () => {
    expect(project()[0].difficultyComparisons).toEqual([
      { from: "unknown", to: "unknown", opportunities: 1, correct: 1 },
    ]);
  });
  it("has no skill evidence when both items lack reviewed taxonomy", () => {
    const unreviewed = snapshots.map((q) => ({
      ...q,
      quality: { ...q.quality, taxonomyReviewed: false },
    }));
    expect(
      projectSkillEvidence(
        history([first, later]),
        unreviewed,
        asOf,
        defaultSettings.reviewPolicy,
      ),
    ).toEqual([]);
  });
});

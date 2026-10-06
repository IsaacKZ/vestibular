import type {
  Instant,
  LearningHistory,
  QuestionRevision,
  ReviewPolicy,
  StudyDate,
  Subject,
} from "../content/types";
import { defaultSettings } from "../content/constants";
import {
  isIndependentAttempt,
  isReleasedAttempt,
  latestGrades,
} from "./attempts";
import { dayDistance } from "./clock";

type Difficulty = NonNullable<QuestionRevision["difficulty"]> | "unknown";
export interface SkillOpportunity {
  attemptId: string;
  questionId: string;
  studyDate: StudyDate;
  correct: boolean;
  fromDifficulty: Difficulty;
  toDifficulty: Difficulty;
}
export interface SkillEvidence {
  subject: Subject;
  skill: string;
  introductionQuestionId: string;
  introductionDate: StudyDate;
  opportunities: number;
  correct: number;
  distinctItems: number;
  dates: StudyDate[];
  evidenceAttemptIds: string[];
  consistent: boolean;
  difficultyComparisons: {
    from: Difficulty;
    to: Difficulty;
    opportunities: number;
    correct: number;
  }[];
  events: SkillOpportunity[];
}

/** Recompute summaries after a reporting filter, retaining the original introduction. */
export function summarizeSkillEvidence(
  row: SkillEvidence,
  events: SkillOpportunity[],
  policy: ReviewPolicy,
): SkillEvidence {
  const successes = events.filter((event) => event.correct);
  const comparisons = new Map<
    string,
    SkillEvidence["difficultyComparisons"][number]
  >();
  for (const event of events) {
    const key = `${event.fromDifficulty}:${event.toDifficulty}`;
    const comparison = comparisons.get(key) ?? {
      from: event.fromDifficulty,
      to: event.toDifficulty,
      opportunities: 0,
      correct: 0,
    };
    comparison.opportunities++;
    if (event.correct) comparison.correct++;
    comparisons.set(key, comparison);
  }
  return {
    ...row,
    events,
    opportunities: events.length,
    correct: successes.length,
    distinctItems: new Set(events.map((event) => event.questionId)).size,
    dates: [...new Set(events.map((event) => event.studyDate))].sort(),
    evidenceAttemptIds: successes.map((event) => event.attemptId),
    consistent: successes.some((earlier) =>
      successes.some(
        (later) =>
          earlier.questionId !== later.questionId &&
          dayDistance(earlier.studyDate, later.studyDate) >=
            Math.max(1, policy.minEvidenceDays),
      ),
    ),
    difficultyComparisons: [...comparisons.values()],
  };
}

/** Application evidence is distinct from remembering the answer to the same question. */
export function projectSkillEvidence(
  history: LearningHistory,
  snapshots: readonly QuestionRevision[],
  asOf: Instant,
  policy: ReviewPolicy = defaultSettings.reviewPolicy,
): SkillEvidence[] {
  const questions = new Map(snapshots.map((q) => [`${q.id}:${q.revision}`, q]));
  const grades = latestGrades(
    history.grades.filter((g) => Date.parse(g.at) <= Date.parse(asOf)),
  );
  const rows = new Map<string, SkillEvidence>();
  const introductionInstants = new Map<string, number>();
  const introductionDifficulties = new Map<string, Difficulty>();
  const firstByQuestion = new Map<string, string>();
  const ordered = history.attempts
    .filter((a) => Date.parse(a.at) <= Date.parse(asOf))
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.at) - Date.parse(b.at) ||
        Number(b.firstAttempt) - Number(a.firstAttempt) ||
        a.id.localeCompare(b.id),
    );
  for (const attempt of ordered) {
    if (!firstByQuestion.has(attempt.questionId))
      firstByQuestion.set(attempt.questionId, attempt.id);
    if (!isReleasedAttempt(attempt, history.sessions, asOf)) continue;
    const q = questions.get(
      `${attempt.questionId}:${attempt.questionRevision}`,
    );
    const grade = grades.get(attempt.id);
    if (
      !q?.quality.taxonomyReviewed ||
      !grade ||
      grade.exclusionReason !== null ||
      grade.correct === null
    )
      continue;
    for (const skill of new Set(q.skills.filter((value) => value.trim()))) {
      const key = JSON.stringify([q.subject, skill]);
      let row = rows.get(key);
      if (!row) {
        row = {
          subject: q.subject,
          skill,
          introductionQuestionId: q.id,
          introductionDate: attempt.studyDate,
          opportunities: 0,
          correct: 0,
          distinctItems: 0,
          dates: [],
          evidenceAttemptIds: [],
          consistent: false,
          difficultyComparisons: [],
          events: [],
        };
        rows.set(key, row);
        introductionInstants.set(key, Date.parse(attempt.at));
        introductionDifficulties.set(key, q.difficulty ?? "unknown");
        continue;
      }
      if (
        q.id === row.introductionQuestionId ||
        firstByQuestion.get(q.id) !== attempt.id ||
        !attempt.firstAttempt ||
        !isIndependentAttempt(attempt) ||
        attempt.skillFeedback === undefined ||
        attempt.priorFeedbackAt !== null ||
        attempt.priorFeedbackDate !== null ||
        Date.parse(attempt.at) <= introductionInstants.get(key)! ||
        dayDistance(row.introductionDate, attempt.studyDate) <
          Math.max(1, policy.minEvidenceDays)
      )
        continue;
      // Only the immutable baseline is consulted. Later feedback cannot rewrite this submission.
      const exposureBlocks = attempt.skillFeedback.some(
        (exposure) =>
          exposure.subject === q.subject &&
          exposure.skill === skill &&
          (Date.parse(exposure.at) >= Date.parse(attempt.at) ||
            dayDistance(exposure.studyDate, attempt.studyDate) <
              Math.max(1, policy.minEvidenceDays)),
      );
      if (exposureBlocks) continue;
      row.events.push({
        attemptId: attempt.id,
        questionId: q.id,
        studyDate: attempt.studyDate,
        correct: grade.correct,
        fromDifficulty: introductionDifficulties.get(key)!,
        toDifficulty: q.difficulty ?? "unknown",
      });
    }
  }
  return [...rows.values()].map((row) =>
    summarizeSkillEvidence(row, row.events, policy),
  );
}

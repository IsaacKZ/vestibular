import type {
  Attempt,
  Grade,
  Instant,
  LearningHistory,
  LearningProjection,
  ReviewPolicy,
  StudyDate,
  Gap,
  Review,
} from "../content/types";
import { addStudyDays, dayDistance } from "./clock";
import {
  isIndependentAttempt,
  isReleasedAttempt,
  latestGrades,
} from "./attempts";

export function isRetentionEvidence(
  attempt: Attempt,
  grade: Grade,
  baselineDate: StudyDate,
  previousEvidenceDate: StudyDate | null,
  policy: ReviewPolicy,
): boolean {
  if (
    grade.attemptId !== attempt.id ||
    grade.correct !== true ||
    grade.exclusionReason !== null ||
    attempt.firstAttempt ||
    !isIndependentAttempt(attempt)
  )
    return false;
  if (dayDistance(baselineDate, attempt.studyDate) < policy.minEvidenceDays)
    return false;
  if (
    previousEvidenceDate &&
    dayDistance(previousEvidenceDate, attempt.studyDate) <
      policy.minEvidenceDays
  )
    return false;
  // Exposure belongs to the immutable submission baseline, not to later feedback events.
  if (attempt.priorFeedbackAt) {
    if (
      Date.parse(attempt.priorFeedbackAt) >= Date.parse(attempt.at) ||
      !attempt.priorFeedbackDate ||
      dayDistance(attempt.priorFeedbackDate, attempt.studyDate) <
        Math.max(1, policy.minEvidenceDays)
    )
      return false;
  }
  return true;
}

interface ItemState {
  gap: Gap | null;
  review: Review;
  baselineDate: StudyDate;
  previousEvidenceDate: StudyDate | null;
}

function project(
  history: LearningHistory,
  now: Instant,
  policy: ReviewPolicy,
  targetExamDate?: StudyDate,
): { projection: LearningProjection; evidenceIds: Set<string> } {
  const dueDate = (date: StudyDate, days: number): StudyDate => {
    const scheduled = addStudyDays(date, days);
    return targetExamDate &&
      date <= targetExamDate &&
      scheduled > targetExamDate
      ? targetExamDate
      : scheduled;
  };
  const current = latestGrades(
    history.grades.filter((g) => Date.parse(g.at) <= Date.parse(now)),
  );
  const items = new Map<string, ItemState>(),
    evidenceIds = new Set<string>();
  const attempts = history.attempts
    .filter(
      (a) =>
        Date.parse(a.at) <= Date.parse(now) &&
        isReleasedAttempt(a, history.sessions, now),
    )
    .slice()
    .sort(
      (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id),
    );
  for (const attempt of attempts) {
    const grade = current.get(attempt.id);
    if (
      !grade ||
      grade.exclusionReason === "annulled" ||
      grade.correct === null
    )
      continue;
    let state = items.get(attempt.questionId);
    const failed = grade.correct !== true || !isIndependentAttempt(attempt);
    if (failed) {
      const gap: Gap = {
        questionId: attempt.questionId,
        status: "open",
        cause: null,
        note: "",
        evidenceAttemptIds: [],
        lastFailureDate: attempt.studyDate,
      };
      state = {
        gap,
        baselineDate: attempt.studyDate,
        previousEvidenceDate: null,
        review: {
          questionId: attempt.questionId,
          dueDate: dueDate(attempt.studyDate, policy.initialDays),
          kind: "gap",
          lastEvidenceDate: null,
        },
      };
      items.set(attempt.questionId, state);
      continue;
    }
    if (!state) {
      items.set(attempt.questionId, {
        gap: null,
        baselineDate: attempt.studyDate,
        previousEvidenceDate: null,
        review: {
          questionId: attempt.questionId,
          dueDate: dueDate(attempt.studyDate, policy.maintenanceDays),
          kind: "maintenance",
          lastEvidenceDate: attempt.studyDate,
        },
      });
      continue;
    }
    if (
      !isRetentionEvidence(
        attempt,
        grade,
        state.baselineDate,
        state.previousEvidenceDate,
        policy,
      )
    )
      continue;
    evidenceIds.add(attempt.id);
    state.previousEvidenceDate = attempt.studyDate;
    if (state.gap) {
      state.gap.evidenceAttemptIds.push(attempt.id);
      const recovered =
        state.gap.evidenceAttemptIds.length >= policy.recoverySuccesses;
      state.gap.status = recovered ? "recovered" : "in_review";
      state.review = {
        questionId: attempt.questionId,
        kind: recovered ? "maintenance" : "gap",
        lastEvidenceDate: attempt.studyDate,
        dueDate: dueDate(
          attempt.studyDate,
          recovered ? policy.maintenanceDays : policy.repeatDays,
        ),
      };
    } else {
      state.review = {
        questionId: attempt.questionId,
        kind: "maintenance",
        lastEvidenceDate: attempt.studyDate,
        dueDate: dueDate(attempt.studyDate, policy.maintenanceDays),
      };
    }
  }
  const states = [...items.values()];
  return {
    projection: {
      gaps: states.flatMap((s) => (s.gap ? [s.gap] : [])),
      reviews: states.map((s) => s.review),
    },
    evidenceIds,
  };
}

export function projectLearning(
  history: LearningHistory,
  now: Instant,
  policy: ReviewPolicy,
  targetExamDate?: StudyDate,
): LearningProjection {
  return project(history, now, policy, targetExamDate).projection;
}

/** Historical evidence events remain countable even when a subsequent failure reopens the item. */
export function retentionEvidenceAttemptIds(
  history: LearningHistory,
  policy: ReviewPolicy,
  asOf: Instant = "9999-12-31T23:59:59Z",
): Set<string> {
  return project(history, asOf, policy).evidenceIds;
}

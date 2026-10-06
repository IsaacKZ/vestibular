import type {
  Instant,
  LearningHistory,
  QuestionRevision,
  StudyDate,
  Subject,
  ReviewPolicy,
} from "../content/types";
import { defaultSettings } from "../content/constants";
import {
  isIndependentAttempt,
  isReleasedAttempt,
  latestGrades,
} from "./attempts";
import { retentionEvidenceAttemptIds } from "./learning";
import {
  projectSkillEvidence,
  summarizeSkillEvidence,
  type SkillEvidence,
} from "./skill-evidence";

export interface StudyMetrics {
  newItems: number;
  repeatAttempts: number;
  firstAttemptCorrect: number;
  firstAttemptTotal: number;
  independentCorrect: number;
  independentTotal: number;
  assistedCorrect: number;
  assistedTotal: number;
  activeMs: number;
  retentionEvidence: number;
  transferEvidence: number;
  transferOpportunities: number;
  skillEvidence: SkillEvidence[];
  annulledExcluded: number;
  keyRevisions: string[];
  decisionRevisions: string[];
}

export function computeMetrics(
  history: LearningHistory,
  snapshots: readonly QuestionRevision[],
  filter: { from: StudyDate; to: StudyDate; subject?: Subject; topic?: string },
  policy: ReviewPolicy = defaultSettings.reviewPolicy,
  asOf: Instant = "9999-12-31T23:59:59Z",
): StudyMetrics {
  const metrics: StudyMetrics = {
    newItems: 0,
    repeatAttempts: 0,
    firstAttemptCorrect: 0,
    firstAttemptTotal: 0,
    independentCorrect: 0,
    independentTotal: 0,
    assistedCorrect: 0,
    assistedTotal: 0,
    activeMs: 0,
    retentionEvidence: 0,
    transferEvidence: 0,
    transferOpportunities: 0,
    skillEvidence: [],
    annulledExcluded: 0,
    keyRevisions: [],
    decisionRevisions: [],
  };
  const questions = new Map(snapshots.map((q) => [`${q.id}:${q.revision}`, q]));
  const attemptsById = new Map(history.attempts.map((a) => [a.id, a]));
  const grades = latestGrades(
      history.grades.filter((g) => Date.parse(g.at) <= Date.parse(asOf)),
    ),
    firstByQuestion = new Map<string, string>();
  const ordered = history.attempts
    .filter((a) => Date.parse(a.at) <= Date.parse(asOf))
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.at) - Date.parse(b.at) ||
        Number(b.firstAttempt) - Number(a.firstAttempt) ||
        a.id.localeCompare(b.id),
    );
  for (const attempt of ordered)
    if (!firstByQuestion.has(attempt.questionId))
      firstByQuestion.set(attempt.questionId, attempt.id);
  const released = ordered.filter((a) =>
    isReleasedAttempt(a, history.sessions, asOf),
  );
  const reportedSkills = new Set<string>();
  for (const attempt of released) {
    const q = questions.get(
      `${attempt.questionId}:${attempt.questionRevision}`,
    );
    const grade = grades.get(attempt.id);
    if (
      !q ||
      !grade ||
      grade.exclusionReason !== null ||
      grade.correct === null ||
      attempt.studyDate < filter.from ||
      attempt.studyDate > filter.to ||
      (filter.subject && q.subject !== filter.subject) ||
      (filter.topic && !q.topics.includes(filter.topic))
    )
      continue;
    for (const skill of q.skills)
      reportedSkills.add(JSON.stringify([q.subject, skill]));
  }
  metrics.skillEvidence = projectSkillEvidence(history, snapshots, asOf, policy)
    .filter((row) =>
      reportedSkills.has(JSON.stringify([row.subject, row.skill])),
    )
    .map((row) =>
      summarizeSkillEvidence(
        row,
        row.events.filter((event) => {
          const attempt = attemptsById.get(event.attemptId)!;
          const q = questions.get(
            `${attempt.questionId}:${attempt.questionRevision}`,
          )!;
          return (
            event.studyDate >= filter.from &&
            event.studyDate <= filter.to &&
            (!filter.topic || q.topics.includes(filter.topic))
          );
        }),
        policy,
      ),
    );
  const transferIds = new Set(
    metrics.skillEvidence.flatMap((row) => row.evidenceAttemptIds),
  );
  metrics.transferOpportunities = new Set(
    metrics.skillEvidence.flatMap((row) =>
      row.events.map((event) => event.attemptId),
    ),
  ).size;
  const retentionIds = retentionEvidenceAttemptIds(history, policy, asOf);
  const keyRevisions = new Set<string>(),
    decisionRevisions = new Set<string>();
  for (const attempt of released) {
    if (attempt.studyDate < filter.from || attempt.studyDate > filter.to)
      continue;
    const q = questions.get(
      `${attempt.questionId}:${attempt.questionRevision}`,
    );
    if (
      !q ||
      (filter.subject && q.subject !== filter.subject) ||
      (filter.topic && !q.topics.includes(filter.topic))
    )
      continue;
    const grade = grades.get(attempt.id);
    if (!grade) continue;
    decisionRevisions.add(grade.decisionRevision);
    if (grade.keyRevision !== null) keyRevisions.add(grade.keyRevision);
    // Official annulment changes scoring, not the student's recorded study time.
    metrics.activeMs += attempt.activeMs;
    if (grade.exclusionReason === "annulled" || grade.correct === null) {
      metrics.annulledExcluded++;
      continue;
    }
    const first = firstByQuestion.get(attempt.questionId) === attempt.id;
    if (first) {
      metrics.newItems++;
      metrics.firstAttemptTotal++;
      if (grade.correct) metrics.firstAttemptCorrect++;
    } else metrics.repeatAttempts++;
    if (isIndependentAttempt(attempt)) {
      metrics.independentTotal++;
      if (grade.correct) metrics.independentCorrect++;
    } else {
      metrics.assistedTotal++;
      if (grade.correct) metrics.assistedCorrect++;
    }
    if (retentionIds.has(attempt.id)) metrics.retentionEvidence++;
    if (transferIds.has(attempt.id)) metrics.transferEvidence++;
  }
  metrics.keyRevisions = [...keyRevisions].sort();
  metrics.decisionRevisions = [...decisionRevisions].sort();
  return metrics;
}

import type {
  Attempt,
  DailyPlan,
  LearningHistory,
  LearningProjection,
  QuestionRevision,
  Settings,
  StudyDate,
  PlanTask,
} from "../content/types";
import { canPractice } from "../content/quality";
import { subjects } from "../content/constants";
import { isReleasedAttempt } from "./attempts";
import { studyDate } from "./clock";

function releasedByDate(
  attempt: Attempt,
  history: LearningHistory,
  date?: StudyDate,
  timezone = "UTC",
): boolean {
  if (!isReleasedAttempt(attempt, history.sessions)) return false;
  if (!date) return true;
  if (attempt.studyDate > date || studyDate(attempt.at, timezone) > date)
    return false;
  if (attempt.mode === "assessment") {
    const completion = history.sessions.find(
      (s) => s.id === attempt.sessionId,
    )?.completedAt;
    return !!completion && studyDate(completion, timezone) <= date;
  }
  return true;
}

/** Active solving time plus 25% for correction; old histories use ten minutes. */
export function estimateTaskMinutes(
  question: QuestionRevision,
  history: LearningHistory,
  items: QuestionRevision[] = [],
  date?: StudyDate,
  timezone = "UTC",
  snapshots: QuestionRevision[] = [],
): number {
  const released = history.attempts.filter(
    (a) =>
      Number.isFinite(a.activeMs) &&
      a.activeMs > 0 &&
      releasedByDate(a, history, date, timezone),
  );
  const revisions = new Map(
    [...items, ...snapshots].map((q) => [
      JSON.stringify([q.id, q.revision]),
      q,
    ]),
  );
  const attemptedQuestion = (a: Attempt) =>
    revisions.get(JSON.stringify([a.questionId, a.questionRevision]));
  const sameQuestion = released.filter((a) => a.questionId === question.id);
  const sameSubject = released.filter(
    (a) => attemptedQuestion(a)?.subject === question.subject,
  );
  const sameSkill = sameSubject.filter((a) =>
    attemptedQuestion(a)?.skills.some((skill) =>
      question.skills.includes(skill),
    ),
  );
  const samples = [sameQuestion, sameSkill, sameSubject, released].find(
    (attempts) => attempts.length > 0,
  );
  if (!samples) return 10;
  const times = samples.map((a) => a.activeMs / 60_000).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const median =
    times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
  return Math.max(5, Math.min(30, Math.ceil(median * 1.25)));
}

export function buildDailyPlan(
  items: QuestionRevision[],
  history: LearningHistory,
  projection: LearningProjection,
  settings: Settings,
  date: StudyDate,
  snapshots: QuestionRevision[] = [],
): DailyPlan {
  const plan: DailyPlan = { date, tasks: [], deferredQuestionIds: [] };
  const weekdays = new Set(settings.studyWeekdays);
  if (
    weekdays.size > 5 ||
    settings.dailyMinutes > 120 ||
    settings.dailyMinutes < 0
  )
    throw new Error("Capacidade de estudo inválida");
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!weekdays.has(weekday)) return plan;
  const ready = new Map(items.filter(canPractice).map((q) => [q.id, q]));
  const estimates = new Map(
    [...ready.values()].map((q) => [
      q.id,
      estimateTaskMinutes(
        q,
        history,
        items,
        date,
        settings.timezone,
        snapshots,
      ),
    ]),
  );
  const selected = new Set<string>();
  const subjectCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  let minutes = 0;
  const add = (id: string, reason: PlanTask["reason"]) => {
    const q = ready.get(id),
      estimate = estimates.get(id);
    if (
      !q ||
      estimate === undefined ||
      selected.has(id) ||
      plan.tasks.length >= 12 ||
      minutes + estimate > settings.dailyMinutes
    )
      return false;
    plan.tasks.push({ questionId: id, minutes: estimate, reason });
    selected.add(id);
    minutes += estimate;
    subjectCounts.set(q.subject, (subjectCounts.get(q.subject) ?? 0) + 1);
    for (const skill of q.skills) {
      const key = `${q.subject}:${skill}`;
      skillCounts.set(key, (skillCounts.get(key) ?? 0) + 1);
    }
    return true;
  };
  const overdue = projection.reviews
    .filter(
      (r) =>
        ready.has(r.questionId) &&
        (r.dueDate < date || (r.kind === "gap" && r.dueDate === date)),
    )
    .slice()
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.questionId.localeCompare(b.questionId),
    );
  const overdueIds = new Set(overdue.map((r) => r.questionId));
  for (const review of overdue) add(review.questionId, "review");
  const reviewsByQuestion = new Map(
    projection.reviews.map((r) => [r.questionId, r]),
  );
  for (const gap of projection.gaps) {
    const review = reviewsByQuestion.get(gap.questionId);
    if (
      gap.status !== "recovered" &&
      !overdueIds.has(gap.questionId) &&
      (!review || review.dueDate <= date)
    )
      add(gap.questionId, "gap");
  }
  for (const review of projection.reviews)
    if (
      review.kind === "maintenance" &&
      review.dueDate <= date &&
      !overdueIds.has(review.questionId)
    )
      add(review.questionId, "maintenance");
  const seen = new Set(
    history.attempts
      .filter((a) => releasedByDate(a, history, date, settings.timezone))
      .map((a) => a.questionId),
  );
  const scheduled = new Set(projection.reviews.map((r) => r.questionId));
  const deferredOverdue = [...overdueIds].some((id) => !selected.has(id));
  const candidates = deferredOverdue
    ? []
    : [...ready.values()].filter(
        (q) => !seen.has(q.id) && !scheduled.has(q.id),
      );
  const skillLoad = (q: QuestionRevision) =>
    q.skills.reduce(
      (total, skill) => total + (skillCounts.get(`${q.subject}:${skill}`) ?? 0),
      0,
    ) / q.skills.length;
  while (candidates.length && plan.tasks.length < 12) {
    candidates.sort(
      (a, b) =>
        (subjectCounts.get(a.subject) ?? 0) -
          (subjectCounts.get(b.subject) ?? 0) ||
        skillLoad(a) - skillLoad(b) ||
        subjects.indexOf(a.subject) - subjects.indexOf(b.subject) ||
        a.originalNumber - b.originalNumber ||
        a.edition.localeCompare(b.edition) ||
        a.id.localeCompare(b.id),
    );
    add(candidates.shift()!.id, "new");
  }
  plan.deferredQuestionIds = [...overdueIds].filter((id) => !selected.has(id));
  return plan;
}

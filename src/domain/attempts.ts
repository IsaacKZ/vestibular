import type {
  Attempt,
  Grade,
  Instant,
  QuestionRevision,
  StudySession,
} from "../content/types";

/** This only constructs a grade; persistence must succeed before feedback is shown. */
export function gradeAttempt(
  attempt: Attempt,
  q: QuestionRevision,
  now: Instant,
  kind: Grade["kind"] = "initial",
): Grade {
  if (q.id !== attempt.questionId)
    throw new Error("Questão diferente da tentativa");
  if (kind === "initial" && q.revision !== attempt.questionRevision)
    throw new Error("Revisão diferente da tentativa");
  let keyRevision: string | null,
    decisionRevision: string,
    correct: boolean | null;
  let exclusionReason: Grade["exclusionReason"] = null;
  if (q.quality.annulled) {
    const decision = q.annulment;
    if (
      !decision?.verified ||
      !decision.revision ||
      !decision.source.trim() ||
      !decision.location.trim() ||
      !decision.reviewer.trim()
    )
      throw new Error("Anulação sem confirmação e procedência");
    keyRevision = null;
    decisionRevision = `annulment:${decision.revision}`;
    correct = null;
    exclusionReason = "annulled";
  } else {
    const key = q.key;
    if (
      !key?.verified ||
      !key.revision ||
      !key.source.trim() ||
      !key.location.trim() ||
      !key.reviewer.trim()
    )
      throw new Error("Sem gabarito confirmado");
    keyRevision = key.revision;
    decisionRevision = `key:${key.revision}`;
    correct = attempt.response === key.letter;
  }
  return {
    id: `${attempt.id}:${decisionRevision}`,
    attemptId: attempt.id,
    keyRevision,
    decisionRevision,
    questionRevision: q.revision,
    correct,
    kind,
    order: kind === "initial" ? 0 : 1,
    exclusionReason,
    at: now,
  };
}

export function canRevealFeedback(session: StudySession): boolean {
  return session.mode === "study" || session.status === "completed";
}

export function isReleasedAttempt(
  attempt: Attempt,
  sessions: StudySession[],
  asOf?: Instant,
): boolean {
  if (attempt.mode === "study") return true;
  const session = sessions.find((s) => s.id === attempt.sessionId);
  return (
    session?.mode === "assessment" &&
    session.status === "completed" &&
    (asOf === undefined ||
      (session.completedAt !== null &&
        Date.parse(session.completedAt) <= Date.parse(asOf)))
  );
}

export function isIndependentAttempt(attempt: Attempt): boolean {
  return (
    attempt.response !== null &&
    attempt.confidence !== "low" &&
    !attempt.guessed &&
    !attempt.doubt &&
    !attempt.usedHint &&
    !attempt.consulted
  );
}

/** Event time, explicit order, and stable ID resolve grades without relying on array order. */
export function latestGrades(grades: Grade[]): Map<string, Grade> {
  const latest = new Map<string, Grade>();
  for (const grade of grades) {
    const previous = latest.get(grade.attemptId);
    const comparison = previous
      ? Date.parse(grade.at) - Date.parse(previous.at) ||
        (grade.order ?? (grade.kind === "initial" ? 0 : 1)) -
          (previous.order ?? (previous.kind === "initial" ? 0 : 1)) ||
        (grade.id > previous.id ? 1 : grade.id < previous.id ? -1 : 0)
      : 1;
    if (comparison > 0) latest.set(grade.attemptId, grade);
  }
  return latest;
}

import type {
  Attempt,
  AttemptInput,
  DailyPlan,
  ErrorCause,
  FeedbackEvent,
  Grade,
  Instant,
  LearningHistory,
  LearningProjection,
  QuestionRevision,
  Settings,
  StudySession,
} from "../content/types";
import { defaultSettings } from "../content/constants";
import { getBlockers, isReady } from "../content/quality";
import {
  SettingsSchema,
  QuestionRevisionSchema,
  AttemptInputSchema,
  DailyPlanSchema,
  FeedbackEventSchema,
  GapSchema,
  GradeSchema,
} from "../content/schema";
import { studyDate } from "../domain/clock";
import {
  gradeAttempt,
  canRevealFeedback,
  latestGrades,
} from "../domain/attempts";
import { projectLearning } from "../domain/learning";
import type { StudyDb } from "./db";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function normalizeInstant(now: Instant): Instant {
  if (!Number.isFinite(Date.parse(now))) throw new Error("Instante inválido");
  return new Date(now).toISOString();
}
export function validateInput(input: AttemptInput): void {
  AttemptInputSchema.parse(input);
  if (
    !input ||
    !["submissionId", "sessionId", "questionId", "questionRevision"].every(
      (k) =>
        typeof input[k as keyof AttemptInput] === "string" &&
        String(input[k as keyof AttemptInput]).trim(),
    )
  )
    throw new Error("Identificador inválido");
  if (
    input.response !== null &&
    !["A", "B", "C", "D", "E"].includes(input.response)
  )
    throw new Error("Resposta inválida");
  if (
    !["low", "medium", "high"].includes(input.confidence) ||
    !["guessed", "doubt", "usedHint", "consulted"].every(
      (k) => typeof input[k as keyof AttemptInput] === "boolean",
    ) ||
    !Number.isSafeInteger(input.activeMs) ||
    input.activeMs < 0
  )
    throw new Error("Dados da tentativa inválidos");
}
// Store the canonical payload itself: no lossy hash can hide a conflicting retry.
export function payloadHash(input: AttemptInput): string {
  return canonical({
    submissionId: input.submissionId,
    sessionId: input.sessionId,
    questionId: input.questionId,
    questionRevision: input.questionRevision,
    response: input.response,
    confidence: input.confidence,
    guessed: input.guessed,
    doubt: input.doubt,
    usedHint: input.usedHint,
    consulted: input.consulted,
    activeMs: input.activeMs,
  });
}
export async function getSettings(db: StudyDb): Promise<Settings> {
  return (
    (await db.settings.get("current"))?.value ??
    structuredClone(defaultSettings)
  );
}
export async function loadHistory(db: StudyDb): Promise<LearningHistory> {
  const [attempts, grades, feedback, sessions] = await Promise.all([
    db.attempts.toArray(),
    db.grades.toArray(),
    db.feedback.toArray(),
    db.sessions.toArray(),
  ]);
  return { attempts, grades, feedback, sessions };
}
export async function loadProjection(db: StudyDb): Promise<LearningProjection> {
  const [gaps, reviews] = await Promise.all([
    db.gaps.toArray(),
    db.reviews.toArray(),
  ]);
  return { gaps, reviews };
}
export async function recalculate(db: StudyDb, now: Instant): Promise<void> {
  const [history, settings, old] = await Promise.all([
    loadHistory(db),
    getSettings(db),
    db.gaps.toArray(),
  ]);
  const projectionAt = new Date(
    Math.max(
      Date.parse(now),
      ...history.attempts.map((a) => Date.parse(a.at)),
      ...history.grades.map((g) => Date.parse(g.at)),
      ...history.feedback.map((event) => Date.parse(event.at)),
      ...history.sessions.map((session) =>
        Date.parse(session.completedAt ?? session.startedAt),
      ),
    ),
  ).toISOString();
  const projection = projectLearning(
    history,
    projectionAt,
    settings.reviewPolicy,
    settings.targetExamDate,
  );
  const annotations = new Map(old.map((g) => [g.questionId, g]));
  for (const gap of projection.gaps) {
    const previous = annotations.get(gap.questionId);
    if (previous) {
      gap.note = previous.note;
      gap.cause = previous.cause;
    }
  }
  // Keep learner annotations even when a later official decision excludes the item.
  for (const previous of old)
    if (
      !projection.gaps.some((g) => g.questionId === previous.questionId) &&
      (previous.note || previous.cause)
    )
      projection.gaps.push({
        ...previous,
        status: "recovered",
        evidenceAttemptIds: [],
      });
  await db.gaps.clear();
  await db.reviews.clear();
  await db.gaps.bulkPut(projection.gaps);
  await db.reviews.bulkPut(projection.reviews);
}
export async function saveSettings(
  db: StudyDb,
  settings: Settings,
): Promise<void> {
  const valid = SettingsSchema.parse(settings);
  await db.transaction(
    "rw",
    [
      db.settings,
      db.gaps,
      db.reviews,
      db.attempts,
      db.grades,
      db.feedback,
      db.sessions,
    ],
    async () => {
      await db.settings.put({ id: "current", value: valid });
      await recalculate(db, new Date().toISOString());
    },
  );
}
async function addSnapshot(db: StudyDb, q: QuestionRevision): Promise<void> {
  const old = await db.questionSnapshots.get([q.id, q.revision]);
  if (old && canonical(old) !== canonical(q))
    throw new Error("Conflito de revisão do conteúdo");
  if (!old) await db.questionSnapshots.add(q);
}
async function assertNoActiveAssessment(
  db: StudyDb,
  questionIds: string[],
): Promise<void> {
  const ids = new Set(questionIds);
  const active = await db.sessions
    .where("status")
    .equals("active")
    .filter((session) => session.mode === "assessment")
    .toArray();
  if (
    active.some((session) =>
      session.questions.some((question) => ids.has(question.id)),
    )
  )
    throw new Error("Questão protegida durante avaliação ativa");
}
export async function startSession(
  db: StudyDb,
  input: {
    questions: QuestionRevision[];
    mode: "study" | "assessment";
    durationMs: number | null;
    purpose?: StudySession["purpose"];
  },
  now: Instant,
): Promise<StudySession> {
  const at = normalizeInstant(now);
  if (!["study", "assessment"].includes(input.mode) || !input.questions.length)
    throw new Error("Sessão inválida");
  if (
    (input.purpose !== undefined &&
      !["practice", "guided", "benchmark"].includes(input.purpose)) ||
    (input.purpose === "benchmark" && input.mode !== "assessment") ||
    (input.purpose === "guided" && input.mode !== "study")
  )
    throw new Error("Finalidade incompatível com o modo da sessão");
  // A question may be used only once per session; separate sessions preserve separate revisions.
  const ids = new Set<string>();
  for (const q of input.questions) {
    QuestionRevisionSchema.parse(q);
    if (!isReady(q)) throw new Error("Questão não pronta");
    if (input.purpose === "benchmark") {
      if (!q.assessmentOnly)
        throw new Error("Avaliação inédita exige questões reservadas");
      if (!q.difficulty)
        throw new Error("Avaliação inédita exige dificuldade declarada");
    } else if (q.assessmentOnly)
      throw new Error("Questão reservada para avaliação inédita");
    if (ids.has(q.id)) throw new Error("Questão duplicada na sessão");
    ids.add(q.id);
  }
  if (
    input.mode === "assessment" &&
    (!Number.isSafeInteger(input.durationMs) || (input.durationMs ?? 0) <= 0)
  )
    throw new Error("Duração inválida");
  const session: StudySession = {
    id: crypto.randomUUID(),
    mode: input.mode,
    purpose: input.purpose ?? "practice",
    status: "active",
    questions: input.questions.map((q) => ({ id: q.id, revision: q.revision })),
    startedAt: at,
    deadlineAt:
      input.mode === "assessment"
        ? new Date(Date.parse(at) + input.durationMs!).toISOString()
        : null,
    completedAt: null,
  };
  await db.transaction(
    "rw",
    [db.questionSnapshots, db.sessions, db.attempts, db.feedback, db.drafts],
    async () => {
      const existingSessions = await db.sessions.toArray();
      session.order =
        Math.max(
          existingSessions.length,
          ...existingSessions.map((existing) => existing.order ?? 0),
        ) + 1;
      if (!Number.isSafeInteger(session.order))
        throw new Error("Ordem de sessão inválida");
      if (input.purpose === "benchmark") {
        const [attempts, feedback, drafts] = await Promise.all([
          db.attempts.toArray(),
          db.feedback.toArray(),
          db.drafts.toArray(),
        ]);
        const exposed = new Set([
          ...attempts.map((a) => a.questionId),
          ...feedback.map((e) => e.questionId),
          ...existingSessions.flatMap((s) => s.questions.map((q) => q.id)),
          ...drafts.map((d) => d.questionId),
        ]);
        if (input.questions.some((q) => exposed.has(q.id)))
          throw new Error(
            "Questão já exposta; a avaliação exige itens inéditos",
          );
      }
      await assertNoActiveAssessment(
        db,
        input.questions.map((q) => q.id),
      );
      for (const q of input.questions) await addSnapshot(db, q);
      await db.sessions.add(session);
    },
  );
  return session;
}
async function validateSession(
  db: StudyDb,
  input: AttemptInput,
  now: Instant,
  allowCompletion = false,
): Promise<{ session: StudySession; q: QuestionRevision }> {
  const session = await db.sessions.get(input.sessionId);
  if (!session || session.status !== "active")
    throw new Error("Sessão finalizada ou inexistente");
  if (Date.parse(now) < Date.parse(session.startedAt))
    throw new Error("Instante anterior à sessão");
  if (
    !allowCompletion &&
    session.deadlineAt &&
    Date.parse(now) >= Date.parse(session.deadlineAt)
  )
    throw new Error("Prazo da avaliação encerrado");
  if (
    !session.questions.some(
      (q) => q.id === input.questionId && q.revision === input.questionRevision,
    )
  )
    throw new Error("Questão ou revisão fora da sessão");
  const q = await db.questionSnapshots.get([
    input.questionId,
    input.questionRevision,
  ]);
  const legacySession =
    q &&
    session.purpose === undefined &&
    getBlockers(q).every((blocker) => blocker === "missing_skills");
  if (!q || (!isReady(q) && !legacySession))
    throw new Error("Questão não pronta");
  if (q.assessmentOnly && session.purpose !== "benchmark")
    throw new Error("Questão reservada para avaliação inédita");
  return { session, q };
}
async function hasLaterRelevantFeedback(
  db: StudyDb,
  q: QuestionRevision,
  at: Instant,
): Promise<boolean> {
  const laterFeedback = await db.feedback
    .filter((event) => Date.parse(event.at) > Date.parse(at))
    .toArray();
  if (!laterFeedback.length) return false;
  const snapshots = await db.questionSnapshots.toArray();
  // A committed exposure happened before this write, even if the clock moved
  // backwards. Do not drop it from the baseline and manufacture delayed evidence.
  // Legacy feedback can refer to any correction revision stored for that item.
  return laterFeedback.some(
    (event) =>
      event.questionId === q.id ||
      snapshots.some(
        (snapshot) =>
          snapshot.id === event.questionId &&
          (event.questionRevision === undefined ||
            snapshot.revision === event.questionRevision) &&
          snapshot.subject === q.subject &&
          snapshot.skills.some((skill) => q.skills.includes(skill)),
      ),
  );
}
export async function saveDraft(
  db: StudyDb,
  input: AttemptInput,
  now: Instant,
): Promise<void> {
  validateInput(input);
  input = AttemptInputSchema.parse(input);
  const at = normalizeInstant(now);
  await db.transaction(
    "rw",
    [
      db.sessions,
      db.questionSnapshots,
      db.drafts,
      db.attempts,
      db.feedback,
      db.submissionReceipts,
    ],
    async () => {
      const { session, q } = await validateSession(db, input, at);
      if (session.purpose === "guided") input = { ...input, consulted: true };
      if (
        (await db.submissionReceipts.get(input.submissionId)) ||
        (await db.drafts
          .filter(
            (d) =>
              d.submissionId === input.submissionId &&
              (d.sessionId !== input.sessionId ||
                d.questionId !== input.questionId),
          )
          .count())
      )
        throw new Error("Conflito de identificador do rascunho");
      if (
        await db.attempts
          .where("sessionId")
          .equals(input.sessionId)
          .filter((a) => a.questionId === input.questionId)
          .count()
      )
        throw new Error("Questão já enviada");
      const previous = await db.drafts.get([input.sessionId, input.questionId]);
      if (previous && Date.parse(previous.updatedAt) > Date.parse(at))
        throw new Error("Rascunho mais recente já salvo");
      if (await hasLaterRelevantFeedback(db, q, at))
        throw new Error("Instante anterior ao feedback já consultado");
      await db.drafts.put({ ...input, updatedAt: at });
    },
  );
}
async function persistAttempt(
  db: StudyDb,
  input: AttemptInput,
  at: Instant,
  allowCompletion = false,
): Promise<Attempt> {
  input = AttemptInputSchema.parse(input);
  // Normalize before the receipt comparison, including retries after completion.
  if ((await db.sessions.get(input.sessionId))?.purpose === "guided")
    input = { ...input, consulted: true };
  const receipt = await db.submissionReceipts.get(input.submissionId);
  if (receipt) {
    if (receipt.payloadHash !== payloadHash(input))
      throw new Error("Conflito de envio");
    const original = await db.attempts.get(receipt.attemptId);
    if (!original) throw new Error("Recibo sem tentativa");
    return original;
  }
  if (
    await db.drafts
      .filter(
        (draft) =>
          draft.submissionId === input.submissionId &&
          (draft.sessionId !== input.sessionId ||
            draft.questionId !== input.questionId),
      )
      .count()
  )
    throw new Error("Conflito de identificador do rascunho");
  const { session, q } = await validateSession(db, input, at, allowCompletion);
  if (session.mode === "study")
    await assertNoActiveAssessment(db, [input.questionId]);
  if (
    await db.attempts
      .where("sessionId")
      .equals(session.id)
      .filter((a) => a.questionId === input.questionId)
      .count()
  )
    throw new Error("Questão já enviada nesta sessão");
  const laterRelevantFeedback = await hasLaterRelevantFeedback(db, q, at);
  if (laterRelevantFeedback && !allowCompletion)
    throw new Error("Instante anterior ao feedback já consultado");
  const settings = await getSettings(db);
  const prior = (
    await db.feedback.where("questionId").equals(input.questionId).toArray()
  )
    // A feedback transaction committed before this submit is already an exposure,
    // even when the clock records both operations in the same millisecond.
    .filter((e) => Date.parse(e.at) <= Date.parse(at))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const [feedbackEvents, previousAttempts, snapshots] = await Promise.all([
    db.feedback.toArray(),
    db.attempts.toArray(),
    db.questionSnapshots.toArray(),
  ]);
  const previousById = new Map(previousAttempts.map((a) => [a.id, a]));
  const snapshotByRevision = new Map(
    snapshots.map((item) => [canonical([item.id, item.revision]), item]),
  );
  const exposures = feedbackEvents
    .filter((event) => Date.parse(event.at) <= Date.parse(at))
    .sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id),
    );
  const skillFeedback: NonNullable<Attempt["skillFeedback"]> = [];
  // Expired assessments finalize at their deadline. Feedback committed since
  // that deadline must not prevent closing, or become a fabricated baseline.
  let unknownSkillExposure =
    laterRelevantFeedback ||
    (session.purpose === undefined &&
      getBlockers(q).includes("missing_skills"));
  for (const skill of new Set(q.skills)) {
    const event = exposures.find((event) => {
      const previous = previousById.get(event.attemptId);
      const snapshot =
        previous && event.questionRevision !== undefined
          ? snapshotByRevision.get(
              canonical([previous.questionId, event.questionRevision]),
            )
          : undefined;
      return snapshot?.subject === q.subject && snapshot.skills.includes(skill);
    });
    // Legacy feedback showed the latest correction, which may differ from the
    // attempt's original snapshot. Any stored revision can therefore be relevant.
    const ambiguous = exposures.some(
      (exposure) =>
        exposure.questionRevision === undefined &&
        (!event || Date.parse(exposure.at) >= Date.parse(event.at)) &&
        snapshots.some(
          (snapshot) =>
            snapshot.id === exposure.questionId &&
            snapshot.subject === q.subject &&
            snapshot.skills.includes(skill),
        ),
    );
    if (ambiguous) unknownSkillExposure = true;
    if (event)
      skillFeedback.push({
        subject: q.subject,
        skill,
        at: event.at,
        studyDate: event.studyDate,
      });
  }
  const attempt: Attempt = {
    ...input,
    id: crypto.randomUUID(),
    at,
    studyDate: studyDate(at, settings.timezone),
    mode: session.mode,
    firstAttempt: !(await db.attempts
      .where("questionId")
      .equals(input.questionId)
      .count()),
    priorFeedbackAt: prior?.at ?? null,
    priorFeedbackDate: prior?.studyDate ?? null,
    ...(unknownSkillExposure ? {} : { skillFeedback }),
  };
  await addSnapshot(db, q);
  await db.attempts.add(attempt);
  await db.grades.add(GradeSchema.parse(gradeAttempt(attempt, q, at)));
  await db.submissionReceipts.add({
    submissionId: input.submissionId,
    attemptId: attempt.id,
    payloadHash: payloadHash(input),
  });
  await db.drafts.delete([input.sessionId, input.questionId]);
  return attempt;
}
export async function submitAttempt(
  db: StudyDb,
  input: AttemptInput,
  now: Instant,
): Promise<Attempt> {
  validateInput(input);
  input = AttemptInputSchema.parse(input);
  const at = normalizeInstant(now);
  return db.transaction("rw", db.tables, async () => {
    const existing = await db.submissionReceipts.get(input.submissionId);
    const attempt = await persistAttempt(db, input, at);
    if (!existing) await recalculate(db, at);
    return attempt;
  });
}
export async function revealFeedback(
  db: StudyDb,
  attemptId: string,
  now: Instant,
  exposureId?: string,
): Promise<FeedbackEvent> {
  const at = normalizeInstant(now);
  if (
    exposureId !== undefined &&
    (typeof exposureId !== "string" ||
      !exposureId.trim() ||
      exposureId.length > 500)
  )
    throw new Error("Identificador de exposição inválido");
  return db.transaction("rw", db.tables, async () => {
    const attempt = await db.attempts.get(attemptId);
    if (!attempt) throw new Error("Tentativa não persistida");
    const session = await db.sessions.get(attempt.sessionId);
    await assertNoActiveAssessment(db, [attempt.questionId]);
    if (!session || !canRevealFeedback(session))
      throw new Error("Feedback fechado durante avaliação");
    if (
      Date.parse(at) < Date.parse(attempt.at) ||
      (session.mode === "assessment" &&
        session.completedAt &&
        Date.parse(at) < Date.parse(session.completedAt))
    )
      throw new Error("Feedback anterior à tentativa");
    const eventId = `feedback:${attemptId}:${exposureId ?? at}`;
    const existing = await db.feedback.get(eventId);
    if (existing) return existing;
    const settings = await getSettings(db);
    const decisions = (
      await db.grades.where("attemptId").equals(attemptId).toArray()
    ).filter((grade) => Date.parse(grade.at) <= Date.parse(at));
    const correctionRevision =
      latestGrades(decisions).get(attemptId)?.questionRevision ??
      attempt.questionRevision;
    const event: FeedbackEvent = {
      id: eventId,
      attemptId,
      questionId: attempt.questionId,
      questionRevision: correctionRevision,
      at,
      studyDate: studyDate(at, settings.timezone),
    };
    await db.feedback.add(FeedbackEventSchema.parse(event));
    await recalculate(db, at);
    return event;
  });
}
export async function completeAssessment(
  db: StudyDb,
  sessionId: string,
  now: Instant,
): Promise<StudySession> {
  const requested = normalizeInstant(now);
  return db.transaction("rw", db.tables, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.mode !== "assessment")
      throw new Error("Avaliação inexistente");
    if (session.status === "completed") return session;
    if (Date.parse(requested) < Date.parse(session.startedAt))
      throw new Error("Instante anterior à sessão");
    const ended =
      session.deadlineAt &&
      Date.parse(requested) >= Date.parse(session.deadlineAt)
        ? session.deadlineAt
        : requested;
    for (const question of session.questions) {
      if (
        await db.attempts
          .where("sessionId")
          .equals(sessionId)
          .filter((a) => a.questionId === question.id)
          .count()
      )
        continue;
      const draft = await db.drafts.get([sessionId, question.id]);
      const valid =
        draft &&
        Date.parse(draft.updatedAt) <= Date.parse(ended) &&
        (!session.deadlineAt ||
          Date.parse(draft.updatedAt) < Date.parse(session.deadlineAt));
      const input: AttemptInput = valid
        ? draft
        : {
            submissionId: `completion:${sessionId}:${question.id}`,
            sessionId,
            questionId: question.id,
            questionRevision: question.revision,
            response: null,
            confidence: "low",
            guessed: false,
            doubt: false,
            usedHint: false,
            consulted: false,
            activeMs: 0,
          };
      validateInput(input);
      await persistAttempt(db, input, ended, true);
    }
    const completed: StudySession = {
      ...session,
      status: "completed",
      completedAt: ended,
    };
    await db.sessions.put(completed);
    await db.drafts.where("sessionId").equals(sessionId).delete();
    await recalculate(db, ended);
    return completed;
  });
}
export async function updateGapNote(
  db: StudyDb,
  questionId: string,
  cause: ErrorCause | null,
  note: string,
): Promise<void> {
  if (
    (cause !== null &&
      ![
        "concept",
        "method",
        "prerequisite",
        "calculation",
        "interpretation",
        "time",
      ].includes(cause)) ||
    typeof note !== "string" ||
    note.length > 500_000
  )
    throw new Error("Anotação inválida");
  await db.transaction("rw", db.gaps, async () => {
    const gap = await db.gaps.get(questionId);
    if (!gap) throw new Error("Lacuna inexistente");
    await db.gaps.put(GapSchema.parse({ ...gap, cause, note }));
  });
}
export async function updateDailyPlan(
  db: StudyDb,
  plan: DailyPlan,
  settings: Settings,
): Promise<void> {
  SettingsSchema.parse(settings);
  DailyPlanSchema.parse(plan);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.date) ||
    !Array.isArray(plan.tasks) ||
    !Array.isArray(plan.deferredQuestionIds)
  )
    throw new Error("Plano inválido");
  const ids = new Set<string>();
  for (const task of plan.tasks) {
    if (
      !task.questionId ||
      ids.has(task.questionId) ||
      !Number.isSafeInteger(task.minutes) ||
      task.minutes <= 0 ||
      !["review", "gap", "maintenance", "new"].includes(task.reason)
    )
      throw new Error("Tarefa inválida");
    ids.add(task.questionId);
  }
  if (
    plan.tasks.reduce((n, t) => n + t.minutes, 0) > settings.dailyMinutes ||
    plan.tasks.length > 12 ||
    plan.deferredQuestionIds.some((id) => !id || ids.has(id)) ||
    new Set(plan.deferredQuestionIds).size !== plan.deferredQuestionIds.length
  )
    throw new Error("Plano excede a capacidade");
  await db.plans.put(plan);
}
export async function regradeAttempt(
  db: StudyDb,
  attemptId: string,
  newQuestionRevision: QuestionRevision,
  now: Instant,
): Promise<Grade> {
  const at = normalizeInstant(now);
  QuestionRevisionSchema.parse(newQuestionRevision);
  const q = newQuestionRevision;
  const verified = q.quality.annulled ? q.annulment : q.key;
  if (
    !verified?.verified ||
    !verified.revision.trim() ||
    !verified.source.trim() ||
    !verified.location.trim() ||
    !verified.reviewer.trim()
  )
    throw new Error("Decisão oficial não conferida");
  return db.transaction("rw", db.tables, async () => {
    const attempt = await db.attempts.get(attemptId);
    if (!attempt || attempt.questionId !== q.id)
      throw new Error("Questão diferente da tentativa");
    if (Date.parse(at) < Date.parse(attempt.at))
      throw new Error("Reavaliação anterior à tentativa");
    const grade = gradeAttempt(attempt, q, at, "regrade");
    const old = await db.grades
      .where("[attemptId+decisionRevision]")
      .equals([attemptId, grade.decisionRevision])
      .first();
    if (old) {
      const snapshot = await db.questionSnapshots.get([q.id, q.revision]);
      if (
        !snapshot ||
        canonical(snapshot) !== canonical(q) ||
        old.questionRevision !== q.revision
      )
        throw new Error("Conflito de decisão");
      return old;
    }
    const previous = await db.grades
      .where("attemptId")
      .equals(attemptId)
      .toArray();
    grade.order =
      Math.max(
        0,
        ...previous.map(
          (decision) => decision.order ?? (decision.kind === "initial" ? 0 : 1),
        ),
      ) + 1;
    await addSnapshot(db, q);
    await db.grades.add(GradeSchema.parse(grade));
    await recalculate(db, at);
    return grade;
  });
}

export async function completeStudySession(
  db: StudyDb,
  sessionId: string,
  now: Instant,
): Promise<StudySession> {
  const at = normalizeInstant(now);
  return db.transaction("rw", [db.sessions, db.attempts], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.mode !== "study")
      throw new Error("Sessão de estudo inexistente");
    if (session.status === "completed") return session;
    const attempts = await db.attempts
      .where("sessionId")
      .equals(sessionId)
      .toArray();
    if (
      session.questions.some(
        (q) =>
          !attempts.some(
            (a) => a.questionId === q.id && a.questionRevision === q.revision,
          ),
      )
    )
      throw new Error("Salve todas as respostas antes de encerrar");
    if (
      Date.parse(at) < Date.parse(session.startedAt) ||
      attempts.some((a) => Date.parse(at) < Date.parse(a.at))
    )
      throw new Error("Encerramento anterior às respostas");
    const completed: StudySession = {
      ...session,
      status: "completed",
      completedAt: at,
    };
    await db.sessions.put(completed);
    return completed;
  });
}

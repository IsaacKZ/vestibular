import { z } from "zod";
import type {
  Attempt,
  DailyPlan,
  DraftRecord,
  FeedbackEvent,
  Gap,
  Grade,
  Instant,
  QuestionRevision,
  Review,
  Settings,
  StudySession,
} from "../content/types";
import {
  AttemptSchema,
  DailyPlanSchema,
  DraftRecordSchema,
  FeedbackEventSchema,
  GapSchema,
  GradeSchema,
  QuestionRevisionSchema,
  ReviewSchema,
  SettingsSchema,
  StudySessionSchema,
} from "../content/schema";
import { getBlockers, isReady } from "../content/quality";
import type { StudyDb, SubmissionReceipt } from "./db";
import {
  canonical,
  getSettings,
  normalizeInstant,
  payloadHash,
  recalculate,
} from "./study-service";
export interface BackupEnvelope {
  format: "udesc-study";
  schemaVersion: 1;
  exportedAt: Instant;
  data: {
    questionSnapshots: QuestionRevision[];
    sessions: StudySession[];
    attempts: Attempt[];
    grades: Grade[];
    feedback: FeedbackEvent[];
    gaps: Gap[];
    reviews: Review[];
    settings: Settings;
    drafts: DraftRecord[];
    plans: DailyPlan[];
    submissionReceipts: SubmissionReceipt[];
  };
}
export interface ImportPreview {
  valid: boolean;
  added: number;
  duplicates: number;
  conflicts: string[];
  errors: string[];
}
const BackupSchema = z
  .object({
    format: z.literal("udesc-study"),
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    data: z
      .object({
        questionSnapshots: z.array(QuestionRevisionSchema),
        sessions: z.array(StudySessionSchema),
        attempts: z.array(AttemptSchema),
        grades: z.array(GradeSchema),
        feedback: z.array(FeedbackEventSchema),
        gaps: z.array(GapSchema),
        reviews: z.array(ReviewSchema),
        settings: SettingsSchema,
        drafts: z.array(DraftRecordSchema),
        plans: z.array(DailyPlanSchema),
        submissionReceipts: z.array(
          z
            .object({
              submissionId: z.string().min(1),
              attemptId: z.string().min(1),
              payloadHash: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();
const storeNames = [
  "questionSnapshots",
  "sessions",
  "attempts",
  "grades",
  "feedback",
  "gaps",
  "reviews",
  "drafts",
  "plans",
  "submissionReceipts",
] as const;
type StoreName = (typeof storeNames)[number];
function recordKey(name: StoreName, record: unknown): string {
  const row = record as Record<string, unknown>;
  if (name === "questionSnapshots") return canonical([row.id, row.revision]);
  if (name === "drafts") return canonical([row.sessionId, row.questionId]);
  return String(
    row[
      name === "gaps" || name === "reviews"
        ? "questionId"
        : name === "plans"
          ? "date"
          : name === "submissionReceipts"
            ? "submissionId"
            : "id"
    ],
  );
}
export async function exportBackup(
  db: StudyDb,
  now: Instant,
): Promise<BackupEnvelope> {
  const exportedAt = normalizeInstant(now);
  return db.transaction("r", db.tables, async () => {
    const values = await Promise.all(
      storeNames.map((name) => db.table(name).toArray()),
    );
    const arrays = Object.fromEntries(
      storeNames.map((name, index) => [name, values[index]]),
    );
    return {
      format: "udesc-study",
      schemaVersion: 1,
      exportedAt,
      data: {
        ...arrays,
        settings: await getSettings(db),
      } as BackupEnvelope["data"],
    };
  });
}
function validateReferences(
  data: BackupEnvelope["data"],
  errors: string[],
): void {
  const snapshots = new Map(
    data.questionSnapshots.map((q) => [canonical([q.id, q.revision]), q]),
  );
  const sessions = new Map(data.sessions.map((s) => [s.id, s]));
  const attempts = new Map(data.attempts.map((a) => [a.id, a]));
  const submissions = new Set<string>(),
    sessionAnswers = new Set<string>(),
    gradeDecisions = new Set<string>();
  // Historical dates belong to the timezone used when the event was recorded.
  // Any supported timezone can shift a UTC date by at most one day.
  function validateStudyDate(event: {
    id: string;
    at: Instant;
    studyDate: string;
  }) {
    const utcDay = Date.parse(new Date(event.at).toISOString().slice(0, 10));
    if (Math.abs(Date.parse(event.studyDate) - utcDay) > 86_400_000)
      errors.push(`Data de estudo incompatível com o instante: ${event.id}`);
  }
  for (const session of data.sessions) {
    const ids = new Set<string>();
    for (const q of session.questions) {
      if (ids.has(q.id))
        errors.push(`Sessão com questão duplicada: ${session.id}`);
      ids.add(q.id);
      const snapshot = snapshots.get(canonical([q.id, q.revision]));
      if (!snapshot)
        errors.push(`Snapshot ausente na sessão: ${session.id}/${q.id}`);
      else if (
        !isReady(snapshot) &&
        !(
          session.purpose === undefined &&
          data.attempts
            .filter(
              (a) =>
                a.sessionId === session.id &&
                a.questionId === q.id &&
                a.questionRevision === q.revision,
            )
            .every((a) => a.skillFeedback === undefined) &&
          getBlockers(snapshot).every((blocker) => blocker === "missing_skills")
        )
      )
        errors.push(`Conteúdo não conferido na sessão: ${session.id}/${q.id}`);
      if (
        snapshot &&
        (session.purpose === "benchmark"
          ? !snapshot.assessmentOnly ||
            !snapshot.difficulty ||
            data.sessions.some(
              (other) =>
                other.id !== session.id &&
                other.questions.some((item) => item.id === q.id) &&
                (other.order !== undefined && session.order !== undefined
                  ? other.order <= session.order
                  : Date.parse(other.startedAt) <=
                    Date.parse(session.startedAt)),
            )
          : snapshot.assessmentOnly)
      )
        errors.push(`Reserva de avaliação inválida: ${session.id}/${q.id}`);
    }
    if (
      Date.parse(session.deadlineAt ?? session.startedAt) <
        Date.parse(session.startedAt) ||
      (session.mode === "assessment" && !session.deadlineAt) ||
      (session.status === "completed" && !session.completedAt) ||
      (session.status === "active" && session.completedAt !== null) ||
      (session.completedAt &&
        (Date.parse(session.completedAt) < Date.parse(session.startedAt) ||
          (session.deadlineAt &&
            Date.parse(session.completedAt) > Date.parse(session.deadlineAt))))
    )
      errors.push(`Estado de sessão inválido: ${session.id}`);
  }
  function linked(
    row: { sessionId: string; questionId: string; questionRevision: string },
    label: string,
  ) {
    const session = sessions.get(row.sessionId);
    if (
      !session ||
      !session.questions.some(
        (q) => q.id === row.questionId && q.revision === row.questionRevision,
      )
    )
      errors.push(`Questão fora da sessão: ${label}`);
    if (!snapshots.has(canonical([row.questionId, row.questionRevision])))
      errors.push(`Snapshot ausente: ${label}`);
    return session;
  }
  for (const attempt of data.attempts) {
    validateStudyDate(attempt);
    const session = linked(attempt, attempt.id);
    if (
      session &&
      (attempt.mode !== session.mode ||
        (session.purpose === "guided" && !attempt.consulted) ||
        Date.parse(attempt.at) < Date.parse(session.startedAt) ||
        (session.deadlineAt &&
          Date.parse(attempt.at) > Date.parse(session.deadlineAt)))
    )
      errors.push(`Instante ou modo inválido: ${attempt.id}`);
    const answerKey = canonical([attempt.sessionId, attempt.questionId]);
    if (submissions.has(attempt.submissionId) || sessionAnswers.has(answerKey))
      errors.push(`Tentativa duplicada: ${attempt.id}`);
    submissions.add(attempt.submissionId);
    sessionAnswers.add(answerKey);
    if (
      (attempt.priorFeedbackAt === null) !==
        (attempt.priorFeedbackDate === null) ||
      (attempt.priorFeedbackAt &&
        (!data.feedback.some(
          (event) =>
            event.questionId === attempt.questionId &&
            event.at === attempt.priorFeedbackAt &&
            event.studyDate === attempt.priorFeedbackDate,
        ) ||
          Date.parse(attempt.priorFeedbackAt) > Date.parse(attempt.at)))
    )
      errors.push(`Exposição anterior inválida: ${attempt.id}`);
    const snapshot = snapshots.get(
      canonical([attempt.questionId, attempt.questionRevision]),
    );
    const baselineSkills = new Set<string>();
    for (const exposure of attempt.skillFeedback ?? []) {
      validateStudyDate({ ...exposure, id: attempt.id });
      const key = canonical([exposure.subject, exposure.skill]);
      const matchingEvent = data.feedback.some((event) => {
        const priorAttempt = attempts.get(event.attemptId);
        const priorQuestion =
          priorAttempt && event.questionRevision !== undefined
            ? snapshots.get(
                canonical([priorAttempt.questionId, event.questionRevision]),
              )
            : undefined;
        return (
          event.at === exposure.at &&
          event.studyDate === exposure.studyDate &&
          priorQuestion?.subject === exposure.subject &&
          priorQuestion.skills.includes(exposure.skill)
        );
      });
      if (
        baselineSkills.has(key) ||
        snapshot?.subject !== exposure.subject ||
        !snapshot?.skills.includes(exposure.skill) ||
        !matchingEvent ||
        Date.parse(exposure.at) > Date.parse(attempt.at)
      )
        errors.push(`Exposição por habilidade inválida: ${attempt.id}`);
      baselineSkills.add(key);
    }
  }
  const draftTokens = new Set<string>();
  for (const draft of data.drafts) {
    if (
      draftTokens.has(draft.submissionId) ||
      submissions.has(draft.submissionId)
    )
      errors.push(
        `Identificador de rascunho em conflito: ${draft.submissionId}`,
      );
    draftTokens.add(draft.submissionId);
    const session = linked(
      draft,
      `rascunho ${draft.sessionId}/${draft.questionId}`,
    );
    if (
      session &&
      (session.status !== "active" ||
        Date.parse(draft.updatedAt) < Date.parse(session.startedAt) ||
        (session.deadlineAt &&
          Date.parse(draft.updatedAt) >= Date.parse(session.deadlineAt)))
    )
      errors.push(`Rascunho fora do prazo: ${draft.questionId}`);
  }
  for (const grade of data.grades) {
    const attempt = attempts.get(grade.attemptId);
    const q =
      attempt &&
      snapshots.get(canonical([attempt.questionId, grade.questionRevision]));
    if (
      attempt &&
      (Date.parse(grade.at) < Date.parse(attempt.at) ||
        (grade.kind === "initial" &&
          grade.questionRevision !== attempt.questionRevision))
    )
      errors.push(`Grade com instante ou revisão inválida: ${grade.id}`);
    if (!attempt || !q)
      errors.push(`Grade sem tentativa ou snapshot: ${grade.id}`);
    else {
      const decision = q.quality.annulled ? q.annulment : q.key;
      const prefix = q.quality.annulled ? "annulment:" : "key:";
      if (
        !decision?.verified ||
        grade.decisionRevision !== prefix + decision.revision ||
        grade.keyRevision !== (q.quality.annulled ? null : q.key?.revision) ||
        grade.correct !==
          (q.quality.annulled ? null : attempt.response === q.key?.letter) ||
        grade.exclusionReason !== (q.quality.annulled ? "annulled" : null)
      )
        errors.push(`Grade não corresponde à decisão: ${grade.id}`);
    }
    const decisionKey = canonical([grade.attemptId, grade.decisionRevision]);
    if (gradeDecisions.has(decisionKey))
      errors.push(`Decisão duplicada: ${grade.id}`);
    gradeDecisions.add(decisionKey);
  }
  for (const feedback of data.feedback) {
    validateStudyDate(feedback);
    const attempt = attempts.get(feedback.attemptId);
    const session = attempt && sessions.get(attempt.sessionId);
    if (
      !attempt ||
      feedback.questionId !== attempt.questionId ||
      (feedback.questionRevision !== undefined &&
        !snapshots.has(
          canonical([feedback.questionId, feedback.questionRevision]),
        )) ||
      Date.parse(feedback.at) < Date.parse(attempt.at) ||
      (session?.mode === "assessment" &&
        (session.status !== "completed" ||
          Date.parse(feedback.at) < Date.parse(session.completedAt!)))
    )
      errors.push(`Feedback inválido: ${feedback.id}`);
  }
  for (const attempt of data.attempts) {
    if (
      !data.grades.some(
        (g) => g.attemptId === attempt.id && g.kind === "initial",
      )
    )
      errors.push(`Tentativa sem grade inicial: ${attempt.id}`);
    const receipt = data.submissionReceipts.find(
      (r) => r.submissionId === attempt.submissionId,
    );
    if (
      !receipt ||
      receipt.attemptId !== attempt.id ||
      receipt.payloadHash !== payloadHash(attempt)
    )
      errors.push(`Tentativa sem recibo válido: ${attempt.id}`);
  }
  for (const receipt of data.submissionReceipts) {
    const attempt = attempts.get(receipt.attemptId);
    if (
      !attempt ||
      receipt.submissionId !== attempt.submissionId ||
      receipt.payloadHash !== payloadHash(attempt)
    )
      errors.push(`Recibo inválido: ${receipt.submissionId}`);
  }
  for (const session of data.sessions)
    if (
      session.mode === "assessment" &&
      session.status === "completed" &&
      session.questions.some(
        (q) =>
          !data.attempts.some(
            (a) => a.sessionId === session.id && a.questionId === q.id,
          ),
      )
    )
      errors.push(`Avaliação encerrada sem todas as respostas: ${session.id}`);
  for (const plan of data.plans) {
    const ids = plan.tasks.map((task) => task.questionId);
    if (
      new Set(ids).size !== ids.length ||
      new Set(plan.deferredQuestionIds).size !==
        plan.deferredQuestionIds.length ||
      plan.deferredQuestionIds.some((id) => ids.includes(id)) ||
      plan.tasks.reduce((sum, task) => sum + task.minutes, 0) > 120 ||
      plan.tasks.length > 12
    )
      errors.push(`Plano inválido: ${plan.date}`);
  }
  for (const gap of data.gaps)
    if (
      !data.questionSnapshots.some((q) => q.id === gap.questionId) ||
      gap.evidenceAttemptIds.some(
        (id) =>
          !attempts.has(id) || attempts.get(id)?.questionId !== gap.questionId,
      )
    )
      errors.push(`Lacuna sem referência: ${gap.questionId}`);
  for (const review of data.reviews)
    if (!data.questionSnapshots.some((q) => q.id === review.questionId))
      errors.push(`Revisão sem snapshot: ${review.questionId}`);
}
async function inspect(
  db: StudyDb,
  envelope: BackupEnvelope,
): Promise<{ preview: ImportPreview; data: BackupEnvelope["data"] }> {
  const result: ImportPreview = {
    valid: true,
    added: 0,
    duplicates: 0,
    conflicts: [],
    errors: [],
  };
  const combined = {} as BackupEnvelope["data"];
  for (const name of storeNames) {
    const incoming = envelope.data[name] as unknown[];
    const current = await db.table(name).toArray();
    const map = new Map(current.map((row) => [recordKey(name, row), row]));
    const seen = new Set<string>();
    for (const row of incoming) {
      const key = recordKey(name, row);
      if (seen.has(key)) {
        result.errors.push(`Identificador repetido no backup: ${name}:${key}`);
        continue;
      }
      seen.add(key);
      const old = map.get(key);
      if (old) {
        if (name === "gaps") {
          const previous = old as Gap;
          const incomingGap = row as Gap;
          for (const field of ["note", "cause"] as const)
            if (
              previous[field] &&
              incomingGap[field] &&
              previous[field] !== incomingGap[field]
            )
              result.conflicts.push(`gaps:${key}:${field}`);
          map.set(key, {
            ...previous,
            note: previous.note || incomingGap.note,
            cause: previous.cause ?? incomingGap.cause,
          });
          result.duplicates++;
        } else if (name === "reviews") {
          // These rows are projections. Only the merged history determines them.
          result.duplicates++;
        } else if (canonical(old) !== canonical(row))
          result.conflicts.push(`${name}:${key}`);
        else result.duplicates++;
      } else {
        result.added++;
        map.set(key, row);
      }
    }
    (combined as unknown as Record<string, unknown>)[name] = Array.from(
      map.values(),
    );
  }
  const existing = await db.settings.get("current");
  if (existing) {
    if (canonical(existing.value) !== canonical(envelope.data.settings))
      result.conflicts.push("settings:current");
    else result.duplicates++;
  } else result.added++;
  combined.settings = envelope.data.settings;
  validateReferences(combined, result.errors);
  const orderedDecisions = new Set<string>();
  for (const grade of combined.grades) {
    const order = grade.order ?? (grade.kind === "initial" ? 0 : 1);
    const key = canonical([grade.attemptId, Date.parse(grade.at), order]);
    if (orderedDecisions.has(key))
      result.conflicts.push(`grades:${grade.attemptId}:ordem ambígua`);
    orderedDecisions.add(key);
  }
  result.valid = !result.errors.length && !result.conflicts.length;
  return { preview: result, data: combined };
}
export async function previewImport(
  db: StudyDb,
  json: unknown,
): Promise<ImportPreview> {
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success)
    return {
      valid: false,
      added: 0,
      duplicates: 0,
      conflicts: [],
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  if (canonical(json) !== canonical(parsed.data))
    return {
      valid: false,
      added: 0,
      duplicates: 0,
      conflicts: [],
      errors: ["Campos desconhecidos no backup."],
    };
  return db.transaction(
    "r",
    db.tables,
    async () => (await inspect(db, parsed.data as BackupEnvelope)).preview,
  );
}
export async function mergeBackup(
  db: StudyDb,
  envelope: BackupEnvelope,
): Promise<void> {
  const preview = await previewImport(db, envelope);
  if (!preview.valid)
    throw new Error([...preview.conflicts, ...preview.errors].join("; "));
  const parsed = BackupSchema.parse(envelope) as BackupEnvelope;
  await db.transaction("rw", db.tables, async () => {
    // Recheck under the write transaction: another tab may have written after preview.
    const checked = await inspect(db, parsed);
    if (!checked.preview.valid)
      throw new Error(
        [...checked.preview.conflicts, ...checked.preview.errors].join("; "),
      );
    for (const name of storeNames) {
      if (name === "gaps" || name === "reviews") continue;
      const current = await db.table(name).toArray();
      const keys = new Set(current.map((row) => recordKey(name, row)));
      const additions = (parsed.data[name] as unknown[]).filter(
        (row) => !keys.has(recordKey(name, row)),
      );
      if (additions.length) await db.table(name).bulkAdd(additions);
    }
    if (!(await db.settings.get("current")))
      await db.settings.add({ id: "current", value: parsed.data.settings });
    // Seed only the compatible learner annotations, then derive every status,
    // evidence list and due date from the combined immutable event history.
    await db.gaps.bulkPut(checked.data.gaps);
    await recalculate(db, parsed.exportedAt);
  });
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ErrorCause, Gap, QuestionRevision } from "../../content/types";
import { canPractice } from "../../content/quality";
import { subjectLabels } from "../../content/constants";
import {
  learningSupport,
  remediationAction,
  selectRemediationQuestions,
} from "../../domain/remediation";
import { db } from "../../storage/db";
import {
  revealLearningSupport,
  startSession,
  updateGapNote,
} from "../../storage/study-service";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import { Notice, formatDate } from "../../ui/FormControls";
import { MathText } from "../../ui/MathText";
export const causes: Record<ErrorCause, string> = {
  concept: "Conceito",
  method: "Método",
  prerequisite: "Pré-requisito",
  calculation: "Cálculo ou sinal",
  interpretation: "Interpretação ou unidade",
  time: "Tempo",
};
export function GapDetails({ gap }: { gap: Gap }) {
  const app = useStudy(),
    navigate = useNavigate(),
    q = app.findQuestion(gap.questionId);
  const [cause, setCause] = useState<ErrorCause | "">(gap.cause ?? ""),
    [note, setNote] = useState(gap.note),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [supportQuestion, setSupportQuestion] = useState<QuestionRevision>();
  const blocked = app.history.sessions.find(
    (s) =>
      s.mode === "assessment" &&
      s.status === "active" &&
      s.questions.some((item) => item.id === gap.questionId),
  );
  const review = app.projection.reviews.find(
    (r) => r.questionId === gap.questionId,
  );
  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateGapNote(db, gap.questionId, cause || null, note);
      await app.refresh();
      setMessage("Anotação salva neste dispositivo.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const begin = async (question: QuestionRevision, guided = false) => {
    if (busy || blocked || !canPractice(question)) return;
    setBusy(true);
    setError("");
    try {
      const session = await startSession(
        db,
        {
          questions: [question],
          mode: "study",
          purpose: guided ? "guided" : "practice",
          durationMs: null,
        },
        now(),
      );
      await app.refresh();
      navigate(`/practice/${session.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const attempts = app.history.attempts.filter(
    (a) =>
      (a.questionId === gap.questionId &&
        app.history.sessions.find((s) => s.id === a.sessionId)?.status !==
          "active") ||
      (a.questionId === gap.questionId && a.mode === "study"),
  );
  const supportOpen = supportQuestion?.id === gap.questionId;
  const understand = async () => {
    if (!q || blocked || busy) return;
    const attempt = [...attempts].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    )[0];
    if (!attempt) {
      setError(
        "Não há tentativa disponível para registrar a consulta ao apoio.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const event = await revealLearningSupport(
        db,
        attempt.id,
        q,
        now(),
        crypto.randomUUID(),
      );
      if (!event.questionRevision)
        throw new Error("A revisão do apoio consultado não está disponível.");
      const snapshot = await db.questionSnapshots.get([
        event.questionId,
        event.questionRevision,
      ]);
      if (!snapshot)
        throw new Error(
          "O apoio desta revisão não está disponível neste dispositivo.",
        );
      await app.refresh();
      setSupportQuestion(snapshot);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const action = remediationAction(cause || null);
  const support =
    supportOpen && supportQuestion ? learningSupport(supportQuestion) : null;
  const protectedIds = app.history.sessions
    .filter((s) => s.mode === "assessment" && s.status === "active")
    .flatMap((s) => s.questions.map((item) => item.id));
  const exposedIds = [
    ...app.history.sessions.flatMap((s) => s.questions.map((item) => item.id)),
    ...app.history.attempts.map((a) => a.questionId),
    ...app.history.feedback.map((event) => event.questionId),
  ];
  const exposed = new Set(exposedIds);
  const candidateLabel = (candidate: QuestionRevision) =>
    `${subjectLabels[candidate.subject]} · ${candidate.edition} · questão ${candidate.originalNumber}`;
  const followup =
    supportOpen && supportQuestion
      ? selectRemediationQuestions(
          supportQuestion,
          app.catalogue,
          "followup",
          protectedIds,
          exposedIds,
        )[0]
      : undefined;
  const prerequisite =
    supportOpen && supportQuestion
      ? selectRemediationQuestions(
          supportQuestion,
          app.catalogue,
          "prerequisite",
          protectedIds,
          exposedIds,
        )[0]
      : undefined;
  if (blocked)
    return (
      <div className="gap-details">
        <Notice>
          O histórico e as anotações desta questão ficam fechados até encerrar o
          simulado.{" "}
          <Link to={`/assessment/${blocked.id}`}>Retomar simulado</Link>
        </Notice>
      </div>
    );
  return (
    <div className="gap-details">
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      <p>
        {gap.evidenceAttemptIds.length} evidências posteriores neste item
        {review ? ` · próximo retorno: ${formatDate(review.dueDate)}` : ""}
      </p>
      <p className="small">
        {app.settings.reviewPolicy.recoverySuccesses} respostas corretas e
        independentes em dias distintos, separadas por ao menos{" "}
        {app.settings.reviewPolicy.minEvidenceDays} dias, são o parâmetro atual
        de recuperação do item.
      </p>
      <p className="small">
        A aplicação em questões diferentes da mesma habilidade aparece no{" "}
        <Link to="/progress">progresso por habilidade</Link>.
      </p>
      <label className="field">
        Causa confirmada por você
        <select
          value={cause}
          onChange={(e) => setCause(e.target.value as ErrorCause | "")}
        >
          <option value="">Ainda não identifiquei</option>
          {Object.entries(causes).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Anotação
        <textarea
          rows={4}
          value={note}
          maxLength={10000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Qual etapa preciso retomar?"
        />
      </label>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={() => void save()}>
          Salvar anotação
        </button>
        {q && !supportOpen && (
          <button disabled={busy} onClick={() => void understand()}>
            Entender o erro
          </button>
        )}
        {q && canPractice(q) && !blocked && !supportOpen && (
          <button disabled={busy} onClick={() => void begin(q)}>
            Tentar novamente este item
          </button>
        )}
        <Link to={`/questions/${gap.questionId}`}>Consultar fonte</Link>
      </div>
      {supportOpen && (
        <section className="feedback" aria-label="Apoio para entender o erro">
          <h3>Próxima ação</h3>
          <p>{action.action}</p>
          {support ? (
            <>
              {support.kind === "learning" ? (
                <>
                  <h3>Conceito</h3>
                  <p className="preserve-lines">
                    <MathText text={support.concept} />
                  </p>
                  <h3>Exemplo resolvido</h3>
                  <p className="preserve-lines">
                    <MathText text={support.workedExample} />
                  </p>
                  <h3>Pré-requisitos conferidos</h3>
                  {support.prerequisites.length ? (
                    <ul>
                      {support.prerequisites.map((p, i) => (
                        <li key={i}>
                          {subjectLabels[p.subject]} · {p.skill}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Não há pré-requisito indicado neste apoio.</p>
                  )}
                </>
              ) : (
                <>
                  <h3>Resolução conferida</h3>
                  <p className="preserve-lines">
                    <MathText text={support.text} />
                  </p>
                  <p className="small">
                    {support.authorKind === "official"
                      ? "Resolução oficial"
                      : "Resolução elaborada para estudo"}{" "}
                    · {support.author}
                  </p>
                </>
              )}
              <p className="small">
                Fonte: {support.source}. Revisão: {support.reviewer}.
              </p>
            </>
          ) : (
            <Notice>
              Não há apoio conferido com procedência para esta questão.
            </Notice>
          )}
          <h3>Explique com suas palavras</h3>
          <p>{action.selfExplanation}</p>
          <p className="small">Registre sua explicação na anotação acima.</p>
          <p>
            A prática após este apoio fica marcada como consulta. Para verificar
            aplicação posterior, tente outra questão sem ajuda em outro dia.
          </p>
          <div className="actions">
            {followup ? (
              <div>
                <p>{candidateLabel(followup)}</p>
                {exposed.has(followup.id) && (
                  <p className="small">
                    Questão já estudada: alternativa para prática guiada.
                  </p>
                )}
                <button
                  disabled={busy}
                  onClick={() => void begin(followup, true)}
                >
                  Praticar outra questão da mesma habilidade
                </button>
              </div>
            ) : (
              <Notice>
                Não há outra questão pronta da mesma habilidade disponível para
                treino.
              </Notice>
            )}
            {cause === "prerequisite" &&
              (prerequisite ? (
                <div>
                  <p>{candidateLabel(prerequisite)}</p>
                  {exposed.has(prerequisite.id) && (
                    <p className="small">
                      Questão já estudada: alternativa para prática guiada.
                    </p>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void begin(prerequisite, true)}
                  >
                    Praticar pré-requisito conferido
                  </button>
                </div>
              ) : (
                <Notice>
                  Não há questão pronta de pré-requisito conferido disponível.
                </Notice>
              ))}
          </div>
        </section>
      )}
      <details>
        <summary>Histórico deste item ({attempts.length} tentativas)</summary>
        <ol className="history-list">
          {attempts.map((a) => {
            const grades = app.history.grades
              .filter((g) => g.attemptId === a.id)
              .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
            return (
              <li key={a.id}>
                <strong>
                  {formatDate(a.studyDate)} ·{" "}
                  {a.firstAttempt ? "Primeira tentativa" : "Retentativa"}
                </strong>
                <p>
                  Resposta {a.response ?? "pulada"} · confiança{" "}
                  {a.confidence === "high"
                    ? "alta"
                    : a.confidence === "medium"
                      ? "média"
                      : "baixa"}
                  {a.consulted ? " · consulta" : ""}
                  {a.usedHint ? " · dica" : ""}
                  {a.guessed ? " · chute" : ""}
                  {a.doubt ? " · dúvida" : ""}
                </p>
                {grades.map((g) => (
                  <p key={g.id} className="small">
                    {g.kind === "initial" ? "Avaliação inicial" : "Reavaliação"}
                    :{" "}
                    {g.exclusionReason === "annulled"
                      ? "anulada"
                      : g.correct
                        ? "correta"
                        : "incorreta"}{" "}
                    · {g.decisionRevision}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}

import { fitDailyPlan } from "./fitDailyPlan";
import "../../styles/today.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  DailyPlan,
  PlanTask,
  Settings,
  QuestionRevision,
} from "../../content/types";
import { subjectLabels } from "../../content/constants";
import { canPractice } from "../../content/quality";
import { buildDailyPlan, estimateTaskMinutes } from "../../domain/planning";
import { isReleasedAttempt } from "../../domain/attempts";
import { studyDate } from "../../domain/clock";
import { db } from "../../storage/db";
import {
  saveSettings,
  startSession,
  updateDailyPlan,
} from "../../storage/study-service";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import {
  EmptyState,
  Notice,
  PageHeader,
  formatDate,
} from "../../ui/FormControls";
const reasonLabels: Record<PlanTask["reason"], string> = {
  review: "Revisão vencida",
  gap: "Retorno a uma lacuna",
  maintenance: "Manutenção",
  new: "Questão nova",
};
export function TodayPage() {
  const app = useStudy(),
    navigate = useNavigate(),
    date = studyDate(now(), app.settings.timezone);
  const savedPlan = app.plans.find((p) => p.date === date);
  const eligible = (id: string) => {
    const question = app.findQuestion(id);
    return question !== undefined && canPractice(question);
  };
  const plan = fitDailyPlan(
    (savedPlan
      ? {
          ...savedPlan,
          tasks: savedPlan.tasks.filter((t) => eligible(t.questionId)),
          deferredQuestionIds: savedPlan.deferredQuestionIds.filter(eligible),
        }
      : undefined) ??
      buildDailyPlan(
        app.catalogue,
        app.history,
        app.projection,
        app.settings,
        date,
        app.snapshots,
      ),
    app.settings,
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false);
  const active = app.history.sessions.filter(
    (s) =>
      s.status === "active" &&
      (s.mode === "assessment" ||
        s.questions.some(
          (q) =>
            !app.history.attempts.some(
              (a) => a.sessionId === s.id && a.questionId === q.id,
            ),
        )),
  );
  const completedIds = new Set(
      app.history.attempts
        .filter(
          (a) =>
            a.studyDate === date && isReleasedAttempt(a, app.history.sessions),
        )
        .map((a) => a.questionId),
    ),
    remainingTasks = plan.tasks.filter((t) => !completedIds.has(t.questionId));
  const continuing = active.some(
    (s) =>
      s.mode === "study" &&
      s.questions.some((q) =>
        remainingTasks.some((t) => t.questionId === q.id),
      ),
  );
  const ready = app.catalogue.filter(canPractice).length;
  const assessedIds = new Set(
      app.history.sessions
        .filter((s) => s.mode === "assessment" && s.status === "active")
        .flatMap((s) => s.questions.map((q) => q.id)),
    ),
    planBlocked = remainingTasks.some((t) => assessedIds.has(t.questionId));
  const plannedMinutes = plan.tasks.reduce(
    (total, task) => total + task.minutes,
    0,
  );
  const addable = app.catalogue
    .filter(
      (q) =>
        canPractice(q) &&
        !assessedIds.has(q.id) &&
        !plan.tasks.some((t) => t.questionId === q.id),
    )
    .map((q) => ({
      question: q,
      minutes: estimateTaskMinutes(
        q,
        app.history,
        app.catalogue,
        date,
        app.settings.timezone,
        app.snapshots,
      ),
    }))
    .filter(
      (candidate) =>
        plan.tasks.length < 12 &&
        plannedMinutes + candidate.minutes <= app.settings.dailyMinutes,
    );
  const changePlan = async (next: DailyPlan) => {
    setError("");
    try {
      await updateDailyPlan(db, next, app.settings);
      await app.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const move = (index: number, by: number) => {
    const tasks = [...plan.tasks];
    [tasks[index], tasks[index + by]] = [tasks[index + by], tasks[index]];
    void changePlan({ ...plan, tasks });
  };
  const changeMinutes = async (minutes: Settings["dailyMinutes"]) => {
    setBusy(true);
    try {
      const s = { ...app.settings, dailyMinutes: minutes };
      await saveSettings(db, s);
      const next = buildDailyPlan(
        app.catalogue,
        app.history,
        app.projection,
        s,
        date,
        app.snapshots,
      );
      await updateDailyPlan(db, next, s);
      await app.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      const questions = remainingTasks
        .map((t) => app.findQuestion(t.questionId))
        .filter(
          (q): q is QuestionRevision => q !== undefined && canPractice(q),
        );
      if (!questions.length)
        throw new Error("O plano não contém questões prontas.");
      await updateDailyPlan(db, plan, app.settings);
      const session = await startSession(
        db,
        { questions, mode: "study", durationMs: null },
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
  return (
    <div className="today-page">
      <PageHeader eyebrow={formatDate(date)} title="Hoje">
        <p>Seu roteiro de questões e revisões para este dia.</p>
      </PageHeader>
      {error && <Notice kind="error">{error}</Notice>}
      {active.length > 0 && (
        <section className="resume-section">
          <h2>Sessão em andamento</h2>
          {active.map((s) => (
            <p key={s.id}>
              <Link
                className="button primary"
                to={`/${s.mode === "assessment" ? "assessment" : "practice"}/${s.id}`}
              >
                Retomar {s.mode === "assessment" ? "simulado parcial" : "treino"} ·{" "}
              {s.questions.length} questões
              </Link>
            </p>
          ))}
        </section>
      )}
      <section className="study-start" aria-label="Estudo de hoje">
        <div className="study-start-main">
          <p className="eyebrow">Plano do dia</p>
          <h2>{plan.tasks.length} questões no seu roteiro</h2>
          <p className="study-summary">
            <span>{plannedMinutes} minutos previstos</span>
            <span>{app.settings.studyWeekdays.length} dias por semana</span>
          </p>
          {plan.tasks.length > 0 && (
            <button
              className="primary"
              disabled={
                busy || planBlocked || continuing || remainingTasks.length === 0
              }
              onClick={() => void start()}
            >
              {remainingTasks.length === 0
                ? "Plano concluído"
                : "Iniciar plano do dia"}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
        <div className="daily-budget">
          <label className="field">
            Tempo disponível hoje
            <select
              value={app.settings.dailyMinutes}
              disabled={busy}
              onChange={(e) =>
                void changeMinutes(
                  Number(e.target.value) as Settings["dailyMinutes"],
                )
              }
            >
              {[30, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
          <p className="small">O plano se ajusta ao tempo escolhido.</p>
        </div>
      </section>
      {ready > 0 && (
        <div className="list-heading">
          <h2>Roteiro de hoje</h2>
          <button
            className="edit-plan"
            aria-expanded={editing}
            aria-controls="plan-tasks"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Concluir edição" : "Editar plano"}
          </button>
        </div>
      )}
      <div id="plan-tasks">
        {plan.tasks.length > 0 ? (
          <section>
            <ol className="task-list">
              {plan.tasks.map((t, i) => {
                const q = app.findQuestion(t.questionId),
                  done = completedIds.has(t.questionId);
                return (
                  <li key={t.questionId} className={done ? "task-done" : undefined}>
                    <span className="task-number" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="task-description">
                      <strong>
                        {q ? subjectLabels[q.subject] : "Questão"} · questão{" "}
                        {q?.originalNumber}
                      </strong>
                      <p className="task-topic">{q?.topics.join(" · ")}</p>
                      <p className="small">
                        {done ? "Feita hoje · " : ""}
                        {q?.edition} · {reasonLabels[t.reason]}
                      </p>
                    </div>
                    <span className="task-duration">
                      {t.minutes}<small> min</small>
                    </span>
                    {editing && (
                      <div className="row-actions">
                        <button
                          aria-label={`Subir tarefa ${i + 1}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`Descer tarefa ${i + 1}`}
                          disabled={i === plan.tasks.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() =>
                            void changePlan({
                              ...plan,
                              tasks: plan.tasks.filter((_, j) => j !== i),
                              deferredQuestionIds: [
                                ...plan.deferredQuestionIds,
                                t.questionId,
                              ],
                            })
                          }
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {remainingTasks.length === 0 && (
              <Notice kind="success">
                Plano concluído. As tentativas de hoje estão salvas.
              </Notice>
            )}
            {continuing && (
              <Notice>
                Uma sessão deste plano está em andamento. Retome para continuar as
                tarefas restantes.
              </Notice>
            )}
            {planBlocked && (
              <Notice>
                Há questões deste plano em um simulado ativo. Retome e encerre o
                simulado antes de iniciar estas tarefas.
              </Notice>
            )}
          </section>
        ) : (
          <EmptyState
            title={
              ready
                ? "Sem tarefas previstas para hoje"
                : "O treino aguarda conteúdo conferido"
            }
          >
            <p>
              {ready
                ? "Você pode adicionar uma tarefa dentro do tempo disponível ou escolher uma lista no acervo."
                : "Os enunciados recebidos ainda precisam de gabaritos, resoluções e conferência dos originais. Consulte o inventário e os motivos de cada bloqueio."}
            </p>
            <Link className="button primary" to="/questions">
              Consultar questões e fontes
            </Link>
          </EmptyState>
        )}
        {ready > 0 && editing && (
          <label className="field plan-add">
            Adicionar tarefa ao plano
            <select
              value=""
              disabled={busy || addable.length === 0}
              onChange={(e) => {
                const candidate = addable.find(
                  (item) => item.question.id === e.target.value,
                );
                if (candidate)
                  void changePlan({
                    ...plan,
                    tasks: [
                      ...plan.tasks,
                      {
                        questionId: candidate.question.id,
                        minutes: candidate.minutes,
                        reason: "new",
                      },
                    ],
                    deferredQuestionIds: plan.deferredQuestionIds.filter(
                      (id) => id !== e.target.value,
                    ),
                  });
              }}
            >
              <option value="">Escolher questão pronta</option>
              {addable.map(({ question: q, minutes }) => (
                <option key={q.id} value={q.id}>
                  {subjectLabels[q.subject]} · {q.edition} · {q.originalNumber} ·{" "}
                  {minutes} min
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {plan.deferredQuestionIds.length > 0 && (
        <p className="small">
          {plan.deferredQuestionIds.length} questões fora da capacidade de hoje.
          O vencimento original das revisões foi preservado.
        </p>
      )}
      <div className="today-notes">
        <section className="plain-section">
          <h2>Retornos no caderno</h2>
          <p>
            {app.projection.reviews.filter((r) => r.dueDate <= date).length}{" "}
            revisões vencidas ·{" "}
            {app.projection.gaps.filter((g) => g.status !== "recovered").length}{" "}
            lacunas em acompanhamento
          </p>
          <Link to="/notebook">Consultar caderno →</Link>
        </section>
        <section className="plain-section">
          <h2>Preparação para a prova</h2>
          <p>
            Data-alvo: {formatDate(app.settings.targetExamDate)}. Confirme o
            calendário, as regras e as obras exigidas no edital vigente.
          </p>
          <Link to="/settings">Ajustar rotina e backup →</Link>
        </section>
      </div>
      {app.history.attempts.length === 0 && (
        <p className="muted">Você ainda não registrou tentativas.</p>
      )}
    </div>
  );
}

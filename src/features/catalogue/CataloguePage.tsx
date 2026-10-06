import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Subject } from "../../content/types";
import {
  subjects,
  subjectLabels,
  blockerLabels,
} from "../../content/constants";
import { filterQuestions, buildMixedList } from "../../content/catalogue";
import {
  getBlockers,
  isReady,
  canPractice,
  hasVerifiedKey,
  hasVerifiedAnnulment,
} from "../../content/quality";
import { db } from "../../storage/db";
import { startSession } from "../../storage/study-service";
import { useStudy, errorMessage, now } from "../../ui/AppContext";
import { EmptyState, Notice, PageHeader } from "../../ui/FormControls";
export function CataloguePage() {
  const app = useStudy(),
    navigate = useNavigate();
  const [subject, setSubject] = useState(""),
    [edition, setEdition] = useState(""),
    [topic, setTopic] = useState(""),
    [readiness, setReadiness] = useState<"all" | "ready" | "blocked">("all"),
    [limit, setLimit] = useState(30),
    [count, setCount] = useState(5),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const filtered = filterQuestions(app.catalogue, {
    subject: (subject as Subject) || undefined,
    edition: edition || undefined,
    topics: topic ? [topic] : undefined,
    readiness,
  });
  const assessedIds = new Set(
    app.history.sessions
      .filter((s) => s.mode === "assessment" && s.status === "active")
      .flatMap((s) => s.questions.map((q) => q.id)),
  );
  const ready = filtered.filter(
    (q) => canPractice(q) && !assessedIds.has(q.id),
  );
  const pendingCount = app.catalogue.filter((q) =>
    getBlockers(q).some((blocker) => blocker !== "annulled"),
  ).length;
  const editions = [...new Set(app.catalogue.map((q) => q.edition))];
  const topics = [
    ...new Set(
      app.catalogue
        .filter((q) => !subject || q.subject === subject)
        .flatMap((q) => q.topics),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const list = buildMixedList(ready, app.history, count, Date.now());
      if (!list.length)
        throw new Error("Nenhuma questão conferida corresponde aos filtros.");
      const s = await startSession(
        db,
        { questions: list, mode: "study", durationMs: null },
        now(),
      );
      await app.refresh();
      navigate(`/practice/${s.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Acervo UDESC" title="Questões">
        <p>
          Consulte os enunciados e a origem de cada item. O treino usa somente
          conteúdo conferido.
        </p>
      </PageHeader>
      <div className="inventory-line" style={{ flexWrap: "wrap" }}>
        <span>
          <strong>{app.catalogue.length}</strong> no inventário
        </span>
        <span>
          <strong>{app.catalogue.filter(hasVerifiedKey).length}</strong> com
          gabarito confirmado
        </span>
        <span>
          <strong>{app.catalogue.filter(hasVerifiedAnnulment).length}</strong>{" "}
          anulações confirmadas
        </span>
        <span>
          <strong>{app.catalogue.filter(canPractice).length}</strong> prontas
          para treino
        </span>
        {app.catalogue.some((q) => q.assessmentOnly && isReady(q)) && (
          <span>
            <strong>
              {
                app.catalogue.filter((q) => q.assessmentOnly && isReady(q))
                  .length
              }
            </strong>{" "}
            reservadas para avaliação
          </span>
        )}
      </div>
      {pendingCount > 0 && (
        <Notice>
          Há {pendingCount} questões com conferência pendente. O treino corrigido
          usa apenas conteúdo conferido.
        </Notice>
      )}
      <section className="filters" aria-label="Filtrar questões">
        <label className="field">
          Matéria
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTopic("");
              setLimit(30);
            }}
          >
            <option value="">Todas as matérias</option>
            {subjects.map((s) => (
              <option value={s} key={s}>
                {subjectLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Edição
          <select
            value={edition}
            onChange={(e) => {
              setEdition(e.target.value);
              setLimit(30);
            }}
          >
            <option value="">Todas as edições</option>
            {editions.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Assunto
          <select
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setLimit(30);
            }}
          >
            <option value="">Todos os assuntos</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Situação
          <select
            value={readiness}
            onChange={(e) => {
              setReadiness(e.target.value as typeof readiness);
              setLimit(30);
            }}
          >
            <option value="all">Todo o inventário</option>
            <option value="ready">Conteúdo conferido</option>
            <option value="blocked">Conferência pendente</option>
          </select>
        </label>
      </section>
      <div className="list-heading">
        <p>
          {filtered.length} questões encontradas · {ready.length} prontas
        </p>
        <Link to="/assessment">Configurar simulado parcial</Link>
      </div>
      {ready.length > 0 && (
        <div className="actions">
          <label className="inline-field">
            Questões na lista
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[1, 5, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void start()}
          >
            Iniciar lista de treino
          </button>
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {filtered.length === 0 ? (
        <EmptyState title="Nenhum item neste filtro">
          <p>Experimente outra matéria, edição ou situação.</p>
        </EmptyState>
      ) : (
        <ol className="question-list">
          {filtered.slice(0, limit).map((q) => (
            <li key={q.id}>
              <div className="row-top">
                <Link to={`/questions/${q.id}`}>
                  <strong>
                    {subjectLabels[q.subject]} · questão {q.originalNumber}
                  </strong>
                </Link>
                <span className="small">
                  {q.edition} · {q.period}
                </span>
              </div>
              <p>{q.topics.join(" · ")}</p>
              <p className="small muted">
                {isReady(q)
                  ? q.assessmentOnly
                    ? "Reservada para avaliação inédita"
                    : "Pronta para treino"
                  : getBlockers(q)
                      .map((b) => blockerLabels[b])
                      .join(" · ")}
              </p>
              <Link className="text-link" to={`/questions/${q.id}`}>
                {isReady(q) ? "Abrir questão" : "Consultar texto e fonte"}{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {limit < filtered.length && (
        <button onClick={() => setLimit((n) => n + 30)}>
          Mostrar mais 30 questões
        </button>
      )}
    </>
  );
}

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { subjectLabels } from "../../content/constants";
import { useStudy } from "../../ui/AppContext";
import { EmptyState, PageHeader, formatDate } from "../../ui/FormControls";
import { GapDetails } from "./GapDetails";
const statuses = {
  open: "Em aberto",
  in_review: "Em revisão",
  recovered: "Recuperada",
};
export function NotebookPage() {
  const app = useStudy(),
    [params] = useSearchParams();
  const [status, setStatus] = useState(""),
    [due, setDue] = useState(""),
    [expanded, setExpanded] = useState(params.get("question") ?? "");
  const gaps = app.projection.gaps.filter(
    (g) =>
      (!status || g.status === status) &&
      (!due ||
        app.projection.reviews.some(
          (r) => r.questionId === g.questionId && r.dueDate <= due,
        )),
  );
  return (
    <>
      <PageHeader eyebrow="Erros, dúvidas e retornos" title="Caderno">
        <p>
          Anote onde errou e acompanhe as questões que precisam de revisão.
        </p>
      </PageHeader>
      <div className="filters">
        <label className="field">
          Situação da lacuna
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas as situações</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Revisões até
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
      </div>
      {gaps.length === 0 ? (
        <EmptyState title="Nenhuma lacuna neste filtro">
          <p>
            {app.history.attempts.length === 0
              ? "Você ainda não registrou tentativas."
              : "Erros, pulos e acertos com ajuda, chute ou dúvida entrarão aqui após o encerramento da sessão."}
          </p>
          <Link className="button primary" to="/questions">
            Consultar questões
          </Link>
        </EmptyState>
      ) : (
        <ul className="gap-list">
          {gaps.map((g) => {
            const q = app.findQuestion(g.questionId),
              review = app.projection.reviews.find(
                (r) => r.questionId === g.questionId,
              );
            return (
              <li key={g.questionId}>
                <button
                  className="gap-toggle"
                  aria-expanded={expanded === g.questionId}
                  onClick={() =>
                    setExpanded(expanded === g.questionId ? "" : g.questionId)
                  }
                >
                  <span>
                    <strong>
                      {q ? subjectLabels[q.subject] : "Questão"} · {q?.edition}{" "}
                      · questão {q?.originalNumber}
                    </strong>
                    <span className="small">
                      {statuses[g.status]}
                      {review ? ` · retorno ${formatDate(review.dueDate)}` : ""}
                    </span>
                  </span>
                  <span aria-hidden="true">
                    {expanded === g.questionId ? "−" : "+"}
                  </span>
                </button>
                {expanded === g.questionId && <GapDetails gap={g} />}
              </li>
            );
          })}
        </ul>
      )}
      <section className="plain-section">
        <h2>Revisões e manutenção</h2>
        {app.projection.reviews.length === 0 ? (
          <p className="muted">Nenhum retorno agendado.</p>
        ) : (
          <ol className="review-list">
            {[...app.projection.reviews]
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map((r) => {
                const q = app.findQuestion(r.questionId);
                return (
                  <li key={r.questionId}>
                    <span>
                      {formatDate(r.dueDate)} ·{" "}
                      {r.kind === "gap" ? "Revisão da lacuna" : "Manutenção"}
                    </span>
                    <Link to={`/questions/${r.questionId}`}>
                      {q ? subjectLabels[q.subject] : "Questão"} ·{" "}
                      {q?.originalNumber}
                    </Link>
                  </li>
                );
              })}
          </ol>
        )}
      </section>
    </>
  );
}

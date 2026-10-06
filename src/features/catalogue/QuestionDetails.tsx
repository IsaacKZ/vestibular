import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { blockerLabels, subjectLabels } from "../../content/constants";
import {
  getBlockers,
  canPractice,
  hasVerifiedKey,
  hasVerifiedAnnulment,
} from "../../content/quality";
import { db } from "../../storage/db";
import { startSession } from "../../storage/study-service";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import { Notice, PageHeader } from "../../ui/FormControls";
export function QuestionDetails() {
  const { questionId = "" } = useParams(),
    app = useStudy(),
    navigate = useNavigate();
  const q = app.findQuestion(questionId);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!q)
    return (
      <>
        <PageHeader title="Questão não encontrada" />
        <Link to="/questions">Voltar às questões</Link>
      </>
    );
  const blocked = app.history.sessions.find(
    (s) =>
      s.mode === "assessment" &&
      s.status === "active" &&
      s.questions.some((item) => item.id === q.id),
  );
  const blockers = getBlockers(q);
  const originalPending = blockers.some((blocker) =>
    [
      "ocr",
      "uncertain",
      "missing_text",
      "missing_options",
      "missing_assets",
      "unreviewed",
    ].includes(blocker),
  );
  const start = async () => {
    setBusy(true);
    try {
      const s = await startSession(
        db,
        { questions: [q], mode: "study", durationMs: null },
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
      <Link className="back-link" to="/questions">
        ← Todas as questões
      </Link>
      <PageHeader
        eyebrow={`UDESC ${q.edition} · ${q.period}`}
        title={`${subjectLabels[q.subject]} · questão ${q.originalNumber}`}
      >
        <p>{q.topics.join(" · ")}</p>
      </PageHeader>
      {error && <Notice kind="error">{error}</Notice>}
      {hasVerifiedAnnulment(q) && (
        <Notice>
          <strong>Anulação confirmada</strong>
          <p>Esta questão fica fora do treino corrigido.</p>
        </Notice>
      )}
      {!q.assessmentOnly && !hasVerifiedAnnulment(q) && hasVerifiedKey(q) && (
        <Notice>
          <strong>Gabarito confirmado</strong>
          <p>A resposta fica disponível apenas na correção.</p>
        </Notice>
      )}
      {blockers.length > 0 && (
        <section className="notice">
          <h2>Conferência pendente</h2>
          <ul>
            {blockers.map((b) => (
              <li key={b}>{blockerLabels[b]}</li>
            ))}
          </ul>
          {originalPending && (
            <p>
              Este texto é uma transcrição do material recebido. Consulte o
              caderno original para conferir as pendências indicadas acima.
            </p>
          )}
        </section>
      )}
      {blocked && (
        <Notice>
          Esta questão está em um simulado ativo. A tentativa e a correção ficam
          fechadas até encerrar.{" "}
          <Link to={`/assessment/${blocked.id}`}>Retomar simulado</Link>
        </Notice>
      )}
      {q.assessmentOnly && !blocked && (
        <Notice>
          Questão reservada para avaliação inédita. O enunciado fica disponível
          ao iniciar essa avaliação.{" "}
          <Link to="/assessment">Configurar avaliação</Link>
        </Notice>
      )}
      {canPractice(q) && !blocked && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => void start()}
        >
          Tentar esta questão
        </button>
      )}
      {!q.assessmentOnly && (
        <section>
          <h2>Texto da fonte</h2>
          <div className="raw-source">{q.rawText}</div>
        </section>
      )}
      <section className="source-details">
        <h2>Procedência</h2>
        <dl>
          <dt>Arquivo</dt>
          <dd>{q.source.file}</dd>
          <dt>Seção</dt>
          <dd>{q.source.section}</dd>
          <dt>Revisão</dt>
          <dd>{q.revision}</dd>
          <dt>SHA-256 do texto bruto</dt>
          <dd className="hash">{q.source.sha256}</dd>
        </dl>
        {q.source.originalPdf && (
          <p>
            Original: {q.source.originalPdf}
            {q.source.page ? ` · página ${q.source.page}` : ""}
          </p>
        )}
      </section>
    </>
  );
}

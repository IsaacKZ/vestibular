import { useState } from "react";
import type { Subject } from "../../content/types";
import { subjects, subjectLabels } from "../../content/constants";
import { computeMetrics } from "../../domain/metrics";
import { StudyDateSchema } from "../../content/schema";
import { studyDate } from "../../domain/clock";
import { isReleasedAttempt } from "../../domain/attempts";
import { useStudy, now } from "../../ui/AppContext";
import {
  EmptyState,
  Notice,
  PageHeader,
  formatDate,
  formatTime,
} from "../../ui/FormControls";
export function ProgressPage() {
  const app = useStudy();
  const asOf = now();
  const difficultyLabels = {
    easy: "Fácil",
    medium: "Média",
    hard: "Difícil",
    unknown: "Não informada",
  };
  const [from, setFrom] = useState("2026-01-01"),
    [to, setTo] = useState(studyDate(now(), app.settings.timezone)),
    [subject, setSubject] = useState(""),
    [topic, setTopic] = useState("");
  const snapshots = [
    ...app.snapshots,
    ...app.catalogue.filter(
      (q) =>
        !app.snapshots.some((s) => s.id === q.id && s.revision === q.revision),
    ),
  ];
  const filter = {
    from,
    to,
    subject: (subject as Subject) || undefined,
    topic: topic || undefined,
  };
  const validDates =
    StudyDateSchema.safeParse(from).success &&
    StudyDateSchema.safeParse(to).success;
  const validPeriod = validDates && from <= to;
  const protectedIds = new Set(
    app.history.sessions
      .filter((s) => s.mode === "assessment" && s.status === "active")
      .flatMap((s) => s.questions.map((q) => q.id)),
  );
  const metrics = computeMetrics(
    app.history,
    snapshots,
    filter,
    app.settings.reviewPolicy,
    asOf,
  );
  const attempts = app.history.attempts.filter(
    (a) =>
      Date.parse(a.at) <= Date.parse(asOf) &&
      isReleasedAttempt(a, app.history.sessions, asOf) &&
      !protectedIds.has(a.questionId),
  );
  const topics = [
    ...new Set(
      app.catalogue
        .filter((q) => !subject || q.subject === subject)
        .flatMap((q) => q.topics),
    ),
  ].sort();
  const frequency = app.audit?.historicalFrequency;
  return (
    <>
      <PageHeader eyebrow="Resultados com contexto" title="Progresso">
        <p>
          Acertos e evidências vêm das tentativas registradas. Tempo acumulado
          não confirma domínio de um assunto.
        </p>
      </PageHeader>
      <div className="filters">
        <label className="field">
          De
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          Até
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="field">
          Matéria
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTopic("");
            }}
          >
            <option value="">Todas as matérias</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {subjectLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Assunto
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Todos os assuntos</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {!validPeriod ? (
        <Notice>
          {validDates
            ? "A data inicial deve vir antes da data final."
            : "Informe datas válidas para consultar o período."}
        </Notice>
      ) : attempts.length === 0 ? (
        <EmptyState title="Você ainda não registrou tentativas.">
          <p>
            Quando houver conteúdo conferido e tentativas salvas, os resultados
            aparecerão aqui.
          </p>
        </EmptyState>
      ) : (
        <>
          <p className="small">
            Período: {formatDate(from)} a {formatDate(to)} · {metrics.newItems}{" "}
            itens novos · {metrics.repeatAttempts} retentativas
          </p>
          <dl className="metrics-list">
            <div>
              <dt>Primeiras tentativas corretas</dt>
              <dd>
                {metrics.firstAttemptCorrect}/{metrics.firstAttemptTotal}
              </dd>
            </div>
            <div>
              <dt>Respostas independentes corretas</dt>
              <dd>
                {metrics.independentCorrect}/{metrics.independentTotal}
              </dd>
            </div>
            <div>
              <dt>Respostas com ajuda, chute ou dúvida corretas</dt>
              <dd>
                {metrics.assistedCorrect}/{metrics.assistedTotal}
              </dd>
            </div>
            <div>
              <dt>Evidências de retenção do mesmo item</dt>
              <dd>{metrics.retentionEvidence}</dd>
            </div>
            <div>
              <dt>Aplicações corretas em itens diferentes / oportunidades</dt>
              <dd>
                {metrics.transferEvidence}/{metrics.transferOpportunities}
              </dd>
            </div>
            <div>
              <dt>Tempo ativo</dt>
              <dd>{formatTime(metrics.activeMs)}</dd>
            </div>
          </dl>
          <p className="small">
            Aplicação posterior exige um item diferente, resposta independente e
            pelo menos {app.settings.reviewPolicy.minEvidenceDays} dias após a
            introdução e o último apoio da habilidade. Registros antigos sem
            histórico de apoio no envio não confirmam essa evidência. Não estima
            domínio nem probabilidade de aprovação.
          </p>
          {metrics.skillEvidence.length > 0 && (
            <div className="table-scroll">
              <table>
                <caption>Aplicação posterior por habilidade</caption>
                <thead>
                  <tr>
                    <th>Matéria</th>
                    <th>Habilidade</th>
                    <th>Acertos / oportunidades</th>
                    <th>Itens distintos</th>
                    <th>Datas</th>
                    <th>Evidência</th>
                    <th>Dificuldade declarada</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.skillEvidence.map((row) => (
                    <tr key={`${row.subject}:${row.skill}`}>
                      <td>{subjectLabels[row.subject]}</td>
                      <th scope="row">{row.skill}</th>
                      <td>
                        {row.correct}/{row.opportunities}
                      </td>
                      <td>{row.distinctItems}</td>
                      <td>
                        {row.dates.map(formatDate).join(", ") ||
                          "Sem oportunidade posterior"}
                      </td>
                      <td>
                        {row.consistent
                          ? "Consistente em itens e datas diferentes"
                          : "Ainda insuficiente"}
                      </td>
                      <td>
                        {row.difficultyComparisons.length === 0
                          ? "Sem comparação"
                          : row.difficultyComparisons.map((comparison) => (
                              <p
                                key={`${comparison.from}:${comparison.to}`}
                                className="small"
                              >
                                {difficultyLabels[comparison.from]} →{" "}
                                {difficultyLabels[comparison.to]}:{" "}
                                {comparison.correct}/{comparison.opportunities}
                              </p>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small">
                O sinal consistente exige acertos em pelo menos dois itens de
                aplicação separados pelo intervalo mínimo. A dificuldade é uma
                classificação humana; níveis diferentes não são equivalentes.
              </p>
            </div>
          )}
          <p className="small">
            {metrics.annulledExcluded} avaliações excluídas por anulação.
            Revisões de decisão:{" "}
            {metrics.decisionRevisions.join(", ") || "nenhuma"}.
          </p>
          <div className="table-scroll">
            <table>
              <caption>Resultados por matéria no período selecionado</caption>
              <thead>
                <tr>
                  <th>Matéria</th>
                  <th>Primeiras</th>
                  <th>Independentes</th>
                  <th>Assistidas</th>
                  <th>Retenção</th>
                </tr>
              </thead>
              <tbody>
                {subjects
                  .filter((s) => !subject || s === subject)
                  .map((s) => {
                    const m = computeMetrics(
                      app.history,
                      snapshots,
                      { ...filter, subject: s },
                      app.settings.reviewPolicy,
                      asOf,
                    );
                    return (
                      <tr key={s}>
                        <th scope="row">{subjectLabels[s]}</th>
                        <td>
                          {m.firstAttemptCorrect}/{m.firstAttemptTotal}
                        </td>
                        <td>
                          {m.independentCorrect}/{m.independentTotal}
                        </td>
                        <td>
                          {m.assistedCorrect}/{m.assistedTotal}
                        </td>
                        <td>{m.retentionEvidence}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Histórico de tentativas e avaliações</summary>
            <ol className="history-list">
              {attempts
                .filter((a) => {
                  const item = snapshots.find(
                    (q) =>
                      q.id === a.questionId &&
                      q.revision === a.questionRevision,
                  );
                  return (
                    a.studyDate >= from &&
                    a.studyDate <= to &&
                    (!subject || item?.subject === subject) &&
                    (!topic || item?.topics.includes(topic))
                  );
                })
                .map((a) => {
                  const q = snapshots.find(
                    (q) =>
                      q.id === a.questionId &&
                      q.revision === a.questionRevision,
                  );
                  return (
                    <li key={a.id}>
                      <strong>
                        {formatDate(a.studyDate)} ·{" "}
                        {q ? subjectLabels[q.subject] : "Questão"} ·{" "}
                        {q?.originalNumber}
                      </strong>
                      <p className="small">
                        {a.firstAttempt ? "Primeira tentativa" : "Retentativa"}{" "}
                        ·{" "}
                        {a.priorFeedbackAt
                          ? "Depois de ver a resolução"
                          : "Antes de ver a resolução"}{" "}
                        · confiança{" "}
                        {a.confidence === "high"
                          ? "alta"
                          : a.confidence === "medium"
                            ? "média"
                            : "baixa"}{" "}
                        · {formatTime(a.activeMs)}
                        {a.consulted ? " · consulta" : ""}
                        {a.usedHint ? " · dica" : ""}
                        {a.guessed ? " · chute" : ""}
                        {a.doubt ? " · dúvida" : ""}
                      </p>
                      {app.history.grades
                        .filter(
                          (g) =>
                            g.attemptId === a.id &&
                            Date.parse(g.at) <= Date.parse(asOf),
                        )
                        .map((g) => (
                          <p key={g.id} className="small">
                            {g.kind === "initial"
                              ? "Avaliação inicial"
                              : "Reavaliação"}{" "}
                            ·{" "}
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
        </>
      )}
      {frequency && (
        <section className="plain-section">
          <h2>Contagens provisórias do mapa histórico</h2>
          <p>
            {frequency.sampleSize} classificações nas{" "}
            {frequency.editions.length} edições: {frequency.editions.join(", ")}
            . {frequency.uncertainClassifications} classificações sinalizadas
            como incertas.
          </p>
          <p className="small">
            Esta é a frequência no acervo recebido, separada do seu progresso.
            Não prevê a próxima prova; zero ocorrências não exclui um assunto.
          </p>
          <details>
            <summary>Consultar frequência por assunto</summary>
            <div className="table-scroll">
              <table>
                <caption>Mapa histórico da amostra</caption>
                <thead>
                  <tr>
                    <th>Matéria</th>
                    <th>Assunto</th>
                    <th>Itens</th>
                    <th>Edições</th>
                  </tr>
                </thead>
                <tbody>
                  {frequency.topics
                    .filter(
                      (t) =>
                        (!subject || t.subject === subject) &&
                        (!topic || t.topic === topic),
                    )
                    .map((t, i) => (
                      <tr key={`${t.subject}-${t.topic}-${i}`}>
                        <td>{subjectLabels[t.subject]}</td>
                        <th scope="row">{t.topic}</th>
                        <td>{t.total}</td>
                        <td>{t.proofs}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </>
  );
}

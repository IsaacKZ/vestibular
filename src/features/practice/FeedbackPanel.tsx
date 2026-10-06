import { MathText } from "../../ui/MathText";
import type { Attempt, Grade, QuestionRevision } from "../../content/types";
import { learningSupport, remediationAction } from "../../domain/remediation";
import { subjectLabels } from "../../content/constants";
export function FeedbackPanel({
  attempt,
  grade,
  question,
}: {
  attempt: Attempt;
  grade: Grade | undefined;
  question: QuestionRevision;
}) {
  const support = learningSupport(question);
  const assistance = attempt.consulted
    ? "Acerto com consulta"
    : attempt.usedHint
      ? "Acerto com dica"
      : attempt.guessed
        ? "Acerto por chute"
        : attempt.doubt || attempt.confidence === "low"
          ? "Acerto com dúvida"
          : "Resposta correta";
  return (
    <section className="feedback" aria-label="Correção">
      <h2>
        {grade?.exclusionReason === "annulled"
          ? "Questão anulada"
          : grade?.correct
            ? assistance
            : attempt.response === null
              ? "Questão pulada"
              : "Resposta incorreta"}
      </h2>
      <p>
        Sua resposta: <strong>{attempt.response ?? "pulo"}</strong> · Gabarito:{" "}
        <strong>{question.key?.letter ?? "não confirmado"}</strong>
      </p>
      {question.key && (
        <p className="small">
          Fonte: {question.key.source} · {question.key.location} · revisão{" "}
          {grade?.keyRevision}
        </p>
      )}
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
              {support.prerequisites.length > 0 && (
                <>
                  <h3>Pré-requisitos conferidos</h3>
                  <ul>
                    {support.prerequisites.map((p, i) => (
                      <li key={i}>
                        {subjectLabels[p.subject]} · {p.skill}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <h3>Resolução</h3>
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
            Revisão: {support.reviewer}. Fonte: {support.source}
          </p>
        </>
      ) : (
        <p>Não há apoio conferido com procedência para esta questão.</p>
      )}
      <p>{remediationAction(null).selfExplanation}</p>
      <p>
        Identifique a etapa em que teve dificuldade. Você pode registrar a causa
        e uma anotação no caderno.
      </p>
      {attempt.priorFeedbackDate === attempt.studyDate && (
        <p className="muted">
          Nova tentativa no mesmo dia. Este acerto não confirma retenção
          posterior.
        </p>
      )}
    </section>
  );
}

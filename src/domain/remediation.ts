import type { ErrorCause, QuestionRevision } from "../content/types";
import { canPractice } from "../content/quality";
import { subjects } from "../content/constants";

export interface RemediationAction {
  action: string;
  selfExplanation: string;
}
export type LearningSupport =
  | ({ kind: "learning" } & NonNullable<QuestionRevision["learning"]>)
  | ({ kind: "explanation" } & NonNullable<QuestionRevision["explanation"]>);

const actions: Record<ErrorCause, RemediationAction> = {
  concept: {
    action:
      "Retome o conceito no apoio conferido e explique quando ele se aplica.",
    selfExplanation: "Que conceito justifica a etapa em que você errou?",
  },
  method: {
    action:
      "Compare sua sequência de etapas com o exemplo ou a resolução conferida.",
    selfExplanation: "Qual etapa do método precisa mudar e por quê?",
  },
  prerequisite: {
    action:
      "Retome um pré-requisito indicado no apoio conferido antes de outro problema.",
    selfExplanation: "Que conhecimento anterior faltou para avançar?",
  },
  calculation: {
    action:
      "Confira o cálculo e os sinais na etapa em que sua resposta divergiu.",
    selfExplanation: "Em qual operação ou sinal surgiu a diferença?",
  },
  interpretation: {
    action: "Releia o enunciado: identifique os dados, o pedido e as unidades.",
    selfExplanation: "O que foi pedido e qual unidade a resposta precisa ter?",
  },
  time: {
    action:
      "Identifique a etapa que consumiu tempo e refaça seu plano de resolução.",
    selfExplanation:
      "Qual etapa tomou mais tempo e como você pode organizá-la?",
  },
};

export function remediationAction(cause: ErrorCause | null): RemediationAction {
  return cause
    ? actions[cause]
    : {
        action:
          "Compare sua tentativa com o apoio conferido e identifique a causa do erro.",
        selfExplanation: "Qual etapa você precisa retomar e por quê?",
      };
}

const hasText = (value: string | undefined): boolean => Boolean(value?.trim());

export function learningSupport(
  question: QuestionRevision,
): LearningSupport | null {
  const learning = question.learning;
  if (
    learning?.reviewed &&
    hasText(learning.concept) &&
    hasText(learning.workedExample) &&
    hasText(learning.source) &&
    hasText(learning.reviewer) &&
    learning.prerequisites.every(
      (p) => subjects.includes(p.subject) && hasText(p.skill),
    )
  )
    return { ...learning, kind: "learning" };
  const explanation = question.explanation;
  if (
    explanation?.reviewed &&
    hasText(explanation.text) &&
    hasText(explanation.source) &&
    hasText(explanation.author) &&
    hasText(explanation.reviewer) &&
    ["official", "prepared"].includes(explanation.authorKind)
  )
    return { ...explanation, kind: "explanation" };
  return null;
}

export function selectRemediationQuestions(
  question: QuestionRevision,
  catalogue: readonly QuestionRevision[],
  kind: "followup" | "prerequisite",
  excludedIds: readonly string[] = [],
  exposedIds: readonly string[] = [],
): QuestionRevision[] {
  const support = learningSupport(question);
  const targets =
    kind === "prerequisite"
      ? support?.kind === "learning"
        ? support.prerequisites
        : []
      : question.quality.taxonomyReviewed
        ? question.skills
            .filter(hasText)
            .map((skill) => ({ subject: question.subject, skill }))
        : [];
  const excluded = new Set([question.id, ...excludedIds]);
  const exposed = new Set(exposedIds);
  return catalogue
    .filter((candidate) => {
      if (
        excluded.has(candidate.id) ||
        !canPractice(candidate) ||
        !targets.some(
          (target) =>
            target.subject === candidate.subject &&
            candidate.skills.includes(target.skill),
        )
      )
        return false;
      excluded.add(candidate.id);
      return true;
    })
    .sort((a, b) => Number(exposed.has(a.id)) - Number(exposed.has(b.id)));
}

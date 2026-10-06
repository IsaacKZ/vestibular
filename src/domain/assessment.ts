import type {
  LearningHistory,
  QuestionRevision,
  Subject,
} from "../content/types";
import { canPractice, isReady } from "../content/quality";

export interface AssessmentConfig {
  count: number;
  durationMinutes: number;
  subjects: Subject[];
  edition: string | null;
  purpose?: "practice" | "benchmark";
  difficulty?: "easy" | "medium" | "hard" | null;
}

export function assessmentPool(
  items: QuestionRevision[],
  config: AssessmentConfig,
  history?: LearningHistory,
): QuestionRevision[] {
  const exposed = new Set([
    ...(history?.attempts.map((a) => a.questionId) ?? []),
    ...(history?.feedback.map((f) => f.questionId) ?? []),
    ...(history?.sessions.flatMap((s) => s.questions.map((q) => q.id)) ?? []),
  ]);
  return [
    ...new Map(
      items
        .filter(
          (q) =>
            config.subjects.includes(q.subject) &&
            (config.edition === null || q.edition === config.edition) &&
            (!config.difficulty || q.difficulty === config.difficulty) &&
            (config.purpose === "benchmark"
              ? isReady(q) &&
                q.assessmentOnly === true &&
                q.skills.length > 0 &&
                ["easy", "medium", "hard"].includes(q.difficulty ?? "") &&
                !exposed.has(q.id)
              : canPractice(q)),
        )
        .map((q) => [q.id, q]),
    ).values(),
  ];
}

export function selectAssessment(
  items: QuestionRevision[],
  config: AssessmentConfig,
  seed: number,
  history?: LearningHistory,
): QuestionRevision[] {
  if (
    !Number.isInteger(config.count) ||
    config.count < 1 ||
    !Number.isFinite(config.durationMinutes) ||
    config.durationMinutes <= 0 ||
    !Number.isFinite(seed)
  )
    throw new Error("Configuração de simulado inválida");
  const available = assessmentPool(items, config, history);
  if (available.length < config.count)
    throw new Error(
      config.purpose === "benchmark"
        ? "Questões reservadas inéditas insuficientes"
        : "Questões prontas insuficientes",
    );
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const groups = [...new Set(available.map((q) => q.subject))].map((subject) =>
    available.filter((q) => q.subject === subject),
  );
  const selected: QuestionRevision[] = [];
  while (selected.length < config.count) {
    for (const group of groups) {
      const next = group.shift();
      if (next) selected.push(next);
      if (selected.length === config.count) break;
    }
  }
  return selected;
}

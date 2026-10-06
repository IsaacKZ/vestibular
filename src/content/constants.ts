import type { Settings, Subject, Blocker, LearningHistory } from "./types";
export const subjects: Subject[] = [
  "matematica",
  "biologia",
  "portugues-literatura",
  "fisica",
  "quimica",
];
export const subjectLabels: Record<Subject, string> = {
  matematica: "Matemática",
  biologia: "Biologia",
  "portugues-literatura": "Português e Literatura",
  fisica: "Física",
  quimica: "Química",
};
export const blockerLabels: Record<Blocker, string> = {
  ocr: "Texto matemático a conferir",
  uncertain: "Conteúdo sinalizado como incompleto",
  missing_text: "Enunciado ou texto de apoio incompleto",
  missing_options: "Alternativas a conferir",
  missing_assets: "Falta uma figura do enunciado",
  unreviewed: "Conferência do original pendente",
  missing_key: "Sem gabarito confirmado",
  missing_explanation: "Sem resolução revisada",
  missing_skills: "Habilidades a conferir",
  annulled: "Questão anulada",
};
export const defaultSettings: Settings = {
  timezone: "America/Sao_Paulo",
  dailyMinutes: 120,
  studyWeekdays: [1, 2, 3, 4, 5],
  targetExamDate: "2026-11-29",
  reviewPolicy: {
    initialDays: 3,
    repeatDays: 14,
    maintenanceDays: 14,
    recoverySuccesses: 2,
    minEvidenceDays: 3,
  },
};
export const emptyHistory = (): LearningHistory => ({
  attempts: [],
  grades: [],
  feedback: [],
  sessions: [],
});

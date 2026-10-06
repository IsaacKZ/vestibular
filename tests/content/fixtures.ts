import type { QuestionRevision } from "../../src/content/types";
export function readyQuestion(
  patch: Partial<QuestionRevision> = {},
): QuestionRevision {
  return {
    id: "udesc-2026-1-matutino-01",
    revision: "checked-1",
    subject: "matematica",
    edition: "2026/1",
    period: "matutino",
    originalNumber: 1,
    subjectNumber: 1,
    topics: ["álgebra", "geometria"],
    skills: ["calcular"],
    rawText: "Original",
    stem: "Enunciado conferido",
    options: ["A", "B", "C", "D", "E"].map((letter) => ({
      letter: letter as "A",
      text: letter,
    })),
    assets: [],
    source: {
      file: "source.md",
      section: "heading",
      sha256: "0".repeat(64),
      originalPdf: "caderno.pdf",
      page: 1,
    },
    quality: {
      reviewed: true,
      ocr: false,
      uncertain: false,
      textComplete: true,
      assetsComplete: true,
      taxonomyReviewed: true,
      annulled: false,
      reviewer: "Revisor",
      reviewedAt: "2026-10-02T12:00:00Z",
    },
    key: {
      letter: "A",
      revision: "official-1",
      verified: true,
      source: "gabarito-oficial.pdf",
      location: "p. 1",
      reviewer: "Revisor",
    },
    annulment: null,
    explanation: {
      text: "Resolução conferida.",
      reviewed: true,
      authorKind: "prepared",
      author: "Autor",
      source: "original.pdf p. 1",
      reviewer: "Revisor",
    },
    ...patch,
  };
}

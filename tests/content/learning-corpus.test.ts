import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { QuestionRevisionSchema } from "../../src/content/schema";
import { canPractice } from "../../src/content/quality";
import { learningSupport, selectRemediationQuestions } from "../../src/domain/remediation";
import { parseCorpus, readSourceFiles } from "../../scripts/import-corpus";

const catalogue = QuestionRevisionSchema.array().parse(
  JSON.parse(readFileSync("public/content/catalog.json", "utf8")),
);
const training = catalogue.filter(canPractice);

test("o lote pedagógico oferece questões oficiais nas cinco disciplinas", () => {
  expect(catalogue).toHaveLength(420);
  expect(training).toHaveLength(84);
  expect(new Set(training.map((q) => q.subject)).size).toBe(5);
  for (const id of [
    "udesc-2024-1-matutino-01", "udesc-2025-1-matutino-10",
    "udesc-2026-1-matutino-11", "udesc-2026-2-matutino-10",
    "udesc-2025-2-matutino-38", "udesc-2025-2-matutino-41",
  ]) expect(training.some((q) => q.id === id)).toBe(true);
});

test("cada questão pronta tem conceito e exemplo conferidos, com procedência", () => {
  for (const q of training) {
    expect(learningSupport(q), q.id).toMatchObject({ kind: "learning", reviewed: true });
    expect(q.learning!.concept.trim().length, q.id).toBeGreaterThan(30);
    expect(q.learning!.workedExample.trim().length, q.id).toBeGreaterThan(30);
    expect(q.learning!.source, q.id).toContain(".pdf");
    expect(q.learning!.reviewer.trim().length, q.id).toBeGreaterThan(0);
    for (const prerequisite of q.learning!.prerequisites) {
      expect(selectRemediationQuestions(q, catalogue, "prerequisite")
        .some((item) => item.subject === prerequisite.subject && item.skills.includes(prerequisite.skill)), q.id).toBe(true);
    }
  }
});

test("grupos comparáveis destravam prática em outro item sem reutilizar o atual", () => {
  const paired = training.filter((q) => selectRemediationQuestions(q, catalogue, "followup").length > 0);
  expect(paired.length).toBeGreaterThanOrEqual(20);
  expect(new Set(paired.map((q) => q.subject)).size).toBe(5);
  for (const q of paired) {
    const candidates = selectRemediationQuestions(q, catalogue, "followup");
    expect(candidates.every((item) => item.id !== q.id && canPractice(item))).toBe(true);
  }
});

test("novos apoios conservam identidade, texto bruto e hashes do inventário", () => {
  const originals = new Map(parseCorpus(readSourceFiles()).map((q) => [q.id, q]));
  for (const q of catalogue) {
    const original = originals.get(q.id)!;
    expect(q.rawText, q.id).toBe(original.rawText);
    expect(q.source.sha256, q.id).toBe(original.source.sha256);
    expect([q.subject, q.edition, q.period, q.originalNumber, q.subjectNumber], q.id)
      .toEqual([original.subject, original.edition, original.period, original.originalNumber, original.subjectNumber]);
  }
});

test("os dois itens de português incluem seus textos de apoio e chaves oficiais", () => {
  const prose = catalogue.find((q) => q.id === "udesc-2025-2-matutino-38")!;
  const poem = catalogue.find((q) => q.id === "udesc-2025-2-matutino-41")!;
  expect(prose.stem).toMatch(/TEXTO\s*1/i);
  expect(prose.stem).toContain("Dois Irmãos");
  expect(poem.stem).toMatch(/TEXTO\s*2/i);
  expect(poem.stem).toContain("Tristeza");
  expect(prose.key?.letter).toBe("D");
  expect(poem.key?.letter).toBe("D");
});

test("Física 2025/2 questão14 conserva todas as proposições das alternativas do PDF p9", () => {
  const q = catalogue.find((item) => item.id === "udesc-2025-2-vespertino-14")!;
  const option = (letter: string) => q.options.find((item) => item.letter === letter)!.text;
  expect(option("C")).toContain("I, II e V");
  expect(option("D")).toContain("I, III e V");
  expect(option("E")).toContain("II, III e IV");
  expect(q.key?.letter).toBe("B");
});

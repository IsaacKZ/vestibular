import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { QuestionRevision } from "../src/content/types";
import { subjects } from "../src/content/constants";
import { QuestionRevisionSchema } from "../src/content/schema";
import { contentAvailability, isReady } from "../src/content/quality";
import {
  applyContentRecords,
  auditCorpus,
  historicalFrequency,
  parseCorpus,
  readSourceFiles,
} from "./import-corpus";
import type { ContentRecords } from "./import-corpus";

export function assertContentIntegrity(
  catalogue: QuestionRevision[],
  training: QuestionRevision[],
): void {
  catalogue.forEach((q) => QuestionRevisionSchema.parse(q));
  training.forEach((q) => QuestionRevisionSchema.parse(q));
  auditCorpus(catalogue); // Also rejects duplicate identities.
  const expected = catalogue.filter(isReady);
  if (training.length !== expected.length || training.some((q) => !isReady(q)))
    throw new Error(
      "Exportação de treino deve conter exatamente as questões prontas.",
    );
  const byId = new Map(expected.map((q) => [q.id, q]));
  if (new Set(training.map((q) => q.id)).size !== training.length)
    throw new Error("Questão duplicada no treino.");
  for (const q of training)
    if (!isDeepStrictEqual(q, byId.get(q.id)))
      throw new Error(`Revisão de treino divergente do catálogo: ${q.id}`);
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));
export function auditGeneratedContent() {
  const originals = parseCorpus(readSourceFiles());
  const inventory = auditCorpus(originals);
  if (
    inventory.total !== 420 ||
    subjects.some((s) => inventory.bySubject[s] !== 84) ||
    Object.values(inventory.bySubjectEdition).some((row) =>
      Object.values(row).some((n) => n !== 14),
    )
  )
    throw new Error(
      "Inventário esperado: 420 questões, 84 por matéria, 14 por matéria/edição.",
    );
  const expectedFlags = {
    ocr: 168,
    uncertain: 68,
    both: 21,
    blocked: 215,
    candidates: 205,
  };
  if (!isDeepStrictEqual(inventory.flags, expectedFlags))
    throw new Error("As marcações da fonte original divergiram.");
  const catalogue = QuestionRevisionSchema.array().parse(
    readJson("public/content/catalog.json"),
  );
  const training = QuestionRevisionSchema.array().parse(
    readJson("public/content/questions.json"),
  );
  const expected = applyContentRecords(originals, {
    reviews: readJson("content/reviews.json") as QuestionRevision[],
    answerKeys: readJson(
      "content/answer-keys.json",
    ) as ContentRecords["answerKeys"],
    explanations: readJson(
      "content/explanations.json",
    ) as ContentRecords["explanations"],
  });
  if (!isDeepStrictEqual(catalogue, expected))
    throw new Error(
      "Catálogo divergente da fonte/conferências; execute content:import.",
    );
  assertContentIntegrity(catalogue, training);
  const expectedAudit = {
    ...inventory,
    ...contentAvailability(catalogue),
    historicalFrequency: historicalFrequency(originals),
  };
  if (!isDeepStrictEqual(readJson("public/content/audit.json"), expectedAudit))
    throw new Error("Auditoria publicada divergente da fonte/conferências.");
  console.log(
    `Auditoria: ${inventory.total} questões; 30 células de 14; ${inventory.flags.blocked} sinalizadas; ${inventory.flags.candidates} candidatas não verificadas; ${training.length} prontas.`,
  );
  return expectedAudit;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  auditGeneratedContent();

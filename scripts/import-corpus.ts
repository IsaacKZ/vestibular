import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { Letter, QuestionRevision, Subject } from "../src/content/types";
import { subjects } from "../src/content/constants";
import { QuestionRevisionSchema } from "../src/content/schema";
import {
  contentAvailability,
  isReady,
  isSafeAssetPath,
} from "../src/content/quality";

export const corpusEditions = [
  "2024/1",
  "2024/2",
  "2025/1",
  "2025/2",
  "2026/1",
  "2026/2",
];
export interface CorpusAudit {
  total: number;
  bySubject: Record<Subject, number>;
  byEdition: Record<string, number>;
  bySubjectEdition: Record<Subject, Record<string, number>>;
  flags: {
    ocr: number;
    uncertain: number;
    both: number;
    blocked: number;
    candidates: number;
  };
}
export interface PedagogyRecord {
  id: string;
  skills: string[];
  learning: NonNullable<QuestionRevision["learning"]>;
}
export interface ContentRecords {
  reviews?: QuestionRevision[];
  answerKeys?: {
    id: string;
    key: QuestionRevision["key"];
    annulment?: QuestionRevision["annulment"];
  }[];
  explanations?: { id: string; explanation: QuestionRevision["explanation"] }[];
  pedagogy?: PedagogyRecord[];
}

export function parseCorpus(
  files: { path: string; text: string }[],
): QuestionRevision[] {
  const result: QuestionRevision[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    const subject = subjects.find((s) =>
      file.path.endsWith(`questoes-${s}.md`),
    );
    if (!subject) throw new Error(`Matéria desconhecida: ${file.path}`);
    const headings = [...file.text.matchAll(/^#{1,2} .+$/gm)];
    let topic = "";
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const topicMatch = heading[0].match(/^# (.+?)\s+\(\d+ questões\)\s*$/);
      if (topicMatch) {
        topic = topicMatch[1].trim().toLocaleLowerCase("pt-BR");
        continue;
      }
      const match = heading[0].match(
        /^## \[(\d{4}\/[12])\] questão (\d+) \(nº (\d+) no caderno\)(.*)$/,
      );
      if (!match) continue;
      if (!topic) throw new Error(`Tópico ausente: ${heading[0]}`);
      const [, edition, number, original, marks] = match;
      const period =
        subject === "fisica" || subject === "quimica"
          ? "vespertino"
          : "matutino";
      const originalNumber = Number(original),
        subjectNumber = Number(number);
      const expectedOffset =
        subject === "biologia" || subject === "quimica"
          ? 14
          : subject === "portugues-literatura"
            ? 36
            : 0;
      if (
        subjectNumber < 1 ||
        subjectNumber > 14 ||
        originalNumber !== subjectNumber + expectedOffset
      )
        throw new Error(`Numeração original inválida: ${heading[0]}`);
      const id = `udesc-${edition.replace("/", "-")}-${period}-${String(originalNumber).padStart(2, "0")}`;
      if (ids.has(id)) throw new Error(`ID duplicado: ${id}`);
      ids.add(id);
      const rawText = file.text.slice(
        heading.index! + heading[0].length,
        headings[i + 1]?.index ?? file.text.length,
      );
      const sha256 = createHash("sha256").update(rawText).digest("hex");
      // Display extraction never changes the immutable source slice.
      const body = rawText
        .replace(/^> 🔧.*\r?\n/gm, "")
        .replace(/^\s*Questão\s+\d+\s*\r?\n/i, "")
        .trim();
      const markers = [...body.matchAll(/^([A-E])[.)]\s*([^\r\n]*)/gm)];
      const supportSections = [...body.matchAll(/^\s*TEXTO\s+(\d+)\s*\r?$/gim)];
      const inline =
        markers.length === 5 &&
        markers.every(
          (m, n) =>
            m[1] === "ABCDE"[n] && m[2].replace(/[()\s]/g, "").length > 0,
        );
      const options: QuestionRevision["options"] = inline
        ? markers.map((m, n) => ({
            letter: m[1] as Letter,
            text: body
              .slice(
                m.index! + m[0].indexOf(m[2]),
                markers[n + 1]?.index ??
                  supportSections.find((section) => section.index! > m.index!)
                    ?.index ??
                  body.length,
              )
              .replace(/^\(\s*\)\s*/, "")
              .trim(),
          }))
        : [];
      const stem = (
        markers.length ? body.slice(0, markers[0].index) : body
      ).trim();
      const supportReferences = [...stem.matchAll(/\btexto\s+(\d+)\b/gi)];
      const attachedSupport = new Set(
        [...stem.matchAll(/^\s*TEXTO\s+(\d+)\s*\r?$/gim)].map(
          (section) => section[1],
        ),
      );
      const missingSupport = supportReferences.some(
        (reference) => !attachedSupport.has(reference[1]),
      );
      const ocr = rawText.includes("Vinda de OCR"),
        uncertain = marks.includes("⚠");
      const mentionsAsset =
        /\b(figura|gráfico|imagem|ilustração|esquema)\s*\d*\b/i.test(body);
      result.push({
        id,
        revision: `import-${sha256.slice(0, 12)}`,
        subject,
        edition,
        period,
        originalNumber,
        subjectNumber,
        topics: [topic],
        skills: [],
        rawText,
        stem,
        options,
        assets: [],
        source: { file: file.path, section: heading[0], sha256 },
        quality: {
          reviewed: false,
          ocr,
          uncertain,
          textComplete: Boolean(stem) && !uncertain && !missingSupport,
          assetsComplete: !mentionsAsset && !uncertain,
          taxonomyReviewed: false,
          annulled: false,
        },
        key: null,
        annulment: null,
        explanation: null,
      });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function auditCorpus(items: QuestionRevision[]): CorpusAudit {
  const editions = [
    ...new Set([...corpusEditions, ...items.map((q) => q.edition)]),
  ].sort();
  const bySubject = Object.fromEntries(subjects.map((s) => [s, 0])) as Record<
    Subject,
    number
  >;
  const byEdition = Object.fromEntries(editions.map((e) => [e, 0]));
  const bySubjectEdition = Object.fromEntries(
    subjects.map((s) => [s, Object.fromEntries(editions.map((e) => [e, 0]))]),
  ) as Record<Subject, Record<string, number>>;
  const flags = { ocr: 0, uncertain: 0, both: 0, blocked: 0, candidates: 0 };
  const ids = new Set<string>();
  for (const q of items) {
    if (ids.has(q.id)) throw new Error(`ID duplicado: ${q.id}`);
    ids.add(q.id);
    bySubject[q.subject]++;
    byEdition[q.edition]++;
    bySubjectEdition[q.subject][q.edition]++;
    if (q.quality.ocr) flags.ocr++;
    if (q.quality.uncertain) flags.uncertain++;
    if (q.quality.ocr && q.quality.uncertain) flags.both++;
    if (q.quality.ocr || q.quality.uncertain) flags.blocked++;
    else flags.candidates++;
  }
  return { total: items.length, bySubject, byEdition, bySubjectEdition, flags };
}

/** Files must exist inside the public tree, including after symlink resolution. */
export function localAssetExists(publicRoot: string, path: string): boolean {
  if (!isSafeAssetPath(path)) return false;
  const root = resolve(publicRoot),
    file = resolve(root, path);
  if (!existsSync(file) || !existsSync(root)) return false;
  const realRoot = realpathSync(root),
    realFile = realpathSync(file),
    inside = relative(realRoot, realFile);
  return (
    inside !== "" &&
    !inside.startsWith(`..${sep}`) &&
    inside !== ".." &&
    !inside.startsWith(sep) &&
    statSync(realFile).isFile()
  );
}

export function applyContentRecords(
  items: QuestionRevision[],
  records: ContentRecords,
  publicRoot = "public",
): QuestionRevision[] {
  const result = new Map(items.map((q) => [q.id, structuredClone(q)]));
  const reviewed = new Set<string>();
  for (const review of records.reviews ?? []) {
    const initial = result.get(review.id);
    if (!initial) throw new Error(`Revisão de ID desconhecido: ${review.id}`);
    if (reviewed.has(review.id))
      throw new Error(`Revisão duplicada: ${review.id}`);
    reviewed.add(review.id);
    if (review.revision === initial.revision)
      throw new Error(`Conferência exige nova revisão: ${review.id}`);
    if (
      !review.quality.reviewed ||
      !review.quality.reviewer?.trim() ||
      !review.quality.reviewedAt ||
      !Number.isFinite(Date.parse(review.quality.reviewedAt)) ||
      !review.source.originalPdf?.trim() ||
      !Number.isInteger(review.source.page) ||
      (review.source.page ?? 0) < 1
    )
      throw new Error(
        `Conferência exige original, página e revisor: ${review.id}`,
      );
    if (
      review.rawText !== initial.rawText ||
      review.source.sha256 !== initial.source.sha256 ||
      review.source.file !== initial.source.file ||
      review.source.section !== initial.source.section
    )
      throw new Error(
        `Texto bruto/procedência original alterados: ${review.id}`,
      );
    for (const field of [
      "subject",
      "edition",
      "period",
      "originalNumber",
      "subjectNumber",
    ] as const)
      if (review[field] !== initial[field])
        throw new Error(`Identidade alterada (${field}): ${review.id}`);
    result.set(review.id, structuredClone(review));
  }
  const keyIds = new Set<string>(),
    explanationIds = new Set<string>();
  for (const record of records.answerKeys ?? []) {
    const q = result.get(record.id);
    if (!q) throw new Error(`Gabarito de ID desconhecido: ${record.id}`);
    if (keyIds.has(record.id))
      throw new Error(`Gabarito duplicado: ${record.id}`);
    keyIds.add(record.id);
    q.key = structuredClone(record.key);
    if (record.annulment !== undefined) {
      q.annulment = structuredClone(record.annulment);
      q.quality.annulled = record.annulment !== null;
    }
  }
  for (const record of records.explanations ?? []) {
    const q = result.get(record.id);
    if (!q) throw new Error(`Resolução de ID desconhecido: ${record.id}`);
    if (explanationIds.has(record.id))
      throw new Error(`Resolução duplicada: ${record.id}`);
    explanationIds.add(record.id);
    q.explanation = structuredClone(record.explanation);
  }
  const pedagogyIds = new Set<string>();
  for (const record of records.pedagogy ?? []) {
    const q = result.get(record.id);
    if (!q) throw new Error(`Apoio de ID desconhecido: ${record.id}`);
    if (pedagogyIds.has(record.id))
      throw new Error(`Apoio duplicado: ${record.id}`);
    pedagogyIds.add(record.id);
    // This overlay cannot serve as a transcription or taxonomy review.
    if (!isReady(q))
      throw new Error(`Apoio exige questão conferida e pronta: ${record.id}`);
    const candidate = {
      ...q,
      skills: [...new Set([...q.skills, ...record.skills])],
      learning: structuredClone(record.learning),
    };
    if (
      !QuestionRevisionSchema.safeParse(candidate).success ||
      record.skills.some((skill) => !skill.trim()) ||
      !record.learning.reviewed ||
      !record.learning.concept.trim() ||
      !record.learning.workedExample.trim() ||
      !record.learning.source.trim() ||
      !record.learning.reviewer.trim()
    )
      throw new Error(`Apoio exige conteúdo e fonte conferidos: ${record.id}`);
    result.set(record.id, candidate);
  }
  for (const q of result.values())
    for (const asset of q.assets) {
      if (!localAssetExists(publicRoot, asset.path)) {
        asset.verified = false;
        if (asset.required) q.quality.assetsComplete = false;
      }
    }
  // A published snapshot includes its attached decisions and explanation. Its
  // identity must change when those records change, even with the same review.
  for (const q of result.values())
    if (reviewed.has(q.id) || keyIds.has(q.id) || explanationIds.has(q.id) || pedagogyIds.has(q.id)) {
      q.revision = `content-${createHash("sha256").update(stableJson(q)).digest("hex")}`;
    }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function historicalFrequency(originals: QuestionRevision[]) {
  const topics = new Map<
    string,
    {
      subject: Subject;
      topic: string;
      total: number;
      proofs: number;
      distribution: number[];
    }
  >();
  for (const q of originals)
    for (const topic of q.topics) {
      const key = `${q.subject}:${topic}`,
        row = topics.get(key) ?? {
          subject: q.subject,
          topic,
          total: 0,
          proofs: 0,
          distribution: corpusEditions.map(() => 0),
        };
      row.total++;
      const idx = corpusEditions.indexOf(q.edition);
      if (idx >= 0) row.distribution[idx]++;
      row.proofs = row.distribution.filter((n) => n > 0).length;
      topics.set(key, row);
    }
  return {
    label: "Contagens provisórias do mapa histórico",
    sampleSize: originals.length,
    editions: corpusEditions,
    uncertainClassifications: originals.filter((q) => q.quality.uncertain)
      .length,
    topics: [...topics.values()].sort(
      (a, b) =>
        subjects.indexOf(a.subject) - subjects.indexOf(b.subject) ||
        b.total - a.total ||
        a.topic.localeCompare(b.topic),
    ),
  };
}

export function readSourceFiles(sourceRoot = "content/source") {
  return readdirSync(sourceRoot)
    .filter((p) => /^questoes-.+\.md$/.test(p))
    .sort()
    .map((p) => ({
      path: `${sourceRoot}/${p}`,
      text: readFileSync(`${sourceRoot}/${p}`, "utf8"),
    }));
}
function recordsFile<T>(path: string): T[] {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(value)) throw new Error(`Esperado array em ${path}`);
  return value as T[];
}
export function readPedagogyRecords(root = "content/pedagogy"): PedagogyRecord[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => recordsFile<PedagogyRecord>(`${root}/${name}`));
}
export function generateContent() {
  const originals = parseCorpus(readSourceFiles());
  const items = applyContentRecords(originals, {
    reviews: recordsFile<QuestionRevision>("content/reviews.json"),
    answerKeys: recordsFile<NonNullable<ContentRecords["answerKeys"]>[number]>(
      "content/answer-keys.json",
    ),
    explanations: recordsFile<
      NonNullable<ContentRecords["explanations"]>[number]
    >("content/explanations.json"),
    pedagogy: readPedagogyRecords(),
  });
  const ready = items.filter(isReady);
  const audit = {
    ...auditCorpus(originals),
    ...contentAvailability(items),
    historicalFrequency: historicalFrequency(originals),
  };
  mkdirSync("public/content", { recursive: true });
  for (const [name, data] of [
    ["catalog", items],
    ["questions", ready],
    ["audit", audit],
  ] as const)
    writeFileSync(
      `public/content/${name}.json`,
      JSON.stringify(data, null, 2) + "\n",
    );
  console.log(
    `Inventário: ${items.length}. Conferidas: ${ready.length}. Treino: ${audit.practiceReady}. Reservadas: ${audit.reservedReady}. Bloqueadas para treino: ${audit.blockedForTraining}.`,
  );
  return { items, originals, audit };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  generateContent();

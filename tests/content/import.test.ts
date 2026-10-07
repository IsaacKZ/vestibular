import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyContentRecords,
  auditCorpus,
  parseCorpus,
} from "../../scripts/import-corpus";
import { isReady, getBlockers } from "../../src/content/quality";
import { readyQuestion } from "./fixtures";
import { createTestDb, makeInput } from "../storage/fixtures";
import {
  startSession,
  submitAttempt,
  regradeAttempt,
} from "../../src/storage/study-service";
import { QuestionRevisionSchema } from "../../src/content/schema";

const files = readdirSync("content/source")
  .filter((p) => p.startsWith("questoes-"))
  .map((path) => ({
    path: `content/source/${path}`,
    text: readFileSync(`content/source/${path}`, "utf8"),
  }));
describe("faithful corpus import", () => {
  it("preserves the 420-item inventory, edition matrix and source flags", () => {
    const items = parseCorpus(files),
      audit = auditCorpus(items);
    expect(audit.total).toBe(420);
    expect(Object.values(audit.bySubject)).toEqual([84, 84, 84, 84, 84]);
    const cells = Object.values(audit.bySubjectEdition).flatMap(Object.values);
    expect(cells).toHaveLength(30);
    expect(cells.every((n) => n === 14)).toBe(true);
    expect(audit.flags).toEqual({
      ocr: 168,
      uncertain: 68,
      both: 21,
      blocked: 215,
      candidates: 205,
    });
    expect(items.filter(isReady)).toHaveLength(0);
    expect(
      items.find((q) => q.subject === "portugues-literatura")?.originalNumber,
    ).toBeGreaterThanOrEqual(37);
    expect(
      items.find((q) => q.subject === "quimica")?.originalNumber,
    ).toBeGreaterThanOrEqual(15);
  });
  it("preserves untouched raw slices, headings and SHA-256, deterministically", () => {
    const first = parseCorpus(files)[0];
    expect(files.find((f) => f.path === first.source.file)?.text).toContain(
      first.rawText,
    );
    expect(first.source.sha256).toBe(
      createHash("sha256").update(first.rawText).digest("hex"),
    );
    expect(first.source.section).toMatch(/^## \[/);
    expect(parseCorpus([...files].reverse())).toEqual(parseCorpus(files));
  });
  it("refuses duplicate question identities", () => {
    expect(() => parseCorpus([files[0], files[0]])).toThrow(/duplic/i);
  });
  it("does not attach separated physics option text by guessing", () => {
    const text =
      "# CINEMÁTICA  (1 questões)\n\n## [2026/1] questão 1 (nº 1 no caderno)\n\nQuestão 01\nTexto\nA. (\nB. (\nC. (\nD. (\nE. (\n)\n1 m\n)\n2 m\n)\n3 m\n)\n4 m\n)\n5 m\n";
    const q = parseCorpus([{ path: "questoes-fisica.md", text }])[0];
    expect(q.options).toEqual([]);
    expect(getBlockers(q)).toContain("missing_options");
    expect(q.rawText).toContain("1 m");
  });
  it("requires a new revision and original evidence to clear imported flags", () => {
    const q = readyQuestion();
    const initial = {
      ...q,
      revision: "import-1",
      quality: { ...q.quality, ocr: true, reviewed: false },
    };
    expect(() =>
      applyContentRecords([initial], { reviews: [q] }),
    ).not.toThrow();
    expect(isReady(applyContentRecords([initial], { reviews: [q] })[0])).toBe(
      true,
    );
    expect(() =>
      applyContentRecords([initial], {
        reviews: [{ ...q, revision: "import-1" }],
      }),
    ).toThrow(/revis/i);
    expect(() =>
      applyContentRecords([initial], {
        reviews: [{ ...q, source: { ...q.source, originalPdf: undefined } }],
      }),
    ).toThrow(/original/i);
    expect(initial.quality.ocr).toBe(true);
  });
  it("blocks a claimed verified asset that is absent from the local public tree", () => {
    const q = readyQuestion();
    const review = {
      ...q,
      revision: "checked-2",
      assets: [
        {
          path: "content/assets/absent.svg",
          alt: "Figura",
          required: true,
          verified: true,
          source: "original.pdf p. 1",
          anchor: {
            target: "stem" as const,
            optionLetter: null,
            afterBlock: 0,
          },
        },
      ],
    };
    expect(
      isReady(applyContentRecords([q], { reviews: [review] }, "public")[0]),
    ).toBe(false);
  });
  it("adds reviewed pedagogy without replacing the question or its original skills, and versions its support", () => {
    const q = readyQuestion();
    const learning = {
      concept: "Conceito conferido para interpretar esta questão.",
      workedExample: "Resolução comentada da mesma questão oficial.",
      prerequisites: [], reviewed: true,
      source: "caderno-original.pdf, p. 1", reviewer: "Revisor",
    };
    const records = { pedagogy: [{ id: q.id, skills: [q.skills[0], "Habilidade compartilhada"], learning }] };
    const before = structuredClone(q);
    const enriched = applyContentRecords([q], records)[0];
    expect(enriched.skills).toEqual([...q.skills, "Habilidade compartilhada"]);
    expect(enriched.learning).toEqual(learning);
    expect(enriched.stem).toBe(q.stem);
    expect(enriched.key).toEqual(q.key);
    expect(enriched.explanation).toEqual(q.explanation);
    expect(enriched.rawText).toBe(q.rawText);
    expect(enriched.revision).not.toBe(q.revision);
    expect(applyContentRecords([q], records)[0]).toEqual(enriched);
    const updated = { pedagogy: [{ ...records.pedagogy[0], learning: { ...learning, concept: "Um conceito revisado com uma explicação mais precisa." } }] };
    expect(applyContentRecords([q], updated)[0].revision).not.toBe(enriched.revision);
    expect(q).toEqual(before);
  });
  it("rejects duplicate, unknown or unreviewed pedagogy instead of unblocking uncertain text", () => {
    const q = readyQuestion();
    const record = {
      id: q.id, skills: ["Habilidade compartilhada"],
      learning: { concept: "Conceito conferido.", workedExample: "Exemplo conferido.", prerequisites: [], reviewed: true, source: "original.pdf p1", reviewer: "Revisor" },
    };
    const duplicate = { pedagogy: [record, record] };
    const unknown = { pedagogy: [{ ...record, id: "absent" }] };
    const valid = { pedagogy: [record] };
    expect(() => applyContentRecords([q], duplicate)).toThrow(/duplic/i);
    expect(() => applyContentRecords([q], unknown)).toThrow(/desconhecido/i);
    expect(() => applyContentRecords([{ ...q, quality: { ...q.quality, taxonomyReviewed: false } }], valid)).toThrow(/confer/i);
    const unreviewed = { pedagogy: [{ ...record, learning: { ...record.learning, reviewed: false } }] };
    expect(() => applyContentRecords([q], unreviewed)).toThrow(/apoio|confer/i);
  });
  it("publishes a new snapshot identity when an official key changes, preserving earlier attempts", async () => {
    const review = readyQuestion({ revision: "checked-v1" });
    const initial = { ...review, revision: "import-v1" };
    const publish = (letter: "A" | "B", revision: string) =>
      applyContentRecords([initial], {
        reviews: [review],
        answerKeys: [
          { id: review.id, key: { ...review.key!, letter, revision } },
        ],
      })[0];
    const before = publish("A", "key-v1");
    const after = publish("B", "key-v2");
    const db = await createTestDb();
    try {
      const session = await startSession(
        db,
        { questions: [before], mode: "study", durationMs: null },
        "2026-10-02T12:00:00Z",
      );
      const saved = await submitAttempt(
        db,
        makeInput(session.id, {
          questionId: before.id,
          questionRevision: before.revision,
        }),
        "2026-10-02T12:00:10Z",
      );
      expect(after.revision).not.toBe(before.revision);
      await expect(
        startSession(
          db,
          { questions: [after], mode: "study", durationMs: null },
          "2026-10-03T12:00:00Z",
        ),
      ).resolves.toMatchObject({ status: "active" });
      await expect(
        regradeAttempt(db, saved.id, after, "2026-10-03T12:00:00Z"),
      ).resolves.toMatchObject({ correct: false });
      expect(await db.attempts.get(saved.id)).toEqual(saved);
      expect(
        await db.questionSnapshots.get([before.id, before.revision]),
      ).toEqual(before);
      expect(await db.questionSnapshots.count()).toBe(2);
      expect(await db.grades.count()).toBe(2);
      expect(publish("B", "key-v2")).toEqual(after);
      expect(after.rawText).toBe(initial.rawText);
      expect(after.source.sha256).toBe(initial.source.sha256);
    } finally {
      await db.delete();
    }
  });
  it("versions explanation and annulment changes with bounded deterministic identities", () => {
    const review = readyQuestion({ revision: "r".repeat(500) });
    const initial = { ...review, revision: "import-v1" };
    const before = applyContentRecords([initial], { reviews: [review] })[0];
    const explained = applyContentRecords([initial], {
      reviews: [review],
      explanations: [
        {
          id: review.id,
          explanation: {
            ...review.explanation!,
            text: "Resolução revisada novamente.",
          },
        },
      ],
    })[0];
    const annulled = applyContentRecords([initial], {
      reviews: [review],
      answerKeys: [
        {
          id: review.id,
          key: review.key,
          annulment: {
            revision: "annulment-v1",
            verified: true,
            source: "oficial.pdf",
            location: "p. 1",
            reviewer: "Revisor",
          },
        },
      ],
    })[0];
    expect(
      new Set([before.revision, explained.revision, annulled.revision]).size,
    ).toBe(3);
    expect(QuestionRevisionSchema.safeParse(explained).success).toBe(true);
    expect(explained.revision.length).toBeLessThanOrEqual(500);
    expect(applyContentRecords([initial], { reviews: [review] })[0]).toEqual(
      before,
    );
    const reordered = Object.fromEntries(
      Object.entries(review).reverse(),
    ) as typeof review;
    expect(applyContentRecords([initial], { reviews: [reordered] })[0]).toEqual(
      before,
    );
  });
  it("imports an official annulment into the correction state without rewriting the earlier attempt", async () => {
    const review = readyQuestion({ revision: "checked-v1" });
    const initial = { ...review, revision: "import-v1" };
    const before = applyContentRecords([initial], { reviews: [review] })[0];
    const after = applyContentRecords([initial], {
      reviews: [review],
      answerKeys: [{
        id: review.id,
        key: null,
        annulment: {
          revision: "official-cancellation-v1",
          verified: true,
          source: "gabarito-oficial.pdf",
          location: "p. 1, matutino, questão 1",
          reviewer: "Conferência do documento",
        },
      }],
    })[0];
    expect(after.quality.annulled).toBe(true);
    expect(isReady(after)).toBe(false);
    const db = await createTestDb();
    try {
      const session = await startSession(db, {
        questions: [before], mode: "study", durationMs: null,
      }, "2026-10-02T12:00:00Z");
      const saved = await submitAttempt(db, makeInput(session.id, {
        questionId: before.id, questionRevision: before.revision,
      }), "2026-10-02T12:00:10Z");
      await expect(regradeAttempt(db, saved.id, after, "2026-10-05T12:00:00Z"))
        .resolves.toMatchObject({ correct: null, exclusionReason: "annulled", keyRevision: null });
      expect(await db.attempts.get(saved.id)).toEqual(saved);
      expect(await db.questionSnapshots.get([before.id, before.revision])).toEqual(before);
      expect(await db.grades.count()).toBe(2);
      expect(applyContentRecords([initial], { reviews: [review] })[0]).toEqual(before);
    } finally {
      await db.delete();
    }
  });
  it("clears the annulment state when a later official record explicitly restores a letter", () => {
    const q = readyQuestion();
    const annulment = {
      revision: "cancelled-v1", verified: true,
      source: "oficial.pdf", location: "p. 1", reviewer: "Revisor",
    };
    const initial = { ...q, quality: { ...q.quality, annulled: true }, key: null, annulment };
    const after = applyContentRecords([initial], {
      answerKeys: [{ id: q.id, key: q.key, annulment: null }],
    })[0];
    expect(after.quality.annulled).toBe(false);
    expect(after.annulment).toBeNull();
    expect(isReady(after)).toBe(true);
    expect(initial.quality.annulled).toBe(true);
  });
  it("does not attach an explicit trailing support section to option E", () => {
    const text =
      "# ECOLOGIA (1 questões)\n\n## [2026/1] questão 1 (nº 15 no caderno)\n\nQuestão 15\nEnunciado próprio.\nA. Alternativa A\nB. Alternativa B\nC. Alternativa C\nD. Alternativa D\nE. Alternativa E\n\nTEXTO 1\nArtigo de apoio de outra questão.\n";
    const q = parseCorpus([{ path: "questoes-biologia.md", text }])[0];
    expect(q.options.find((o) => o.letter === "E")?.text).toBe("Alternativa E");
    expect(q.rawText).toContain("TEXTO 1\nArtigo de apoio");
    expect(q.source.sha256).toBe(
      createHash("sha256").update(q.rawText).digest("hex"),
    );
  });
  it("marks a referenced support text missing without guessing an association", () => {
    const text =
      "# ECOLOGIA (1 questões)\n\n## [2026/1] questão 1 (nº 15 no caderno)\n\nQuestão 15\nSegundo o Texto 1, assinale.\nA. Alternativa A\nB. Alternativa B\nC. Alternativa C\nD. Alternativa D\nE. Alternativa E\n";
    const q = parseCorpus([{ path: "questoes-biologia.md", text }])[0];
    expect(q.quality.textComplete).toBe(false);
    expect(getBlockers(q)).toContain("missing_text");
  });
  it("keeps an explicit support text already included before the alternatives", () => {
    const text =
      "# ECOLOGIA (1 questões)\n\n## [2026/1] questão 1 (nº 15 no caderno)\n\nQuestão 15\nTEXTO 1\nArtigo de apoio conservado.\n\nSegundo o Texto 1, assinale.\nA. Alternativa A\nB. Alternativa B\nC. Alternativa C\nD. Alternativa D\nE. Alternativa E\n";
    const q = parseCorpus([{ path: "questoes-biologia.md", text }])[0];
    expect(q.stem).toContain("TEXTO 1\nArtigo de apoio conservado.");
    expect(q.quality.textComplete).toBe(true);
    expect(q.options.find((o) => o.letter === "E")?.text).toBe("Alternativa E");
  });
});

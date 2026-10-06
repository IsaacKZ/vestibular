import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import type { QuestionRevision } from "../../src/content/types";
import { hasVerifiedAnnulment, hasVerifiedKey, isReady } from "../../src/content/quality";

const catalogue = (): QuestionRevision[] => JSON.parse(readFileSync("public/content/catalog.json", "utf8"));

test("the real corpus publishes all 404 official letters and the 16 cancellations", () => {
  const rows = catalogue();
  expect(rows.filter(hasVerifiedKey)).toHaveLength(404);
  expect(rows.filter(hasVerifiedAnnulment)).toHaveLength(16);
  expect(rows.every((q) => hasVerifiedKey(q) || hasVerifiedAnnulment(q))).toBe(true);
  expect(rows.filter(hasVerifiedAnnulment).every((q) => q.quality.annulled && q.key === null && !isReady(q))).toBe(true);
});

test("official decisions retain original question numbering and do not mix periods", () => {
  const rows = catalogue();
  const byId = new Map(rows.map((q) => [q.id, q]));
  const cancelled = [
    "2024-1-matutino-39", "2024-1-vespertino-12",
    "2024-2-matutino-05", "2024-2-matutino-12", "2024-2-matutino-26",
    "2024-2-vespertino-10", "2024-2-vespertino-20",
    "2025-1-vespertino-23",
    "2025-2-matutino-12", "2025-2-matutino-39",
    "2025-2-vespertino-10", "2025-2-vespertino-21",
    "2026-1-matutino-12", "2026-1-vespertino-17",
    "2026-2-matutino-09", "2026-2-vespertino-14",
  ].map((id) => `udesc-${id}`).sort();
  expect(rows.filter(hasVerifiedAnnulment).map((q) => q.id).sort()).toEqual(cancelled);
  const sample = [
    ["2024-1-matutino-01", "C"], ["2024-1-vespertino-15", "C"],
    ["2024-2-matutino-15", "C"], ["2024-2-vespertino-01", "B"],
    ["2025-1-matutino-37", "C"], ["2025-1-vespertino-15", "E"],
    ["2025-2-matutino-01", "C"], ["2025-2-vespertino-15", "B"],
    ["2026-1-matutino-01", "A"], ["2026-1-vespertino-01", "D"],
    ["2026-2-matutino-37", "E"], ["2026-2-vespertino-15", "A"],
  ];
  for (const [id, letter] of sample) expect(byId.get(`udesc-${id}`)?.key?.letter, id).toBe(letter);
});

test("every official answer points to an unchanged local source PDF and a precise location", () => {
  const manifestPath = "content/answer-key-sources.json";
  expect(existsSync(manifestPath)).toBe(true);
  const docs: { edition: string; file: string; sha256: string }[] = JSON.parse(readFileSync(manifestPath, "utf8"));
  expect(docs).toHaveLength(6);
  const byPath = new Map(docs.map((d) => [d.file, d]));
  for (const d of docs) {
    const path = `public/${d.file}`;
    expect(existsSync(path)).toBe(true);
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(d.sha256);
  }
  for (const q of catalogue()) {
    const decision = q.quality.annulled ? q.annulment : q.key;
    expect(decision).not.toBeNull();
    expect(byPath.get(decision!.source)?.edition).toBe(q.edition);
    expect(decision!.location).toContain(`questão ${q.originalNumber}`);
    expect(decision!.location.toLocaleLowerCase("pt-BR")).toContain(q.period);
    expect(createHash("sha256").update(q.rawText).digest("hex")).toBe(q.source.sha256);
  }
});

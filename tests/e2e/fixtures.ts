import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { readyQuestion } from "../content/fixtures";
import { subjects } from "../../src/content/constants";

// Synthetic content is deliberately confined to browser tests. Never publish it.
export const browserQuestions = Array.from({ length: 12 }, (_, index) =>
  readyQuestion({
    id: `test-browser-${index + 1}`,
    subject: subjects[index % subjects.length],
    originalNumber: index + 1,
    subjectNumber: Math.floor(index / subjects.length) + 1,
    rawText: `Enunciado sintético exclusivo dos testes ${index + 1}.`,
    stem: `Quanto é 2 + 2? Questão de teste ${index + 1}.`,
    options: [
      { letter: "A", text: "4" },
      { letter: "B", text: "5" },
      { letter: "C", text: "6" },
      { letter: "D", text: "7" },
      { letter: "E", text: "8" },
    ],
    explanation: {
      text: "Somar duas unidades a duas unidades resulta em quatro.",
      reviewed: true,
      authorKind: "prepared",
      author: "Fixture de teste",
      source: "Fixture isolada",
      reviewer: "Teste",
    },
  }),
);
export async function useVerifiedTestCorpus(page: Page) {
  const audit = JSON.parse(
    readFileSync(
      new URL("../../public/content/audit.json", import.meta.url),
      "utf8",
    ),
  );
  audit.total = browserQuestions.length;
  audit.ready = browserQuestions.length;
  audit.blockedForTraining = 0;
  await page.route("**/content/*.json", async (route) => {
    const name = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        name.endsWith("/audit.json") ? audit : browserQuestions,
      ),
    });
  });
}
export async function readStore(
  page: Page,
  store: string,
): Promise<Record<string, unknown>[]> {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("udesc-study");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = database.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, store);
}

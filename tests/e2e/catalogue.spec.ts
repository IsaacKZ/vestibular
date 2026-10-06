import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QuestionRevisionSchema } from "../../src/content/schema";
import {
  canPractice,
  getBlockers,
  hasVerifiedAnnulment,
  hasVerifiedKey,
  isReady,
} from "../../src/content/quality";
import { blockerLabels } from "../../src/content/constants";
import { readyQuestion } from "../content/fixtures";

const realCatalogue = () =>
  QuestionRevisionSchema.array().parse(
    JSON.parse(
      readFileSync(
        new URL("../../public/content/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );

test("catálogo real mostra as confirmações e filtra matéria e edição com contagens reais", async ({
  page,
}) => {
  const catalogue = realCatalogue();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/questions");
  await expect(
    page.getByRole("heading", { name: "Questões", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      `${catalogue.length} questões encontradas · ${catalogue.filter(canPractice).length} prontas`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator(".inventory-line").getByText(
      `${catalogue.filter(hasVerifiedKey).length} com gabarito confirmado`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator(".inventory-line").getByText(
      `${catalogue.filter(hasVerifiedAnnulment).length} anulações confirmadas`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/O acervo recebido não inclui gabaritos oficiais/),
  ).toHaveCount(0);
  const pendingCount = catalogue.filter((q) =>
    getBlockers(q).some((blocker) => blocker !== "annulled"),
  ).length;
  if (pendingCount > 0) {
    await expect(
      page.getByText(
        `Há ${pendingCount} questões com conferência pendente. O treino corrigido usa apenas conteúdo conferido.`,
        { exact: true },
      ),
    ).toBeVisible();
  } else {
    await expect(page.getByText(/questões com conferência pendente/)).toHaveCount(0);
  }
  await page
    .getByRole("combobox", { name: "Matéria", exact: true })
    .selectOption("biologia");
  const biology = catalogue.filter((q) => q.subject === "biologia");
  await expect(
    page.getByText(
      `${biology.length} questões encontradas · ${biology.filter(canPractice).length} prontas`,
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Edição", exact: true })
    .selectOption("2026/1");
  const selection = biology.filter((q) => q.edition === "2026/1");
  await expect(
    page.getByText(
      `${selection.length} questões encontradas · ${selection.filter(canPractice).length} prontas`,
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("ready");
  const ready = selection.filter(isReady);
  await expect(
    page.getByText(
      `${ready.length} questões encontradas · ${ready.filter(canPractice).length} prontas`,
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("blocked");
  await expect(
    page.getByText(
      `${selection.filter((q) => !isReady(q)).length} questões encontradas · 0 prontas`,
      { exact: true },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("gabarito confirmado não libera uma transcrição OCR nem antecipa a resposta", async ({
  page,
}) => {
  const q = realCatalogue().find(
    (item) => item.quality.ocr && hasVerifiedKey(item) && !isReady(item),
  );
  expect(q, "O acervo real deve conservar uma questão OCR ainda bloqueada").toBeDefined();
  if (!q) throw new Error("Questão OCR pendente não encontrada.");
  await page.goto(`/questions/${q.id}`);
  await expect(
    page.getByRole("heading", { name: "Conferência pendente" }),
  ).toBeVisible();
  await expect(page.getByText("Gabarito confirmado", { exact: true })).toBeVisible();
  for (const blocker of getBlockers(q)) {
    await expect(page.getByText(blockerLabels[blocker], { exact: true })).toBeVisible();
  }
  await expect(
    page.getByText("Sem gabarito confirmado", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(q.key!.source, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/(?:Gabarito|Resposta correta|Alternativa correta):\s*[ABCDE]\b/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tentar esta questão" }),
  ).toHaveCount(0);
});

test("anulação confirmada de matemática 2024/2 não pede gabarito nem oferece treino", async ({
  page,
}) => {
  const q = realCatalogue().find(
    (item) => item.subject === "matematica" && item.edition === "2024/2" && item.originalNumber === 5,
  );
  expect(q).toBeDefined();
  if (!q) throw new Error("Questão anulada não encontrada.");
  expect(hasVerifiedAnnulment(q)).toBe(true);
  expect(q.key).toBeNull();
  await page.goto(`/questions/${q.id}`);
  await expect(page.getByText("Anulação confirmada", { exact: true })).toBeVisible();
  await expect(page.getByText("Questão anulada", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sem gabarito confirmado", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(q.annulment!.source, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tentar esta questão" }),
  ).toHaveCount(0);
});

test("confirmações não revelam respostas, PDFs ou enunciados reservados durante simulado ativo", async ({
  page,
}) => {
  const key = {
    ...readyQuestion().key!,
    source: "content/answer-keys/gabarito-oficial-completo.pdf",
  };
  const ordinary = readyQuestion({ id: "catalogue-active", key });
  const reserved = readyQuestion({
    id: "catalogue-reserved",
    assessmentOnly: true,
    difficulty: "medium",
    rawText: "ENUNCIADO RESERVADO DO CATÁLOGO",
    key,
  });
  await page.route("**/content/*.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().endsWith("/audit.json") ? null : [ordinary, reserved],
      ),
    });
  });
  await page.goto(`/questions/${reserved.id}`);
  await expect(page.getByText(/Questão reservada para avaliação inédita/)).toBeVisible();
  await expect(page.getByText(reserved.rawText, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tentar esta questão" })).toHaveCount(0);
  await expect(page.getByText(key.source, { exact: true })).toHaveCount(0);
  await expect(page.locator(`a[href*="${key.source}"]`)).toHaveCount(0);
  await page.goto("/assessment");
  await page.getByRole("spinbutton", { name: "Quantidade de questões", exact: true }).fill("1");
  await page.getByRole("button", { name: "Iniciar simulado parcial", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Questão 1 de 1" })).toBeVisible();
  await page.goto(`/questions/${ordinary.id}`);
  await expect(page.getByRole("link", { name: "Retomar simulado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar esta questão" })).toHaveCount(0);
  await expect(page.getByText(key.source, { exact: true })).toHaveCount(0);
  await expect(page.locator(`a[href*="${key.source}"]`)).toHaveCount(0);
  await expect(page.getByText(/(?:Gabarito|Resposta correta|Alternativa correta):\s*[ABCDE]\b/i)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.goto("/questions");
  await expect(
    page.getByText("2 questões encontradas · 0 prontas", { exact: true }),
  ).toBeVisible();
});

test("telas reais em celular não transbordam e não inventam histórico", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/questions",
    "/notebook",
    "/progress",
    "/settings",
    "/assessment",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const width = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(width.body, route).toBeLessThanOrEqual(width.viewport);
  }
  await page.goto("/");
  await expect(
    page.getByText("Você ainda não registrou tentativas.", { exact: true }),
  ).toBeVisible();
});

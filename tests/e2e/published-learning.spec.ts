import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QuestionRevisionSchema } from "../../src/content/schema";
import { canPractice } from "../../src/content/quality";
import { selectRemediationQuestions } from "../../src/domain/remediation";
import { readStore } from "./fixtures";

const catalogue = QuestionRevisionSchema.array().parse(
  JSON.parse(readFileSync(new URL("../../public/content/catalog.json", import.meta.url), "utf8")),
);

test("questão oficial de Matemática leva do erro ao conceito e a outro item com consulta registrada", async ({ page }) => {
  const original = catalogue.find((q) => q.id === "udesc-2024-1-matutino-01")!;
  const followup = selectRemediationQuestions(original, catalogue, "followup")[0];
  expect(canPractice(original)).toBe(true);
  expect(original.learning?.reviewed).toBe(true);
  expect(followup).toBeDefined();
  await page.goto(`/questions/${original.id}`);
  await page.getByRole("button", { name: "Tentar esta questão", exact: true }).click();
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.getByRole("radio").first().check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page.getByRole("button", { name: "Registrar resposta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resposta incorreta", exact: true })).toBeVisible();
  const correction = page.getByRole("region", { name: "Correção" });
  await expect(correction.getByRole("heading", { name: "Conceito", exact: true })).toBeVisible();
  await expect(correction.getByRole("heading", { name: "Resolução", exact: true })).toBeVisible();
  await expect(correction).toContainText("504");
  const attempts = await readStore(page, "attempts");
  const grades = await readStore(page, "grades");
  await page.goto(`/notebook?question=${original.id}`);
  const support = page.getByRole("region", { name: "Apoio para entender o erro" });
  await expect(support).toHaveCount(0);
  await page.getByLabel("Causa confirmada por você").selectOption("method");
  await page.getByRole("button", { name: "Entender o erro", exact: true }).click();
  await expect(support.getByRole("heading", { name: "Conceito", exact: true })).toBeVisible();
  await expect(support.getByRole("heading", { name: "Exemplo resolvido", exact: true })).toBeVisible();
  await expect(support).toContainText("504");
  expect(await readStore(page, "attempts")).toEqual(attempts);
  expect(await readStore(page, "grades")).toEqual(grades);
  expect((await readStore(page, "feedback")).filter((event) => String(event.id).startsWith("support:")))
    .toEqual([expect.objectContaining({ attemptId: attempts[0].id, questionRevision: original.revision })]);
  await page.screenshot({ path: "/tmp/udesc-learning-support-desktop.png", fullPage: true });
  await support.getByRole("button", { name: "Praticar outra questão da mesma habilidade", exact: true }).click();
  await expect(page.getByText("Prática guiada", { exact: true })).toBeVisible();
  const consulted = page.getByRole("checkbox", { name: "Consultei material", exact: true });
  await expect(consulted).toBeChecked();
  await expect(consulted).toBeDisabled();
  const guided = (await readStore(page, "sessions")).find((s) => s.purpose === "guided")!;
  expect(guided.questions).toEqual([{ id: followup.id, revision: followup.revision }]);
  await page.getByRole("radio").nth("ABCDE".indexOf(followup.key!.letter)).check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page.getByRole("button", { name: "Registrar resposta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acerto com consulta", exact: true })).toBeVisible();
  expect((await readStore(page, "attempts")).find((a) => a.sessionId === guided.id))
    .toMatchObject({ questionId: followup.id, consulted: true, response: followup.key!.letter });
});

test("Português conserva o poema completo e a correção com legibilidade em320px", async ({ page }) => {
  const question = catalogue.find((q) => q.id === "udesc-2025-2-matutino-41")!;
  expect(canPractice(question)).toBe(true);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(`/questions/${question.id}`);
  await page.getByRole("button", { name: "Tentar esta questão", exact: true }).click();
  await expect(page.getByText(/Poema da Tristeza/i).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Enunciado" })).toContainText("Sou triste porque a minha alma");
  await expect(page.getByRole("region", { name: "Enunciado" })).toContainText("2024, p. 62");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/udesc-portugues-mobile.png", fullPage: true });
  await page.getByRole("radio").nth(3).check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page.getByRole("button", { name: "Registrar resposta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resposta correta", exact: true })).toBeVisible();
  const correction = page.getByRole("region", { name: "Correção" });
  await expect(correction).toContainText(/veem/i);
  await expect(correction).toContainText(/têm/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

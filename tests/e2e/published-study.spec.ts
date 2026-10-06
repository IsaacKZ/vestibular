import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QuestionRevisionSchema } from "../../src/content/schema";
import { canPractice } from "../../src/content/quality";
import { readStore } from "./fixtures";

const catalogue = QuestionRevisionSchema.array().parse(
  JSON.parse(
    readFileSync(new URL("../../public/content/catalog.json", import.meta.url), "utf8"),
  ),
);
const training = catalogue.filter(canPractice);

test("treino publicado carrega figura original e registra resposta antes da resolução", async ({ page }) => {
  const question = training.find((q) => q.id === "udesc-2025-2-vespertino-13");
  if (!question?.key) throw new Error("Lote publicado sem questão conferida com figura e gabarito.");
  const letters = ["A", "B", "C", "D", "E"];
  await page.goto(`/questions/${question.id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await expect(page.getByRole("heading", { name: "Questão 1 de 1" })).toBeVisible();
  for (const asset of question.assets.filter((asset) => asset.anchor.target === "stem")) {
    const image = page.getByRole("img", { name: asset.alt, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.getByRole("radio").nth(letters.indexOf(question.key.letter)).check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(page.getByRole("heading", { name: "Resposta correta", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Correção" }).getByRole("heading", { name: "Resolução", exact: true })).toBeVisible();
  const attempts = await readStore(page, "attempts");
  expect(attempts).toHaveLength(1);
  expect(attempts[0].questionId).toBe(question.id);
  expect(attempts[0].response).toBe(question.key.letter);
});

test("simulado real usa somente questões conferidas e mantém correções fechadas até encerrar", async ({ page }) => {
  await page.goto("/assessment");
  await expect(page.getByText(`${training.length} questões prontas nesta seleção.`, { exact: true })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Quantidade de questões", exact: true }).fill("3");
  await page.getByRole("button", { name: "Iniciar simulado parcial", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Questão 1 de 3" })).toBeVisible();
  const sessions = await readStore(page, "sessions");
  expect(sessions).toHaveLength(1);
  const questions = sessions[0].questions as { id: string; revision: string }[];
  expect(questions).toHaveLength(3);
  const selected = questions.map((reference) => training.find((q) => q.id === reference.id && q.revision === reference.revision));
  expect(selected.every(Boolean)).toBe(true);
  expect(new Set(selected.map((q) => q!.subject)).size).toBe(3);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver correção", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Tempo restante:/)).toBeVisible();
  await page.getByRole("button", { name: "Encerrar simulado", exact: true }).click();
  await expect(page.getByText("Simulado encerrado. Respostas salvas; correções disponíveis por questão.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver correção", exact: true }).click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
  expect(await readStore(page, "attempts")).toHaveLength(3);
});

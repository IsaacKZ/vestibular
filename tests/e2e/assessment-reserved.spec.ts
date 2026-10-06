import { expect, test } from "@playwright/test";
import { readyQuestion } from "../content/fixtures";
import { readStore } from "./fixtures";

test("avaliação reservada salva finalidade e consome itens inéditos mesmo sem responder", async ({
  page,
}) => {
  // Fixtures stay in browser interception; they never certify the real corpus.
  const reserved = [
    readyQuestion({
      id: "reserved-math",
      assessmentOnly: true,
      difficulty: "medium",
      stem: "Questão reservada de matemática",
    }),
    readyQuestion({
      id: "reserved-bio",
      subject: "biologia",
      assessmentOnly: true,
      difficulty: "medium",
      stem: "Questão reservada de biologia",
    }),
  ];
  const questions = [
    ...reserved,
    readyQuestion({ id: "ordinary", difficulty: "medium" }),
    readyQuestion({ id: "unclassified", assessmentOnly: true }),
  ];
  await page.route("**/content/*.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().endsWith("/audit.json") ? null : questions,
      ),
    });
  });
  await page.goto("/assessment");
  await expect(
    page.getByText("1 questões prontas nesta seleção."),
  ).toBeVisible();
  await page.getByLabel("Finalidade").selectOption("benchmark");
  await expect(
    page.getByText("2 questões reservadas inéditas nesta seleção."),
  ).toBeVisible();
  await page.getByLabel("Dificuldade declarada").selectOption("easy");
  await expect(
    page.getByText("0 questões reservadas inéditas nesta seleção."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar avaliação reservada" }),
  ).toBeDisabled();
  await page.getByLabel("Dificuldade declarada").selectOption("medium");
  await page.getByLabel("Quantidade de questões").fill("2");
  await page
    .getByRole("button", { name: "Iniciar avaliação reservada" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 2" }),
  ).toBeVisible();
  const sessions = await readStore(page, "sessions");
  expect(sessions).toHaveLength(1);
  expect(sessions[0].purpose).toBe("benchmark");
  expect(sessions[0].questions).toEqual(
    expect.arrayContaining(
      reserved.map((q) => ({ id: q.id, revision: q.revision })),
    ),
  );
  await page.getByRole("radio").first().check();
  await expect
    .poll(async () => (await readStore(page, "drafts")).length)
    .toBe(1);
  expect(await readStore(page, "attempts")).toHaveLength(0);
  await page.goto("/assessment");
  await page.getByLabel("Finalidade").selectOption("benchmark");
  await expect(
    page.getByText("0 questões reservadas inéditas nesta seleção."),
  ).toBeVisible();
  await page.getByLabel("Quantidade de questões").fill("1");
  await expect(
    page.getByText(/Questões reservadas inéditas insuficientes/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar avaliação reservada" }),
  ).toBeDisabled();
});

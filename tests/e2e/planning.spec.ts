import { test, expect } from "@playwright/test";
import { readStore, useVerifiedTestCorpus } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // Planning runs Monday–Friday; freeze a study day independently of the host date.
  await page.clock.setFixedTime(new Date("2026-10-02T12:00:00Z"));
});

test("diminuir a rotina atualiza um plano já salvo sem ultrapassar o novo orçamento", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto("/");
  await expect(page.locator(".task-list li")).toHaveCount(12);
  await page
    .getByRole("button", { name: "Subir tarefa 2", exact: true })
    .click();
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Tempo diário", exact: true })
    .selectOption("30");
  await page
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(
    page.getByText(
      "Rotina salva. Os intervalos serão usados nos próximos retornos.",
    ),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".task-list li")).toHaveCount(3);
  await expect(
    page.getByText("30 minutos previstos", { exact: true }),
  ).toBeVisible();
});

test("iniciar o plano preserva a lista do dia e marca tarefas feitas após retornar", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Iniciar plano do dia", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resposta correta", exact: true }),
  ).toBeVisible();
  const plans = await readStore(page, "plans");
  expect(plans).toHaveLength(1);
  expect(plans[0].tasks).toHaveLength(12);
  await page.goto("/");
  await expect(page.locator(".task-list li")).toHaveCount(12);
  await expect(page.getByText(/Feita hoje/)).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Iniciar plano do dia", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: /Retomar treino/ }),
  ).toBeVisible();
});

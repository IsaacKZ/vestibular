import { test, expect } from "@playwright/test";
import { browserQuestions, readStore, useVerifiedTestCorpus } from "./fixtures";

test("salva tentativa antes da correção, mantém resposta e caderno após recarregar", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 1" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.getByRole("radio").nth(1).check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Resposta incorreta" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver correção", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resposta incorreta" }),
  ).toBeVisible();
  await page.goto("/notebook");
  await expect(page.getByText(/Matemática.*2026\/1/).first()).toBeVisible();
});

test("prazo vencido promove rascunho e pulos, sem perder ou duplicar tentativas", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await useVerifiedTestCorpus(page);
  await page.goto("/assessment");
  await page
    .getByRole("spinbutton", { name: "Duração em minutos", exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Iniciar simulado parcial", exact: true })
    .click();
  await page.getByRole("radio").nth(1).check();
  await expect
    .poll(async () =>
      (await readStore(page, "drafts")).some((d) => d.response === "B"),
    )
    .toBe(true);
  await page.clock.setFixedTime(new Date("2026-10-02T12:02:00Z"));
  await page.reload();
  await expect(
    page.getByText(
      "Simulado encerrado. Respostas salvas; correções disponíveis por questão.",
    ),
  ).toBeVisible();
  const attempts = await readStore(page, "attempts");
  expect(attempts).toHaveLength(10);
  expect(attempts.filter((a) => a.response === "B")).toHaveLength(1);
  expect(attempts.filter((a) => a.response === null)).toHaveLength(9);
  expect(new Set(attempts.map((a) => a.id)).size).toBe(10);
  await page.reload();
  await expect(
    page.getByText(
      "Simulado encerrado. Respostas salvas; correções disponíveis por questão.",
    ),
  ).toBeVisible();
  expect(await readStore(page, "attempts")).toHaveLength(10);
});

test("simulado não revela correção antes de encerrar e retoma o prazo original", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto("/assessment");
  await page.getByRole("button", { name: /Iniciar simulado/ }).click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 10" }),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(
    page.getByRole("button", { name: "Ver correção", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Tempo restante:/)).toBeVisible();
  await page
    .getByRole("button", { name: "Encerrar simulado", exact: true })
    .click();
  await expect(
    page.getByText(
      "Simulado encerrado. Respostas salvas; correções disponíveis por questão.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver correção", exact: true }).click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
});

test("simulado bloqueia acesso à correção da mesma questão por outra sessão", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 1" }),
  ).toBeVisible();
  const oldSession = page.url();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Resposta correta", exact: true }),
  ).toBeVisible();
  await page.goto("/assessment");
  await page
    .getByRole("spinbutton", { name: "Quantidade de questões", exact: true })
    .fill("12");
  await page
    .getByRole("button", { name: "Iniciar simulado parcial", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 12" }),
  ).toBeVisible();
  await page.goto(oldSession);
  await expect(
    page.getByRole("link", { name: /Retomar simulado/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver correção", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Correção" })).toHaveCount(0);
});

test("navegar pelo número da questão mantém o registro do tempo ativo", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await useVerifiedTestCorpus(page);
  await page.goto("/assessment");
  await page
    .getByRole("button", { name: "Iniciar simulado parcial", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await page
    .getByRole("navigation", { name: "Questões do simulado" })
    .getByRole("button", { name: "2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Questão 2 de 10" }),
  ).toBeVisible();
  await page.clock.runFor(2000);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect
    .poll(async () => (await readStore(page, "attempts")).length)
    .toBe(2);
  expect(
    (await readStore(page, "attempts")).some((a) => Number(a.activeMs) >= 1500),
  ).toBe(true);
});

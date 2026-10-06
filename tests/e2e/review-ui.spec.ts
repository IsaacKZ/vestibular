import { expect, test, type Page } from "@playwright/test";
import { browserQuestions, readStore, useVerifiedTestCorpus } from "./fixtures";

async function useVisualFixture(page: Page) {
  await useVerifiedTestCorpus(page);
  const visual = browserQuestions.map((q, i) =>
    i
      ? q
      : {
          ...q,
          stem: `Figura e fórmula de teste. \\(${Array(35).fill("123456789").join("")}\\)`,
          assets: [
            {
              path: "content/assets/review-figure.svg",
              alt: "Figura larga de teste",
              required: true,
              verified: true,
              source: "Fixture de teste",
              anchor: { target: "stem", optionLetter: null, afterBlock: 0 },
            },
          ],
        },
  );
  for (const name of ["catalog", "questions"])
    await page.route(`**/content/${name}.json`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(visual),
      }),
    );
  await page.route("**/content/assets/review-figure.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300"><rect width="1200" height="300" fill="white"/><text x="20" y="100" font-size="32">Figura de teste</text></svg>',
    }),
  );
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await expect(
    page.getByRole("button", { name: "Ampliar: Figura larga de teste" }),
  ).toBeVisible();
}

test("limpar datas de progresso preserva a tela e pede um período válido", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
  await page.goto("/progress");
  for (const name of ["De", "Até"]) {
    const field = page.getByLabel(name, { exact: true });
    const previous = await field.inputValue();
    await field.fill("");
    await expect(
      page.getByRole("heading", { name: "Progresso", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Informe datas válidas para consultar o período."),
    ).toBeVisible();
    await field.fill(previous);
  }
  await page.getByLabel("De", { exact: true }).fill("2027-01-01");
  await expect(
    page.getByText("A data inicial deve vir antes da data final."),
  ).toBeVisible();
});

test("trocar questão antes de cinco segundos preserva todo o tempo ativo", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await useVerifiedTestCorpus(page);
  await page.goto("/assessment");
  await page
    .getByRole("spinbutton", { name: "Quantidade de questões", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Iniciar simulado parcial" }).click();
  await page.getByRole("radio").first().check();
  await expect
    .poll(async () =>
      (await readStore(page, "drafts")).some((d) => d.response === "A"),
    )
    .toBe(true);
  const questionId = (await readStore(page, "drafts"))[0].questionId;
  await page.clock.runFor(4000);
  const navigation = page.getByRole("navigation", {
    name: "Questões do simulado",
  });
  await navigation.getByRole("button", { name: "2", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        (await readStore(page, "drafts")).find(
          (d) => d.questionId === questionId,
        )?.activeMs,
      ),
    )
    .toBeGreaterThanOrEqual(4000);
  await navigation.getByRole("button", { name: "1", exact: true }).click();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect
    .poll(async () => Number((await readStore(page, "attempts"))[0]?.activeMs))
    .toBeGreaterThanOrEqual(4000);
});

test("sair da questão salva os segundos restantes e retoma o rascunho", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").first().check();
  const sessionUrl = page.url();
  await expect
    .poll(async () => (await readStore(page, "drafts")).length)
    .toBe(1);
  await page.clock.runFor(3000);
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect
    .poll(async () => Number((await readStore(page, "drafts"))[0]?.activeMs))
    .toBeGreaterThanOrEqual(3000);
  await page.goto(sessionUrl);
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect
    .poll(async () => Number((await readStore(page, "attempts"))[0]?.activeMs))
    .toBeGreaterThanOrEqual(3000);
});

test("simulado ativo fecha o histórico e as notas da mesma questão no caderno", async ({
  page,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").first().check();
  await page.getByLabel("Usei uma dica").check();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
  await page.goto(`/notebook?question=${browserQuestions[0].id}`);
  await page
    .getByLabel("Anotação", { exact: true })
    .fill("A resposta é A: nota de teste.");
  await page
    .getByRole("button", { name: "Salvar anotação", exact: true })
    .click();
  await expect(
    page.getByText("Anotação salva neste dispositivo."),
  ).toBeVisible();
  await page.goto(`/questions/${browserQuestions[1].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
  await page.goto("/assessment");
  await page
    .getByRole("spinbutton", { name: "Quantidade de questões", exact: true })
    .fill("3");
  for (const name of [
    "Biologia",
    "Português e Literatura",
    "Física",
    "Química",
  ])
    await page.getByLabel(name, { exact: true }).uncheck();
  await page.getByRole("button", { name: "Iniciar simulado parcial" }).click();
  await expect(
    page.getByRole("heading", { name: "Questão 1 de 3" }),
  ).toBeVisible();
  await page.goto(`/notebook?question=${browserQuestions[0].id}`);
  await expect(page.getByLabel("Anotação", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Resposta A", { exact: false })).toHaveCount(0);
  await expect(
    page.getByText(/O histórico e as anotações desta questão/),
  ).toBeVisible();
  await page.goto("/progress");
  await page
    .getByText("Histórico de tentativas e avaliações", { exact: true })
    .click();
  await expect(page.locator(".history-list li")).toHaveCount(1);
  await expect(page.locator(".history-list")).toContainText("Biologia");
  await expect(page.locator(".history-list")).not.toContainText("Matemática");
  await expect(
    page.getByText("Avaliação inicial", { exact: false }),
  ).toHaveCount(1);
});

test("ocultar a página e pagehide salvam os segundos sem contar o período oculto", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").first().check();
  await expect
    .poll(async () => (await readStore(page, "drafts")).length)
    .toBe(1);
  await page.clock.runFor(3000);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(async () => Number((await readStore(page, "drafts"))[0]?.activeMs))
    .toBeGreaterThanOrEqual(3000);
  const before = Number((await readStore(page, "drafts"))[0].activeMs);
  await page.clock.runFor(10_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(1000);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect
    .poll(async () => Number((await readStore(page, "drafts"))[0]?.activeMs))
    .toBeGreaterThanOrEqual(before + 1000);
  expect(Number((await readStore(page, "drafts"))[0].activeMs)).toBeLessThan(
    before + 2000,
  );
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
  const submitted = JSON.stringify(await readStore(page, "attempts"));
  await page.clock.runFor(2000);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await readStore(page, "drafts")).toHaveLength(0);
  expect(JSON.stringify(await readStore(page, "attempts"))).toBe(submitted);
});

test("figura ampliada preserva escala e devolve foco ao fechar com Enter ou Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await useVisualFixture(page);
  const trigger = page.getByRole("button", {
    name: "Ampliar: Figura larga de teste",
  });
  const inlineWidth = (await trigger.locator("img").boundingBox())!.width;
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Figura ampliada" });
  await expect(dialog).toBeVisible();
  expect((await dialog.locator("img").boundingBox())!.width).toBeGreaterThan(
    inlineWidth,
  );
  await page.getByRole("button", { name: "Fechar figura" }).press("Enter");
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("fórmula longa rola dentro do enunciado sem alargar a tela de 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await useVisualFixture(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const math = page.locator(".math-inline");
  expect(
    await math.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
});

test("ações secundárias de hoje e catálogo têm alvo de toque de 44 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  for (const name of ["Consultar caderno →", "Ajustar rotina e backup →"]) {
    expect(
      (await page.getByRole("link", { name }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/questions");
  await expect(page.locator(".question-list li").first()).toBeVisible();
  expect(
    (await page.locator(".row-top a").first().boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  expect(
    (await page
      .getByRole("link", { name: "Configurar simulado parcial" })
      .boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
});

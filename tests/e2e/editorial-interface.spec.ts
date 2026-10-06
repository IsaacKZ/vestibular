import { expect, test } from "@playwright/test";
import { browserQuestions, readStore, useVerifiedTestCorpus } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00Z"));
  await useVerifiedTestCorpus(page);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 700 }]) {
  test(`o estudo começa sem rolar a tela em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const start = page.getByRole("button", { name: "Iniciar plano do dia", exact: true });
    await expect(start).toBeEnabled();
    const box = (await start.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThan(viewport.height - (viewport.width === 320 ? 80 : 0));
    await start.click();
    await expect(page.getByRole("heading", { name: "Questão 1 de 12" })).toBeVisible();
    expect((await readStore(page, "plans"))[0].tasks).toHaveLength(12);
  });
}

test("editar o plano revela controles e preserva a ordem ao recarregar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".task-list li")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Subir tarefa 2", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Editar plano", exact: true }).click();
  const second = await page.locator(".task-list li").nth(1).innerText();
  await page.getByRole("button", { name: "Subir tarefa 2", exact: true }).click();
  const subject = second.split("\n").find((line) => line.includes("questão"))!;
  await expect(page.locator(".task-list li").first()).toContainText(subject);
  await page.getByRole("button", { name: "Concluir edição", exact: true }).click();
  await expect(page.getByRole("button", { name: "Subir tarefa 2", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".task-list li").first()).toContainText(subject);
  await expect(page.locator(".task-list li")).toHaveCount(12);
});

test("texto, botão, controle e foco têm contraste suficiente na tela real", async ({ page }) => {
  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Tempo disponível hoje", exact: true });
  await expect(select).toBeEnabled();
  await select.focus();
  const colors = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    const root = style(":root"), button = style("button.primary"), control = style("select");
    return {
      ink: root.color, paper: root.backgroundColor,
      buttonText: button.color, buttonFill: button.backgroundColor,
      controlBorder: control.borderTopColor, controlFill: control.backgroundColor,
      focus: control.outlineColor,
    };
  });
  function luminance(rgb: string) {
    const [r, g, b] = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number)
      .map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a: string, b: string) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  expect(contrast(colors.ink, colors.paper)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.buttonText, colors.buttonFill)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.controlBorder, colors.controlFill)).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.focus, colors.paper)).toBeGreaterThanOrEqual(3);
});

test("um dia sem tarefas permite montar o plano pela edição", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-04T12:00:00Z"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sem tarefas previstas para hoje" })).toBeVisible();
  await page.getByRole("button", { name: "Editar plano", exact: true }).click();
  await page.getByRole("combobox", { name: "Adicionar tarefa ao plano", exact: true })
    .selectOption(browserQuestions[0].id);
  await expect(page.locator(".task-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "Iniciar plano do dia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Questão 1 de 1" })).toBeVisible();
});

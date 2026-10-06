import { test, expect } from "@playwright/test";

test("Pages carrega o catálogo no subdiretório e mantém a rota após recarregar", async ({ page }) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/vestibular/#/questions");
  await expect(page.getByRole("heading", { name: "Questões", exact: true })).toBeVisible();
  await expect(page.getByText("420 questões encontradas · 78 prontas", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Questões", exact: true })).toBeVisible();
  const location = page.url();
  await page.getByRole("link", { name: "Pular para o conteúdo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(page.url()).toBe(location);
  expect(failures).toEqual([]);
});

test("Pages carrega a figura e retoma uma tentativa real salva", async ({ page }) => {
  await page.goto("/vestibular/#/questions/udesc-2025-2-vespertino-13");
  await page.getByRole("button", { name: "Tentar esta questão", exact: true }).click();
  await expect(page).toHaveURL(/\/vestibular\/#\/practice\//);
  await expect(page.getByRole("heading", { name: "Questão 1 de 1" })).toBeVisible();
  const image = page.getByRole("img", { name: /Figura 5: raio sai do ar/ });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await image.getAttribute("src")).toMatch(/^\/vestibular\/content\/assets\//);
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Registrar resposta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resposta correta", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Ver correção", exact: true }).click();
  await expect(page.getByRole("region", { name: "Correção" })).toBeVisible();
});

test("Pages mantém catálogo e figuras offline com PWA restrita a /vestibular/", async ({ page, context }) => {
  await page.goto("/vestibular/#/questions");
  await expect(page.getByText("420 questões encontradas · 78 prontas", { exact: true })).toBeVisible();
  const registration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    return { scope: registration.scope, scriptURL: registration.active?.scriptURL };
  });
  expect(new URL(registration.scope).pathname).toBe("/vestibular/");
  expect(new URL(registration.scriptURL!).pathname).toBe("/vestibular/sw.js");
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error("Manifesto ausente");
    return (await fetch(link.href)).json();
  });
  expect(manifest.start_url).toBe("/vestibular/");
  expect(manifest.scope).toBe("/vestibular/");
  expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith("/vestibular/"))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("420 questões encontradas · 78 prontas", { exact: true })).toBeVisible();
  await page.goto("/vestibular/#/questions/udesc-2025-2-vespertino-13");
  await page.getByRole("button", { name: "Tentar esta questão", exact: true }).click();
  const image = page.getByRole("img", { name: /Figura 5: raio sai do ar/ });
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

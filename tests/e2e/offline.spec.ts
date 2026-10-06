import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QuestionRevisionSchema } from "../../src/content/schema";
import { canPractice } from "../../src/content/quality";

const catalogue = QuestionRevisionSchema.array().parse(
  JSON.parse(
    readFileSync(new URL("../../public/content/catalog.json", import.meta.url), "utf8"),
  ),
);
const readyCount = catalogue.filter(canPractice).length;
const biology = catalogue.filter((question) => question.subject === "biologia");

test.use({ serviceWorkers: "allow" });

test("app e acervo real continuam disponíveis offline após cache completo", async ({
  page,
  context,
}) => {
  await page.goto("/questions");
  await expect(
    page.getByText(`${catalogue.length} questões encontradas · ${readyCount} prontas`, { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error("Service worker não ativou.");
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Questões", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${catalogue.length} questões encontradas · ${readyCount} prontas`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Matéria", exact: true })
    .selectOption("biologia");
  await expect(
    page.getByText(`${biology.length} questões encontradas · ${biology.filter(canPractice).length} prontas`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Consultar texto e fonte/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Texto da fonte", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});

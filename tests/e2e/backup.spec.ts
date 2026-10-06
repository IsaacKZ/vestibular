import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { browserQuestions, useVerifiedTestCorpus } from "./fixtures";

test("backup real é restaurado uma vez e versões futuras não alteram o histórico", async ({
  page,
  browser,
}) => {
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${browserQuestions[0].id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Registrar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Resposta incorreta" }),
  ).toBeVisible();
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup JSON" }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.data.attempts).toHaveLength(1);
  const context = await browser.newContext();
  const target = await context.newPage();
  await useVerifiedTestCorpus(target);
  await target.goto("/settings");
  const upload = target.getByLabel("Escolher backup para conferir");
  await upload.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await target
    .getByRole("button", { name: "Confirmar importação do backup" })
    .click();
  await expect(
    target.getByText(
      "Backup incorporado. O histórico existente foi preservado.",
    ),
  ).toBeVisible();
  await upload.setInputFiles({
    name: "backup-repetido.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(target.getByText(/0 registros novos/)).toBeVisible();
  await target
    .getByRole("button", { name: "Confirmar importação do backup" })
    .click();
  await expect(upload).toBeEnabled();
  await upload.setInputFiles({
    name: "futuro.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...backup, schemaVersion: 2 })),
  });
  await expect(
    target.getByText(
      "Este arquivo não pode ser importado. O histórico atual foi preservado.",
    ),
  ).toBeVisible();
  await expect(
    target.getByRole("button", { name: "Confirmar importação do backup" }),
  ).toHaveCount(0);
  await target.goto("/notebook");
  await expect(
    target.getByRole("button", { name: /Matemática.*2026\/1/ }),
  ).toHaveCount(1);
  await context.close();
});

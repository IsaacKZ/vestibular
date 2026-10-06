import { expect, test } from "@playwright/test";
import { browserQuestions, readStore, useVerifiedTestCorpus } from "./fixtures";

test("o caderno registra consulta antes do apoio e abre outra questão como prática guiada", async ({
  page,
}) => {
  const original = browserQuestions[0];
  const followup = browserQuestions[5];
  await useVerifiedTestCorpus(page);
  await page.goto(`/questions/${original.id}`);
  await page.getByRole("button", { name: "Tentar esta questão" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resposta incorreta" }),
  ).toBeVisible();
  const initialAttempts = await readStore(page, "attempts");
  expect(initialAttempts).toHaveLength(1);
  expect(initialAttempts[0]).toMatchObject({
    questionId: original.id,
    consulted: false,
  });
  const beforeSupport = await readStore(page, "feedback");

  await page.goto(`/notebook?question=${original.id}`);
  const support = page.getByRole("region", {
    name: "Apoio para entender o erro",
  });
  await expect(support).toHaveCount(0);
  await page
    .getByLabel("Causa confirmada por você")
    .selectOption("calculation");
  await page
    .getByRole("button", { name: "Entender o erro", exact: true })
    .click();
  await expect(support).toBeVisible();
  await expect(support).toContainText("Confira o cálculo e os sinais");
  await expect(support).toContainText(original.explanation!.text);
  const exposures = await readStore(page, "feedback");
  expect(exposures).toHaveLength(beforeSupport.length + 1);
  expect(
    exposures.filter(
      (event) => !beforeSupport.some((previous) => previous.id === event.id),
    ),
  ).toEqual([
    expect.objectContaining({
      attemptId: initialAttempts[0].id,
      questionId: original.id,
      questionRevision: original.revision,
    }),
  ]);

  await page
    .getByRole("button", {
      name: "Praticar outra questão da mesma habilidade",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/practice\//);
  await expect(page.getByText("Prática guiada", { exact: true })).toBeVisible();
  await expect(page.getByText(followup.stem, { exact: true })).toBeVisible();
  const consulted = page.getByRole("checkbox", {
    name: "Consultei material",
    exact: true,
  });
  await expect(consulted).toBeChecked();
  await expect(consulted).toBeDisabled();
  const guided = (await readStore(page, "sessions")).find(
    (session) => session.purpose === "guided",
  );
  expect(guided).toMatchObject({
    mode: "study",
    purpose: "guided",
    questions: [{ id: followup.id, revision: followup.revision }],
  });
  const followupSnapshot = (await readStore(page, "questionSnapshots")).find(
    (snapshot) => snapshot.id === followup.id,
  );
  expect(followupSnapshot).toMatchObject({
    subject: original.subject,
    skills: expect.arrayContaining([original.skills[0]]),
  });

  await page.getByRole("radio").first().check();
  await page.getByLabel("Confiança antes da correção").selectOption("high");
  await page
    .getByRole("button", { name: "Registrar resposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Acerto com consulta", exact: true }),
  ).toBeVisible();
  const saved = (await readStore(page, "attempts")).find(
    (attempt) => attempt.sessionId === guided!.id,
  );
  expect(saved).toMatchObject({
    questionId: followup.id,
    response: "A",
    consulted: true,
    mode: "study",
  });
  expect(
    (await readStore(page, "grades")).find(
      (grade) => grade.attemptId === saved!.id,
    ),
  ).toMatchObject({ correct: true });
});

import { describe, expect, it } from "vitest";
import {
  AttemptInputSchema,
  QuestionRevisionSchema,
  SettingsSchema,
} from "../../src/content/schema";
import { defaultSettings } from "../../src/content/constants";
import { readyQuestion } from "./fixtures";

describe("contratos de entrada", () => {
  it("aceita o inventário incompleto, sem confundir schema com prontidão", () => {
    expect(
      QuestionRevisionSchema.safeParse(
        readyQuestion({ options: [], key: null, explanation: null }),
      ).success,
    ).toBe(true);
  });
  it("rejeita letras inválidas e alternativas duplicadas", () => {
    const q = readyQuestion();
    expect(
      QuestionRevisionSchema.safeParse({
        ...q,
        options: [{ letter: "F", text: "inválida" }],
      }).success,
    ).toBe(false);
    expect(
      QuestionRevisionSchema.safeParse({
        ...q,
        options: [...q.options, q.options[0]],
      }).success,
    ).toBe(false);
  });
  it("mantém o teto de tempo e dias de estudo, sem datas inexistentes", () => {
    expect(SettingsSchema.safeParse(defaultSettings).success).toBe(true);
    expect(
      SettingsSchema.safeParse({
        ...defaultSettings,
        studyWeekdays: [1, 2, 3, 4, 5, 6],
      }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ ...defaultSettings, dailyMinutes: 150 })
        .success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({
        ...defaultSettings,
        targetExamDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ ...defaultSettings, timezone: "Unknown/Zone" })
        .success,
    ).toBe(false);
  });
  it("recusa tempo negativo e não aceita texto arbitrário como resposta", () => {
    const input = {
      submissionId: "a",
      sessionId: "s",
      questionId: "q",
      questionRevision: "v",
      response: null,
      confidence: "low",
      guessed: false,
      doubt: false,
      usedHint: false,
      consulted: false,
      activeMs: 0,
    };
    expect(AttemptInputSchema.safeParse(input).success).toBe(true);
    expect(
      AttemptInputSchema.safeParse({ ...input, activeMs: -1 }).success,
    ).toBe(false);
    expect(
      AttemptInputSchema.safeParse({ ...input, response: "F" }).success,
    ).toBe(false);
  });
});

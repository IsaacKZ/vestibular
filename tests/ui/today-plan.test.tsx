// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultSettings } from "../../src/content/constants";
import { attempt, history, question } from "../domain/fixtures";
import type { DailyPlan, QuestionRevision } from "../../src/content/types";
import { TodayPage } from "../../src/features/today/TodayPage";

const state = vi.hoisted(() => ({
  app: null as unknown as ReturnType<
    typeof import("../../src/ui/AppContext").useStudy
  >,
  update: vi.fn(async (..._args: unknown[]) => {}),
}));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => "2026-10-02T12:00:00Z",
  errorMessage: (error: unknown) => String(error),
}));
vi.mock("../../src/storage/study-service", () => ({
  updateDailyPlan: (...args: unknown[]) => state.update(...args),
  saveSettings: vi.fn(async () => {}),
  startSession: vi.fn(async () => ({ id: "new-session" })),
}));
afterEach(() => {
  cleanup();
  state.update.mockClear();
});

function showPlan(tasks: DailyPlan["tasks"], extra: QuestionRevision[] = []) {
  const questions = [
    ...tasks.map((t, i) =>
      question({ id: t.questionId, originalNumber: i + 1 }),
    ),
    ...extra,
  ];
  state.app = {
    catalogue: questions,
    snapshots: questions,
    audit: null,
    history: history([attempt({ questionId: "older", activeMs: 60_000 })]),
    projection: { gaps: [], reviews: [] },
    settings: { ...defaultSettings, dailyMinutes: 30 },
    plans: [{ date: "2026-10-02", tasks, deferredQuestionIds: [] }],
    loading: false,
    error: "",
    refresh: async () => {},
    findQuestion: (id) => questions.find((q) => q.id === id),
  };
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
}

test("shows the sum of task estimates in the daily budget", () => {
  showPlan([{ questionId: "planned", minutes: 25, reason: "review" }]);
  expect(screen.getByText("25 minutos previstos")).toBeTruthy();
});

test("allows another short task when five tasks leave five actual minutes", async () => {
  showPlan(
    Array.from({ length: 5 }, (_, i) => ({
      questionId: `p${i}`,
      minutes: 5,
      reason: "review",
    })),
    [question({ id: "add-short", originalNumber: 50 })],
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar plano" }));
  const add = screen.getByRole("combobox", {
    name: "Adicionar tarefa ao plano",
  }) as HTMLSelectElement;
  expect(add.disabled).toBe(false);
  fireEvent.change(add, { target: { value: "add-short" } });
  await waitFor(() => expect(state.update).toHaveBeenCalledOnce());
  const updated = state.update.mock.calls[0][1] as DailyPlan;
  expect(updated.tasks.at(-1)).toEqual({
    questionId: "add-short",
    minutes: 5,
    reason: "new",
  });
  expect(updated.tasks.reduce((total, task) => total + task.minutes, 0)).toBe(
    30,
  );
});

test("excludes reserved and over-budget choices from manual additions", () => {
  const slow = question({ id: "slow", originalNumber: 70 });
  showPlan(
    [{ questionId: "planned", minutes: 25, reason: "review" }],
    [
      slow,
      question({ id: "reserved", originalNumber: 99, assessmentOnly: true }),
    ],
  );
  state.app.history.attempts.push(
    attempt({ id: "slow-attempt", questionId: "slow", activeMs: 60 * 60_000 }),
  );
  cleanup();
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar plano" }));
  const add = screen.getByRole("combobox", {
    name: "Adicionar tarefa ao plano",
  }) as HTMLSelectElement;
  expect([...add.options].map((option) => option.value)).toEqual([""]);
  expect(add.disabled).toBe(true);
});

test("removes a now-reserved question from a saved plan before rendering or starting", async () => {
  showPlan([
    { questionId: "reserved", minutes: 10, reason: "new" },
    { questionId: "practice", minutes: 10, reason: "new" },
  ]);
  state.app.catalogue[0].assessmentOnly = true;
  cleanup();
  const view = render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
  expect(view.container.querySelectorAll(".task-list li")).toHaveLength(1);
  expect(screen.getByText("10 minutos previstos")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Iniciar plano do dia" }));
  await waitFor(() => expect(state.update).toHaveBeenCalledOnce());
  expect(
    (state.update.mock.calls[0][1] as DailyPlan).tasks.map((t) => t.questionId),
  ).toEqual(["practice"]);
});

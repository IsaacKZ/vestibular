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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { defaultSettings, emptyHistory } from "../../src/content/constants";
import type {
  LearningHistory,
  QuestionRevision,
} from "../../src/content/types";
import { AssessmentPage } from "../../src/features/assessment/AssessmentPage";
import { db } from "../../src/storage/db";
import { readyQuestion } from "../content/fixtures";
import { session } from "../domain/fixtures";

const state = vi.hoisted(() => ({
  app: null as unknown as ReturnType<
    typeof import("../../src/ui/AppContext").useStudy
  >,
}));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => "2026-10-03T12:00:00Z",
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));
afterEach(async () => {
  cleanup();
  await db.delete();
});

function openAssessment(
  catalogue: QuestionRevision[],
  history: LearningHistory = emptyHistory(),
) {
  state.app = {
    catalogue,
    history,
    snapshots: [],
    audit: null,
    projection: { gaps: [], reviews: [] },
    settings: defaultSettings,
    plans: [],
    loading: false,
    error: "",
    refresh: async () => {},
    findQuestion: (id) => catalogue.find((q) => q.id === id),
  };
  render(
    <MemoryRouter initialEntries={["/assessment"]}>
      <Routes>
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route
          path="/assessment/:sessionId"
          element={<p>Avaliação iniciada</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

test("practice counts exclude reserved inventory", () => {
  openAssessment([readyQuestion({ assessmentOnly: true, difficulty: "easy" })]);
  expect(screen.getByText("0 questões prontas nesta seleção.")).toBeTruthy();
});

test("benchmark controls report only unseen reserved questions at the selected difficulty", () => {
  const seen = readyQuestion({
    id: "seen",
    assessmentOnly: true,
    difficulty: "easy",
  });
  openAssessment(
    [
      seen,
      readyQuestion({ id: "new", assessmentOnly: true, difficulty: "medium" }),
      readyQuestion({ id: "practice", difficulty: "medium" }),
      readyQuestion({ id: "unknown", assessmentOnly: true }),
    ],
    {
      ...emptyHistory(),
      sessions: [
        session({
          status: "completed",
          questions: [{ id: seen.id, revision: seen.revision }],
        }),
      ],
    },
  );
  fireEvent.change(screen.getByLabelText("Finalidade"), {
    target: { value: "benchmark" },
  });
  expect(
    screen.getByText("1 questões reservadas inéditas nesta seleção."),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Dificuldade declarada"), {
    target: { value: "easy" },
  });
  expect(
    screen.getByText("0 questões reservadas inéditas nesta seleção."),
  ).toBeTruthy();
  expect(
    screen.getByText(/Questões reservadas inéditas insuficientes/),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Iniciar avaliação reservada",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("starting a benchmark persists its purpose and only its reserved unseen item", async () => {
  await db.open();
  const reserved = readyQuestion({
    id: "reserved",
    assessmentOnly: true,
    difficulty: "medium",
  });
  openAssessment([
    reserved,
    readyQuestion({ id: "practice", difficulty: "medium" }),
  ]);
  fireEvent.change(screen.getByLabelText("Finalidade"), {
    target: { value: "benchmark" },
  });
  fireEvent.change(screen.getByLabelText("Quantidade de questões"), {
    target: { value: "1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Iniciar avaliação reservada" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Avaliação iniciada")).toBeTruthy(),
  );
  const sessions = await db.sessions.toArray();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].purpose).toBe("benchmark");
  expect(sessions[0].questions).toEqual([
    { id: reserved.id, revision: reserved.revision },
  ]);
});

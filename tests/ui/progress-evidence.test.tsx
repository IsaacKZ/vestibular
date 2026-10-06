// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { defaultSettings } from "../../src/content/constants";
import { ProgressPage } from "../../src/features/progress/ProgressPage";
import { attempt, grade, history, question } from "../domain/fixtures";

const state = vi.hoisted(() => ({
  app: null as unknown as ReturnType<
    typeof import("../../src/ui/AppContext").useStudy
  >,
}));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => "2026-11-01T12:00:00Z",
}));
afterEach(cleanup);

test("progress shows skill application denominators, items, dates and difficulty without claiming mastery", () => {
  const first = attempt({ skillFeedback: [] }),
    second = attempt({
      id: "a2",
      questionId: "test-q2",
      at: "2026-10-05T12:00:00Z",
      studyDate: "2026-10-05",
      skillFeedback: [],
    });
  const questions = [
    question({ difficulty: "easy" }),
    question({ id: "test-q2", difficulty: "hard" }),
  ];
  state.app = {
    catalogue: questions,
    snapshots: questions,
    audit: null,
    history: history([first, second], [grade(first), grade(second, false)]),
    projection: { gaps: [], reviews: [] },
    settings: defaultSettings,
    plans: [],
    loading: false,
    error: "",
    refresh: async () => {},
    findQuestion: (id) => questions.find((q) => q.id === id),
  };
  render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Aplicações corretas em itens diferentes / oportunidades"),
  ).toBeDefined();
  expect(
    screen.getByRole("table", { name: "Aplicação posterior por habilidade" }),
  ).toBeDefined();
  expect(screen.getByText("skill")).toBeDefined();
  expect(screen.getByText("Ainda insuficiente")).toBeDefined();
  expect(screen.getByText("Fácil → Difícil: 0/1")).toBeDefined();
  expect(
    screen.getByText(/Não estima domínio nem probabilidade de aprovação/),
  ).toBeDefined();
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readyQuestion } from "../content/fixtures";
import { QuestionDetails } from "../../src/features/catalogue/QuestionDetails";
const app = vi.hoisted(() => ({ current: {} as any }));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => app.current,
  now: () => "2026-10-02T12:00:00Z",
  errorMessage: String,
}));
afterEach(cleanup);
it("does not expose reserved raw content or a practice entry from the catalogue", () => {
  const q = readyQuestion({
    assessmentOnly: true,
    difficulty: "medium",
    rawText: "RESERVED SECRET STEM",
  });
  app.current = { findQuestion: () => q, history: { sessions: [] } };
  render(
    <MemoryRouter initialEntries={[`/questions/${q.id}`]}>
      <Routes>
        <Route path="/questions/:questionId" element={<QuestionDetails />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.queryByText("RESERVED SECRET STEM")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Tentar esta questão" }),
  ).toBeNull();
  expect(screen.getByText(/reservada/i)).toBeTruthy();
});

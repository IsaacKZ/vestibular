// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { defaultSettings, emptyHistory } from "../../src/content/constants";
import { readyQuestion } from "../content/fixtures";
import { db } from "../../src/storage/db";
import { startSession, loadHistory } from "../../src/storage/study-service";
import { PracticePage } from "../../src/features/practice/PracticePage";
const state = vi.hoisted(() => ({ app: null as any, revised: null as any }));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => new Date().toISOString(),
  errorMessage: String,
}));
vi.mock("../../src/storage/study-service", async (loadOriginal) => {
  const original =
    await loadOriginal<typeof import("../../src/storage/study-service")>();
  return {
    ...original,
    revealFeedback: async (
      ...args: Parameters<typeof original.revealFeedback>
    ) => {
      const event = await original.revealFeedback(...args);
      if (state.revised)
        await original.regradeAttempt(args[0], args[1], state.revised, args[2]);
      return event;
    },
  };
});
afterEach(async () => {
  cleanup();
  state.revised = null;
  await db.delete();
});

it("keeps the correction snapshot actually recorded despite a concurrent regrade before refresh", async () => {
  await db.open();
  const q = readyQuestion({
    id: "exposure-race",
    explanation: {
      ...readyQuestion().explanation!,
      text: "Resolução original exibida",
    },
  });
  const session = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    new Date().toISOString(),
  );
  state.revised = {
    ...q,
    revision: "r2",
    key: { ...q.key!, letter: "B", revision: "key-r2" },
    explanation: {
      ...q.explanation!,
      text: "Resolução alterada sem exposição",
    },
  };
  state.app = {
    catalogue: [q],
    snapshots: [q],
    audit: null,
    history: { ...emptyHistory(), sessions: [session] },
    projection: { gaps: [], reviews: [] },
    settings: defaultSettings,
    plans: [],
    loading: false,
    error: "",
    findQuestion: () => q,
    refresh: async () => {
      state.app.history = await loadHistory(db);
      state.app.snapshots = await db.questionSnapshots.toArray();
    },
  };
  render(
    <MemoryRouter initialEntries={[`/practice/${session.id}`]}>
      <Routes>
        <Route path="/practice/:sessionId" element={<PracticePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(5));
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Registrar resposta" }));
  await waitFor(() =>
    expect(screen.getByText("Resolução original exibida")).toBeTruthy(),
  );
  expect(screen.queryByText("Resolução alterada sem exposição")).toBeNull();
  expect(screen.getByText("Resposta correta")).toBeTruthy();
  expect((await db.feedback.toArray())[0].questionRevision).toBe(q.revision);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Abrir correção atualizada" }),
    ).toBeTruthy(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir correção atualizada" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Resolução alterada sem exposição")).toBeTruthy(),
  );
  expect(screen.getByText("Resposta incorreta")).toBeTruthy();
  expect(
    (await db.feedback.toArray()).map((e) => e.questionRevision).sort(),
  ).toEqual([q.revision, "r2"].sort());
});

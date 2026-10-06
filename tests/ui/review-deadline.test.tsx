// @vitest-environment jsdom
import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { defaultSettings, emptyHistory } from "../../src/content/constants";
import { readyQuestion } from "../content/fixtures";
import { db } from "../../src/storage/db";
import { startSession } from "../../src/storage/study-service";
import { PracticePage } from "../../src/features/practice/PracticePage";

const state = vi.hoisted(() => ({
  app: null as unknown as ReturnType<
    typeof import("../../src/ui/AppContext").useStudy
  >,
  gate: undefined as Promise<void> | undefined,
  started: undefined as (() => void) | undefined,
}));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => new Date().toISOString(),
  errorMessage: (error: unknown) => String(error),
}));
vi.mock("../../src/storage/study-service", async (loadOriginal) => {
  const original =
    await loadOriginal<typeof import("../../src/storage/study-service")>();
  return {
    ...original,
    submitAttempt: async (
      ...args: Parameters<typeof original.submitAttempt>
    ) => {
      state.started?.();
      await state.gate;
      return original.submitAttempt(...args);
    },
  };
});
afterEach(async () => {
  cleanup();
  state.gate = undefined;
  state.started = undefined;
  vi.useRealTimers();
  await db.delete();
});

test("an assessment automatically completes after a pending submission crosses its deadline", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  await db.open();
  const questions = [
    readyQuestion({ id: "deadline-q1" }),
    readyQuestion({ id: "deadline-q2" }),
  ];
  const session = await startSession(
    db,
    { questions, mode: "assessment", durationMs: 60_000 },
    new Date().toISOString(),
  );
  state.app = {
    catalogue: questions,
    snapshots: questions,
    audit: null,
    history: { ...emptyHistory(), sessions: [session] },
    projection: { gaps: [], reviews: [] },
    settings: defaultSettings,
    plans: [],
    loading: false,
    error: "",
    refresh: async () => {},
    findQuestion: (id) => questions.find((q) => q.id === id),
  };
  render(
    <MemoryRouter initialEntries={[`/assessment/${session.id}`]}>
      <Routes>
        <Route path="/assessment/:sessionId" element={<PracticePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(5));
  fireEvent.click(screen.getAllByRole("radio")[0]);
  let release!: () => void;
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const submitted = new Promise<void>((resolve) => {
    state.started = resolve;
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar resposta" }));
  await submitted;
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Salvando…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true),
  );
  act(() => vi.advanceTimersByTime(61_000));
  expect((await db.sessions.get(session.id))?.status).toBe("active");
  await act(async () => {
    release();
  });
  await waitFor(async () =>
    expect((await db.sessions.get(session.id))?.status).toBe("completed"),
  );
  expect(await db.attempts.count()).toBe(2);
  expect(
    (await db.attempts.toArray()).filter((a) => a.response === "A"),
  ).toHaveLength(1);
  expect(
    (await db.attempts.toArray()).filter((a) => a.response === null),
  ).toHaveLength(1);
});

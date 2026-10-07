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
import { defaultSettings } from "../../src/content/constants";
import type { Gap, QuestionRevision } from "../../src/content/types";
import { GapDetails } from "../../src/features/notebook/GapDetails";
import { db } from "../../src/storage/db";
import {
  completeStudySession,
  loadHistory,
  startSession,
  submitAttempt,
} from "../../src/storage/study-service";
import { question } from "../domain/fixtures";
import { makeInput } from "../storage/fixtures";

const state = vi.hoisted(() => ({
  app: null as unknown as ReturnType<
    typeof import("../../src/ui/AppContext").useStudy
  >,
  gate: undefined as Promise<void> | undefined,
}));
vi.mock("../../src/ui/AppContext", () => ({
  useStudy: () => state.app,
  now: () => "2026-10-03T12:00:00Z",
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));
vi.mock("../../src/storage/study-service", async (loadOriginal) => {
  const original =
    await loadOriginal<typeof import("../../src/storage/study-service")>();
  return {
    ...original,
    revealFeedback: async (...args: Parameters<typeof original.revealFeedback>) => {
      await state.gate;
      return original.revealFeedback(...args);
    },
    revealLearningSupport: async (
      ...args: Parameters<typeof original.revealLearningSupport>
    ) => {
      await state.gate;
      return original.revealLearningSupport(...args);
    },
  };
});

afterEach(async () => {
  cleanup();
  state.gate = undefined;
  await db.delete();
});

const gap: Gap = {
  questionId: "test-q1",
  status: "open",
  cause: "calculation",
  note: "",
  evidenceAttemptIds: [],
  lastFailureDate: "2026-10-02",
};
async function setup(
  catalogue: QuestionRevision[] = [question(), question({ id: "next" })],
  storedQuestion = question(),
) {
  await db.open();
  const q = storedQuestion;
  const session = await startSession(
    db,
    { questions: [q], mode: "study", durationMs: null },
    "2026-10-02T12:00:00Z",
  );
  const attempt = await submitAttempt(
    db,
    makeInput(session.id, {
      questionId: q.id,
      questionRevision: q.revision,
      response: "A",
    }),
    "2026-10-02T12:00:00Z",
  );
  await completeStudySession(db, session.id, "2026-10-02T12:00:00Z");
  state.app = {
    catalogue,
    snapshots: [q],
    audit: null,
    history: await loadHistory(db),
    projection: { gaps: [gap], reviews: [] },
    settings: defaultSettings,
    plans: [],
    loading: false,
    error: "",
    refresh: async () => {
      state.app.history = await loadHistory(db);
    },
    findQuestion: (id) => catalogue.find((q) => q.id === id),
  };
  return attempt;
}

function show() {
  return render(
    <MemoryRouter initialEntries={["/notebook"]}>
      <Routes>
        <Route path="/notebook" element={<GapDetails gap={gap} />} />
        <Route path="/practice/:id" element={<p>Guided question opened</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("support stays closed until a new exposure is persisted, then another item opens as guided study", async () => {
  const a = await setup();
  let release!: () => void;
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  show();
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Praticar outra questão/ }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(await db.feedback.count()).toBe(0);
  await act(async () => {
    release();
  });
  await screen.findByText("Synthetic explanation");
  expect(await db.feedback.count()).toBe(1);
  expect((await db.feedback.toArray())[0]).toMatchObject({
    questionId: a.questionId,
    attemptId: a.id,
  });
  expect(screen.getByText(/Confira o cálculo e os sinais/)).toBeTruthy();
  expect(screen.getByText(/Em qual operação ou sinal/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: /Praticar outra questão/ }),
  );
  await screen.findByText("Guided question opened");
  const guided = (await db.sessions.toArray()).find(
    (s) => s.purpose === "guided",
  );
  expect(guided).toMatchObject({
    mode: "study",
    purpose: "guided",
    questions: [{ id: "next", revision: "r1" }],
  });
  const submitted = await submitAttempt(
    db,
    makeInput(guided!.id, {
      questionId: "next",
      questionRevision: "r1",
      consulted: false,
    }),
    "2026-10-03T12:00:00Z",
  );
  expect(submitted.consulted).toBe(true);
});

test("a failed exposure leaves support and guided practice closed", async () => {
  await setup();
  let reject!: (error: Error) => void;
  state.gate = new Promise<void>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await act(async () => {
    reject(new Error("Não foi possível salvar a exposição"));
  });
  await screen.findByText("Não foi possível salvar a exposição");
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Praticar outra questão/ }),
  ).toBeNull();
  expect(await db.feedback.count()).toBe(0);
});

test("active assessment protects support and notes even when the notebook has earlier attempts", async () => {
  await setup();
  const assessment = await startSession(
    db,
    { questions: [question()], mode: "assessment", durationMs: 60_000 },
    "2026-10-03T12:00:00Z",
  );
  state.app.history = await loadHistory(db);
  show();
  expect(screen.queryByRole("button", { name: "Entender o erro" })).toBeNull();
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Retomar simulado" }).getAttribute("href"),
  ).toBe(`/assessment/${assessment.id}`);
  expect(await db.feedback.count()).toBe(0);
});

test("missing reviewed support keeps support closed", async () => {
  await setup([question({ explanation: null })]);
  // Simulate archived content whose support can no longer be verified.
  await db.questionSnapshots.update(["test-q1", "r1"], { explanation: null });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await waitFor(() =>
    expect(screen.getByText(/Não há apoio conferido/)).toBeTruthy(),
  );
  expect(screen.queryByRole("region", { name: "Apoio para entender o erro" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Praticar outra questão/ }),
  ).toBeNull();
});

test("a concurrent assessment prevents a pending notebook exposure from opening support", async () => {
  await setup();
  let release!: () => void;
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await startSession(
    db,
    { questions: [question()], mode: "assessment", durationMs: 60_000 },
    "2026-10-03T12:00:00Z",
  );
  await act(async () => {
    release();
  });
  await screen.findByText(/Questão protegida durante avaliação ativa/);
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(await db.feedback.count()).toBe(0);
});

test("a reviewed prerequisite opens a distinct linked item as guided study", async () => {
  const current = question({
    learning: {
      concept: "Reviewed concept",
      workedExample: "Reviewed example",
      prerequisites: [{ subject: "fisica", skill: "units" }],
      reviewed: true,
      source: "Reviewed source",
      reviewer: "Reviewer",
    },
  });
  await setup(
    [
      current,
      question({ id: "units-item", subject: "fisica", skills: ["units"] }),
    ],
    current,
  );
  show();
  fireEvent.change(screen.getByLabelText("Causa confirmada por você"), {
    target: { value: "prerequisite" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Reviewed concept");
  expect(screen.getByText(/Física · units/)).toBeTruthy();
  expect(screen.getByText(/Não há outra questão pronta/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Praticar pré-requisito conferido" }),
  );
  await screen.findByText("Guided question opened");
  expect(
    (await db.sessions.toArray()).find((s) => s.purpose === "guided"),
  ).toMatchObject({
    questions: [{ id: "units-item", revision: "r1" }],
    purpose: "guided",
    mode: "study",
  });
});

test("notebook registers current support on an old attempt and uses its exposed snapshot", async () => {
  const stored = question({
    learning: {
      concept: "Concept in recorded revision",
      workedExample: "Example in recorded revision",
      prerequisites: [],
      reviewed: true,
      source: "Recorded source",
      reviewer: "Reviewer",
    },
  });
  const current = question({
    revision: "r2",
    skills: ["new-skill"],
    learning: {
      ...stored.learning!,
      concept: "Concept in current catalogue",
    },
  });
  const a = await setup(
    [
      current,
      question({ id: "old-skill-next" }),
      question({ id: "new-skill-next", skills: ["new-skill"] }),
    ],
    stored,
  );
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Concept in current catalogue");
  expect(screen.queryByText("Concept in recorded revision")).toBeNull();
  expect((await db.feedback.toArray())[0]).toMatchObject({
    attemptId: a.id,
    questionRevision: "r2",
  });
  expect((await db.attempts.get(a.id))?.questionRevision).toBe("r1");
  fireEvent.click(
    screen.getByRole("button", { name: /Praticar outra questão/ }),
  );
  await screen.findByText("Guided question opened");
  expect(
    (await db.sessions.toArray()).find((s) => s.purpose === "guided")
      ?.questions,
  ).toEqual([{ id: "new-skill-next", revision: "r1" }]);
});

test("a current snapshot conflict keeps notebook support closed", async () => {
  await setup();
  await db.questionSnapshots.update(["test-q1", "r1"], { stem: "Conflicting stored stem" });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText(/Conflito de revisão do conteúdo/);
  expect(screen.queryByText("Synthetic explanation")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Praticar outra questão/ }),
  ).toBeNull();
});


test("any started session counts as exposed and an unstarted candidate is identified without revealing its stem", async () => {
  const seen = question({ id: "seen", edition: "2024-1", originalNumber: 7, stem: "Seen secret stem" });
  const unseen = question({ id: "unseen", edition: "2025-2", originalNumber: 8, stem: "Unseen secret stem" });
  await setup([question(), seen, unseen]);
  await startSession(db, { questions: [seen], mode: "study", durationMs: null }, "2026-10-02T13:00:00Z");
  state.app.history = await loadHistory(db);
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Synthetic explanation");
  expect(screen.getByText(/Matemática · 2025-2 · questão 8/)).toBeTruthy();
  expect(screen.queryByText("Unseen secret stem")).toBeNull();
  expect(screen.queryByText("Seen secret stem")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Praticar outra questão/ }));
  await screen.findByText("Guided question opened");
  expect((await db.sessions.toArray()).find((s) => s.purpose === "guided")?.questions).toEqual([{ id: "unseen", revision: "r1" }]);
});

test("an exposed fallback is identified and remains available for guided practice", async () => {
  const seen = question({ id: "seen", edition: "2024-1", originalNumber: 7 });
  await setup([question(), seen]);
  await startSession(db, { questions: [seen], mode: "study", durationMs: null }, "2026-10-02T13:00:00Z");
  state.app.history = await loadHistory(db);
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Synthetic explanation");
  expect(screen.getByText(/Matemática · 2024-1 · questão 7/)).toBeTruthy();
  expect(screen.getByText(/Questão já estudada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Praticar outra questão/ }));
  await screen.findByText("Guided question opened");
  expect((await db.sessions.toArray()).find((s) => s.purpose === "guided")?.questions).toEqual([{ id: "seen", revision: "r1" }]);
});


test("catalogue updates during refresh do not replace the snapshot actually recorded", async () => {
  const current = question({
    revision: "r2",
    learning: {
      concept: "Concept actually exposed", workedExample: "Example actually exposed",
      prerequisites: [], reviewed: true, source: "Study source", reviewer: "Codex",
    },
  });
  const a = await setup([current]);
  const refresh = state.app.refresh;
  state.app.refresh = async () => {
    await refresh();
    state.app.catalogue = [question({ ...current, revision: "r3", learning: { ...current.learning!, concept: "Latest concept after refresh" } })];
  };
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Concept actually exposed");
  expect(screen.queryByText("Latest concept after refresh")).toBeNull();
  expect((await db.feedback.toArray())[0]).toMatchObject({ attemptId: a.id, questionRevision: "r2" });
});

test.each(["attempt", "feedback"] as const)("a candidate exposed through %s is deprioritized even without its session in loaded history", async (kind) => {
  const seen = question({ id: "seen", edition: "2024-1", originalNumber: 7 });
  const unseen = question({ id: "unseen", edition: "2025-2", originalNumber: 8 });
  const a = await setup([question(), seen, unseen]);
  const addExposure = () => {
    if (kind === "attempt")
      state.app.history.attempts.push({ ...a, id: "seen-attempt", questionId: "seen" });
    else
      state.app.history.feedback.push({ id: "seen-feedback", attemptId: a.id, questionId: "seen", questionRevision: "r1", at: a.at, studyDate: a.studyDate });
  };
  addExposure();
  const refresh = state.app.refresh;
  state.app.refresh = async () => {
    await refresh();
    addExposure();
  };
  show();
  fireEvent.click(screen.getByRole("button", { name: "Entender o erro" }));
  await screen.findByText("Synthetic explanation");
  expect(screen.getByText(/Matemática · 2025-2 · questão 8/)).toBeTruthy();
});

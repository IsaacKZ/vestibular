// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FeedbackPanel } from "../../src/features/practice/FeedbackPanel";
import { attempt, grade, question } from "../domain/fixtures";

afterEach(cleanup);

test("correction withholds an unreviewed explanation instead of exposing support", () => {
  const a = attempt();
  const q = question();
  q.explanation = {
    ...q.explanation!,
    reviewed: false,
    text: "Unreviewed support",
  };
  render(<FeedbackPanel attempt={a} grade={grade(a, false)} question={q} />);
  expect(screen.queryByText("Unreviewed support")).toBeNull();
  expect(screen.getByText(/Não há apoio conferido/)).toBeTruthy();
});

test("correction invites self explanation after showing reviewed support", () => {
  const a = attempt();
  render(
    <FeedbackPanel attempt={a} grade={grade(a, false)} question={question()} />,
  );
  expect(screen.getByText("Synthetic explanation")).toBeTruthy();
  expect(screen.getByText(/Qual etapa você precisa retomar/)).toBeTruthy();
});

test("reviewed learning displays its concept, example and prerequisite with provenance", () => {
  const a = attempt();
  const q = question({
    learning: {
      concept: "Reviewed concept",
      workedExample: "Reviewed worked example",
      prerequisites: [{ subject: "fisica", skill: "units" }],
      reviewed: true,
      source: "Reviewed source",
      reviewer: "Reviewer",
    },
  });
  render(<FeedbackPanel attempt={a} grade={grade(a, false)} question={q} />);
  expect(screen.getByText("Reviewed concept")).toBeTruthy();
  expect(screen.getByText("Reviewed worked example")).toBeTruthy();
  expect(screen.getByText(/Física · units/)).toBeTruthy();
  expect(
    screen.getByText(/Revisão: Reviewer. Fonte: Reviewed source/),
  ).toBeTruthy();
});

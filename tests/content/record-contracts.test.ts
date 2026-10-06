import { describe, expect, it } from "vitest";
import { FeedbackEventSchema, GradeSchema } from "../../src/content/schema";

const grade = {
  id: "attempt:key:v1",
  attemptId: "attempt",
  keyRevision: "v1",
  decisionRevision: "key:v1",
  questionRevision: "q1",
  correct: false,
  kind: "initial",
  exclusionReason: null,
  at: "2026-10-02T12:00:00Z",
};
describe("contratos dos registros produzidos pelo app", () => {
  it("preserva a ordem durável das decisões sem invalidar registros legados", () => {
    const parsed = GradeSchema.parse({ ...grade, order: 2 });
    expect(parsed).toHaveProperty("order", 2);
    expect(GradeSchema.safeParse(grade).success).toBe(true);
    expect(GradeSchema.safeParse({ ...grade, order: -1 }).success).toBe(false);
  });
  it("aceita identificadores compostos derivados das revisões máximas permitidas", () => {
    const revision = "r".repeat(500),
      decisionRevision = `annulment:${revision}`;
    expect(
      GradeSchema.safeParse({
        ...grade,
        id: `${"a".repeat(500)}:${decisionRevision}`,
        keyRevision: null,
        decisionRevision,
        correct: null,
        exclusionReason: "annulled",
      }).success,
    ).toBe(true);
  });
  it("aceita exposições com token limitado sem estourar o ID composto", () => {
    expect(
      FeedbackEventSchema.safeParse({
        id: `feedback:${"a".repeat(500)}:${"t".repeat(500)}`,
        attemptId: "a".repeat(500),
        questionId: "q",
        at: grade.at,
        studyDate: "2026-10-02",
      }).success,
    ).toBe(true);
  });
});

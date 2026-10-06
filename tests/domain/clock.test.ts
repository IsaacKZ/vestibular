import { describe, expect, it } from "vitest";
import { addStudyDays, dayDistance, studyDate } from "../../src/domain/clock";

describe("datas do estudo", () => {
  it("usa o dia local de São Paulo perto da meia-noite UTC", () => {
    expect(studyDate("2026-10-03T01:00:00Z", "America/Sao_Paulo")).toBe(
      "2026-10-02",
    );
  });
  it("atravessa meses e anos sem depender do fuso da máquina", () => {
    expect(dayDistance("2026-10-02", "2026-10-05")).toBe(3);
    expect(addStudyDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addStudyDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("rejeita datas impossíveis e instantes inválidos", () => {
    expect(() => addStudyDays("2026-02-30", 1)).toThrow();
    expect(() => dayDistance("2026-13-01", "2026-10-05")).toThrow();
    expect(() => studyDate("invalid", "America/Sao_Paulo")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { splitMath } from "../../src/ui/MathText";

describe("fórmulas conferidas", () => {
  it("renderiza somente delimitadores explícitos e preserva moeda e OCR", () => {
    expect(
      splitMath("Preço R$ 20; fórmula \\(x^2\\); texto mutilado x//"),
    ).toEqual([
      { text: "Preço R$ 20; fórmula ", math: false, display: false },
      { text: "x^2", math: true, display: false },
      { text: "; texto mutilado x//", math: false, display: false },
    ]);
  });
  it("preserva delimitador incompleto sem tentar adivinhar a fórmula", () => {
    expect(splitMath("Original \\(x")).toEqual([
      { text: "Original \\(x", math: false, display: false },
    ]);
  });
});

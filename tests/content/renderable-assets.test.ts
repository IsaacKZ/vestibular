import { expect, test } from "vitest";
import { getBlockers } from "../../src/content/quality";
import { readyQuestion } from "./fixtures";

test("documentos e páginas não passam como figuras renderizáveis do enunciado", () => {
  for (const extension of ["pdf", "html", "json"]) {
    const question = readyQuestion({
      assets: [
        {
          path: `content/assets/figure.${extension}`,
          alt: "Figura",
          required: true,
          verified: true,
          source: "Original p.1",
          anchor: { target: "stem", optionLetter: null, afterBlock: 0 },
        },
      ],
    });
    expect(getBlockers(question)).toContain("missing_assets");
  }
});

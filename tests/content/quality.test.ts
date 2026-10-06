import { describe, expect, it } from "vitest";
import { readyQuestion } from "./fixtures";
import { getBlockers, isReady } from "../../src/content/quality";

describe("content readiness", () => {
  it("allows only a completely reviewed question", () => {
    expect(isReady(readyQuestion())).toBe(true);
  });
  it("accumulates independent blockers without treating edition as a certificate", () => {
    const q = readyQuestion();
    expect(
      getBlockers({
        ...q,
        options: [],
        key: null,
        explanation: null,
        quality: { ...q.quality, ocr: true, uncertain: true, reviewed: false },
      }),
    ).toEqual(
      expect.arrayContaining([
        "ocr",
        "uncertain",
        "missing_options",
        "missing_key",
        "missing_explanation",
        "unreviewed",
      ]),
    );
  });
  it("rejects an empty option and repeated letters", () => {
    const q = readyQuestion();
    expect(
      isReady({
        ...q,
        options: q.options.map((o, i) => (i === 0 ? { ...o, text: "" } : o)),
      }),
    ).toBe(false);
    expect(
      isReady({ ...q, options: q.options.map((o) => ({ ...o, letter: "A" })) }),
    ).toBe(false);
  });
  it("requires reviewed original provenance even when the review boolean is true", () => {
    const q = readyQuestion();
    expect(
      isReady({ ...q, source: { ...q.source, originalPdf: undefined } }),
    ).toBe(false);
    expect(isReady({ ...q, quality: { ...q.quality, reviewer: "" } })).toBe(
      false,
    );
  });
  it("blocks missing required figures and unsafe asset paths", () => {
    const q = readyQuestion();
    const asset = {
      path: "content/assets/figure.svg",
      alt: "Figura real",
      required: true,
      verified: false,
      source: "original.pdf p. 1",
      anchor: { target: "stem" as const, optionLetter: null, afterBlock: 0 },
    };
    expect(getBlockers({ ...q, assets: [asset] })).toContain("missing_assets");
    expect(
      getBlockers({
        ...q,
        assets: [{ ...asset, verified: true, path: "../private.svg" }],
      }),
    ).toContain("missing_assets");
  });
  it("rejects unsafe asset URLs even when marked optional", () => {
    const q = readyQuestion();
    const asset = {
      path: "https://remote.example/figure.svg",
      alt: "Figura",
      required: false,
      verified: true,
      source: "Original",
      anchor: { target: "stem" as const, optionLetter: null, afterBlock: 0 },
    };
    expect(getBlockers({ ...q, assets: [asset] })).toContain("missing_assets");
  });
  it("blocks figures anchored outside the text actually rendered", () => {
    const q = readyQuestion();
    const asset = {
      path: "content/assets/figure.svg",
      alt: "Figura",
      required: true,
      verified: true,
      source: "Original",
      anchor: { target: "stem" as const, optionLetter: null, afterBlock: 999 },
    };
    expect(getBlockers({ ...q, assets: [asset] })).toContain("missing_assets");
    expect(
      getBlockers({
        ...q,
        assets: [
          {
            ...asset,
            anchor: { ...asset.anchor, target: "option", optionLetter: "A" },
          },
        ],
      }),
    ).toContain("missing_assets");
  });
  it("blocks unreviewed optional figures because those assets are displayed too", () => {
    const q = readyQuestion();
    const asset = {
      path: "content/assets/figure.svg",
      alt: "Figura",
      required: false,
      verified: false,
      source: "Original",
      anchor: { target: "stem" as const, optionLetter: null, afterBlock: 0 },
    };
    expect(getBlockers({ ...q, assets: [asset] })).toContain("missing_assets");
  });
  it("accepts graphical alternatives only when the verified figure is linked to that letter", () => {
    const q = readyQuestion();
    const asset = {
      path: "content/assets/a.svg",
      alt: "Alternativa A",
      required: true,
      verified: true,
      source: "original.pdf p. 1",
      anchor: {
        target: "option" as const,
        optionLetter: "A" as const,
        afterBlock: 0,
      },
    };
    const options = q.options.map((o, i) => (i === 0 ? { ...o, text: "" } : o));
    expect(isReady({ ...q, options, assets: [asset] })).toBe(true);
    expect(
      isReady({
        ...q,
        options,
        assets: [{ ...asset, anchor: { ...asset.anchor, optionLetter: "B" } }],
      }),
    ).toBe(false);
  });
  it("excludes annulled questions", () => {
    const q = readyQuestion();
    expect(
      getBlockers({ ...q, quality: { ...q.quality, annulled: true } }),
    ).toContain("annulled");
  });
  it("treats a sourced verified annulment as a decision, while keeping it out of training", () => {
    const q = readyQuestion({ key: null, annulment: {
      revision: "official-cancellation-v1", verified: true,
      source: "oficial.pdf", location: "p. 1", reviewer: "Revisor",
    }});
    q.quality.annulled = true;
    expect(getBlockers(q)).toContain("annulled");
    expect(getBlockers(q)).not.toContain("missing_key");
    expect(isReady(q)).toBe(false);
    expect(getBlockers({ ...q, annulment: { ...q.annulment!, verified: false } }))
      .toContain("missing_key");
    expect(getBlockers({ ...q, annulment: { ...q.annulment!, source: "" } }))
      .toContain("missing_key");
  });
});

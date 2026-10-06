import { expect, test } from "vitest";
import { formatDate } from "../../src/ui/FormControls";

test.each(["", "invalid", "2026-02-31"])(
  "formatDate safely handles an empty or invalid study date: %s",
  (date) => {
    expect(() => formatDate(date)).not.toThrow();
    expect(formatDate(date)).toBe("Data não informada");
  },
);

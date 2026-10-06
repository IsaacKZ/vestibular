// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useActiveTimer } from "../../src/features/practice/useActiveTimer";
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
test("active time excludes hidden page and an explicit pause, then resumes", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const { result, unmount } = renderHook(() =>
    useActiveTimer({ enabled: true, running: true, targetMs: 15000 }),
  );
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.activeMs).toBe(10000);
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(20000);
  });
  expect(result.current.activeMs).toBe(10000);
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(5000);
  });
  expect(result.current.activeMs).toBe(15000);
  expect(result.current.reminderReached).toBe(true);
  act(() => result.current.pause());
  act(() => vi.advanceTimersByTime(7000));
  expect(result.current.activeMs).toBe(15000);
  act(() => result.current.start());
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current.activeMs).toBe(18000);
  unmount();
});

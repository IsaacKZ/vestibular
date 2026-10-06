import { useCallback, useEffect, useRef, useState } from "react";
export function useActiveTimer({
  enabled,
  running,
  targetMs,
}: {
  enabled: boolean;
  running: boolean;
  targetMs: number | null;
}) {
  const [activeMs, setActiveMs] = useState(0),
    [manual, setManual] = useState(running);
  const total = useRef(0),
    last = useRef<number | null>(null);
  const getActiveMs = useCallback(
    () =>
      Math.floor(
        total.current +
          (last.current === null
            ? 0
            : Math.max(0, performance.now() - last.current)),
      ),
    [],
  );
  const tick = useCallback(() => {
    const current = performance.now();
    if (last.current !== null) {
      total.current += Math.max(0, current - last.current);
      setActiveMs(Math.floor(total.current));
    }
    last.current =
      enabled && manual && document.visibilityState === "visible"
        ? current
        : null;
  }, [enabled, manual]);
  useEffect(() => {
    tick();
    const id = window.setInterval(tick, 250);
    const visibility = () => tick();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      tick();
      last.current = null;
      clearInterval(id);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [tick]);
  return {
    activeMs,
    getActiveMs,
    reminderReached: targetMs !== null && activeMs >= targetMs,
    start: () => setManual(true),
    pause: () => {
      tick();
      setManual(false);
    },
    reset: () => {
      total.current = 0;
      setActiveMs(0);
      last.current =
        enabled && manual && document.visibilityState === "visible"
          ? performance.now()
          : null;
    },
  };
}

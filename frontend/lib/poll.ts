"use client";
import { useEffect, useRef } from "react";

/**
 * Tab-visibility-aware polling hook. Pauses fetching when the tab is hidden
 * (so we're not running 4 polls per minute across Genome / Threats / Defense
 * / Reports for nothing) and exponentially backs off on consecutive errors
 * so a failing endpoint doesn't get hammered.
 *
 * Returns nothing; the caller wires up state inside `fn`.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number, deps: any[] = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const nextDelay = (): number => {
      if (failures === 0) return intervalMs;
      // Cap backoff at 60s. With intervalMs=10s this is 10→20→40→60 across
      // the first four failures, then steady at 60s.
      return Math.min(60000, intervalMs * Math.min(2 ** failures, 6));
    };

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        await fnRef.current();
        failures = 0;
      } catch (e) {
        failures += 1;
        // Surface to devtools so a silently broken endpoint is visible
        // during development. In prod the user still sees stale data
        // (last-known-good) instead of an error wall.
        console.warn(`[poll] attempt ${failures} failed:`, e);
      }
      if (!cancelled) timer = setTimeout(tick, nextDelay());
    };

    // initial fire
    tick();

    const onVis = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        if (timer) clearTimeout(timer);
        // Reset backoff on visibility regain — the previous failure may
        // have been because we were sleeping behind a flaky network.
        failures = 0;
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

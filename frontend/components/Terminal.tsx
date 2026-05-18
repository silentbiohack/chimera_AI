"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";

export type TerminalEvent = {
  ts?: number;
  source: string;
  type: string;
  severity?: string;
  payload?: any;
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-danger-500",
  warning:  "text-warn-500",
  info:     "text-cy-200",
};
const SOURCE_COLOR: Record<string, string> = {
  attacker:         "text-danger-500",
  defender:         "text-cy-300",
  trap:             "text-warn-500",
  sandbox:          "text-ink-200",
  orchestrator:     "text-cy-400",
  // Swarm operatives — match SwarmPanel hues. Tailwind doesn't carry
  // these as named tokens so we use arbitrary-color classes.
  scout:            "text-[#4be9d2]",
  exploit_engineer: "text-[#ff3b6e]",
  deception:        "text-[#c084fc]",
  persistence:      "text-[#ffc857]",
  exfiltration:     "text-[#f97316]",
  strategist:       "text-[#80f7e3]",
};

const STICK_THRESHOLD_PX = 32;

export default function Terminal({ events }: { events: TerminalEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sticky-tail: auto-scroll only while the user is parked at the bottom.
  // We track *user intent* (wheel / touch / keyboard), NOT the raw scroll
  // event — because the scroll event also fires when:
  //   (a) we programmatically set scrollTop ourselves,
  //   (b) content height grows and the scrollbar reflows.
  // Those would otherwise flip stickRef→false on every burst of events,
  // freezing the feed mid-stream (the bug the user reported).
  const stickRef = useRef(true);
  // Re-render only for the indicator chip — actual scrolling never touches
  // React state to avoid a re-render on every event.
  const [sticky, setSticky] = useState(true);

  // Detect explicit user intent to break the tail. Wheel UP, drag UP, or
  // PageUp / Up arrow all unstick. Wheel DOWN or scrolling back to the
  // bottom re-sticks.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const atBottom = () =>
      el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX;

    const update = (newStick: boolean) => {
      if (stickRef.current !== newStick) {
        stickRef.current = newStick;
        setSticky(newStick);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) update(false);
      // After a downward wheel, re-check (let the scroll happen first).
      else requestAnimationFrame(() => update(atBottom()));
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key)) update(false);
      else if (["End", "PageDown", "ArrowDown"].includes(e.key)) {
        requestAnimationFrame(() => update(atBottom()));
      }
    };
    const onTouchMove = () => requestAnimationFrame(() => update(atBottom()));

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // Snap to bottom on every render where we're sticky. No rAF guard: we
  // need this to fire for *every* event, otherwise burst-batches under
  // React 18's auto-batching skip past the writes. scrollTop assignment
  // is one DOM op — at hundreds of events/sec the cost is invisible.
  useLayoutEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  const resume = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setSticky(true);
  };

  return (
    <div className="panel scanline h-full relative">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="h-full font-mono text-[12px] leading-snug overflow-y-auto p-3 focus:outline-none"
      >
        <div className="text-cy-400 mb-2 sticky top-0 bg-bg-950/80 backdrop-blur py-1 -mx-3 px-3">
          ▌ chimera-arena · streaming telemetry
        </div>
        {events.map((e, i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="text-ink-400 shrink-0">
              {fmtTime(e.ts)}
            </span>
            <span className={clsx("shrink-0 w-24 uppercase", SOURCE_COLOR[e.source] || "text-ink-300")}>
              {e.source}
            </span>
            <span className={clsx("shrink-0 w-32", SEVERITY_COLOR[e.severity || "info"])}>
              {e.type}
            </span>
            <span className="text-ink-200 truncate min-w-0">
              {summarize(e.payload)}
            </span>
          </div>
        ))}
      </div>
      {!sticky && (
        <button
          onClick={resume}
          className="absolute bottom-3 right-3 chip bg-cy-900/80 border-cy-400 text-cy-100 shadow-glow hover:bg-cy-800 transition"
        >
          ↓ resume live tail
        </button>
      )}
    </div>
  );
}

function fmtTime(ts?: number): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "--:--:--";
  try {
    return new Date(ts * 1000).toLocaleTimeString();
  } catch {
    return "--:--:--";
  }
}

function safeSlice(v: unknown, n: number): string {
  const s = typeof v === "string" ? v : String(v ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function summarize(p: any): string {
  if (p == null) return "";
  try {
    if (typeof p === "string") return safeSlice(p, 220);
    if (p.payload != null) return safeSlice(p.payload, 220);
    if (p.action && Array.isArray(p.matched_rules)) {
      return `${p.action} ← ${p.matched_rules.join(",")}`;
    }
    if (p.family) {
      return `${p.family}${p.generation !== undefined ? ` gen=${p.generation}` : ""}`;
    }
    if (p.reply != null) return safeSlice(p.reply, 220);
    if (p.system_prompt_leak !== undefined) {
      const flags = Object.entries(p).filter(([, v]) => v).map(([k]) => k);
      return `signals: ${flags.join(", ") || "none"}`;
    }
    return safeSlice(JSON.stringify(p), 220);
  } catch {
    // Circular refs, non-serializable values — never blow up the row.
    return "[unserializable]";
  }
}

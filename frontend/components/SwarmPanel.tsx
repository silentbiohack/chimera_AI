"use client";
import clsx from "clsx";

export type RoleStats = {
  attempts: number;
  successes: number;
  blocks?: number;
};

export type SwarmState = {
  phase?: "discovery" | "exploitation" | "persistence" | string;
  roles: Record<string, RoleStats>;
  lastActive?: string;
};

export const ROLE_LABEL: Record<string, string> = {
  scout: "Scout",
  exploit_engineer: "Exploit Eng",
  deception: "Deception",
  persistence: "Persistence",
  exfiltration: "Exfiltration",
  strategist: "Strategist",
};

// Distinct hues per role — also reused by AttackGraph to colour nodes.
export const ROLE_COLOR: Record<string, string> = {
  scout:            "#4be9d2",
  exploit_engineer: "#ff3b6e",
  deception:        "#c084fc",
  persistence:      "#ffc857",
  exfiltration:     "#f97316",
  strategist:       "#80f7e3",
};

const OPERATIVE_ORDER: string[] = [
  "exploit_engineer", "deception", "persistence", "exfiltration",
];

export default function SwarmPanel({ swarm }: { swarm: SwarmState | null }) {
  const phase = swarm?.phase ?? "discovery";
  const active = swarm?.lastActive;

  return (
    <div className="panel p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-sm text-cy-100 uppercase tracking-wider">
          Attack swarm
        </div>
        <span className={clsx(
          "chip uppercase tracking-widest text-[10px]",
          phase === "persistence" ? "border-warn-500 text-warn-500" :
          phase === "exploitation" ? "border-danger-500 text-danger-500" :
          "border-cy-700 text-cy-300"
        )}>
          phase · {phase}
        </span>
      </div>
      <ul className="space-y-2">
        {OPERATIVE_ORDER.map((role) => {
          const s = swarm?.roles?.[role] ?? { attempts: 0, successes: 0 };
          const isActive = active === role;
          const rate = s.attempts ? s.successes / s.attempts : 0;
          return (
            <li
              key={role}
              className={clsx(
                "rounded-md border px-3 py-2 transition",
                isActive
                  ? "border-cy-400 bg-cy-900/30 shadow-glow"
                  : "border-cy-900/60",
              )}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: ROLE_COLOR[role] }}
                  />
                  <span className="text-cy-100">{ROLE_LABEL[role]}</span>
                  {isActive && (
                    <span className="chip text-[10px] border-cy-400 text-cy-200">live</span>
                  )}
                </div>
                <span className="text-ink-300">
                  {s.successes}/{s.attempts}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-bg-950 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.round(rate * 100)}%`,
                    background: ROLE_COLOR[role],
                    opacity: s.attempts ? 1 : 0.2,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 text-[10px] text-ink-400 font-mono uppercase tracking-wider">
        scout + strategist coordinate · 4 operatives execute
      </div>
    </div>
  );
}

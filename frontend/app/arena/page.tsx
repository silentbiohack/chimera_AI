"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, setToken, getToken } from "@/lib/api";
import { connectArena, type ArenaConnection } from "@/lib/ws";
import Terminal, { TerminalEvent } from "@/components/Terminal";
import AttackGraph, { GraphEdge, GraphNode } from "@/components/AttackGraph";
import SwarmPanel, { SwarmState } from "@/components/SwarmPanel";
import { PulseDot, Stat } from "@/components/Telemetry";

type Agent = { id: string; name: string; kind: string };
type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

const MAX_EVENTS = 400;
const MAX_NODES = 2000;
const MAX_EDGES = 4000;

const EMPTY_SWARM: SwarmState = {
  phase: "discovery",
  roles: {
    exploit_engineer: { attempts: 0, successes: 0 },
    deception:        { attempts: 0, successes: 0 },
    persistence:      { attempts: 0, successes: 0 },
    exfiltration:     { attempts: 0, successes: 0 },
  },
};

export default function ArenaPage() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [target, setTarget] = useState<string>("");
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState({ mutations: 0, blocks: 0, successes: 0, policies: 0 });
  const [swarm, setSwarm] = useState<SwarmState>(EMPTY_SWARM);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  // Bumped on every Launch — used as React `key` to force a full remount of
  // AttackGraph and Terminal so their internal refs (nodeStateRef, stickRef,
  // d3 simulation) start clean. Without this, a relaunch leaves orphan nodes
  // from the previous session clustered next to the new ones.
  const [runId, setRunId] = useState<number>(0);
  const wsRef = useRef<ArenaConnection | null>(null);

  // ----------------------------------------------------- boot

  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        let list: Agent[] = await api("/agents");
        if (!list.length) list = await api("/agents/seed-sandbox", { method: "POST" });
        setAgents(list);
        if (list[0]) setTarget(list[0].id);
      } catch (e) { console.error(e); }
    })();
  }, [authed]);

  // ----------------------------------------------------- live stream

  useEffect(() => {
    if (!authed) return;

    const conn = connectArena({
      onEvent: (evt) => {
        if (!evt || typeof evt !== "object") return;
        const payload = evt.payload || {};

        // React 18 auto-batches multiple setState calls inside the same
        // microtask, so several updates per event still produce one render.
        setEvents((prev) => {
          const next = prev.length >= MAX_EVENTS ? prev.slice(-(MAX_EVENTS - 1)) : prev;
          return [...next, {
            ts: typeof evt.ts === "number" ? evt.ts : Date.now() / 1000,
            source: String(evt.source ?? "unknown"),
            type: String(evt.type ?? "event"),
            severity: typeof evt.severity === "string" ? evt.severity : undefined,
            payload,
          }];
        });

        const role = typeof payload.role === "string" ? payload.role : null;

        if (evt.type === "exploit.seeded" || evt.type === "exploit.mutated") {
          const id =
            (typeof payload.exploit_id === "string" && payload.exploit_id) ||
            (typeof payload.child_id === "string" && payload.child_id) ||
            crypto.randomUUID();
          setNodes((prev) => {
            if (prev.length >= MAX_NODES) return prev;
            return [...prev, {
              id,
              family: typeof payload.family === "string" ? payload.family : "unknown",
              generation: Number.isFinite(payload.generation) ? payload.generation : 0,
              success: false,
              role: role ?? undefined,
            }];
          });
          if (evt.type === "exploit.mutated" &&
              typeof payload.parent_id === "string" &&
              typeof payload.child_id === "string") {
            setEdges((prev) => {
              if (prev.length >= MAX_EDGES) return prev;
              return [...prev, { source: payload.parent_id, target: payload.child_id }];
            });
          }
          setStats((s) => ({ ...s, mutations: s.mutations + 1 }));

          // Bump the role's attempts counter and mark it as the live role.
          if (role) {
            setSwarm((prev) => {
              const cur = prev.roles[role] ?? { attempts: 0, successes: 0 };
              return {
                ...prev,
                phase: typeof payload.phase === "string" ? payload.phase : prev.phase,
                lastActive: role,
                roles: { ...prev.roles, [role]: { ...cur, attempts: cur.attempts + 1 } },
              };
            });
          }
        }
        if (evt.type === "trap.verdict" &&
            ["block", "quarantine"].includes(payload.action)) {
          setStats((s) => ({ ...s, blocks: s.blocks + 1 }));
        }
        if (evt.type === "compromise.signal" &&
            Object.values(payload).some(Boolean)) {
          setStats((s) => ({ ...s, successes: s.successes + 1 }));
          // Compromise comes from the sandbox source — attribute to the
          // most-recently-active role since events are emitted in order.
          setSwarm((prev) => {
            const r = prev.lastActive;
            if (!r) return prev;
            const cur = prev.roles[r] ?? { attempts: 0, successes: 0 };
            return {
              ...prev,
              roles: { ...prev.roles, [r]: { ...cur, successes: cur.successes + 1 } },
            };
          });
        }
        if (evt.type === "policy.promoted") {
          setStats((s) => ({ ...s, policies: s.policies + 1 }));
        }
        if (evt.type === "swarm.briefing" || evt.type === "swarm.debrief") {
          // Authoritative server-side snapshot — reconciles client counters
          // (which can drift if the user loads mid-session) with reality.
          setSwarm((prev) => ({
            ...prev,
            phase: typeof payload.phase === "string" ? payload.phase : prev.phase,
            roles: payload.roles
              ? Object.fromEntries(
                  Object.entries(payload.roles).map(([k, v]: [string, any]) => [
                    k, { attempts: v?.attempts ?? 0, successes: v?.successes ?? 0, blocks: v?.blocks ?? 0 },
                  ])
                )
              : prev.roles,
          }));
        }
      },
      onStatus: (s, err) => {
        setStreamStatus(s);
        setStreamError(err ?? null);
      },
    });
    wsRef.current = conn;

    return () => {
      conn.close();
      wsRef.current = null;
    };
  }, [authed]);

  // ----------------------------------------------------- actions

  const launch = useCallback(async () => {
    if (!target) return;
    // Hard reset: clearing arrays alone isn't enough — the graph/terminal
    // keep d3 state, sticky-scroll state, etc. in refs that survive prop
    // changes. Bumping runId forces a remount via React `key`.
    setNodes([]); setEdges([]); setEvents([]);
    setStats({ mutations: 0, blocks: 0, successes: 0, policies: 0 });
    setSwarm(EMPTY_SWARM);
    setRunId((r) => r + 1);
    await api<{ id: string }>("/arena/sessions", {
      method: "POST",
      body: JSON.stringify({ target_agent_id: target, objective: "continuous adversarial validation" }),
    });
  }, [target]);

  // ----------------------------------------------------- render

  if (!authed) return <Login onAuth={() => setAuthed(true)} />;

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <header className="col-span-12 flex items-center justify-between">
        <div>
          <div className="chip mb-1 flex items-center gap-2">
            <PulseDot />
            <span>
              arena · {streamStatus}
              {streamError ? ` (${streamError})` : ""}
            </span>
          </div>
          <h1 className="font-display text-2xl text-cy-100">Attack Arena</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-bg-900 border border-cy-800 rounded-md px-2 py-1.5 text-sm font-mono text-cy-100"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.kind}</option>
            ))}
          </select>
          <button onClick={launch} className="btn-primary">▶ Launch session</button>
        </div>
      </header>

      <section className="col-span-12 grid grid-cols-4 gap-3">
        <Stat label="Mutations this run" value={stats.mutations} />
        <Stat label="Lobster Trap blocks" value={stats.blocks} accent="warn" />
        <Stat label="Compromise signals" value={stats.successes} accent="danger" />
        <Stat label="Policies promoted" value={stats.policies} />
      </section>

      <section className="col-span-12 lg:col-span-2 h-[560px]">
        <SwarmPanel swarm={swarm} />
      </section>
      <section className="col-span-12 lg:col-span-6 h-[560px]">
        <AttackGraph key={`graph-${runId}`} nodes={nodes} edges={edges} />
      </section>
      <section className="col-span-12 lg:col-span-4 h-[560px]">
        <Terminal key={`term-${runId}`} events={events} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline auth — kept on the same route so the demo is one-click.
// ---------------------------------------------------------------------------

function Login({ onAuth }: { onAuth: () => void }) {
  const [tenant, setTenant] = useState("demo-corp");
  const [email, setEmail] = useState("ops@demo-corp.io");
  const [password, setPassword] = useState("chimera-launch-2026");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const prettifyError = (raw: string): string => {
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) return raw;
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const detail = parsed.detail;
      if (Array.isArray(detail)) {
        return detail
          .map((d: any) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "field";
            return `${field}: ${d.msg}`;
          })
          .join(" · ");
      }
      if (typeof detail === "string") return detail;
    } catch {}
    return raw;
  };

  const fillDemo = () => {
    setEmail("ops@demo-corp.io");
    setPassword("chimera-launch-2026");
  };

  const submit = async (mode: "register" | "login") => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ access_token: string }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ tenant_name: tenant, email, password }),
      });
      setToken(r.access_token);
      onAuth();
    } catch (e: any) {
      setErr(prettifyError(e.message));
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-24 panel p-8">
      <div className="chip mb-2">arena access</div>
      <h2 className="font-display text-2xl text-cy-100 mb-6">
        Authenticate to CHIMERA
      </h2>
      <div className="grid gap-3">
        <label className="block">
          <div className="text-xs uppercase tracking-widest text-ink-300 font-mono mb-1">tenant</div>
          <input value={tenant} onChange={(e) => setTenant(e.target.value)}
                 className="w-full bg-bg-950 border border-cy-800 rounded-md px-3 py-2 font-mono text-sm" />
        </label>
        <label className="block">
          <div className="text-xs uppercase tracking-widest text-ink-300 font-mono mb-1">email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
                 className="w-full bg-bg-950 border border-cy-800 rounded-md px-3 py-2 font-mono text-sm" />
        </label>
        <label className="block">
          <div className="text-xs uppercase tracking-widest text-ink-300 font-mono mb-1">password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-bg-950 border border-cy-800 rounded-md px-3 py-2 font-mono text-sm" />
          <div className="text-[11px] text-ink-400 font-mono mt-1">
            ≥12 chars, must include letters and digits
          </div>
        </label>
        <div className="flex gap-2 mt-2">
          <button disabled={busy} onClick={() => submit("register")} className="btn-primary flex-1">
            Provision tenant
          </button>
          <button disabled={busy} onClick={() => submit("login")} className="btn flex-1">
            Login
          </button>
        </div>
        <button type="button" onClick={fillDemo}
                className="text-[11px] text-cy-300 font-mono underline self-start hover:text-cy-100">
          fill demo credentials
        </button>
        {err && (
          <div className="text-danger-500 text-sm font-mono break-words whitespace-pre-wrap">
            {err}
          </div>
        )}
        <div className="text-[11px] text-ink-400 font-mono mt-2">
          first run? "Provision tenant" seeds the sandbox estate automatically.
        </div>
      </div>
    </div>
  );
}

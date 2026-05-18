"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Agent = {
  id: string; name: string; kind: string; description: string | null;
  tools: any[]; permissions: any[]; risk_baseline: number;
};

export default function SandboxPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const fetchAgents = async (): Promise<Agent[]> => {
    const list = await api<Agent[]>("/agents");
    return Array.isArray(list) ? list : [];
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchAgents();
        if (!alive) return;
        setAgents(list);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "failed to load agents");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // Guards against setState-after-unmount when the user navigates away
    // mid-fetch (next/link prefetch + fast nav makes this hit easily).
    return () => { alive = false; };
  }, []);

  const seed = async () => {
    if (seeding) return;
    setSeeding(true); setErr(null); setInfo(null);
    try {
      // The endpoint is idempotent and returns ONLY freshly-created rows
      // (empty if the estate was already seeded — e.g. via the arena's
      // auto-seed). Re-fetch the full list so the UI always reflects DB
      // state instead of trusting the partial response.
      const created = await api<Agent[]>("/agents/seed-sandbox", { method: "POST" });
      const full = await fetchAgents();
      setAgents(full);
      const n = Array.isArray(created) ? created.length : 0;
      setInfo(n
        ? `Seeded ${n} new agent${n === 1 ? "" : "s"}.`
        : "Sandbox already seeded — no new agents to create.");
    } catch (e: any) {
      setErr(e?.message ?? "seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const labelOf = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    // Tools/permissions sometimes arrive as {name, scope} objects from
    // the LLM-driven seed — fall back to a readable summary instead of
    // printing "[object Object]" all over the chip row.
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      return (typeof o.name === "string" && o.name) ||
             (typeof o.id === "string" && o.id) ||
             JSON.stringify(v);
    }
    return String(v);
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="chip mb-1">enterprise sandbox</div>
          <h1 className="font-display text-2xl text-cy-100">Synthetic agent estate</h1>
          <p className="text-ink-300 text-sm mt-2 max-w-3xl">
            CHIMERA never touches real systems. Every target below is a
            simulated enterprise agent inside your tenant, with intentional
            weaknesses for the arena to probe.
          </p>
        </div>
        <button onClick={seed} disabled={seeding}
                className="btn-primary disabled:opacity-50">
          {seeding ? "Seeding…" : "Seed sandbox estate"}
        </button>
      </header>

      {err && (
        <div className="panel p-3 mb-4 text-danger-500 font-mono text-xs break-words">
          {err}
        </div>
      )}
      {info && !err && (
        <div className="panel p-3 mb-4 text-cy-300 font-mono text-xs">
          {info}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="panel p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="chip mb-1">{a.kind}</div>
                <h3 className="font-display text-lg text-cy-100">{a.name}</h3>
              </div>
              <span className="chip-warn">simulated</span>
            </div>
            <p className="text-ink-300 text-xs mb-3">{a.description}</p>
            <div className="text-[11px] font-mono text-ink-300 mb-1 uppercase tracking-wider">tools</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {(a.tools || []).map((t, i) => (
                <span key={i} className="chip">{labelOf(t)}</span>
              ))}
            </div>
            <div className="text-[11px] font-mono text-ink-300 mb-1 uppercase tracking-wider">permissions</div>
            <div className="flex flex-wrap gap-1">
              {(a.permissions || []).map((p, i) => (
                <span key={i} className="chip">{labelOf(p)}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && !agents.length && (
          <div className="panel p-8 col-span-full text-center text-ink-300 animate-pulse">
            Loading sandbox estate…
          </div>
        )}
        {!loading && !agents.length && !err && (
          <div className="panel p-8 col-span-full text-center text-ink-300">
            No sandbox agents yet. Click <b>Seed sandbox estate</b> to spin up the canonical
            email / CRM / RAG / doc / assistant agents.
          </div>
        )}
      </div>
    </div>
  );
}

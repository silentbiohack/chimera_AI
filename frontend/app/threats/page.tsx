"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/poll";

type Vuln = {
  id: string; agent_id: string; family: string; title: string;
  severity: number; exploitability: number; blast_radius: number;
  business_impact: number; status: string; evidence: any;
};
type Intel = {
  families: { family: string; count: number; max_severity: number; avg_severity: number }[];
  mutations: number; successes: number; total_exploits: number; success_rate: number;
};

// Defensive numeric formatter — any non-finite value (null, undefined,
// NaN, "—") becomes a dash rather than throwing inside .toFixed().
const fmt = (n: unknown, digits = 2): string => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : "—";
};
const pct = (n: unknown, digits = 1): string => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "—";
};

export default function ThreatsPage() {
  const [vulns, setVulns] = useState<Vuln[]>([]);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);

  usePoll(async () => {
    const [v, i] = await Promise.all([
      api<Vuln[]>("/threats/vulnerabilities"),
      api<Intel>("/threats/intelligence"),
    ]);
    setVulns(Array.isArray(v) ? v : []);
    setIntel(i && typeof i === "object" ? i : null);
    setLoading(false);
  }, 8000);

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <header className="col-span-12">
        <div className="chip mb-1">threat intelligence</div>
        <h1 className="font-display text-2xl text-cy-100">AI Agent Threat Posture</h1>
      </header>

      {intel && (
        <section className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="stat"><div className="stat-label">Total exploits observed</div><div className="stat-num">{intel.total_exploits ?? 0}</div></div>
          <div className="stat"><div className="stat-label">Successful compromises</div><div className="stat-num text-danger-500">{intel.successes ?? 0}</div></div>
          <div className="stat"><div className="stat-label">Attack success rate</div><div className="stat-num">{pct(intel.success_rate)}</div></div>
          <div className="stat"><div className="stat-label">Mutations generated</div><div className="stat-num">{intel.mutations ?? 0}</div></div>
        </section>
      )}

      <section className="col-span-12 lg:col-span-5 panel p-4">
        <h2 className="font-display text-lg text-cy-100 mb-3">Family posture</h2>
        <ul className="space-y-2 text-sm font-mono">
          {(Array.isArray(intel?.families) ? intel!.families : []).map((f) => (
            <li key={f.family} className="flex items-center justify-between">
              <span className="text-cy-200">{f.family}</span>
              <div className="flex items-center gap-2">
                <span className="text-ink-300 text-xs">avg {fmt(f.avg_severity)}</span>
                <span className={f.max_severity > 0.8 ? "chip-danger" : f.max_severity > 0.6 ? "chip-warn" : "chip"}>
                  max {fmt(f.max_severity)}
                </span>
                <span className="chip">{f.count ?? 0}</span>
              </div>
            </li>
          ))}
          {loading && !intel?.families?.length && (
            <li className="text-ink-400 text-xs animate-pulse">loading…</li>
          )}
          {!loading && !intel?.families?.length && (
            <li className="text-ink-400 text-xs">no findings — run an arena session to populate.</li>
          )}
        </ul>
      </section>

      <section className="col-span-12 lg:col-span-7 panel p-4">
        <h2 className="font-display text-lg text-cy-100 mb-3">Top vulnerabilities</h2>
        <table className="w-full text-sm font-mono">
          <thead className="text-ink-300 text-xs uppercase">
            <tr>
              <th className="text-left py-1">title</th>
              <th className="text-left">family</th>
              <th className="text-right">CRI</th>
              <th className="text-right">expl</th>
              <th className="text-right">blast</th>
            </tr>
          </thead>
          <tbody>
            {vulns.slice(0, 25).map((v) => (
              <tr key={v.id} className="border-t border-cy-900/40">
                <td className="py-1.5 text-cy-200 max-w-md truncate">{v.title}</td>
                <td className="text-ink-200">{v.family}</td>
                <td className="text-right text-cy-100">
                  {fmt(v.evidence?.cri ?? v.severity)}
                </td>
                <td className="text-right">{fmt(v.exploitability)}</td>
                <td className="text-right">{fmt(v.blast_radius)}</td>
              </tr>
            ))}
            {loading && !vulns.length && (
              <tr><td colSpan={5} className="py-3 text-ink-400 text-xs animate-pulse">loading…</td></tr>
            )}
            {!loading && !vulns.length && (
              <tr><td colSpan={5} className="py-3 text-ink-400 text-xs">no vulnerabilities yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

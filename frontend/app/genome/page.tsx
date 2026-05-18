"use client";
import { useMemo, useState } from "react";
import AttackGraph, { GraphEdge, GraphNode } from "@/components/AttackGraph";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/poll";

type GenomeData = { nodes: GraphNode[]; edges: GraphEdge[]; families: Record<string, number> };
const EMPTY: GenomeData = { nodes: [], edges: [], families: {} };

export default function GenomePage() {
  const [data, setData] = useState<GenomeData>(EMPTY);

  usePoll(async () => {
    try {
      const r = await api<GenomeData>("/threats/genome");
      // Defensive: API may return partial payload during a server restart.
      setData({
        nodes: Array.isArray(r?.nodes) ? r.nodes : [],
        edges: Array.isArray(r?.edges) ? r.edges : [],
        families: r?.families && typeof r.families === "object" ? r.families : {},
      });
    } catch {
      // Keep last-known-good on transient failure — empty state is worse UX.
    }
  }, 8000);

  // Memoize derived data so we don't re-scan nodes / re-sort families on
  // unrelated renders (Family census re-render storm on big lineages).
  const { total, succ, familyCount, families } = useMemo(() => {
    let s = 0;
    for (const n of data.nodes) if (n?.success) s += 1;
    return {
      total: data.nodes.length,
      succ: s,
      familyCount: Object.keys(data.families).length,
      families: Object.entries(data.families).sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <header className="col-span-12">
        <div className="chip mb-1">attack genome</div>
        <h1 className="font-display text-2xl text-cy-100">Mutation Lineage & Exploit DNA</h1>
        <p className="text-ink-300 text-sm max-w-3xl mt-2">
          Every exploit produced by the arena leaves a fingerprint. CHIMERA
          clusters them into families, traces mutation lineage, and surfaces
          emergent variants — the autonomous-attacker equivalent of a phylogeny.
        </p>
      </header>

      <section className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat"><div className="stat-label">Total exploits</div><div className="stat-num">{total}</div></div>
        <div className="stat"><div className="stat-label">Compromises</div><div className="stat-num text-danger-500">{succ}</div></div>
        <div className="stat"><div className="stat-label">Families</div><div className="stat-num">{familyCount}</div></div>
        <div className="stat"><div className="stat-label">Mutation edges</div><div className="stat-num">{data.edges.length}</div></div>
      </section>

      <section className="col-span-12 lg:col-span-9 h-[620px]">
        <AttackGraph nodes={data.nodes} edges={data.edges} />
      </section>

      <section className="col-span-12 lg:col-span-3 panel p-4">
        <h2 className="font-display text-lg text-cy-100 mb-3">Family census</h2>
        <ul className="space-y-2 text-sm font-mono">
          {families.map(([fam, count]) => (
            <li key={fam} className="flex items-center justify-between">
              <span className="text-cy-200">{fam}</span>
              <span className="chip">{count}</span>
            </li>
          ))}
          {!families.length && (
            <li className="text-ink-400 text-xs">no exploits observed yet — launch a session in the arena.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

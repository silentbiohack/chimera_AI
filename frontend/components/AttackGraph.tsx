"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type GraphNode = {
  id: string;
  family: string;
  generation: number;
  success: boolean;
  /** Producing swarm role — when present, takes precedence over family colour. */
  role?: string;
};
export type GraphEdge = { source: string; target: string };

// Role colours match SwarmPanel.ROLE_COLOR — kept here to avoid a
// cross-component import dragging React into the d3 module.
const ROLE_COLOR: Record<string, string> = {
  scout:            "#4be9d2",
  exploit_engineer: "#ff3b6e",
  deception:        "#c084fc",
  persistence:      "#ffc857",
  exfiltration:     "#f97316",
  strategist:       "#80f7e3",
};
const FAMILY_COLOR: Record<string, string> = {
  prompt_injection:  "#4be9d2",
  jailbreak:         "#80f7e3",
  tool_abuse:        "#ff3b6e",
  memory_poison:     "#ffc857",
  rag_poison:        "#c084fc",
  exfiltration:      "#f97316",
  excessive_agency:  "#a3e635",
};
const FALLBACK_COLOR = "#7c8499";

const MAX_NODES = 2000; // hard cap to keep the simulation stable

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode> & { source: string | SimNode; target: string | SimNode };

const safeNum = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Incremental D3 force graph. Instead of rebuilding the simulation on each
 * render, we mutate node/link arrays in place and let d3 re-anneal. This
 * keeps positions stable as exploits stream in, and is O(diff) rather than
 * O(N²) per update.
 *
 * Edges are deep-cloned before being handed to d3.forceLink because d3
 * mutates them (replacing string ids with node refs). Without the clone,
 * the parent component's state ends up pointing to live d3 internals.
 */
export default function AttackGraph({
  nodes, edges,
}: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const nodeStateRef = useRef<Map<string, SimNode>>(new Map());
  const linkStateRef = useRef<SimLink[]>([]);
  const linkSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null);
  const nodeSelRef = useRef<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>(null);

  // Live viewport size — refs so the tick handler closes over current values
  // rather than the size captured on mount (graph would otherwise drift off
  // screen when the panel beside it changes width).
  const sizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  // One-time setup
  useEffect(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    // clientWidth/Height may be 0 on cold start (before layout settles); fall
    // back to a sane size so the simulation centers reasonably.
    const w0 = svgEl.clientWidth || 800;
    const h0 = svgEl.clientHeight || 600;
    sizeRef.current = { w: w0, h: h0 };

    const linkGroup = svg.append("g")
      .attr("stroke", "rgba(75, 233, 210, 0.25)")
      .attr("stroke-width", 0.8);
    const nodeGroup = svg.append("g");

    const sim = d3.forceSimulation<SimNode, SimLink>()
      .force("link", d3.forceLink<SimNode, SimLink>()
        .id((d) => d.id)
        .distance(28)
        .strength(0.7))
      // Charge tuned down from -90 → -45: with 100+ nodes the higher value
      // produces a centrifugal explosion that flings outliers past the SVG.
      .force("charge", d3.forceManyBody().strength(-45).distanceMax(180))
      .force("center", d3.forceCenter(w0 / 2, h0 / 2))
      .force("collide", d3.forceCollide(8))
      // Soft gravity toward centre on each axis. Without these, nothing
      // actually keeps drifting nodes inside the viewport — the centre
      // force alone is a single weak attractor that loses to charge once
      // a node is far enough away. forceX/Y act *everywhere*.
      .force("x", d3.forceX(w0 / 2).strength(0.06))
      .force("y", d3.forceY(h0 / 2).strength(0.06))
      // Cool slower so newly added nodes get more frames to find a spot
      // before the simulation freezes.
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    simRef.current = sim;
    linkSelRef.current = linkGroup.selectAll<SVGLineElement, SimLink>("line");
    nodeSelRef.current = nodeGroup.selectAll<SVGCircleElement, SimNode>("circle");

    sim.on("tick", () => {
      // Hard clamp: a node should never render outside the SVG even if a
      // force briefly pushes it there. This is the last line of defence;
      // forceX/Y are the soft pull.
      const { w, h } = sizeRef.current;
      const margin = 12;
      for (const n of nodeStateRef.current.values()) {
        if (Number.isFinite(n.x)) {
          n.x = Math.min(w - margin, Math.max(margin, n.x as number));
        }
        if (Number.isFinite(n.y)) {
          n.y = Math.min(h - margin, Math.max(margin, n.y as number));
        }
      }
      // Guard against NaN coords leaking into SVG attributes — d3 forces can
      // briefly produce non-finite values during re-anneal and SVG throws.
      if (linkSelRef.current) {
        linkSelRef.current
          .attr("x1", (d) => safeNum((d.source as SimNode).x))
          .attr("y1", (d) => safeNum((d.source as SimNode).y))
          .attr("x2", (d) => safeNum((d.target as SimNode).x))
          .attr("y2", (d) => safeNum((d.target as SimNode).y));
      }
      if (nodeSelRef.current) {
        nodeSelRef.current
          .attr("cx", (d) => safeNum(d.x))
          .attr("cy", (d) => safeNum(d.y));
      }
    });

    // Keep ALL position-bearing forces aligned with the actual SVG size —
    // when the panel beside the graph appears/disappears, width changes
    // sharply and the old centre+gravity would be wrong. Also re-seat any
    // node that ended up outside the new viewport so the user doesn't
    // have to wait for forces to drag them back.
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const { width, height } = e.contentRect;
      if (width <= 0 || height <= 0) return;
      sizeRef.current = { w: width, h: height };
      (sim.force("center") as d3.ForceCenter<SimNode>).x(width / 2).y(height / 2);
      (sim.force("x") as d3.ForceX<SimNode>).x(width / 2);
      (sim.force("y") as d3.ForceY<SimNode>).y(height / 2);
      const margin = 12;
      for (const n of nodeStateRef.current.values()) {
        if (!Number.isFinite(n.x) || (n.x as number) < margin || (n.x as number) > width - margin) {
          n.x = width / 2 + (Math.random() - 0.5) * Math.min(120, width / 4);
        }
        if (!Number.isFinite(n.y) || (n.y as number) < margin || (n.y as number) > height - margin) {
          n.y = height / 2 + (Math.random() - 0.5) * Math.min(120, height / 4);
        }
      }
      sim.alpha(0.4).restart();
    });
    ro.observe(svgEl);

    return () => {
      ro.disconnect();
      sim.on("tick", null);
      sim.stop();
    };
  }, []);

  // Diff-apply on every prop change
  useEffect(() => {
    const sim = simRef.current;
    if (!sim || !svgRef.current) return;

    const nodeState = nodeStateRef.current;
    let mutated = false;
    for (const n of nodes) {
      if (!n || typeof n.id !== "string") continue;
      // Coerce optional/unknown fields so downstream math never sees NaN.
      const safe: GraphNode = {
        id: n.id,
        family: typeof n.family === "string" ? n.family : "unknown",
        generation: safeNum(n.generation, 0),
        success: Boolean(n.success),
        role: typeof n.role === "string" ? n.role : undefined,
      };
      const existing = nodeState.get(safe.id);
      if (!existing) {
        if (nodeState.size >= MAX_NODES) continue; // hard cap
        // Seed new nodes near the current centre with a small jitter so
        // they don't pile up at (0,0) and get launched diagonally by the
        // first charge tick. Jitter radius scales with viewport so the
        // initial cloud fills the panel proportionally.
        const { w, h } = sizeRef.current;
        const r = Math.min(80, Math.min(w, h) / 6);
        const fresh: SimNode = {
          ...safe,
          x: w / 2 + (Math.random() - 0.5) * r,
          y: h / 2 + (Math.random() - 0.5) * r,
        };
        nodeState.set(safe.id, fresh);
        mutated = true;
      } else if (existing.success !== safe.success ||
                 existing.generation !== safe.generation ||
                 existing.family !== safe.family) {
        Object.assign(existing, safe);
        mutated = true;
      }
    }
    // We don't remove nodes — the lineage view is append-only by design.

    // Clone edges so d3's in-place mutation can't bleed back into React state.
    // Drop any edge whose endpoint isn't in nodeState yet — d3.forceLink throws
    // "node not found" otherwise. Skipped edges are not buffered: the parent
    // stream is expected to re-send the edge once both nodes are present.
    const wantedEdges: SimLink[] = edges
      .filter((e) => nodeState.has(e.source) && nodeState.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    // Re-use existing link objects keyed by (src,tgt) to preserve positions.
    const linkState = linkStateRef.current;
    const existingKeys = new Set(
      linkState.map((l) => `${typeof l.source === "string" ? l.source : (l.source as SimNode).id}|${typeof l.target === "string" ? l.target : (l.target as SimNode).id}`),
    );
    for (const e of wantedEdges) {
      const key = `${e.source}|${e.target}`;
      if (!existingKeys.has(key)) {
        linkState.push(e);
        mutated = true;
      }
    }

    if (!mutated) return;

    const allNodes = Array.from(nodeState.values());
    sim.nodes(allNodes);
    (sim.force("link") as d3.ForceLink<SimNode, SimLink>).links(linkState);

    const svg = d3.select(svgRef.current);
    const linkSel = svg.select<SVGGElement>("g:first-of-type")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(linkState, (d: any) =>
        `${typeof d.source === "string" ? d.source : d.source.id}|${typeof d.target === "string" ? d.target : d.target.id}`);
    linkSel.exit().remove();
    const linkEnter = linkSel.enter().append("line");
    linkSelRef.current = linkEnter.merge(linkSel as any);

    const nodeSel = svg.select<SVGGElement>("g:last-of-type")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(allNodes, (d: any) => d.id);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel.enter().append("circle");
    nodeEnter.append("title");
    const merged = nodeEnter.merge(nodeSel as any);
    merged
      .attr("r", (d) => 3 + Math.min(safeNum(d.generation, 0), 8) * 0.6)
      .attr("fill", (d) => {
        // Role colour wins when present — that's the swarm-aware view.
        // Falls back to family colour for nodes from historical sessions
        // that pre-date the swarm refactor (role is nullable in DB).
        if (d.role && ROLE_COLOR[d.role]) return ROLE_COLOR[d.role];
        return FAMILY_COLOR[d.family] || FALLBACK_COLOR;
      })
      .attr("stroke", (d) => (d.success ? "#ff3b6e" : "rgba(8, 200, 180, 0.4)"))
      .attr("stroke-width", (d) => (d.success ? 2 : 1));
    merged.select("title").text(
      (d) => `${d.family} · gen ${d.generation}${d.success ? " · COMPROMISE" : ""}`,
    );
    nodeSelRef.current = merged;

    sim.alpha(0.6).restart();
  }, [nodes, edges]);

  return (
    <div className="panel scanline relative h-full">
      <div className="absolute top-3 left-3 chip">attack graph · mutation lineage</div>
      <svg ref={svgRef} width="100%" height="100%" />
      <div className="absolute bottom-3 right-3 flex gap-1 flex-wrap max-w-xs">
        {Object.entries(FAMILY_COLOR).map(([fam, color]) => (
          <span key={fam} className="chip" style={{ borderColor: color, color }}>
            ● {fam}
          </span>
        ))}
      </div>
    </div>
  );
}

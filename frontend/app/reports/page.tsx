"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/poll";

type Exec = {
  attack_sessions: number; successful_breaches: number; breach_rate: number;
  open_vulnerabilities: number; critical_vulnerabilities: number;
  active_policies: number; auto_generated_policies: number;
  agents_under_protection: number; headline: string;
};

const pct = (n: unknown, digits = 1): string => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : "—";
};

export default function ReportsPage() {
  const [exec, setExec] = useState<Exec | null>(null);
  const [loading, setLoading] = useState(true);

  usePoll(async () => {
    const r = await api<Exec>("/reports/executive");
    setExec(r && typeof r === "object" ? r : null);
    setLoading(false);
  }, 10000);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="chip mb-1">executive briefing</div>
      <h1 className="font-display text-3xl text-cy-100 mb-2">
        AI agent posture · live
      </h1>

      {loading && !exec && (
        <div className="panel p-8 text-center text-ink-300 animate-pulse">
          loading executive snapshot…
        </div>
      )}

      {exec && (
        <>
          <p className="text-ink-200 max-w-3xl mb-6">
            <span className="text-cy-200">{exec.headline}</span>
          </p>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Kpi label="Attack sessions" value={exec.attack_sessions ?? 0} />
            <Kpi label="Successful breaches" value={exec.successful_breaches ?? 0} accent={exec.successful_breaches ? "danger" : "ok"} />
            <Kpi label="Breach rate" value={pct(exec.breach_rate)} />
            <Kpi label="Open vulnerabilities" value={exec.open_vulnerabilities ?? 0} accent={exec.open_vulnerabilities ? "warn" : "ok"} />
            <Kpi label="Critical exposures" value={exec.critical_vulnerabilities ?? 0} accent={exec.critical_vulnerabilities ? "danger" : "ok"} />
            <Kpi label="Active policies" value={exec.active_policies ?? 0} />
            <Kpi label="Auto-promoted policies" value={exec.auto_generated_policies ?? 0} />
            <Kpi label="Agents under protection" value={exec.agents_under_protection ?? 0} />
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-xl text-cy-100 mb-2">What the board sees</h2>
            <p className="text-ink-200 text-sm leading-relaxed">
              CHIMERA continuously red-teams every AI agent in your estate.
              For each new attack family, the defender layer synthesizes a
              candidate policy and A/B-tests it against the prior version in
              the arena. Promotion is automatic — but every promotion is
              versioned, audit-logged, and reversible. The platform's
              value is not a one-time pentest report; it's a live posture
              that hardens itself overnight.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent = "ok" }: { label: string; value: any; accent?: "ok" | "warn" | "danger" }) {
  const color =
    accent === "danger" ? "text-danger-500" :
    accent === "warn"   ? "text-warn-500"   : "text-cy-100";
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-num ${color}`}>{value}</div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import HeroBackground from "@/components/HeroBackground";

export default function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="relative h-[80vh] min-h-[640px] overflow-hidden">
        <HeroBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-950/30 via-bg-950/50 to-bg-950" />
        <div className="relative z-10 h-full flex flex-col justify-center px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="chip mb-4 w-fit"
          >
            autonomous adversarial intelligence
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display text-6xl md:text-7xl font-semibold tracking-tight text-cy-50 leading-[1.05]"
          >
            The autonomous immune system<br />
            <span className="text-cy-300">for enterprise AI agents.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-6 max-w-3xl text-lg text-ink-200 leading-relaxed"
          >
            CHIMERA runs swarms of AI attackers that continuously discover,
            mutate, and exploit vulnerabilities in your AI agent estate —
            then teaches its defender layer to neutralize them before real
            attackers can. AI-vs-AI, at frontier scale, under your control.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link href="/arena" className="btn-primary">
              ▶ Launch Live Arena
            </Link>
            <Link href="/reports" className="btn">
              View Executive Briefing
            </Link>
            <Link href="/sandbox" className="btn">
              Inspect Sandbox Agents
            </Link>
            <Link href="/pricing" className="btn">
              See Pricing
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-8 left-8 right-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-6xl"
          >
            <KPI label="Attacker swarm" value="active" tone="ok" />
            <KPI label="Lobster Trap" value="LT-CORE v3" tone="ok" />
            <KPI label="Open CRIs ≥ 0.8" value="2" tone="warn" />
            <KPI label="Auto-policies promoted" value="14" tone="ok" />
          </motion.div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="px-8 py-16 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl text-cy-100 mb-2">
          A continuous adversarial loop, fully autonomous.
        </h2>
        <p className="text-ink-300 max-w-3xl mb-10">
          CHIMERA isn't a prompt library or a static benchmark. Attackers
          generate, evolve, and chain exploits in real time. Defenders learn
          from every attempt. Policies version themselves.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Pillar
            title="Attack Arena"
            href="/arena"
            body="AI-vs-AI battles streamed live. Watch attacker swarms mutate exploits against your agent estate, with Lobster Trap arbitrating every hop."
          />
          <Pillar
            title="Attack Genome"
            href="/genome"
            body="Every exploit carries DNA. Family clustering, mutation lineage, and emergent-variant detection — the same lens used by biosurveillance, applied to AI threats."
          />
          <Pillar
            title="Defense Core"
            href="/defense"
            body="Versioned policies, auto-synthesized from observed attacks. A/B-tested in the arena, promoted only after they win."
          />
          <Pillar
            title="Threat Intelligence"
            href="/threats"
            body="Family-level posture, business impact propagation, anomaly detection. Built for CISOs, scoped per tenant."
          />
          <Pillar
            title="Enterprise Sandbox"
            href="/sandbox"
            body="Synthetic email / CRM / RAG / doc / DB agents with intentional weaknesses. No third-party systems are ever touched."
          />
          <Pillar
            title="Reports"
            href="/reports"
            body="Executive-grade briefings and forensic timelines, generated from the same telemetry that drives the arena."
          />
        </div>
      </section>

      {/* SAFETY */}
      <section className="px-8 py-12 max-w-6xl mx-auto">
        <div className="panel p-6 border-cy-700/40">
          <div className="chip mb-3">safety boundary</div>
          <h3 className="font-display text-xl text-cy-100">
            CHIMERA only attacks sandboxed, authorized targets.
          </h3>
          <p className="text-ink-300 mt-2 max-w-3xl text-sm leading-relaxed">
            All offensive activity is constrained to synthetic enterprise
            agents inside your tenant. No real credentials, no real outbound
            traffic, no third-party systems. The full boundary is documented in{" "}
            <code className="text-cy-200">docs/SECURITY_MODEL.md</code>.
          </p>
        </div>
      </section>
    </>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "danger" }) {
  return (
    <div className="panel px-4 py-3 flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-widest text-ink-300 font-mono">{label}</div>
      <div className={
        tone === "warn" ? "chip-warn" : tone === "danger" ? "chip-danger" : "chip"
      }>{value}</div>
    </div>
  );
}

function Pillar({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="panel p-5 hover:shadow-glow transition group">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg text-cy-100">{title}</h3>
        <span className="text-cy-300 group-hover:translate-x-1 transition">→</span>
      </div>
      <p className="text-sm text-ink-300 leading-relaxed">{body}</p>
    </Link>
  );
}

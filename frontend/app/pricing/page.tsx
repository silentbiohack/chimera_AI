"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// Tier data — kept in one place so the comparison table and the cards stay
// in sync. Numbers are anchored to the AI-security market: Lakera Guard
// ($99→$999/mo for prompt-firewall), Cobalt.io / Bugcrowd ($1.5-3K/mo for
// pentest-as-a-service), WhyLabs ($125-999/mo for ML monitoring), and
// enterprise AI-firewall vendors (Robust Intelligence / HiddenLayer, mid-
// 5-figure to low-6-figure annual contracts).
// ---------------------------------------------------------------------------

type Tier = {
  id: "scout" | "operator" | "frontier";
  label: string;
  tagline: string;
  monthly: number | null;       // null → "Custom"
  yearly: number | null;        // null → "Custom"
  cta: { label: string; href: string };
  highlights: string[];
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "scout",
    label: "Scout",
    tagline: "Hands-on red team for a single AI agent estate.",
    monthly: 0,
    yearly: 0,
    cta: { label: "Start free", href: "/arena" },
    highlights: [
      "50 attack sessions / month",
      "3 sandbox agents (preset)",
      "Single tenant · 1 seat",
      "All 7 attack families",
      "Synthetic LLM driver (offline)",
      "7-day telemetry retention",
      "Community Discord support",
    ],
  },
  {
    id: "operator",
    label: "Operator",
    tagline: "Continuous adversarial validation for a security team.",
    monthly: 899,
    yearly: 8990, // 17% off
    cta: { label: "Start 14-day trial", href: "/arena" },
    featured: true,
    highlights: [
      "1,000 attack sessions / month",
      "Unlimited sandbox agents",
      "Up to 5 tenants · 10 seats",
      "Full swarm: all 6 operatives",
      "Strategist phase-bandit selection",
      "Gemini Pro / Flash (BYOK)",
      "Auto-policy synthesis & versioning",
      "Webhook alerts + Slack integration",
      "90-day telemetry retention",
      "Email support · 12-hour SLA",
    ],
  },
  {
    id: "frontier",
    label: "Frontier",
    tagline: "Autonomous immune system for the regulated enterprise.",
    monthly: null,
    yearly: null,
    cta: { label: "Talk to sales", href: "mailto:sales@chimera.dev" },
    highlights: [
      "Unlimited sessions, tenants, seats",
      "Dedicated single-tenant infra",
      "Bring-your-own-LLM: Claude · GPT-4 · Gemini · on-prem",
      "Custom attack families & target adapters",
      "SOC 2 Type II · HIPAA · GDPR audit exports",
      "SIEM webhooks: Splunk · Datadog · Sentinel · CrowdStrike",
      "SSO (SAML, OIDC) + SCIM provisioning",
      "Air-gapped / VPC deployment",
      "Private Slack with dedicated SE",
      "24/7 SLA · 15-min response for criticals",
    ],
  },
];

// Feature matrix for the comparison table. Each row has a feature label
// and a value per tier. Use `"—"` for absent, `"✓"` for present.
const COMPARE: { section: string; rows: { label: string; values: [string, string, string] }[] }[] = [
  {
    section: "Adversarial engine",
    rows: [
      { label: "Attack sessions / month",      values: ["50", "1,000", "Unlimited"] },
      { label: "Sandbox agents",               values: ["3 preset", "Unlimited", "Unlimited + custom"] },
      { label: "Mutation budget per session",  values: ["32 ticks", "64 ticks", "Configurable"] },
      { label: "Attack families",              values: ["7", "7", "7 + custom"] },
      { label: "Swarm operatives",             values: ["1 (generalist)", "6 specialized", "6 + custom roles"] },
      { label: "Cross-session evolution",      values: ["—", "✓", "✓"] },
    ],
  },
  {
    section: "Defense & policy",
    rows: [
      { label: "Lobster Trap inspection",      values: ["✓", "✓", "✓"] },
      { label: "Auto-policy synthesis",        values: ["✓", "✓", "✓"] },
      { label: "Policy versioning + A/B",      values: ["—", "✓", "✓"] },
      { label: "ReDoS-safe regex engine",      values: ["✓", "✓", "✓"] },
      { label: "Custom rule packs",            values: ["—", "—", "✓"] },
    ],
  },
  {
    section: "Platform",
    rows: [
      { label: "Tenants",                      values: ["1", "5", "Unlimited"] },
      { label: "Seats",                        values: ["1", "10", "Unlimited"] },
      { label: "Telemetry retention",          values: ["7 days", "90 days", "365 days + archive"] },
      { label: "RBAC roles",                   values: ["5", "5", "5 + custom"] },
      { label: "Audit log export",             values: ["CSV", "CSV · JSON", "CSV · JSON · SIEM"] },
    ],
  },
  {
    section: "Integrations & support",
    rows: [
      { label: "LLM router (BYOK)",            values: ["Synthetic only", "Gemini", "Claude · GPT-4 · Gemini · on-prem"] },
      { label: "Webhook alerts",               values: ["—", "✓", "✓"] },
      { label: "SIEM (Splunk / Datadog / Sentinel)", values: ["—", "—", "✓"] },
      { label: "SSO (SAML / OIDC)",            values: ["—", "—", "✓"] },
      { label: "SCIM provisioning",            values: ["—", "—", "✓"] },
      { label: "Support",                      values: ["Community", "Email · 12h SLA", "Dedicated SE · 24/7"] },
      { label: "Deployment",                   values: ["Cloud (shared)", "Cloud (shared)", "Dedicated · VPC · Air-gapped"] },
    ],
  },
  {
    section: "Compliance",
    rows: [
      { label: "SOC 2 Type II evidence",       values: ["—", "—", "✓"] },
      { label: "HIPAA-eligible workloads",     values: ["—", "—", "✓"] },
      { label: "GDPR DPA",                     values: ["Standard", "Standard", "Custom"] },
      { label: "Regulator-ready reports",      values: ["—", "—", "✓"] },
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as an attack session?",
    a: "One launched arena run against a single target agent — typically 32-64 mutation ticks. A session that terminates early on three successful compromises still counts as one.",
  },
  {
    q: "Do I need my own LLM API key?",
    a: "Scout works offline with the deterministic synthetic driver — no key required. Operator and Frontier route to live Gemini / Claude / GPT-4 if you provide a BYOK key in tenant settings; otherwise the synthetic driver is the fallback.",
  },
  {
    q: "Is the platform safe to point at real production agents?",
    a: "CHIMERA only attacks targets you explicitly authorize inside your tenant. Sandboxed synthetic agents are the default. Frontier customers can register custom adapters for staged or canary environments under signed authorization scope. We never touch third-party systems.",
  },
  {
    q: "How does annual billing work?",
    a: "Operator annual saves 17% vs monthly. Frontier contracts are 1- or 3-year commitments with quarterly true-up on overages. All plans are billed in USD via Stripe or wire transfer.",
  },
  {
    q: "Can I migrate between tiers?",
    a: "Yes — usage and history persist. Upgrading is instant; downgrades take effect at the next billing period and respect quota caps prospectively.",
  },
  {
    q: "Do you offer non-profit / academic pricing?",
    a: "Yes. Verified research teams and educational programs get Operator at 60% off. Reach out from an institutional address.",
  },
];

// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="px-6 py-12 max-w-7xl mx-auto">
      <header className="text-center mb-10">
        <div className="chip mb-3 inline-block">pricing</div>
        <h1 className="font-display text-4xl md:text-5xl text-cy-50 tracking-tight">
          Price the <span className="text-cy-300">immune system</span>, not the audit.
        </h1>
        <p className="mt-4 text-ink-200 max-w-2xl mx-auto leading-relaxed">
          Traditional AI red-teaming charges per engagement. CHIMERA runs
          continuously. Every plan includes the full attack swarm, the
          Lobster Trap defense engine, and unlimited replay.
        </p>

        <div className="mt-6 inline-flex items-center gap-1 panel p-1 rounded-full">
          <BillingToggle annual={false} active={!annual} onClick={() => setAnnual(false)}>
            Monthly
          </BillingToggle>
          <BillingToggle annual={true} active={annual} onClick={() => setAnnual(true)}>
            Annual <span className="ml-1 text-[10px] text-cy-300">save 17%</span>
          </BillingToggle>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} annual={annual} />
        ))}
      </section>

      <section className="mb-16">
        <h2 className="font-display text-2xl text-cy-100 mb-6 text-center">
          Compare plans
        </h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="text-ink-300 text-xs uppercase tracking-wider">
              <tr className="border-b border-cy-900/60">
                <th className="text-left py-3 px-4 w-1/3"> </th>
                {TIERS.map((t) => (
                  <th key={t.id} className={clsx(
                    "text-left py-3 px-4",
                    t.featured && "text-cy-200"
                  )}>
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((section) => (
                <FragmentRows key={section.section} section={section} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-2xl text-cy-100 mb-6 text-center">
          FAQ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {FAQS.map((f) => (
            <div key={f.q} className="panel p-5">
              <div className="text-cy-100 font-semibold mb-2">{f.q}</div>
              <div className="text-ink-300 text-sm leading-relaxed">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-8 text-center bg-gradient-to-br from-cy-900/40 to-bg-950 border-cy-700/40">
        <h3 className="font-display text-2xl text-cy-100 mb-2">
          Need a custom deployment, BYOL contract, or air-gapped install?
        </h3>
        <p className="text-ink-300 max-w-2xl mx-auto mb-5">
          Frontier is sales-led so we can right-size the architecture and
          compliance package to your environment. Typical evaluation: 2-week
          POC against your sandboxed agent estate, then commercial close.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a className="btn-primary" href="mailto:sales@chimera.dev?subject=Frontier%20evaluation">
            Talk to sales
          </a>
          <Link className="btn" href="/arena">
            ▶ Try Scout free
          </Link>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BillingToggle({ active, onClick, children }: {
  annual: boolean; active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest transition",
        active
          ? "bg-cy-900/70 text-cy-100 shadow-glow"
          : "text-ink-300 hover:text-cy-100",
      )}
    >
      {children}
    </button>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const price = annual ? tier.yearly : tier.monthly;
  const isCustom = price === null;
  const monthlyEquivalent = annual && tier.yearly ? Math.round(tier.yearly / 12) : null;

  return (
    <div
      className={clsx(
        "panel p-6 flex flex-col h-full transition",
        tier.featured && "border-cy-400 shadow-glow",
      )}
    >
      {tier.featured && (
        <div className="chip mb-3 self-start border-cy-400 text-cy-200 uppercase">
          most popular
        </div>
      )}
      <div className="text-xs uppercase tracking-widest text-ink-300 font-mono mb-1">
        {tier.id}
      </div>
      <div className="font-display text-2xl text-cy-100 mb-1">{tier.label}</div>
      <p className="text-ink-300 text-sm mb-5">{tier.tagline}</p>

      <div className="mb-5">
        {isCustom ? (
          <div className="text-3xl font-display text-cy-100">Custom</div>
        ) : price === 0 ? (
          <div className="text-3xl font-display text-cy-100">$0</div>
        ) : annual ? (
          <>
            <div className="text-3xl font-display text-cy-100">
              ${fmtUSD(monthlyEquivalent)}
              <span className="text-base text-ink-300 font-mono"> / mo</span>
            </div>
            <div className="text-[11px] text-ink-400 font-mono mt-1">
              billed ${fmtUSD(tier.yearly)} annually
            </div>
          </>
        ) : (
          <div className="text-3xl font-display text-cy-100">
            ${fmtUSD(price)}
            <span className="text-base text-ink-300 font-mono"> / mo</span>
          </div>
        )}
      </div>

      <CtaButton tier={tier} />

      <ul className="mt-6 space-y-2 text-sm text-ink-200">
        {tier.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <span className="text-cy-300 mt-0.5">✓</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Locale-stable USD formatter.
 *  toLocaleString() picks up the runtime locale on the client (e.g. ru-RU
 *  uses a narrow non-breaking space) while Node renders en-US by default,
 *  which causes a React hydration mismatch on the pricing card. Hard-code
 *  en-US thousand separators here so server and client always agree. */
function fmtUSD(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  const sign = v < 0 ? "-" : "";
  const n = Math.abs(Math.trunc(v));
  return sign + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function CtaButton({ tier }: { tier: Tier }) {
  const isExternal = tier.cta.href.startsWith("mailto:") || tier.cta.href.startsWith("http");
  const cls = tier.featured ? "btn-primary w-full" : "btn w-full";
  if (isExternal) {
    return <a href={tier.cta.href} className={cls}>{tier.cta.label}</a>;
  }
  return <Link href={tier.cta.href} className={cls}>{tier.cta.label}</Link>;
}

function FragmentRows({ section }: { section: typeof COMPARE[number] }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pt-5 pb-2 px-4 text-cy-400 text-[11px] uppercase tracking-widest">
          {section.section}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.label} className="border-t border-cy-900/40">
          <td className="py-2 px-4 text-ink-200">{row.label}</td>
          {row.values.map((v, i) => (
            <td key={i} className={clsx(
              "py-2 px-4 font-mono",
              v === "—" ? "text-ink-500" : "text-cy-200",
            )}>
              {v}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

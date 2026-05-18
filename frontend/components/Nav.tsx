"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/arena", label: "Attack Arena" },
  { href: "/genome", label: "Attack Genome" },
  { href: "/defense", label: "Defense Core" },
  { href: "/threats", label: "Threat Intel" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/reports", label: "Reports" },
  { href: "/pricing", label: "Pricing" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-cy-900/60 bg-bg-950/80 backdrop-blur-md">
      <div className="px-6 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cy-300 to-cy-700 shadow-glow animate-pulseGlow" />
          <span className="font-display font-semibold tracking-wider text-cy-100">
            CHIMERA
          </span>
          <span className="chip ml-2">v0.1 · live</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {ITEMS.map((it) => {
            const active = path === it.href || (it.href !== "/" && path?.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={clsx(
                  "px-3 py-1.5 rounded-md font-mono uppercase tracking-wider text-xs transition",
                  active
                    ? "bg-cy-900/60 text-cy-100 shadow-glow"
                    : "text-ink-300 hover:text-cy-100"
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip">tenant · trial</span>
          <span className="chip">LT-CORE · active</span>
        </div>
      </div>
    </header>
  );
}

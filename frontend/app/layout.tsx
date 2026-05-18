import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "CHIMERA — Autonomous AI Red Team",
  description:
    "The autonomous immune system for enterprise AI agents. AI-vs-AI adversarial intelligence at frontier scale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grid-bg">
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="py-6 px-8 border-t border-cy-900/40 text-[11px] font-mono text-ink-400 flex justify-between">
            <span>CHIMERA · v0.1 · sandboxed targets only</span>
            <span>© Adversaria Labs — all rights reserved</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

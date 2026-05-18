"use client";
import { motion } from "framer-motion";

export function Stat({
  label, value, accent = "cy",
}: { label: string; value: string | number; accent?: "cy" | "danger" | "warn" }) {
  const color =
    accent === "danger" ? "text-danger-500" :
    accent === "warn"   ? "text-warn-500"   : "text-cy-100";
  return (
    <motion.div
      className="stat"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="stat-label">{label}</div>
      <div className={`stat-num ${color}`}>{value}</div>
    </motion.div>
  );
}

export function PulseDot({ tone = "cy" }: { tone?: "cy" | "danger" | "warn" }) {
  const c = tone === "danger" ? "bg-danger-500" : tone === "warn" ? "bg-warn-500" : "bg-cy-300";
  return (
    <span className="relative inline-flex w-2 h-2">
      <span className={`absolute inset-0 rounded-full ${c} animate-ping opacity-70`} />
      <span className={`relative rounded-full w-2 h-2 ${c}`} />
    </span>
  );
}

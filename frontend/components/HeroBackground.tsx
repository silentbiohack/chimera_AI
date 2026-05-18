"use client";
import { useEffect, useRef } from "react";

/**
 * A canvas of slowly drifting "neural" nodes wired with thin glowing lines.
 * Deliberately minimal (no Three.js dependency at first paint) so the
 * landing page hits TTI fast.
 *
 * Pauses while the tab is hidden (no wasted battery) and rescales positions
 * proportionally on resize so the field doesn't snap to a corner.
 */
export default function HeroBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let raf = 0;
    let running = true;

    const sizeCanvas = (): { w: number; h: number } => {
      const w = Math.max(1, canvas.offsetWidth) * dpr;
      const h = Math.max(1, canvas.offsetHeight) * dpr;
      canvas.width = w;
      canvas.height = h;
      return { w, h };
    };

    let { w, h } = sizeCanvas();
    const N = 70;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      hostile: Math.random() < 0.18,
    }));

    const onResize = () => {
      const oldW = w, oldH = h;
      const sized = sizeCanvas();
      w = sized.w; h = sized.h;
      if (oldW > 0 && oldH > 0) {
        // Proportional remap so the field doesn't clip to a corner.
        const sx = w / oldW, sy = h / oldH;
        for (const n of nodes) { n.x *= sx; n.y *= sy; }
      }
    };
    window.addEventListener("resize", onResize);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      // edges
      const max = 180 * dpr;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < max) {
            const t = 1 - d / max;
            ctx.strokeStyle = a.hostile || b.hostile
              ? `rgba(255, 59, 110, ${0.10 * t})`
              : `rgba(75, 233, 210, ${0.10 * t})`;
            ctx.lineWidth = 0.6 * dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // nodes
      for (const n of nodes) {
        ctx.fillStyle = n.hostile ? "#ff3b6e" : "#4be9d2";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full opacity-70 mix-blend-screen"
    />
  );
}

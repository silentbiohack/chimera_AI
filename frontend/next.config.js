/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  // Static HTML export — every page.tsx becomes a self-contained HTML
  // file under `out/`. FastAPI then serves them as static + handles
  // /api/* and /ws/* in the same process, so we ship the whole product
  // as a single container behind one URL with no CORS surface.
  output: "export",
  // Required for export: Next.js Image optimizer needs a runtime; we
  // don't have one in static mode.
  images: { unoptimized: true },
  // Emit pages as `/arena/index.html` so server-side routing matches the
  // user-visible URL `/arena` regardless of trailing slash.
  trailingSlash: true,
};
module.exports = nextConfig;

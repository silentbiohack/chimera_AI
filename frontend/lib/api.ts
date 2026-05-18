"use client";

const BASE =
  (typeof window !== "undefined" && (window as any).__CHIMERA_API__) ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

const TOKEN_KEY = "chimera.token";

export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  // Build headers via the Headers class so we correctly merge whatever shape
  // the caller passed in (Headers / string[][] / Record<string,string>).
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    // Cap: server errors occasionally include a full HTML stacktrace
    // page (Next.js dev overlay, Sentry capture, etc.). Surfacing
    // megabytes of HTML into an Error message clogs DevTools and
    // overflows the in-app error banners we render verbatim.
    const text = raw.length > 600 ? raw.slice(0, 600) + "…" : raw;
    throw new Error(`${res.status} ${res.statusText} :: ${text || path}`);
  }
  if (res.status === 204) return undefined as T;
  // Defensive: some endpoints return 200 with empty body (e.g. when a
  // proxy strips content). Trying to parse "" as JSON throws.
  const body = await res.text();
  if (!body) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`invalid JSON from ${path}`);
  }
}

export const apiBase = BASE;

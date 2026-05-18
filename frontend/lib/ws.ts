"use client";
import { api, getToken } from "./api";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE ||
  (typeof window !== "undefined"
    ? `ws://${window.location.hostname}:8000`
    : "ws://localhost:8000");

export type ArenaConnection = {
  /** Close the connection and stop reconnect attempts. */
  close: () => void;
  /** Current state: connecting → open → reconnecting → closed. */
  getStatus: () => "connecting" | "open" | "reconnecting" | "closed";
};

type Options = {
  onEvent: (e: any) => void;
  onStatus?: (s: "connecting" | "open" | "reconnecting" | "closed", err?: string) => void;
};

/**
 * Connects to the arena event stream with auto-reconnect and exponential
 * backoff. The bearer token is mintable via /auth/ws-token (short-lived,
 * scope=ws) so a leak via proxy logs / Referer can't be replayed against REST.
 *
 * Reconnect strategy: jittered exponential backoff capped at 30s. Stops
 * permanently on auth failure (no token in localStorage) or when caller calls
 * close().
 */
export function connectArena(opts: Options | ((e: any) => void)): ArenaConnection {
  const onEvent = typeof opts === "function" ? opts : opts.onEvent;
  const onStatus = typeof opts === "function" ? undefined : opts.onStatus;

  let status: "connecting" | "open" | "reconnecting" | "closed" = "connecting";
  let ws: WebSocket | null = null;
  let hb: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let stopped = false;

  const setStatus = (s: typeof status, err?: string) => {
    status = s;
    onStatus?.(s, err);
  };

  const clearHb = () => {
    if (hb) { clearInterval(hb); hb = null; }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    setStatus("reconnecting");
    // exp backoff: 500ms, 1s, 2s, 4s, 8s, 16s, 30s (cap), with ±25% jitter.
    const base = Math.min(30000, 500 * 2 ** Math.min(attempt, 6));
    const jitter = base * (0.75 + Math.random() * 0.5);
    attempt += 1;
    reconnectTimer = setTimeout(connect, jitter);
  };

  const connect = async () => {
    if (stopped) return;
    if (typeof window === "undefined") return;
    if (!getToken()) {
      setStatus("closed", "no auth token");
      stopped = true;
      return;
    }

    setStatus(attempt === 0 ? "connecting" : "reconnecting");

    let wsToken: string;
    try {
      const r = await api<{ token: string }>("/auth/ws-token", { method: "POST" });
      wsToken = r.token;
    } catch (e: any) {
      // 401 → token is dead, don't keep hammering the endpoint.
      if (String(e?.message || "").startsWith("401")) {
        setStatus("closed", "auth expired");
        stopped = true;
        return;
      }
      scheduleReconnect();
      return;
    }

    let sock: WebSocket;
    try {
      sock = new WebSocket(`${WS_BASE}/ws/arena?token=${encodeURIComponent(wsToken)}`);
    } catch {
      scheduleReconnect();
      return;
    }
    ws = sock;

    sock.onopen = () => {
      attempt = 0;
      setStatus("open");
      clearHb();
      hb = setInterval(() => {
        if (sock.readyState === sock.OPEN) {
          try { sock.send("ping"); } catch { /* fall through to onclose */ }
        }
      }, 15000);
    };

    sock.onmessage = (m) => {
      let parsed: any;
      try { parsed = JSON.parse(m.data); } catch { return; }
      try { onEvent(parsed); } catch (err) {
        // A consumer exception must not kill the stream. Log and move on.
        console.error("[ws] consumer threw:", err);
      }
    };

    sock.onerror = () => {
      // onclose always fires after onerror — let it handle reconnect.
      clearHb();
    };

    sock.onclose = () => {
      clearHb();
      ws = null;
      if (!stopped) scheduleReconnect();
    };
  };

  connect();

  return {
    close: () => {
      stopped = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      clearHb();
      if (ws) {
        try { ws.close(); } catch {}
        ws = null;
      }
      setStatus("closed");
    },
    getStatus: () => status,
  };
}

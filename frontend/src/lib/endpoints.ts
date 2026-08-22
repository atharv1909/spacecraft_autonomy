// src/lib/endpoints.ts
//
// Where the Python mission-control server lives.
//
// In local development the API is proxied through the Vite dev server, so
// same-origin is correct and nothing needs configuring. In a split deployment
// — static frontend on one host, the stateful FastAPI server on another —
// `VITE_API_BASE` points at the backend origin and both HTTP and WebSocket
// URLs are derived from it, so there is one value to set rather than two that
// can disagree.

const configured = (import.meta.env["VITE_API_BASE"] as string | undefined)?.trim();

/** Origin for all `/api/...` calls, without a trailing slash. */
export const API_BASE: string = configured
  ? configured.replace(/\/+$/, "")
  : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8000";

/**
 * Live telemetry socket.
 *
 * Derived from API_BASE rather than configured separately: a WebSocket that
 * points somewhere other than the API is a failure mode with no upside, and
 * the scheme has to track http/https or the browser blocks the upgrade on a
 * secure page.
 */
export const WS_URL: string = (() => {
  if (API_BASE.startsWith("https://")) return `wss://${API_BASE.slice("https://".length)}/ws`;
  if (API_BASE.startsWith("http://")) return `ws://${API_BASE.slice("http://".length)}/ws`;
  return "ws://localhost:8000/ws";
})();

/** True when the frontend is talking to a backend on another origin. */
export const IS_SPLIT_DEPLOYMENT: boolean =
  typeof window !== "undefined" && Boolean(configured) && !API_BASE.startsWith(window.location.origin);

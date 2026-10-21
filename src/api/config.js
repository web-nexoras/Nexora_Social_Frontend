const configuredApiUrl =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const isLoopback = (hostname) =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());

// Keep browser requests same-origin in development. This lets desktop and
// phone browsers use the Vite proxy even when the API is hosted remotely and
// does not allow the phone's changing LAN origin in CORS.
export const USE_DEV_API_PROXY = Boolean(import.meta.env.DEV);

function resolveApiBaseUrl() {
  try {
    const apiUrl = new URL(configuredApiUrl, window.location.origin);
    // In dev, send loopback API calls through Vite so phones can use the PC's
    // LAN address without trying to resolve localhost on the phone itself.
    if (USE_DEV_API_PROXY) {
      return new URL(apiUrl.pathname, window.location.origin).toString().replace(/\/$/, "");
    }

    return apiUrl.toString().replace(/\/$/, "");
  } catch {
    return configuredApiUrl;
  }
}

export const API_BASE_URL = resolveApiBaseUrl();
export const SOCKET_URL = USE_DEV_API_PROXY
  ? window.location.origin
  : API_BASE_URL.replace(/\/api\/v1\/?$/i, "");

// WebRTC ICE servers for calls. Add a TURN server via env for cross-network
// calls (same-WiFi works on STUN alone; mobile data / different networks NEED
// TURN). Set VITE_TURN_URL (+ VITE_TURN_USERNAME / VITE_TURN_PASSWORD) in .env.
export const ICE_SERVERS = (() => {
  const servers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME || "",
      credential: import.meta.env.VITE_TURN_PASSWORD || "",
    });
  }
  return servers;
})();

const configuredApiUrl =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const isLoopback = (hostname) =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());

export const USE_DEV_API_PROXY = (() => {
  try {
    return import.meta.env.DEV && isLoopback(new URL(configuredApiUrl).hostname);
  } catch {
    return false;
  }
})();

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

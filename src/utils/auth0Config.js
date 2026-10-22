// Auth0 is configured through Vite env vars only (never hardcoded secrets).
// The dashboard often stores the domain with a protocol or a trailing slash;
// normalize it so the SDK always receives a bare hostname.
export const AUTH0_DOMAIN = (import.meta.env.VITE_AUTH0_DOMAIN || "")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");

export const AUTH0_CLIENT_ID = (import.meta.env.VITE_AUTH0_CLIENT_ID || "").trim();

export const isAuth0Configured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

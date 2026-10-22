import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { Auth0Context, Auth0Provider, initialContext } from "@auth0/auth0-react";

// Auth0 expects a bare domain (without protocol or trailing slash). Normalize
// common dashboard/env formats so a harmless formatting difference cannot
// crash provider initialization on any device.
const auth0Domain = (import.meta.env.VITE_AUTH0_DOMAIN || "")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");
const auth0ClientId = (import.meta.env.VITE_AUTH0_CLIENT_ID || "").trim();
// Audience must be a clean URL — Vercel env vars often get a pasted
// trailing newline (%0A) which makes /authorize return 404.
const auth0Audience = (import.meta.env.VITE_AUTH0_AUDIENCE || "").replace(
  /\s+/g,
  ""
);
const auth0Configured = Boolean(auth0Domain && auth0ClientId);
const app = <App />;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {auth0Configured ? (
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{
          redirect_uri: window.location.origin + "/auth/callback",
          ...(auth0Audience ? { audience: auth0Audience } : {}),
        }}
      >
        {app}
      </Auth0Provider>
    ) : (
      <Auth0Context.Provider value={initialContext}>
        {app}
      </Auth0Context.Provider>
    )}
  </React.StrictMode>
);

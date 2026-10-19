import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { Auth0Context, Auth0Provider, initialContext } from "@auth0/auth0-react";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
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
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
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

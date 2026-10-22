import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { Auth0Context, Auth0Provider, initialContext } from "@auth0/auth0-react";
import { AUTH0_CLIENT_ID, AUTH0_DOMAIN, isAuth0Configured } from "./utils/auth0Config";

const app = <App />;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAuth0Configured ? (
      <Auth0Provider
        domain={AUTH0_DOMAIN}
        clientId={AUTH0_CLIENT_ID}
        authorizationParams={{ redirect_uri: window.location.origin }}
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

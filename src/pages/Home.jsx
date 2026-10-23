import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/PageLoader";
import { hasAuth0CallbackParams } from "../utils/auth0Callback";
import { isAuth0Configured } from "../utils/auth0Config";

export default function Home() {
  const { user, loading } = useAuth();

  // "Never redirect away from an Auth0 callback." The provider returns to "/"
  // with ?code=&state= and the SDK needs to read that URL. Rendering the guest
  // redirect here would replace the URL with /signin before the exchange runs.
  if (isAuth0Configured && hasAuth0CallbackParams()) {
    return <PageLoader />;
  }

  // While the auth session resolves, show ONLY the skeleton. This route lives
  // outside PublicLayout, so the navbar (Sign In / Sign Up) never flashes
  // before the user lands on /signin.
  if (loading) {
    return <PageLoader />;
  }

  // Guests go straight to the Sign In page; logged-in users land on the FEED
  return <Navigate to={user ? "/feed" : "/signin"} replace />;
}

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Skeleton from "../components/Skeleton";
import { hasAuth0CallbackParams } from "../utils/auth0Callback";
import { isAuth0Configured } from "../utils/auth0Config";

export default function Home() {
  const { user, loading } = useAuth();

  // "Never redirect away from an Auth0 callback." The provider returns to "/"
  // with ?code=&state= and the SDK needs to read that URL. Rendering the guest
  // redirect here would replace the URL with /signin before the exchange runs.
  if (isAuth0Configured && hasAuth0CallbackParams()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-5/6" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>
    );
  }

  if (loading) {
    // Lightweight skeleton while the auth session resolves (no full-screen loader)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-5/6" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      </div>
    );
  }

  // Guests go straight to the Sign In page; logged-in users land on the FEED
  return <Navigate to={user ? "/feed" : "/signin"} replace />;
}

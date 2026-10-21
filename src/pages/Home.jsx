import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Skeleton from "../components/Skeleton";

export default function Home() {
  const { user, loading } = useAuth();

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

  // Guests go straight to the Sign In page
  return <Navigate to={user ? "/dashboard" : "/signin"} replace />;
}

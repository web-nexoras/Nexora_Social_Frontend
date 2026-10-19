import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingState from "./LoadingState";
import { hasShownInitialLoader } from "../utils/initialLoader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return hasShownInitialLoader() ? (
      <div className="flex min-h-[24vh] items-center justify-center" role="status" aria-label="Checking your session">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    ) : <LoadingState label="Checking your session..." />;
  }

  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

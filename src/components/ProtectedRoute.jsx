import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "./PageLoader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Same full-screen skeleton as every other loading state so the user never
  // sees a flash of the app chrome before auth finishes resolving.
  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InlineLoader from "./InlineLoader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <InlineLoader label="Checking your session..." />;
  }

  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

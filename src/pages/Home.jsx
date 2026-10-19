import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingState from "../components/LoadingState";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState label="Getting things ready..." />;
  }

  // Guests go straight to the Sign In page
  return <Navigate to={user ? "/dashboard" : "/signin"} replace />;
}

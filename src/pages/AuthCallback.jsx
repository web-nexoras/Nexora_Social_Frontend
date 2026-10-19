import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthShell from "../components/AuthShell";

export default function AuthCallback() {
  const { isAuthenticated, getIdTokenClaims, isLoading, error } = useAuth0();
  const { oauthLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    if (isLoading) return;

    if (error) {
      setStatus("Auth0 error: " + error.message);
      showToast("Auth0 login failed: " + error.message, "error");
      const t = setTimeout(() => navigate("/login"), 3000);
      return () => clearTimeout(t);
    }

    if (!isAuthenticated) {
      // Not authenticated and not loading — redirect to login
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const claims = await getIdTokenClaims();
        const idToken = claims?.__raw;
        if (!idToken) throw new Error("No ID token received from Auth0");

        const data = await oauthLogin(idToken);
        if (cancelled) return;

        if (data?.pending) {
          setStatus("Account created. Pending admin approval.");
          showToast("Account created. Pending admin approval.", "info", 6000);
          setTimeout(() => navigate("/login"), 3000);
        } else {
          showToast("Signed in successfully! Welcome back.", "success");
          navigate("/dashboard");
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.response?.data?.message || "OAuth login failed. Try again.";
        const isPending = err?.response?.data?.pending;
        setStatus(msg);
        showToast(msg, isPending ? "info" : "error", 6000);
        setTimeout(() => navigate("/login"), 3000);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, error]);

  return (
    <AuthShell title="Signing in..." subtitle={status}>
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand"></div>
      </div>
    </AuthShell>
  );
}

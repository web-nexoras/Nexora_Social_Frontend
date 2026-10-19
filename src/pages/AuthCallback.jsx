import React, { useEffect, useRef, useState } from "react";
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
  const oauthExchange = useRef(null);

  useEffect(() => {
    const auth0Configured = Boolean(
      import.meta.env.VITE_AUTH0_DOMAIN?.trim() && import.meta.env.VITE_AUTH0_CLIENT_ID?.trim(),
    );
    if (!auth0Configured) {
      navigate("/signin", { replace: true });
      return;
    }

    if (isLoading) return;

    if (error) {
      setStatus("Auth0 error: " + error.message);
      showToast("Auth0 login failed: " + error.message, "error");
      const t = setTimeout(() => navigate("/signin"), 3000);
      return () => clearTimeout(t);
    }

    if (!isAuthenticated) {
      // Not authenticated and not loading — redirect to login
      navigate("/signin", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Reuse the same exchange across React StrictMode's development effect replay.
        if (!oauthExchange.current) {
          oauthExchange.current = (async () => {
            const claims = await getIdTokenClaims();
            const idToken = claims?.__raw;
            if (!idToken) throw new Error("No ID token received from Auth0");
            return oauthLogin(idToken);
          })();
        }

        const data = await oauthExchange.current;
        if (cancelled) return;

        if (data?.pending) {
          setStatus("Account created. Pending admin approval.");
          showToast("Account created. Pending admin approval.", "info", 6000);
          setTimeout(() => navigate("/signin"), 3000);
        } else {
          showToast("Signed in successfully! Welcome back.", "success");
          navigate("/dashboard");
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.response?.data?.message ||
          (err?.code === "ERR_NETWORK" || !err?.response
            ? "Could not connect to the server. Check your connection and try again."
            : "OAuth login failed. Try again.");
        const isPending = err?.response?.data?.pending;
        setStatus(msg);
        showToast(msg, isPending ? "info" : "error", 6000);
        setTimeout(() => navigate("/signin"), 3000);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, error]);

  return (
    <AuthShell title="Signing in..." subtitle={status}>
      <div className="flex items-center justify-center py-3" role="status" aria-label={status}>
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    </AuthShell>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthShell from "../components/AuthShell";
import { isAuth0Configured } from "../utils/auth0Config";
import { readAuth0UrlError } from "../utils/auth0Callback";
import { describeAuth0UrlError, describeOAuthFailure } from "../utils/oauthErrors";

const PENDING_MESSAGE =
  "Your account is awaiting admin approval. You can sign in once an administrator approves it.";

export default function AuthCallback() {
  let auth0 = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth0 = useAuth0();
  } catch {
    auth0 = null;
  }
  const isAuthenticated = auth0?.isAuthenticated ?? false;
  const isLoading = auth0?.isLoading ?? false;
  const error = auth0?.error ?? null;
  const getIdTokenClaims = auth0?.getIdTokenClaims;
  const { oauthLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Signing you in...");
  const exchange = useRef(null);
  const reported = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    if (!isAuth0Configured) {
      navigate("/signin", { replace: true });
      return;
    }

    // Auth0 puts failures in the URL (error / error_description) instead of a
    // code. Explain them instead of spinning forever.
    const urlError = readAuth0UrlError();
    if (urlError) {
      const message = describeAuth0UrlError(urlError.error, urlError.description);
      if (!reported.current) {
        reported.current = true;
        setStatus(message);
        showToast(message, "error", 8000);
      }
      const timer = setTimeout(
        () => navigate("/signin", { replace: true, state: { oauthError: message } }),
        3500,
      );
      return () => clearTimeout(timer);
    }

    if (isLoading) return;

    if (error) {
      const message = describeAuth0UrlError(
        error.error || error.name,
        error.error_description || error.message,
      );
      setStatus(message);
      if (!reported.current) {
        reported.current = true;
        showToast(message, "error", 8000);
      }
      const timer = setTimeout(
        () => navigate("/signin", { replace: true, state: { oauthError: message } }),
        3500,
      );
      return () => clearTimeout(timer);
    }

    if (!isAuthenticated) {
      navigate("/signin", { replace: true });
      return;
    }

    if (finished.current) return;
    finished.current = true;

    let cancelled = false;
    let timer;

    // Auth0 provider is not mounted — there is nothing to exchange here.
    if (typeof getIdTokenClaims !== "function") {
      navigate("/signin", { replace: true });
      return;
    }

    (async () => {
      try {
        // Reuse the same exchange across React StrictMode's development effect replay.
        if (!exchange.current) {
          exchange.current = (async () => {
            const claims = await getIdTokenClaims();
            const idToken = claims?.__raw;
            if (!idToken) throw new Error("No ID token received from Auth0");
            return oauthLogin(idToken);
          })();
        }

        const data = await exchange.current;
        if (cancelled) return;

        if (data?.pending) {
          setStatus(PENDING_MESSAGE);
          showToast(PENDING_MESSAGE, "info", 8000);
          timer = setTimeout(
            () =>
              navigate("/signin", {
                replace: true,
                state: { oauthError: PENDING_MESSAGE, oauthPending: true },
              }),
            3000,
          );
        } else {
          showToast("Signed in successfully! Welcome back.", "success");
          navigate("/feed", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        const { message, tone } = describeOAuthFailure(err);
        setStatus(message);
        showToast(message, tone, 8000);
        timer = setTimeout(
          () => navigate("/signin", { replace: true, state: { oauthError: message } }),
          3500,
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, isLoading, error, getIdTokenClaims, navigate, oauthLogin, showToast]);

  return (
    <AuthShell title="Signing in..." subtitle={status}>
      <div className="flex items-center justify-center py-3" role="status" aria-label={status}>
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    </AuthShell>
  );
}

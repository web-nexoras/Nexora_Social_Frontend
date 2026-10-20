import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "../context/ToastContext";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { login } = useAuth();
  const { loginWithRedirect, isLoading: auth0Loading } = useAuth0();
  const auth0Configured = Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN?.trim() && import.meta.env.VITE_AUTH0_CLIENT_ID?.trim(),
  );
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!password) {
      errors.password = "Password is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setGeneralError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      showToast("Signed in successfully! Welcome back.", "success");
      navigate("/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.message ||
        (err?.code === "ERR_NETWORK" || !err?.response
          ? "Cannot connect to the server. Check your connection and try again."
          : "Invalid email or password");
      const isPending = msg.toLowerCase().includes("waiting for admin approval") || msg.toLowerCase().includes("pending");
      const isRejected = msg.toLowerCase().includes("rejected");

      if (isPending) {
        setGeneralError("Your account has been registered and verified, but is currently awaiting admin approval. You will be able to log in once an administrator approves your account.");
        showToast("Account pending admin approval.", "warning", 6000);
      } else if (isRejected) {
        setGeneralError("Your account was rejected by the administrator. Contact support for assistance.");
        showToast("Account rejected by administrator.", "error", 6000);
      } else if (msg.toLowerCase().includes("invalid")) {
        setGeneralError("Invalid email or password");
        showToast("Invalid email or password", "error");
      } else {
        setGeneralError(msg);
        showToast(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const startSocialLogin = async (connection) => {
    setGeneralError("");
    if (!auth0Configured) {
      const message = "Social sign-in is not configured for this app. Add the Auth0 domain and client ID, then restart or redeploy.";
      setGeneralError(message);
      showToast(message, "error");
      return;
    }
    if (auth0Loading) {
      const message = "Social sign-in is still initializing. Please try again in a moment.";
      setGeneralError(message);
      showToast(message, "info");
      return;
    }

    setSocialLoading(true);
    try {
      await loginWithRedirect({ authorizationParams: { connection } });
    } catch (err) {
      const message = err?.message || "Could not start social sign-in. Please try again.";
      setGeneralError(message);
      showToast(message, "error");
      setSocialLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign In"
      subtitle="Nexora Social is a realtime social platform — connect with friends, chat instantly, and unlock premium groups with secure subscriptions."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-brand font-semibold hover:underline">
            Sign Up
          </Link>
        </>
      }
    >
      {generalError && (
        <div className="text-rose-600 text-sm mb-4 text-center bg-rose-50 border border-rose-200 rounded-xl py-2.5 px-3.5 leading-relaxed">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on" noValidate>
        {/* Email */}
        <div className="space-y-1">
          {fieldErrors.email && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.email}</p>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
              if (generalError) setGeneralError("");
            }}
            autoComplete="email"
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm transition ${
              fieldErrors.email ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>

        {/* Password */}
        <PasswordInput
          name="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }));
            if (generalError) setGeneralError("");
          }}
          placeholder="Password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />

        <div className="flex items-center justify-between text-xs px-1">
          <Link to="/forgot-password" className="text-brand font-medium hover:underline">
            Forgot password?
          </Link>
          <Link to="/reset-password" className="text-slate-500 hover:text-brand hover:underline">
            Reset password
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-black text-sm font-semibold neo-btn disabled:opacity-60 transition shadow-md hover:shadow-lg"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="hidden lg:block">
          <div className="flex justify-center text-xs my-2">
            <span className="text-slate-400">or continue with</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={socialLoading}
            aria-busy={socialLoading}
            onClick={() => startSocialLogin("google-oauth2")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>
          <button
            type="button"
            disabled={socialLoading}
            aria-busy={socialLoading}
            onClick={() => startSocialLogin("github")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </button>
          </div>
          {!auth0Configured && (
            <p className="mt-3 text-center text-xs text-slate-500" role="status">
              Social sign-in is unavailable on this deployment until Auth0 is configured.
            </p>
          )}
        </div>
      </form>
    </AuthShell>
  );
}

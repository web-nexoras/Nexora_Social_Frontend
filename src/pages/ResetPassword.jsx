import React, { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function ResetPassword() {
  const { token: tokenParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(tokenParam || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Per-field errors: shown only on submit, only under the offending field
  const [fieldErrors, setFieldErrors] = useState({ email: "", token: "", password: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const errs = { email: "", token: "", password: "" };
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Please enter a valid email address";
    if (!tokenParam && !token.trim()) errs.token = "Reset token is required";
    if (password.length < 8) errs.password = "Password must be at least 8 characters long";
    setFieldErrors(errs);
    if (errs.email || errs.token || errs.password) return;

    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, email, password);
      setMsg(res.data?.message || "Password reset successfully");
      setTimeout(() => navigate("/signin"), 1500);
    } catch (err) {
      setError(err?.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Set a new password for your Nexora Social account."
      footer={
        <Link to="/signin" className="inline-flex items-center gap-1 text-brand font-semibold hover:underline">
          <FiArrowLeft /> Back to Sign In
        </Link>
      }
    >
      {msg && <p className="text-emerald-600 text-sm mb-4 text-center bg-emerald-50 rounded-xl py-2 px-3">{msg}</p>}
      {error && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          {fieldErrors.email && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.email}</p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
            }}
            autoComplete="email"
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm transition ${
              fieldErrors.email ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>

        {!tokenParam && (
          <div className="space-y-1">
            {fieldErrors.token && (
              <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.token}</p>
            )}
            <input
              placeholder="Reset token (from your email)"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: "" }));
              }}
              className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm transition ${
                fieldErrors.token ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
              }`}
            />
          </div>
        )}

        <PasswordInput
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }));
          }}
          placeholder="New password (min 8)"
          autoComplete="new-password"
          error={fieldErrors.password}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-black text-sm font-semibold neo-btn disabled:opacity-60"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthShell>
  );
}

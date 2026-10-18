import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setDevLink("");
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setMsg(res.data?.message || "If an account exists, a reset link has been sent.");
      // Dev-only: backend exposes the link directly so you don't need a deliverable inbox
      if (res.data?.devResetLink) setDevLink(res.data.devResetLink);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Enter your email and we'll send you a secure link to reset your password."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 text-brand font-semibold hover:underline">
          <FiArrowLeft /> Back to Sign In
        </Link>
      }
    >
      {msg && <p className="text-emerald-600 text-sm mb-4 text-center bg-emerald-50 rounded-xl py-2 px-3">{msg}</p>}
      {error && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}

      {devLink && (
        <div className="mb-4 text-center bg-slate-50 border border-slate-200 rounded-xl py-2 px-3">
          <p className="text-xs text-slate-500 mb-1">Dev reset link (email may not be deliverable):</p>
          <Link to={devLink.replace(/^https?:\/\/[^/]+/, "")} className="inline-flex items-center gap-1 text-brand text-sm font-semibold break-all hover:underline">
            Open reset page <FiArrowRight />
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </AuthShell>
  );
}

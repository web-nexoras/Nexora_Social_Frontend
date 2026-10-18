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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, email, password);
      setMsg(res.data?.message || "Password reset successfully");
      setTimeout(() => navigate("/login"), 1500);
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
        <Link to="/login" className="inline-flex items-center gap-1 text-brand font-semibold hover:underline">
          <FiArrowLeft /> Back to Sign In
        </Link>
      }
    >
      {msg && <p className="text-emerald-600 text-sm mb-4 text-center bg-emerald-50 rounded-xl py-2 px-3">{msg}</p>}
      {error && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}

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

        {!tokenParam && (
          <input
            placeholder="Reset token (from your email)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
            required
          />
        )}

        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min 8)"
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthShell>
  );
}

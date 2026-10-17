import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";

export default function VerifyOtp() {
  const { verifyOtp } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setMsg("Email verified! Your account is now pending admin approval. You can log in once the admin approves you.");
    } catch (err) {
      setError(err?.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setMsg("");
    try {
      await authApi.resendOtp(email);
      setMsg("A new OTP has been sent to your email.");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not resend OTP");
    }
  };

  return (
    <AuthShell
      title="Verify Email"
      subtitle="Enter the 6-digit code we sent to your email to activate your account."
      footer={
        msg ? (
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Go to Sign In →
          </Link>
        ) : (
          <Link to="/signup" className="text-brand font-semibold hover:underline">
            ← Back to Sign Up
          </Link>
        )
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
        <input
          type="text"
          inputMode="numeric"
          placeholder="OTP (6 digits)"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm tracking-widest text-center"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
        <button
          type="button"
          onClick={resend}
          className="w-full py-2 rounded-xl text-brand text-xs font-semibold hover:underline"
        >
          Resend OTP
        </button>
      </form>
    </AuthShell>
  );
}

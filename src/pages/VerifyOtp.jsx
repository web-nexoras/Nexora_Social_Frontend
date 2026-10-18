import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheckCircle } from "react-icons/fi";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";

export default function VerifyOtp() {
  const { verifyOtp } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || "");
  // Per-field errors: shown only on submit, only under the field that's wrong
  const [fieldErrors, setFieldErrors] = useState({ email: "", otp: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    const errs = { email: "", otp: "" };
    if (!email.trim()) errs.email = "Email is required";
    if (!otp.trim()) errs.otp = "OTP code is required";
    else if (otp.trim().length !== 6) errs.otp = "Please enter the complete 6-digit OTP code";
    setFieldErrors(errs);
    if (errs.email || errs.otp) return;

    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setMsg("Email verified successfully! Your account is now pending admin approval. You can log in once an admin approves your account.");
      showToast("Email verified! Account pending admin approval.", "success", 6000);
    } catch (err) {
      const errMsg = err?.response?.data?.message || "OTP verification failed. Check the code and try again.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setMsg("");
    if (!email.trim()) {
      setFieldErrors((p) => ({ ...p, email: "Email is required" }));
      return;
    }
    try {
      const data = await authApi.resendOtp(email);
      if (data?.data?.devOtp) setDevOtp(data.data.devOtp);
      setMsg("A new OTP has been sent to your email.");
      showToast("A new OTP has been sent to your email.", "info");
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Could not resend OTP";
      setError(errMsg);
      showToast(errMsg, "error");
    }
  };

  return (
    <AuthShell
      title="Verify Email"
      subtitle="Enter the 6-digit code we sent to your email to activate your account."
      footer={
        msg ? (
          <Link to="/login" className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline">
            Go to Sign In <FiArrowRight />
          </Link>
        ) : (
          <Link to="/signup" className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline">
            <FiArrowLeft /> Back to Sign Up
          </Link>
        )
      }
    >
      {msg && (
        <div className="text-emerald-700 text-sm mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <FiCheckCircle className="text-emerald-500 text-lg shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-semibold text-emerald-800">Email Verified!</p>
            <p className="text-xs text-emerald-600 mt-1">{msg}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="text-rose-600 text-sm mb-4 text-center bg-rose-50 border border-rose-200 rounded-xl py-2.5 px-3">
          {error}
        </div>
      )}

      {devOtp && (
        <div className="mb-4 text-center bg-slate-50 border border-slate-200 rounded-xl py-2 px-3">
          <p className="text-xs text-slate-500 mb-1">Dev OTP (for testing without email):</p>
          <button
            type="button"
            onClick={() => setOtp(devOtp)}
            className="inline-flex items-center gap-1 text-brand text-lg font-bold tracking-widest hover:underline"
          >
            {devOtp} — tap to fill <FiArrowRight />
          </button>
        </div>
      )}

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
        <div className="space-y-1">
          {fieldErrors.otp && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.otp}</p>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="OTP (6 digits)"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ""));
              if (fieldErrors.otp) setFieldErrors((p) => ({ ...p, otp: "" }));
            }}
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm tracking-widest text-center font-mono font-semibold transition ${
              fieldErrors.otp ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60 transition shadow-md hover:shadow-lg"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
        <button
          type="button"
          onClick={resend}
          className="w-full py-2 rounded-xl text-brand text-xs font-semibold hover:underline transition"
        >
          Resend OTP
        </button>
      </form>
    </AuthShell>
  );
}

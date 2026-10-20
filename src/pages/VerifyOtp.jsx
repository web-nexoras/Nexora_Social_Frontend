import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";

export default function VerifyOtp() {
  const { verifyOtp } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [email] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!email.trim()) {
      setError("Email not found. Please sign up again.");
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP code");
      return;
    }
    setOtpError("");

    setLoading(true);
    try {
      await verifyOtp(email, otp);
      showToast("Email verified. Your account is pending admin approval.", "success", 6000);
      setTimeout(() => navigate("/signin"), 1500);
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
    if (!email) {
      setError("Email not found. Please sign up again.");
      return;
    }
    try {
      await authApi.resendOtp(email);
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
          <Link to="/signin" className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline">
            Go to Sign In <FiArrowRight />
          </Link>
        ) : (
          <Link to="/signup" className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline">
            <FiArrowLeft /> Back to Sign Up
          </Link>
        )
      }
    >
      {error && (
        <div className="text-rose-600 text-sm mb-4 text-center bg-rose-50 border border-rose-200 rounded-xl py-2.5 px-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          {otpError && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{otpError}</p>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="OTP (6 digits)"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ""));
              if (otpError) setOtpError("");
            }}
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm tracking-widest text-center font-mono font-semibold transition ${
              otpError ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-black text-sm font-semibold neo-btn disabled:opacity-60 transition shadow-md hover:shadow-lg"
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

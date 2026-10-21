import React, { useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiMail } from "react-icons/fi";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";

const OTP_LEN = 6;

export default function VerifyOtp() {
  const { verifyOtp } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [email] = useState(location.state?.email || "");
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(""));
  const [otpError, setOtpError] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputsRef = useRef([]);

  const code = digits.join("");

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 480);
  };

  const focusAt = (i) => {
    const el = inputsRef.current[i];
    if (el) el.focus();
  };

  const setDigit = (i, val) => {
    const clean = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    if (otpError) setOtpError("");
  };

  const handleChange = (i, val) => {
    // paste or fast typing can deliver multiple chars — fill forward
    const chars = val.replace(/\D/g, "").split("").slice(-(OTP_LEN - i));
    if (!chars.length || !chars[0]) {
      setDigit(i, "");
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => { next[i + k] = c; });
      return next;
    });
    if (otpError) setOtpError("");
    const target = Math.min(i + chars.length, OTP_LEN - 1);
    focusAt(target);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setDigit(i, "");
      } else if (i > 0) {
        setDigit(i - 1, "");
        focusAt(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") || "";
    const chars = pasted.replace(/\D/g, "").split("").slice(0, OTP_LEN);
    if (!chars.length) return;
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => { next[k] = c; });
      return next;
    });
    if (otpError) setOtpError("");
    focusAt(Math.min(chars.length, OTP_LEN - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!email.trim()) {
      setError("Email not found. Please sign up again.");
      return;
    }
    if (code.length !== OTP_LEN) {
      setOtpError("Please enter the complete 6-digit OTP code");
      triggerShake();
      focusAt(digits.findIndex((d) => !d) < 0 ? 0 : digits.findIndex((d) => !d));
      return;
    }
    setOtpError("");

    setLoading(true);
    try {
      await verifyOtp(email, code);
      showToast("Email verified. Your account is pending admin approval.", "success", 6000);
      setTimeout(() => navigate("/signin"), 1500);
    } catch (err) {
      const errMsg = err?.response?.data?.message || "OTP verification failed. Check the code and try again.";
      setError(errMsg);
      showToast(errMsg, "error");
      triggerShake();
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

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Floating 3D mail badge */}
        <div className="flex justify-center pt-1 pb-0.5" style={{ perspective: "600px" }}>
          <div className="otp-float w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-indigo-600 flex items-center justify-center shadow-[0_14px_28px_rgba(30,41,59,0.35),0_4px_10px_rgba(99,102,241,0.3)]">
            <FiMail size={26} className="text-white" />
          </div>
        </div>

        {/* 3D keypad — 6 pressed-in slots, digit pops out on fill */}
        <div className={shake ? "otp-shake" : ""}>
          {otpError && (
            <p className="mb-2 px-1 text-rose-700 text-xs font-bold text-center">{otpError}</p>
          )}
          <div className="flex justify-center gap-2 sm:gap-2.5" style={{ perspective: "800px" }}>
            {digits.map((d, i) => (
              <div key={i} className="otp-tilt">
                <input
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={OTP_LEN}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                  disabled={loading}
                  aria-label={`OTP digit ${i + 1}`}
                  className={`otp-slot ${d ? "filled" : ""} ${otpError ? "err" : ""} w-11 h-14 sm:w-12 sm:h-16 rounded-2xl text-center text-xl sm:text-2xl font-extrabold otp-digit cursor-text disabled:opacity-60`}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold shadow-[0_8px_18px_rgba(30,41,59,0.3)] hover:shadow-[0_12px_24px_rgba(30,41,59,0.38)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_4px_10px_rgba(30,41,59,0.3)] disabled:opacity-60 disabled:hover:translate-y-0 transition-all duration-150"
        >
          {loading ? "Verifying..." : `Verify${code.length === OTP_LEN ? ` ${code}` : " OTP"}`}
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

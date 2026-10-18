import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

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
      await login(email, password);
      showToast("Signed in successfully! Welcome back.", "success");
      navigate("/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.message || "Invalid email or password";
      const isPending = msg.toLowerCase().includes("waiting for admin approval") || msg.toLowerCase().includes("pending");
      const isRejected = msg.toLowerCase().includes("rejected");

      if (isPending) {
        setGeneralError("Your account has been registered and verified, but is currently awaiting admin approval. You will be able to log in once an administrator approves your account.");
        showToast("Account pending admin approval.", "warning", 6000);
      } else if (isRejected) {
        setGeneralError("Your account was rejected by the administrator. Contact support for assistance.");
        showToast("Account rejected by administrator.", "error", 6000);
      } else if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("password")) {
        setFieldErrors({
          email: "Please check your email",
          password: "Or check your password",
        });
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
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
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60 transition shadow-md hover:shadow-lg"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
}

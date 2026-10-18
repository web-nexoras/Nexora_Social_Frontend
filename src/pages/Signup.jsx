import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function Signup() {
  const { signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullname: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errors = {};
    if (!form.fullname.trim()) {
      errors.fullname = "Full name is required";
    }
    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!form.password) {
      errors.password = "Password is required";
    } else if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (generalError) setGeneralError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setGeneralError("");
    setLoading(true);

    try {
      const data = await signup(form.fullname, form.email, form.password);
      showToast("Account created successfully! Please verify your email with the OTP.", "success");
      navigate("/verify-otp", { state: { email: form.email, devOtp: data?.devOtp } });
    } catch (err) {
      const msg = err?.response?.data?.message || "Signup failed. Please try again.";
      if (msg.toLowerCase().includes("email already exists")) {
        setFieldErrors((prev) => ({ ...prev, email: "An account with this email already exists" }));
      } else {
        setGeneralError(msg);
      }
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign Up"
      subtitle="Join Nexora Social to connect with friends, chat in realtime, and unlock premium groups."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-brand font-semibold hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      {generalError && (
        <div className="text-rose-500 text-sm mb-4 text-center bg-rose-50 border border-rose-200 rounded-xl py-2.5 px-3 animate-shake">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div className="space-y-1">
          {fieldErrors.fullname && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.fullname}</p>
          )}
          <input
            name="fullname"
            placeholder="Full Name"
            value={form.fullname}
            onChange={handleChange}
            autoComplete="name"
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm transition ${
              fieldErrors.fullname ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          {fieldErrors.email && (
            <p className="mb-px px-1 text-rose-700 text-xs font-bold">{fieldErrors.email}</p>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            className={`w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm transition ${
              fieldErrors.email ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
            }`}
          />
        </div>

        {/* Password */}
        <PasswordInput
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password (min 8 characters)"
          autoComplete="new-password"
          error={fieldErrors.password}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60 transition shadow-md hover:shadow-lg"
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
    </AuthShell>
  );
}

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullname: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await signup(form.fullname, form.email, form.password);
      navigate("/verify-otp", { state: { email: form.email, devOtp: data?.devOtp } });
    } catch (err) {
      setError(err?.response?.data?.message || "Signup failed");
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
      {error && (
        <p className="text-red-500 text-sm mb-4 text-center bg-red-50 rounded-xl py-2 px-3">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="fullname"
          placeholder="Full Name"
          value={form.fullname}
          onChange={handleChange}
          autoComplete="name"
          className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
          required
        />
        <PasswordInput
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password (min 8)"
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold neo-btn disabled:opacity-60"
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
    </AuthShell>
  );
}

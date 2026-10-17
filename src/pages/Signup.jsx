import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
      await signup(form.fullname, form.email, form.password);
      navigate("/verify-otp", { state: { email: form.email } });
    } catch (err) {
      setError(err?.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 mt-10">
      <h1 className="text-3xl font-bold text-brand mb-6 text-center">Create Account</h1>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="fullname" placeholder="Full Name" value={form.fullname} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand" required />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand" required />
        <input name="password" type="password" placeholder="Password (min 6)" value={form.password} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand" required />
        <button type="submit" disabled={loading} className="w-full py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
          {loading ? "Creating..." : "Sign Up"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-4">
        Already have account? <Link to="/login" className="text-brand font-medium">Login</Link>
      </p>
    </div>
  );
}

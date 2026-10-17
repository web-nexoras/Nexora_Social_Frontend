import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ fullname: "", address: "" });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ fullname: user.fullname || "", address: user.address || "" });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("fullname", form.fullname);
      fd.append("address", form.address);
      if (file) fd.append("avatar", file);
      await updateProfile(fd);
      setMsg("Profile updated successfully");
    } catch (err) {
      setMsg(err?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 mt-6">
      <div className="flex items-center gap-6 mb-6">
        <img
          src={user.avatar || "https://via.placeholder.com/96"}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover border-4 border-brand"
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{user.fullname}</h1>
          <p className="text-slate-500">{user.email}</p>
          <p className="text-sm text-slate-400">{user.role}</p>
        </div>
      </div>

      {msg && <p className="text-sm mb-4 text-brand">{msg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          value={form.fullname}
          onChange={(e) => setForm({ ...form, fullname: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
        <input
          type="text"
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiCamera, FiMail, FiMapPin, FiShield, FiUser } from "react-icons/fi";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({ fullname: "", address: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ fullname: user.fullname || "", address: user.address || "" });
      setPreview(user.avatar || null);
    }
  }, [user]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setImgError(false);
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullname.trim()) {
      showToast("Full name cannot be empty", "error");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("fullname", form.fullname);
      fd.append("address", form.address);
      if (file) fd.append("avatar", file);
      await updateProfile(fd);
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      const errMsg = err?.response?.data?.message || "Profile update failed";
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const initials = (user.fullname || "User")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-3xl mx-auto mt-6 px-4 sm:px-0">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Dark Cover banner — clean monochrome gradient */}
        <div className="relative h-40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent"></div>
          <div className="absolute -bottom-24 -right-10 w-80 h-80 rounded-full bg-white/5 blur-3xl"></div>
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-slate-200">
            <FiShield className="text-slate-300" />
            <span className="capitalize">{user.role} Settings</span>
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-6 sm:px-8 pb-8">
          <div className="-mt-14 mb-6">
            {/* Avatar container with photo upload overlay — z-10 so it paints over the banner */}
            <div className="relative z-10 w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-900 shrink-0 group">
              {preview && !imgError ? (
                <img
                  src={preview}
                  alt={user.fullname}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-black tracking-wider">
                  {initials}
                </div>
              )}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs cursor-pointer">
                <FiCamera className="text-lg mb-0.5" />
                Change
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <div className="mt-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{user.fullname}</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <FiMail className="text-slate-400" /> {user.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                  className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Address</label>
              <input
                type="text"
                placeholder="Your address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Profile Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition disabled:opacity-60"
              >
                {loading ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiCamera, FiMail, FiMapPin, FiShield } from "react-icons/fi";

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
    if (form.fullname.trim().length > 80) {
      showToast("Full name must be at most 80 characters", "error");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("fullname", form.fullname.trim());
      fd.append("address", form.address.trim());
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
    <div className="max-w-3xl mx-auto mt-4 sm:mt-6 px-3 sm:px-4 md:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl profile-card overflow-hidden">
        {/* 3D gradient cover — layered radial mesh, slow pan + light sheen */}
        <div className="relative h-32 sm:h-40 md:h-48 profile-cover overflow-hidden">
          <div className="cover-sheen absolute inset-y-0 -left-1/3 w-1/2 pointer-events-none" aria-hidden />
          {/* floating light orbs for depth */}
          <div className="absolute -bottom-16 -right-6 w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-white/5 blur-3xl" aria-hidden />
          <div className="absolute top-4 left-1/3 w-14 h-14 sm:w-24 sm:h-24 rounded-full bg-indigo-400/15 blur-2xl" aria-hidden />
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-slate-200">
            <FiShield className="text-slate-300" />
            <span className="capitalize">{user.role} Settings</span>
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-4 sm:px-6 md:px-8 pb-6 sm:pb-8">
          <div className="-mt-12 sm:-mt-14 mb-5 sm:mb-6">
            <div className="flex items-end gap-3 sm:gap-4">
              {/* Avatar — gradient 3D ring, z-10 paints over the banner */}
              <div className="relative z-10 shrink-0 w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-full p-[3px] bg-gradient-to-br from-indigo-400 via-brand to-indigo-800 shadow-xl">
                <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-900 group">
                  {preview && !imgError ? (
                    <img
                      src={preview}
                      alt={user.fullname}
                      onError={() => setImgError(true)}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 flex items-center justify-center text-white text-xl sm:text-2xl font-black tracking-wider">
                      {initials}
                    </div>
                  )}
                  {/* Desktop: hover overlay. Mobile: always-visible corner badge */}
                  <label className="hidden sm:flex absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex-col items-center justify-center text-white text-xs cursor-pointer">
                    <FiCamera className="text-lg mb-0.5" />
                    Change
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
                {/* Mobile camera badge — centered at the bottom edge, tap to change photo */}
                <label className="sm:hidden absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer">
                  <FiCamera className="text-sm" />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Name + email (sits below avatar, aligned under it) */}
              <div className="min-w-0 pb-1">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight break-words leading-tight">
                  {user.fullname}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-1 min-w-0">
                  <FiMail className="text-slate-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              </div>
            </div>

            {user.address && (
              <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-2 sm:mt-3 px-1">
                <FiMapPin className="text-slate-400 shrink-0" />
                <span className="truncate">{user.address}</span>
              </p>
            )}
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
                  className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-[15px] sm:text-sm"
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
                className="w-full neo-input rounded-xl px-4 py-3 text-slate-700 text-[15px] sm:text-sm"
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
                className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-60"
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

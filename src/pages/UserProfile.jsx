import React, { useEffect, useState } from "react";
import { FiCheck, FiMail, FiMapPin, FiShield, FiUserPlus, FiMessageSquare, FiArrowLeft, FiUser } from "react-icons/fi";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usersApi } from "../api/usersApi";
import { friendsApi } from "../api/friendsApi";
import { useToast } from "../context/ToastContext";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [isSelf, setIsSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.get(id);
      setUser(res.data?.user || null);
      setRelationship(res.data?.relationship || null);
      setIsSelf(!!res.data?.isSelf);
    } catch (e) {
      console.error(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const addFriend = async () => {
    try {
      await friendsApi.sendRequest(id);
      showToast("Friend request sent successfully!", "success");
      setRelationship((prev) => ({ ...(prev || {}), requestSent: true }));
    } catch (e) {
      const errMsg = e?.response?.data?.message || "Could not send friend request";
      showToast(errMsg, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
        <p className="text-slate-500 font-medium mb-4">User not found</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
        >
          <FiArrowLeft /> Go Back
        </button>
      </div>
    );
  }

  const rel = relationship || {};
  const canMessage = rel.isFriend || user.role === "admin" || isSelf;
  const initials = (user.fullname || "User")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-3xl mx-auto mt-6 px-4 sm:px-0">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden transition">
        {/* Cover banner — sleek dark theme matching admin overview */}
        <div className="relative h-44 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 overflow-hidden border-b border-slate-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600/25 via-slate-900/40 to-transparent"></div>
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-slate-200">
            <FiShield className="text-indigo-400" />
            <span className="capitalize">{user.role} Profile</span>
          </div>
        </div>

        {/* Card Content */}
        <div className="px-6 sm:px-8 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 mb-6">
            <div className="flex items-end gap-4">
              {/* Avatar with fallback to clean initials */}
              <div className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-900 shrink-0">
                {user.avatar && !imgError ? (
                  <img
                    src={user.avatar}
                    alt={user.fullname}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 flex items-center justify-center text-white text-2xl font-black tracking-wider">
                    {initials}
                  </div>
                )}
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {user.fullname}
                  </h1>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize border ${
                      user.role === "admin"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  <FiMail className="text-slate-400" /> {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
            <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                <FiUser />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">Role</p>
                <p className="font-semibold text-slate-800 capitalize">{user.role}</p>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                <FiMapPin />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">Address</p>
                <p className="font-semibold text-slate-800">{user.address || "No address provided"}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {isSelf && (
              <Link
                to="/profile"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold hover:shadow-lg transition"
              >
                Edit My Profile
              </Link>
            )}

            {!isSelf && rel.isFriend && (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold">
                <FiCheck className="text-emerald-600 font-bold" /> Friends
              </span>
            )}

            {!isSelf && !rel.isFriend && rel.requestSent && (
              <span className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-sm font-semibold">
                Friend Request Pending
              </span>
            )}

            {!isSelf && !rel.isFriend && rel.requestReceived && (
              <Link
                to="/friends"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 shadow-md transition"
              >
                Respond to Request
              </Link>
            )}

            {!isSelf && !rel.isFriend && !rel.requestSent && !rel.requestReceived && (
              <button
                onClick={addFriend}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand to-indigo-600 text-white text-sm font-semibold hover:shadow-lg transition"
              >
                <FiUserPlus /> Add Friend
              </button>
            )}

            {canMessage && (
              <Link
                to={`/chat?user=${user._id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow-md hover:shadow-lg transition"
              >
                <FiMessageSquare /> Message
              </Link>
            )}

            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition ml-auto"
            >
              <FiArrowLeft /> Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

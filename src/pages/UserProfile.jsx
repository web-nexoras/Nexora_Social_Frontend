import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usersApi } from "../api/usersApi";
import { friendsApi } from "../api/friendsApi";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [isSelf, setIsSelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

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
      setMsg("Friend request sent ✅");
      setRelationship({ ...(relationship || {}), requestSent: true });
    } catch (e) {
      setMsg(e?.response?.data?.message || "Could not send request");
    }
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!user) return <p className="text-center mt-10 text-slate-500">User not found</p>;

  const rel = relationship || {};
  const canMessage = rel.isFriend || user.role === "admin" || isSelf;

  return (
    <div className="max-w-3xl mx-auto mt-6">
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand to-indigo-700" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12">
            <img
              src={user.avatar || "https://via.placeholder.com/96"}
              alt={user.fullname}
              className="w-24 h-24 rounded-full border-4 border-white object-cover bg-slate-200"
            />
            <div className="pb-2">
              <h1 className="text-2xl font-bold text-slate-800">{user.fullname}</h1>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Role</p>
              <p className="font-medium text-slate-700 capitalize">{user.role}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Address</p>
              <p className="font-medium text-slate-700">{user.address || "—"}</p>
            </div>
          </div>

          {msg && <p className="mt-4 text-sm text-brand font-medium">{msg}</p>}

          <div className="flex flex-wrap gap-3 mt-6">
            {isSelf && (
              <Link to="/profile" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">
                Edit Profile
              </Link>
            )}

            {!isSelf && rel.isFriend && (
              <span className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold">✓ Friends</span>
            )}

            {!isSelf && !rel.isFriend && rel.requestSent && (
              <span className="px-4 py-2 rounded-lg bg-slate-100 text-slate-500 font-semibold">Request Sent</span>
            )}

            {!isSelf && !rel.isFriend && rel.requestReceived && (
              <Link to="/friends" className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold hover:bg-cyan-600 transition">
                Respond to Request
              </Link>
            )}

            {!isSelf && !rel.isFriend && !rel.requestSent && !rel.requestReceived && (
              <button onClick={addFriend} className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">
                Add Friend
              </button>
            )}

            {canMessage && (
              <Link to={`/chat?user=${user._id}`} className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 transition">
                Message
              </Link>
            )}

            <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition">
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

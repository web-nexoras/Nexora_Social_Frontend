import React, { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { groupsApi } from "../api/groupsApi";
import { useAuth } from "../context/AuthContext";

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.list();
      setGroups(res.data.groups || []);
    } catch (e) {
      console.error(e);
      setMsg(e?.response?.data?.message || "Could not load groups. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openChat = (g) => {
    const convId = g.conversation?._id || g.conversation;
    if (!convId) {
      setMsg("This group has no chat yet.");
      return;
    }
    navigate(`/chat?conversation=${convId}`);
  };

  if (loading) return <p className="text-center mt-10">Loading groups...</p>;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand">Groups</h1>
        {user?.role === "admin" && (
          <a href="/admin/groups" className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition">
            Admin Panel
          </a>
        )}
      </div>
      {msg && <p className="text-sm text-red-500 mb-4">{msg}</p>}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((g) => (
          <div key={g._id} className="bg-white rounded-2xl shadow p-5 flex flex-col">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{g.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{g.description}</p>
              <p className="text-sm mt-3">
                <span className="font-semibold">Price:</span> {g.price} {g.currency}
              </p>
              {g.isMember && (
                <p className="inline-flex items-center gap-1 text-sm text-slate-600 mt-1">
                  <FiCheck className="text-green-600" /> Member
                </p>
              )}
              {g.membership?.premiumExpiresAt && (
                <p className="text-xs text-slate-400 mt-1">
                  Expires: {new Date(g.membership.premiumExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              {g.isMember ? (
                <button onClick={() => openChat(g)} className="flex-1 px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">
                  Open Chat
                </button>
              ) : (
                <button onClick={() => openChat(g)} className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition">
                  Open Chat
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {groups.length === 0 && !msg && <p className="text-center text-slate-500 mt-10">No groups available</p>}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { groupsApi, paymentsApi } from "../api/groupsApi";
import { useAuth } from "../context/AuthContext";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmGroup, setConfirmGroup] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await groupsApi.list();
      setGroups(res.data.groups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subscribe = async (groupId) => {
    setMsg("");
    try {
      const res = await paymentsApi.initSubscription(groupId);
      if (res.data?.gatewayPageURL) {
        window.location.href = res.data.gatewayPageURL;
      } else {
        setMsg(res.data?.message || "Failed to start payment");
      }
    } catch (e) {
      setMsg(e?.response?.data?.message || "Subscription failed");
    }
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
              {g.isMember && <p className="text-sm text-green-600 mt-1">✓ Member</p>}
              {g.membership?.premiumExpiresAt && (
                <p className="text-xs text-slate-400 mt-1">
                  Expires: {new Date(g.membership.premiumExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              {g.isMember ? (
                <a href={`/chat?conversation=${g.conversation?._id || g.conversation}`} className="flex-1 text-center px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">
                  Open Chat
                </a>
              ) : (
                <button onClick={() => setConfirmGroup(g)} className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition">
                  Subscribe to Join
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {groups.length === 0 && <p className="text-center text-slate-500 mt-10">No groups available</p>}

      {/* Subscription popup */}
      {confirmGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-brand mb-3">Subscribe to Join</h3>
            <p className="text-slate-600 mb-4">
              To join <strong>{confirmGroup.name}</strong>, you need an active subscription.
              Click below to proceed to secure payment.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              After successful payment, admin will add you to the group.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  subscribe(confirmGroup._id);
                  setConfirmGroup(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition"
              >
                Proceed to Payment
              </button>
              <button
                onClick={() => setConfirmGroup(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

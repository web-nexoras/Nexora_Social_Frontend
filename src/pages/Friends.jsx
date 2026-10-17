import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function Friends() {
  const [suggestions, setSuggestions] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, i, f, se] = await Promise.all([
        api.get("/friends/suggestions"),
        api.get("/friends/requests/incoming"),
        api.get("/friends"),
        api.get("/friends/requests/sent"),
      ]);
      setSuggestions(s.data?.users || []);
      setIncoming(i.data?.requests || []);
      setFriends(f.data?.friends || []);
      setSent(se.data?.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const sendRequest = async (userId) => {
    await api.post(`/friends/request/${userId}`);
    loadAll();
  };

  const accept = async (id) => {
    await api.patch(`/friends/requests/${id}/accept`);
    loadAll();
  };

  const reject = async (id) => {
    await api.patch(`/friends/requests/${id}/reject`);
    loadAll();
  };

  const cancel = async (id) => {
    await api.patch(`/friends/requests/${id}/cancel`);
    loadAll();
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="grid md:grid-cols-4 gap-6 mt-6">
      {/* Suggestions */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-xl font-bold text-brand mb-4">Suggestions</h2>
        {suggestions.length === 0 && <p className="text-slate-500 text-sm">No suggestions</p>}
        {suggestions.map((u) => (
          <div key={u._id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <p className="font-medium">{u.fullname}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
            <button onClick={() => sendRequest(u._id)} className="text-sm px-3 py-1 rounded bg-brand text-white hover:bg-indigo-700">Add</button>
          </div>
        ))}
      </div>

      {/* Incoming Requests */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-xl font-bold text-brand mb-4">Incoming</h2>
        {incoming.length === 0 && <p className="text-slate-500 text-sm">No requests</p>}
        {incoming.map((r) => (
          <div key={r._id} className="py-2 border-b last:border-0">
            <p className="font-medium">{r.sender?.fullname}</p>
            <p className="text-xs text-slate-400">{r.sender?.email}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => accept(r._id)} className="text-xs px-3 py-1 rounded bg-green-500 text-white">Accept</button>
              <button onClick={() => reject(r._id)} className="text-xs px-3 py-1 rounded bg-red-500 text-white">Reject</button>
            </div>
          </div>
        ))}
      </div>

      {/* Sent Requests */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-xl font-bold text-brand mb-4">Sent</h2>
        {sent.length === 0 && <p className="text-slate-500 text-sm">No sent requests</p>}
        {sent.map((r) => (
          <div key={r._id} className="py-2 border-b last:border-0">
            <p className="font-medium">{r.receiver?.fullname}</p>
            <p className="text-xs text-slate-400">{r.receiver?.email}</p>
            <button onClick={() => cancel(r._id)} className="mt-2 text-xs px-3 py-1 rounded bg-slate-500 text-white">Cancel</button>
          </div>
        ))}
      </div>

      {/* Friends */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-xl font-bold text-brand mb-4">Friends</h2>
        {friends.length === 0 && <p className="text-slate-500 text-sm">No friends yet</p>}
        {friends.map((f) => (
          <div key={f.friendshipId} className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
              <p className="font-medium">{f.friend?.fullname}</p>
              <p className="text-xs text-slate-400">{f.friend?.email}</p>
            </div>
            <Link to={`/chat?user=${f.friend?._id}`} className="text-xs px-3 py-1 rounded bg-accent text-white">Chat</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { friendsApi } from "../api/friendsApi";

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
        friendsApi.suggestions(),
        friendsApi.incoming(),
        friendsApi.list(),
        friendsApi.sent(),
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
    await friendsApi.sendRequest(userId);
    loadAll();
  };

  const accept = async (id) => {
    await friendsApi.accept(id);
    loadAll();
  };

  const reject = async (id) => {
    await friendsApi.reject(id);
    loadAll();
  };

  const cancel = async (id) => {
    await friendsApi.cancel(id);
    loadAll();
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  const Card = ({ children }) => (
    <div className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition">{children}</div>
  );

  return (
    <div className="space-y-8 mt-6">
      {/* Suggestions */}
      <section>
        <h2 className="text-2xl font-bold text-brand mb-4">Suggestions</h2>
        {suggestions.length === 0 && <p className="text-slate-500 text-sm">No suggestions</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map((u) => (
            <Card key={u._id}>
              <div className="flex items-center gap-3 mb-3">
                <img src={u.avatar || "https://via.placeholder.com/48"} alt={u.fullname} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-slate-800">{u.fullname}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
              </div>
              <button onClick={() => sendRequest(u._id)} className="w-full py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 transition">
                Add Friend
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* Incoming */}
      <section>
        <h2 className="text-2xl font-bold text-brand mb-4">Incoming Requests</h2>
        {incoming.length === 0 && <p className="text-slate-500 text-sm">No incoming requests</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {incoming.map((r) => (
            <Card key={r._id}>
              <div className="flex items-center gap-3 mb-3">
                <img src={r.sender?.avatar || "https://via.placeholder.com/48"} alt={r.sender?.fullname} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-slate-800">{r.sender?.fullname}</p>
                  <p className="text-xs text-slate-400">{r.sender?.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => accept(r._id)} className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition">
                  Accept
                </button>
                <button onClick={() => reject(r._id)} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">
                  Reject
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Sent */}
      <section>
        <h2 className="text-2xl font-bold text-brand mb-4">Sent Requests</h2>
        {sent.length === 0 && <p className="text-slate-500 text-sm">No sent requests</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sent.map((r) => (
            <Card key={r._id}>
              <div className="flex items-center gap-3 mb-3">
                <img src={r.receiver?.avatar || "https://via.placeholder.com/48"} alt={r.receiver?.fullname} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-slate-800">{r.receiver?.fullname}</p>
                  <p className="text-xs text-slate-400">{r.receiver?.email}</p>
                </div>
              </div>
              <button onClick={() => cancel(r._id)} className="w-full py-1.5 rounded-lg bg-slate-500 text-white text-sm font-medium hover:bg-slate-600 transition">
                Cancel
              </button>
            </Card>
          ))}
        </div>
      </section>

      {/* Friends */}
      <section>
        <h2 className="text-2xl font-bold text-brand mb-4">Friends</h2>
        {friends.length === 0 && <p className="text-slate-500 text-sm">No friends yet</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {friends.map((f) => (
            <Card key={f.friendshipId}>
              <div className="flex items-center gap-3 mb-3">
                <img src={f.friend?.avatar || "https://via.placeholder.com/48"} alt={f.friend?.fullname} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-slate-800">{f.friend?.fullname}</p>
                  <p className="text-xs text-slate-400">{f.friend?.email}</p>
                </div>
              </div>
              <Link to={`/chat?user=${f.friend?._id}`} className="block text-center w-full py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-cyan-600 transition">
                Chat
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { friendsApi } from "../api/friendsApi";
import { useToast } from "../context/ToastContext";
import Skeleton from "../components/Skeleton";

const TABS = ["Suggestions", "Incoming", "Sent", "Friends"];

export default function Friends() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const [activeTab, setActiveTab] = useState("Suggestions");
  const [suggestions, setSuggestions] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadSequence = useRef(0);

  const loadAll = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    // allSettled: a single failing tab (e.g. no suggestions) must not wipe out
    // the friends/requests lists that loaded fine.
    const results = await Promise.allSettled([
      friendsApi.suggestions(searchQuery),
      friendsApi.incoming(),
      friendsApi.list(),
      friendsApi.sent(),
    ]);
    if (sequence !== loadSequence.current) return;

    const val = (idx, fallback) =>
      results[idx].status === "fulfilled" ? results[idx].value : fallback;
    const asArray = (v) => (Array.isArray(v) ? v : []);

    const s = val(0, {});
    const i = val(1, {});
    const f = val(2, {});
    const se = val(3, {});

    setSuggestions(asArray(s.data?.users));
    setIncoming(asArray(i.data?.requests));
    setFriends(asArray(f.data?.friends));
    setSent(asArray(se.data?.requests));

    if (results.every((r) => r.status === "rejected")) {
      showToast("Could not load friends", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    return () => {
      loadSequence.current += 1;
    };
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      setActiveTab("Suggestions");
    }
  }, [searchQuery]);

  // Deep links from notifications (e.g. "/friends?tab=incoming").
  useEffect(() => {
    const requested = (searchParams.get("tab") || "").toLowerCase();
    if (!requested) return;
    const match = TABS.find((tab) => tab.toLowerCase() === requested);
    if (match) setActiveTab(match);
  }, [searchParams]);

  const sendRequest = async (userId) => {
    try {
      await friendsApi.sendRequest(userId);
      await loadAll();
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not send friend request", "error");
    }
  };

  const accept = async (id) => {
    try {
      await friendsApi.accept(id);
      await loadAll();
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not accept friend request", "error");
    }
  };

  const reject = async (id) => {
    try {
      await friendsApi.reject(id);
      await loadAll();
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not reject friend request", "error");
    }
  };

  const cancel = async (id) => {
    try {
      await friendsApi.cancel(id);
      await loadAll();
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not cancel friend request", "error");
    }
  };

  return (
    <div className="grid md:grid-cols-4 gap-6 mt-6">
      {/* Sidebar tabs */}
      <aside className="bg-white rounded-2xl shadow p-4 h-fit md:sticky md:top-20">
        <h2 className="text-lg font-bold text-brand mb-4">Friends</h2>
        <nav className="space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab ? "bg-brand text-white shadow" : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
              }`}
            >
              {tab}
              {tab === "Incoming" && incoming.length > 0 && (
                <span className="ml-2 text-xs bg-slate-700 text-white px-2 py-0.5 rounded-full">{incoming.length}</span>
              )}
              {tab === "Sent" && sent.length > 0 && (
                <span className="ml-2 text-xs bg-slate-500 text-white px-2 py-0.5 rounded-full">{sent.length}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content based on active tab */}
      <main className="md:col-span-3">
        {/* Skeleton replaces the tab content while it loads — the tabs sidebar
            and its request counters stay visible. */}
        {loading && <Skeleton className="h-28 w-full rounded-2xl" count={4} />}
        {!loading && activeTab === "Suggestions" && (
          <section>
            <h2 className="text-2xl font-bold text-brand mb-4">
              {searchQuery ? `Search results for "${searchQuery}"` : "Suggestions"}
            </h2>
            {suggestions.length === 0 && <p className="text-slate-500 text-sm">No users found</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((u) => (
                <div key={u._id} className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition overflow-hidden">
                  <Link to={`/user/${u._id}`} className="flex items-center gap-3 mb-3">
                    <img src={u.avatar || "https://via.placeholder.com/48"} alt={u.fullname} className="w-12 h-12 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 hover:text-brand truncate">{u.fullname}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                  </Link>
                  <button onClick={() => sendRequest(u._id)} className="w-full py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 transition">
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === "Incoming" && (
          <section>
            <h2 className="text-2xl font-bold text-brand mb-4">Incoming Requests</h2>
            {incoming.length === 0 && <p className="text-slate-500 text-sm">No incoming requests</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {incoming.map((r) => (
                <div key={r._id} className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition overflow-hidden">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={r.sender?.avatar || "https://via.placeholder.com/48"} alt={r.sender?.fullname} className="w-12 h-12 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.sender?.fullname}</p>
                      <p className="text-xs text-slate-400 truncate">{r.sender?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => accept(r._id)} className="flex-1 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-slate-700 transition">
                      Accept
                    </button>
                    <button onClick={() => reject(r._id)} className="flex-1 py-1.5 rounded-lg bg-slate-400 text-white text-sm font-medium hover:bg-slate-500 transition">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === "Sent" && (
          <section>
            <h2 className="text-2xl font-bold text-brand mb-4">Sent Requests</h2>
            {sent.length === 0 && <p className="text-slate-500 text-sm">No sent requests</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sent.map((r) => (
                <div key={r._id} className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition overflow-hidden">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={r.receiver?.avatar || "https://via.placeholder.com/48"} alt={r.receiver?.fullname} className="w-12 h-12 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.receiver?.fullname}</p>
                      <p className="text-xs text-slate-400 truncate">{r.receiver?.email}</p>
                    </div>
                  </div>
                  <button onClick={() => cancel(r._id)} className="w-full py-1.5 rounded-lg bg-slate-500 text-white text-sm font-medium hover:bg-slate-600 transition">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === "Friends" && (
          <section>
            <h2 className="text-2xl font-bold text-brand mb-4">Friends</h2>
            {friends.length === 0 && <p className="text-slate-500 text-sm">No friends yet</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((f) => (
                <div key={f.friendshipId} className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition overflow-hidden">
                  <Link to={`/user/${f.friend?._id}`} className="flex items-center gap-3 mb-3">
                    <img src={f.friend?.avatar || "https://via.placeholder.com/48"} alt={f.friend?.fullname} className="w-12 h-12 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 hover:text-brand truncate">{f.friend?.fullname}</p>
                      <p className="text-xs text-slate-400 truncate">{f.friend?.email}</p>
                    </div>
                  </Link>
                  <div className="flex gap-2">
                    <Link to={`/user/${f.friend?._id}`} className="flex-1 text-center py-1.5 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 transition">
                      Profile
                    </Link>
                    <Link to={`/chat?user=${f.friend?._id}`} className="flex-1 text-center py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-slate-700 transition">
                      Chat
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

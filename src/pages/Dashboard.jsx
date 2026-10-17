import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({ friends: 0, conversations: 0, groups: 0, pendingRequests: 0, totalUsers: 0, pendingApprovals: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [f, c, g, inc, u] = await Promise.all([
          api.get("/friends").catch(() => ({ data: { friends: [] } })),
          api.get("/chat/conversations").catch(() => ({ data: { conversations: [] } })),
          api.get("/groups").catch(() => ({ data: { groups: [] } })),
          api.get("/friends/requests/incoming").catch(() => ({ data: { requests: [] } })),
          isAdmin ? api.get("/users").catch(() => ({ data: { users: [], total: 0 } })) : Promise.resolve({ data: { users: [], total: 0 } }),
        ]);
        setStats({
          friends: (f.data?.friends || []).length,
          conversations: (c.data?.conversations || []).length,
          groups: (g.data?.groups || []).length,
          pendingRequests: (inc.data?.requests || []).length,
          totalUsers: u.data?.total || (u.data?.users || []).length,
          pendingApprovals: (u.data?.users || []).filter((x) => !x.isApproved).length,
        });
        setRecent((c.data?.conversations || []).slice(0, 5));
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [isAdmin]);

  const userCards = [
    { label: "Friends", value: stats.friends, color: "from-indigo-500 to-brand", to: "/friends" },
    { label: "Conversations", value: stats.conversations, color: "from-cyan-500 to-accent", to: "/chat" },
    { label: "Groups", value: stats.groups, color: "from-emerald-500 to-green-500", to: "/groups" },
    { label: "Pending Requests", value: stats.pendingRequests, color: "from-amber-500 to-orange-500", to: "/friends" },
  ];

  const adminCards = [
    { label: "Total Users", value: stats.totalUsers, color: "from-indigo-500 to-brand", to: "/admin/users" },
    { label: "Pending Approvals", value: stats.pendingApprovals, color: "from-amber-500 to-orange-500", to: "/admin/users" },
    { label: "Groups", value: stats.groups, color: "from-emerald-500 to-green-500", to: "/admin/groups" },
    { label: "Conversations", value: stats.conversations, color: "from-cyan-500 to-accent", to: "/chat" },
  ];

  const cards = isAdmin ? adminCards : userCards;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand to-indigo-700 rounded-2xl shadow-lg p-8 text-white flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">
            {isAdmin ? "Admin Dashboard" : `Welcome back, ${user?.fullname}`}
          </h1>
          <p className="text-indigo-100">{user?.email}</p>
          <p className="text-indigo-200 text-sm mt-1">Role: {user?.role}</p>
        </div>
        <img
          src={user?.avatar || "https://via.placeholder.com/96"}
          alt="avatar"
          className="w-20 h-20 rounded-full border-4 border-white/40 object-cover"
        />
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group bg-white rounded-2xl shadow p-5 hover:shadow-lg transition">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center text-xl font-bold mb-3`}>
              {c.value}
            </div>
            <p className="text-slate-700 font-semibold group-hover:text-brand transition">{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold text-brand mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/profile" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">Edit Profile</Link>
          <Link to="/friends" className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition">Friends</Link>
          <Link to="/chat" className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 transition">Chat</Link>
          <Link to="/groups" className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition">Groups</Link>
          <Link to="/payments" className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition">Payments</Link>
          {isAdmin && (
            <>
              <Link to="/admin/users" className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition">Admin Users</Link>
              <Link to="/admin/groups" className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition">Admin Groups</Link>
            </>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold text-brand mb-4">Recent Conversations</h2>
        {recent.length === 0 && <p className="text-slate-500 text-sm">No conversations yet</p>}
        <div className="space-y-3">
          {recent.map((c) => (
            <Link key={c._id} to={`/chat?conversation=${c._id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition">
              <div>
                <p className="font-medium text-slate-800">
                  {c.type === "group" ? c.groupName : c.participants?.map((p) => p.fullname).join(", ")}
                </p>
                <p className="text-xs text-slate-400 truncate">{c.lastMessage?.text || "No messages yet"}</p>
              </div>
              <span className="text-xs text-brand font-semibold">Open →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

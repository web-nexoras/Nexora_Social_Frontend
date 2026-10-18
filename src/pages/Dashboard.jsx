import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { friendsApi } from "../api/friendsApi";
import { usersApi } from "../api/usersApi";
import { FiArrowRight, FiCheck, FiX } from "react-icons/fi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({ friends: 0, conversations: 0, groups: 0, pendingRequests: 0, totalUsers: 0, pendingApprovals: 0 });
  const [recent, setRecent] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [f, c, g, inc, u, s] = await Promise.all([
          api.get("/friends"),
          api.get("/chat/conversations"),
          api.get("/groups"),
          api.get("/friends/requests/incoming"),
          isAdmin ? usersApi.list() : Promise.resolve({ data: { users: [], total: 0 } }),
          friendsApi.suggestions(),
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
        setIncoming(inc.data?.requests || []);
        setSuggestions(s.data?.users || []);
        if (isAdmin) setAllUsers(u.data?.users || []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [isAdmin]);

  const accept = async (id) => {
    await friendsApi.accept(id);
    setIncoming((prev) => prev.filter((r) => r._id !== id));
    setStats((s) => ({ ...s, pendingRequests: Math.max(0, s.pendingRequests - 1), friends: s.friends + 1 }));
  };

  const reject = async (id) => {
    await friendsApi.reject(id);
    setIncoming((prev) => prev.filter((r) => r._id !== id));
    setStats((s) => ({ ...s, pendingRequests: Math.max(0, s.pendingRequests - 1) }));
  };

  const messageAdmin = async () => {
    try {
      const res = await usersApi.admins();
      const admins = res.data?.admins || [];
      if (admins.length > 0) {
        navigate(`/chat?user=${admins[0]._id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendSuggestionRequest = async (userId) => {
    await friendsApi.sendRequest(userId);
    setSuggestions((prev) => prev.filter((u) => u._id !== userId));
  };

  const cards = isAdmin
    ? [
        { label: "Total Users", value: stats.totalUsers, color: "from-slate-700 to-slate-900", to: "/admin/users" },
        { label: "Pending Approvals", value: stats.pendingApprovals, color: "from-slate-400 to-slate-600", to: "/admin/users" },
        { label: "Groups", value: stats.groups, color: "from-slate-600 to-slate-800", to: "/admin/groups" },
        { label: "Conversations", value: stats.conversations, color: "from-slate-500 to-slate-700", to: "/chat" },
      ]
    : [
        { label: "Friends", value: stats.friends, color: "from-slate-700 to-slate-900", to: "/friends" },
        { label: "Conversations", value: stats.conversations, color: "from-slate-500 to-slate-700", to: "/chat" },
        { label: "Groups", value: stats.groups, color: "from-slate-600 to-slate-800", to: "/groups" },
        { label: "Pending Requests", value: stats.pendingRequests, color: "from-slate-400 to-slate-600", to: "/friends" },
      ];

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

      {/* Incoming friend requests (user only) */}
      {!isAdmin && incoming.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-brand mb-4">Friend Requests</h2>
          <div className="space-y-3">
            {incoming.map((r) => (
              <div key={r._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-3">
                  <img src={r.sender?.avatar || "https://via.placeholder.com/40"} alt={r.sender?.fullname} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="font-medium text-slate-800">{r.sender?.fullname}</p>
                    <p className="text-xs text-slate-400">{r.sender?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => accept(r._id)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-slate-700 transition">
                    Accept
                  </button>
                  <button onClick={() => reject(r._id)} className="px-3 py-1.5 rounded-lg bg-slate-400 text-white text-sm font-medium hover:bg-slate-500 transition">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friend Suggestions (user only) */}
      {!isAdmin && suggestions.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">Friend Suggestions</h2>
            <Link to="/friends" className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline">View all <FiArrowRight /></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.slice(0, 6).map((u) => (
              <div key={u._id} className="bg-slate-50 rounded-xl p-4 hover:shadow transition">
                <Link to={`/user/${u._id}`} className="flex items-center gap-3 mb-3">
                  <img src={u.avatar || "https://via.placeholder.com/40"} alt={u.fullname} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="font-medium text-slate-800 text-sm hover:text-brand">{u.fullname}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </Link>
                <button onClick={() => sendSuggestionRequest(u._id)} className="w-full py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 transition">
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All users (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">All Users</h2>
            <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline">Manage <FiArrowRight /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Approved</th>
                  <th className="text-left px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u._id} className="border-t">
                    <td className="px-4 py-3">{u.fullname}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">
                      {u.isApproved ? (
                        <FiCheck className="text-green-600 inline" aria-label="Approved" />
                      ) : (
                        <FiX className="text-red-500 inline" aria-label="Not approved" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <FiCheck className="text-green-600 inline" aria-label="Active" />
                      ) : (
                        <FiX className="text-red-500 inline" aria-label="Inactive" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allUsers.length === 0 && <p className="text-center text-slate-500 py-6">No users found</p>}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold text-brand mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/profile" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Edit Profile</Link>
          <Link to="/friends" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Friends</Link>
          <Link to="/chat" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Chat</Link>
          <Link to="/groups" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Groups</Link>
          <Link to="/payments" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Payments</Link>
          <button onClick={messageAdmin} className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Message Admin</button>
          {isAdmin && (
            <>
              <Link to="/admin/users" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Admin Users</Link>
              <Link to="/admin/groups" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Admin Groups</Link>
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
              <span className="inline-flex items-center gap-1 text-xs text-brand font-semibold">Open <FiArrowRight /></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

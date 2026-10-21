import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { friendsApi } from "../api/friendsApi";
import { usersApi } from "../api/usersApi";
import { useToast } from "../context/ToastContext";
import { FiArrowRight, FiCheck, FiX, FiUserPlus, FiEdit2 } from "react-icons/fi";

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({
    friends: 0,
    conversations: 0,
    groups: 0,
    pendingRequests: 0,
    totalUsers: 0,
    pendingApprovals: 0,
  });
  const [allUsers, setAllUsers] = useState([]);  const [incoming, setIncoming] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // Admin: quick "add user" modal (creates an approved account instantly)
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullname: "", email: "", password: "", role: "user" });
  const [creating, setCreating] = useState(false);

  // Admin: edit any user's details from the card's edit button
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullname: "", email: "", role: "user", isApproved: true, isActive: true });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditUser = (u) => {
    setEditingUser(u);
    setEditForm({
      fullname: u.fullname || "",
      email: u.email || "",
      role: u.role === "admin" ? "admin" : "user",
      isApproved: Boolean(u.isApproved),
      isActive: Boolean(u.isActive),
    });
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (savingEdit || !editingUser) return;
    if (!editForm.fullname.trim() || !editForm.email.trim()) {
      showToast("Name & email are required", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await usersApi.update(editingUser._id, editForm);
      const u = res.data?.user;
      if (u) setAllUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, ...u } : x)));
      showToast("User updated successfully", "success");
      setEditingUser(null);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update user", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (creating) return;
    if (!newUser.fullname.trim() || !newUser.email.trim() || newUser.password.length < 8) {
      showToast("Name, email & password (min 8 chars) required", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await usersApi.create(newUser);
      const u = res.data?.user;
      if (u) {
        setAllUsers((prev) => [u, ...prev]);
        setStats((s) => ({ ...s, totalUsers: s.totalUsers + 1 }));
      }
      showToast("User added successfully", "success");
      setNewUser({ fullname: "", email: "", password: "", role: "user" });
      setShowAddUser(false);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add user", "error");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [f, c, g, inc, u, s] = await Promise.all([
          api.get("/friends"),
          api.get("/chat/conversations"),
          api.get("/groups"),
          api.get("/friends/requests/incoming"),
          isAdmin
            ? usersApi.list({ limit: 100 })
            : Promise.resolve({ data: { users: [], total: 0 } }),
          friendsApi.suggestions(),
        ]);
        if (!alive) return;
        setStats({
          friends: (f.data?.friends || []).length,
          conversations: (c.data?.conversations || []).length,
          groups: (g.data?.groups || []).length,
          pendingRequests: (inc.data?.requests || []).length,
          totalUsers: u.data?.total || (u.data?.users || []).length,
          pendingApprovals: (u.data?.users || []).filter((x) => {
            const status = x.status || (x.isApproved ? "approved" : "pending");
            return status === "pending";
          }).length,
        });
        setIncoming(inc.data?.requests || []);
        setSuggestions(s.data?.users || []);
        if (isAdmin) setAllUsers(u.data?.users || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        showToast(e?.response?.data?.message || "Could not load dashboard data", "error");
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const accept = async (id) => {
    try {
      await friendsApi.accept(id);
      setIncoming((prev) => prev.filter((r) => r._id !== id));
      setStats((s) => ({
        ...s,
        pendingRequests: Math.max(0, s.pendingRequests - 1),
        friends: s.friends + 1,
      }));
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not accept friend request", "error");
    }
  };

  const reject = async (id) => {
    try {
      await friendsApi.reject(id);
      setIncoming((prev) => prev.filter((r) => r._id !== id));
      setStats((s) => ({
        ...s,
        pendingRequests: Math.max(0, s.pendingRequests - 1),
      }));
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not reject friend request", "error");
    }
  };

  const sendSuggestionRequest = async (userId) => {
    try {
      await friendsApi.sendRequest(userId);
      setSuggestions((prev) => prev.filter((u) => u._id !== userId));
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not send friend request", "error");
    }
  };

  const cards = isAdmin
    ? [
        {
          label: "Total Users",
          value: stats.totalUsers,
          color: "from-slate-700 to-slate-900",
          to: "/admin/users",
        },
        {
          label: "Pending Approvals",
          value: stats.pendingApprovals,
          color: "from-slate-400 to-slate-600",
          to: "/admin/users",
        },
        {
          label: "Groups",
          value: stats.groups,
          color: "from-slate-600 to-slate-800",
          to: "/admin/groups",
        },
        {
          label: "Conversations",
          value: stats.conversations,
          color: "from-slate-500 to-slate-700",
          to: "/chat",
        },
      ]
    : [
        {
          label: "Friends",
          value: stats.friends,
          color: "from-slate-700 to-slate-900",
          to: "/friends",
        },
        {
          label: "Conversations",
          value: stats.conversations,
          color: "from-slate-500 to-slate-700",
          to: "/chat",
        },
        {
          label: "Groups",
          value: stats.groups,
          color: "from-slate-600 to-slate-800",
          to: "/groups",
        },
        {
          label: "Pending Requests",
          value: stats.pendingRequests,
          color: "from-slate-400 to-slate-600",
          to: "/friends",
        },
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
          <Link
            key={c.label}
            to={c.to}
            className="group bg-white rounded-2xl shadow p-5 hover:shadow-lg transition"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center text-xl font-bold mb-3`}
            >
              {c.value}
            </div>
            <p className="text-slate-700 font-semibold group-hover:text-brand transition">
              {c.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Incoming friend requests (user only) */}
      {!isAdmin && incoming.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-brand mb-4">Friend Requests</h2>
          <div className="space-y-3">
            {incoming.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={r.sender?.avatar || "https://via.placeholder.com/40"}
                    alt={r.sender?.fullname}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-slate-800">
                      {r.sender?.fullname}
                    </p>
                    <p className="text-xs text-slate-400">{r.sender?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => accept(r._id)}
                    className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-slate-700 transition"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => reject(r._id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-400 text-white text-sm font-medium hover:bg-slate-500 transition"
                  >
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
            <Link
              to="/friends"
              className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline"
            >
              View all <FiArrowRight />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.slice(0, 6).map((u) => (
              <div
                key={u._id}
                className="bg-slate-50 rounded-xl p-4 hover:shadow transition"
              >
                <Link
                  to={`/user/${u._id}`}
                  className="flex items-center gap-3 mb-3"
                >
                  <img
                    src={u.avatar || "https://via.placeholder.com/40"}
                    alt={u.fullname}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-slate-800 text-sm hover:text-brand">
                      {u.fullname}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </Link>
                <button
                  onClick={() => sendSuggestionRequest(u._id)}
                  className="w-full py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-indigo-700 transition"
                >
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
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-brand">All Users</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddUser(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand px-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
              >
                <FiUserPlus /> Add User
              </button>
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline"
              >
                Manage <FiArrowRight />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allUsers.map((u) => (
              <div
                key={u._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/user/${u._id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/user/${u._id}`)}
                className="group relative bg-slate-50 rounded-xl p-4 pr-11 hover:shadow-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                {/* Edit icon — click stops propagation, opens the edit modal */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditUser(u);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label={`Edit ${u.fullname}`}
                  title="Edit user"
                  className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-brand transition"
                >
                  <FiEdit2 size={15} />
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={u.avatar || "https://via.placeholder.com/48"}
                    alt={u.fullname}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate group-hover:text-brand transition">
                      {u.fullname}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.role === "admin"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {u.role}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.isApproved
                        ? "bg-brand text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {u.isApproved ? "Approved" : "Pending"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.isActive
                        ? "bg-emerald-700 text-white"
                        : "bg-rose-500 text-white"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
            {allUsers.length === 0 && (
              <p className="text-center text-slate-500 py-6 sm:col-span-2 lg:col-span-3">
                No users found
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold text-brand mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/profile"
            className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
          >
            Edit Profile
          </Link>
          <Link
            to="/friends"
            className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
          >
            Friends
          </Link>
          <Link
            to="/chat"
            className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
          >
            Chat
          </Link>
          <Link
            to="/groups"
            className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
          >
            Groups
          </Link>
          <Link
            to="/payments"
            className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
          >
            Payments
          </Link>
          {isAdmin && (
            <Link
              to="/admin/groups"
              className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
            >
              Admin Groups
            </Link>
          )}
        </div>
      </div>

      {/* Recent conversations removed — messaging lives in the always-visible bottom-right chat icon */}

      {/* Admin: add-user modal — create accounts anytime, no OTP needed */}
      {isAdmin && showAddUser && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4"
          onClick={() => !creating && setShowAddUser(false)}
        >
          <div
            className="bg-white rounded-2xl neo-modal w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-brand">Add New User</h3>
              <button
                onClick={() => !creating && setShowAddUser(false)}
                aria-label="Close"
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={newUser.fullname}
                onChange={(e) => setNewUser((n) => ({ ...n, fullname: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
                autoFocus
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser((n) => ({ ...n, email: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={newUser.password}
                onChange={(e) => setNewUser((n) => ({ ...n, password: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((n) => ({ ...n, role: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-xs text-slate-400">
                The account is verified &amp; approved instantly — user can log in right away.
              </p>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin: edit-user modal — change any user's details anytime */}
      {isAdmin && editingUser && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4"
          onClick={() => !savingEdit && setEditingUser(null)}
        >
          <div
            className="bg-white rounded-2xl neo-modal w-full max-w-md p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-brand">Edit User</h3>
              <button
                onClick={() => !savingEdit && setEditingUser(null)}
                aria-label="Close"
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <FiX />
              </button>
            </div>
            <div className="flex items-center gap-3 pb-1">
              <img
                src={editingUser.avatar || "https://via.placeholder.com/48"}
                alt={editingUser.fullname}
                className="w-12 h-12 rounded-full object-cover"
              />
              <p className="text-sm text-slate-500">
                Editing <span className="font-semibold text-slate-700">{editingUser.fullname}</span>
              </p>
            </div>
            <form onSubmit={handleEditUser} className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={editForm.fullname}
                onChange={(e) => setEditForm((f) => ({ ...f, fullname: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
                autoFocus
              />
              <input
                type="email"
                placeholder="Email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm"
              />
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                disabled={editingUser._id === user?._id}
                className="w-full neo-input rounded-lg px-3 py-2.5 text-sm disabled:opacity-60"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isApproved}
                    onChange={(e) => setEditForm((f) => ({ ...f, isApproved: e.target.checked }))}
                    className="w-4 h-4 accent-brand"
                  />
                  Approved
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                    disabled={editingUser._id === user?._id}
                    className="w-4 h-4 accent-brand disabled:opacity-60"
                  />
                  Active
                </label>
              </div>
              {editingUser._id === user?._id && (
                <p className="text-xs text-slate-400">
                  You cannot change your own role or deactivate your account.
                </p>
              )}
              <button
                type="submit"
                disabled={savingEdit}
                className="w-full py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { usersApi } from "../api/usersApi";
import { useAuth } from "../context/AuthContext";

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === "active") params.status = "active";
      if (filter === "inactive") params.status = "inactive";
      if (filter === "approved") params.approved = "true";
      if (filter === "pending") params.approved = "false";
      const res = await usersApi.list(params);
      setUsers(res.data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const approve = async (id) => {
    try {
      await usersApi.approve(id);
      setMsg("User approved");
      load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed");
    }
  };

  const reject = async (id) => {
    try {
      await usersApi.reject(id);
      setMsg("User rejected");
      load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed");
    }
  };

  const toggle = async (id) => {
    try {
      await usersApi.toggle(id);
      setMsg("Status toggled");
      load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed");
    }
  };

  if (user?.role !== "admin") {
    return <p className="text-center mt-10 text-red-500">Admin access required</p>;
  }

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold text-brand mb-6">Admin Users</h1>
      {msg && <p className="text-sm text-brand mb-4">{msg}</p>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "active", "inactive", "approved", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-slate-400">Loading...</p>}

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Approved</th>
              <th className="text-left px-4 py-3">Active</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-3">{u.fullname}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role}</td>
                <td className="px-4 py-3">{u.isApproved ? "✓" : "✗"}</td>
                <td className="px-4 py-3">{u.isActive ? "✓" : "✗"}</td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  {!u.isApproved && (
                    <button onClick={() => approve(u._id)} className="text-xs px-2 py-1 rounded bg-green-500 text-white">Approve</button>
                  )}
                  {u.isApproved && (
                    <button onClick={() => reject(u._id)} className="text-xs px-2 py-1 rounded bg-red-500 text-white">Reject</button>
                  )}
                  <button onClick={() => toggle(u._id)} className="text-xs px-2 py-1 rounded bg-slate-500 text-white">
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-slate-500 py-6">No users found</p>}
      </div>
    </div>
  );
}

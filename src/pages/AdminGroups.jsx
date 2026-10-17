import React, { useEffect, useState } from "react";
import { groupsApi, paymentsApi } from "../api/groupsApi";
import { usersApi } from "../api/usersApi";

export default function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", currency: "BDT" });
  const [userIds, setUserIds] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const res = await groupsApi.list();
      setGroups(res.data.groups || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await groupsApi.create({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        currency: form.currency,
      });
      setForm({ name: "", description: "", price: "", currency: "BDT" });
      load();
      setMsg("Group created");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to create group");
    }
  };

  const loadMembers = async (groupId) => {
    try {
      const res = await groupsApi.members(groupId);
      setMembers(res.data.members || []);
    } catch (e) {
      console.error(e);
    }
  };

  const addMembers = async (groupId) => {
    setMsg("");
    const ids = userIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      setMsg("Enter at least one user ID");
      return;
    }
    try {
      const res = await groupsApi.addMembers(groupId, ids);
      setMsg(res.data?.message || "Members processed");
      setUserIds("");
      loadMembers(groupId);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to add members");
    }
  };

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold text-brand mb-6">Admin Groups</h1>
      {msg && <p className="text-sm text-brand mb-4">{msg}</p>}

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Create Group</h2>
        <form onSubmit={createGroup} className="grid md:grid-cols-2 gap-4">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-2 border rounded-lg" required />
          <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-4 py-2 border rounded-lg" required />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-4 py-2 border rounded-lg md:col-span-2" />
          <button type="submit" className="px-6 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">Create</button>
        </form>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g._id} className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{g.name}</h3>
                <p className="text-sm text-slate-500">{g.description}</p>
                <p className="text-sm mt-1">Price: {g.price} {g.currency}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedGroup(g._id);
                  loadMembers(g._id);
                }}
                className="text-xs px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
              >
                Manage
              </button>
            </div>

            {selectedGroup === g._id && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2">Add Members (comma-separated user IDs)</h4>
                <div className="flex gap-2">
                  <input
                    value={userIds}
                    onChange={(e) => setUserIds(e.target.value)}
                    placeholder="userId1, userId2"
                    className="flex-1 px-4 py-2 border rounded-lg"
                  />
                  <button onClick={() => addMembers(g._id)} className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition">
                    Add
                  </button>
                </div>

                <h4 className="font-semibold mt-4 mb-2">Members</h4>
                {members.length === 0 && <p className="text-sm text-slate-500">No members yet</p>}
                {members.map((m) => (
                  <div key={m._id} className="text-sm py-1 border-b last:border-0">
                    {m.user?.fullname} ({m.user?.email}) — {m.role}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { groupsApi } from "../api/groupsApi";
import { usersApi } from "../api/usersApi";

export default function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", currency: "BDT", image: "" });
  const [userIds, setUserIds] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", price: "", currency: "BDT", image: "" });

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
        image: form.image || undefined,
      });
      setForm({ name: "", description: "", price: "", currency: "BDT", image: "" });
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

  const loadSubscribers = async (groupId) => {
    try {
      const res = await groupsApi.subscribers(groupId);
      setSubscribers(res.data.subscribers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshGroup = (groupId) => {
    loadMembers(groupId);
    loadSubscribers(groupId);
  };

  const addMembers = async (groupId, overrideIds) => {
    setMsg("");
    const ids = overrideIds || userIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      setMsg("Enter at least one user ID");
      return;
    }
    try {
      const res = await groupsApi.addMembers(groupId, ids);
      setMsg(res.data?.message || "Members processed");
      setUserIds("");
      refreshGroup(groupId);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to add members");
    }
  };

  const startEdit = (g) => {
    setEditingId(g._id);
    setEditForm({
      name: g.name || "",
      description: g.description || "",
      price: g.price ?? "",
      currency: g.currency || "BDT",
      image: g.image || "",
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (groupId) => {
    setMsg("");
    try {
      await groupsApi.update(groupId, {
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        currency: editForm.currency,
        image: editForm.image || undefined,
      });
      setEditingId(null);
      load();
      setMsg("Group updated");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to update group");
    }
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm("Delete this group? This cannot be undone.")) return;
    setMsg("");
    try {
      await groupsApi.remove(groupId);
      if (selectedGroup === groupId) setSelectedGroup(null);
      load();
      setMsg("Group deleted");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to delete group");
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
          <input placeholder="Image URL (optional)" value={form.image || ""} onChange={(e) => setForm({ ...form, image: e.target.value })} className="px-4 py-2 border rounded-lg md:col-span-2" />
          <button type="submit" className="px-6 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">Create</button>
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
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(g)}
                  className="text-xs px-3 py-1 rounded bg-brand text-white hover:bg-slate-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteGroup(g._id)}
                  className="text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setSelectedGroup(g._id);
                    refreshGroup(g._id);
                  }}
                  className="text-xs px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
                >
                  Manage
                </button>
              </div>
            </div>

            {editingId === g._id && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2">Edit Group</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  <input
                    placeholder="Name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="px-3 py-2 border rounded-lg"
                    required
                  />
                  <input
                    placeholder="Price"
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="px-3 py-2 border rounded-lg"
                    required
                  />
                  <input
                    placeholder="Description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="px-3 py-2 border rounded-lg md:col-span-2"
                  />
                  <input
                    placeholder="Image URL (optional)"
                    value={editForm.image}
                    onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                    className="px-3 py-2 border rounded-lg md:col-span-2"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => saveEdit(g._id)} className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition">
                    Save
                  </button>
                  <button onClick={cancelEdit} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {selectedGroup === g._id && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2">Paid — Pending Approval</h4>
                {subscribers.length === 0 && (
                  <p className="text-sm text-slate-500 mb-4">No paid users waiting to be added.</p>
                )}
                <div className="space-y-2 mb-4">
                  {subscribers.map((s) => (
                    <div key={s.user?._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <img src={s.user?.avatar || "https://via.placeholder.com/32"} alt="" className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{s.user?.fullname}</p>
                          <p className="text-xs text-slate-400">{s.user?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => addMembers(g._id, [s.user?._id])}
                        className="text-xs px-3 py-1 rounded bg-brand text-white hover:bg-slate-700"
                      >
                        Add to Group
                      </button>
                    </div>
                  ))}
                </div>

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

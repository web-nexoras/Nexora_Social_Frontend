import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
    isActive
      ? "bg-brand text-white shadow"
      : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
  }`;

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="bg-white rounded-lg shadow p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand">Nexora Social</h2>
        <p className="text-xs text-slate-400 mt-1">
          {user?.role === "admin" ? "Admin" : "User"}
        </p>
      </div>
      <nav className="space-y-1">
        <NavLink to="/dashboard" className={linkClass}>
          🏠 Overview
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          👤 Profile
        </NavLink>
        <NavLink to="/friends" className={linkClass}>
          👥 Friends
        </NavLink>
        <NavLink to="/chat" className={linkClass}>
          💬 Chat
        </NavLink>
        <NavLink to="/groups" className={linkClass}>
          🏷️ Groups
        </NavLink>
        <NavLink to="/payments" className={linkClass}>
          💳 Payments
        </NavLink>
        {user?.role === "admin" && (
          <>
            <div className="my-3 border-t" />
            <NavLink to="/admin/users" className={linkClass}>
              🛡️ Admin Users
            </NavLink>
            <NavLink to="/admin/groups" className={linkClass}>
              ⚙️ Admin Groups
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

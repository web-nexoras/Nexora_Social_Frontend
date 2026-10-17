import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
    isActive
      ? "bg-brand text-white shadow"
      : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
  }`;

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <aside className="neo-raised p-4 flex-1 min-h-screen overflow-y-auto flex flex-col" onClick={onNavigate}>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-brand">{user?.role === "admin" ? "Nexora Social Admin" : "Nexora Social"}</h2>
        <p className="text-xs text-slate-400 mt-1">
          {user?.role === "admin" ? "Admin" : "User"}
        </p>
      </div>
      <nav className="space-y-4">
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
          💬 Messages
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
              🛡️ All Users
            </NavLink>
            <NavLink to="/admin/groups" className={linkClass}>
              ⚙️ Admin Groups
            </NavLink>
          </>
        )}
      </nav>

      {/* Theme selector */}
      <div className="mt-auto pt-4 border-t">
        <p className="text-xs text-slate-400 mb-2">Appearance</p>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
              theme === "light" ? "bg-brand text-white shadow" : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
            }`}
          >
            ☀️ Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
              theme === "dark" ? "bg-brand text-white shadow" : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
            }`}
          >
            🌙 Dark
          </button>
        </div>
      </div>
    </aside>
  );
}


import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSocket } from "../context/SocketContext";
import {
  FiHome,
  FiUser,
  FiUsers,
  FiMessageSquare,
  FiBell,
  FiRss,
  FiTag,
  FiCreditCard,
  FiShield,
  FiSettings,
  FiSun,
  FiMoon,
} from "react-icons/fi";

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
    isActive
      ? "bg-brand text-white shadow"
      : "text-slate-700 hover:bg-indigo-50 hover:text-brand"
  }`;

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { unreadMessages } = useSocket();

  return (
    <aside className="neo-raised app-sidebar p-4 flex-1 min-h-0 overflow-y-auto flex flex-col" onClick={onNavigate}>
      <div className="mb-6">
        <h2 className="text-lg font-extrabold text-slate-900">{user?.role === "admin" ? "Nexora Social Admin" : "Nexora Social"}</h2>
        <p className="text-xs text-slate-400 mt-1">
          {user?.role === "admin" ? "Admin" : "User"}
        </p>
      </div>
      <nav className="space-y-2 lg:space">
        <NavLink to="/feed" className={linkClass}>
          <FiRss className="shrink-0" /> Feed
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <FiUser className="shrink-0" /> Profile
        </NavLink>
        <NavLink to="/chat" className={linkClass}>
          <FiMessageSquare className="shrink-0" /> Messages
          {unreadMessages > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </NavLink>
        <NavLink to="/friends" className={linkClass}>
          <FiUsers className="shrink-0" /> Friends
        </NavLink>
        <NavLink to="/notifications" className={linkClass}>
          <FiBell className="shrink-0" /> Notifications
        </NavLink>
        <NavLink to="/groups" className={linkClass}>
          <FiTag className="shrink-0" /> Groups
        </NavLink>
        <NavLink to="/payments" className={linkClass}>
          <FiCreditCard className="shrink-0" /> Payments
        </NavLink>
        {user?.role === "admin" && (
          <>
            <div className="my-3 border-t" />
            <NavLink to="/admin/users" className={linkClass}>
              <FiShield className="shrink-0" /> All Users
            </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          <FiHome className="shrink-0" /> Dashboard
        </NavLink>
            <NavLink to="/admin/groups" className={linkClass}>
              <FiSettings className="shrink-0" /> Admin Groups
            </NavLink>
          </>
        )}
      </nav>

      {/* Theme selector — pinned to the sidebar bottom and STICKY, so it
          stays visible on lg screens and inside the mobile drawer too */}
      <div className="mt-auto sticky bottom-0 bg-inherit pt-4 pb-1">
        <p className="text-xs text-slate-400 mb-2">Appearance</p>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
              theme === "light" ? "bg-brand text-white shadow" : "text-slate-700 bg-white/60 dark:bg-white/10 hover:bg-indigo-50 hover:text-brand"
            }`}
          >
            <FiSun /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
              theme === "dark" ? "bg-brand text-white shadow" : "text-slate-700 bg-white/60 dark:bg-white/10 hover:bg-indigo-50 hover:text-brand"
            }`}
          >
            <FiMoon /> Dark
          </button>
        </div>
      </div>
    </aside>
  );
}

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white/80 backdrop-blur shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-brand">Nexora Social</Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/profile" className="text-slate-700 hover:text-brand">Profile</Link>
              <Link to="/friends" className="text-slate-700 hover:text-brand">Friends</Link>
              <Link to="/chat" className="text-slate-700 hover:text-brand">Chat</Link>
              <Link to="/groups" className="text-slate-700 hover:text-brand">Groups</Link>
              <Link to="/payments" className="text-slate-700 hover:text-brand">Payments</Link>
              {user?.role === "admin" && (
                <>
                  <Link to="/admin/users" className="text-slate-700 hover:text-brand">Admin Users</Link>
                  <Link to="/admin/groups" className="text-slate-700 hover:text-brand">Admin Groups</Link>
                </>
              )}
              <button onClick={handleLogout} className="px-4 py-1.5 rounded-lg bg-brand text-white hover:bg-indigo-700 transition">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-700 hover:text-brand">Login</Link>
              <Link to="/signup" className="px-4 py-1.5 rounded-lg bg-brand text-white hover:bg-indigo-700 transition">Signup</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

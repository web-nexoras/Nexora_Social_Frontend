import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../api/usersApi";
import { FiMenu, FiSearch } from "react-icons/fi";

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/login");
  };

  // Live search while typing (debounced)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await usersApi.search(q);
        setResults(res.data?.users || []);
        setShowResults(true);
      } catch (e) {
        console.error(e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToUser = (id) => {
    setShowResults(false);
    setQuery("");
    navigate(`/user/${id}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (results.length > 0) {
      goToUser(results[0]._id);
    } else if (query.trim()) {
      navigate(`/friends?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 neo-raised">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-slate-100"
        aria-label="Open menu"
      >
        <FiMenu className="h-6 w-6 text-slate-700" />
      </button>

      <div ref={searchRef} className="flex-1 max-w-md relative">
        <form onSubmit={handleSearch}>
          <button
            type="submit"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
            aria-label="Search"
          >
            <FiSearch className="h-4 w-4" />
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setShowResults(true)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 rounded-full neo-input"
          />
        </form>

        {showResults && query.trim() && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl neo-menu border py-2 z-50 max-h-80 overflow-y-auto">
            {searching && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">Searching...</p>
            )}
            {!searching && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">No users found</p>
            )}
            {results.map((u) => (
              <button
                key={u._id}
                onClick={() => goToUser(u._id)}
                className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-slate-50 transition"
              >
                <img
                  src={u.avatar || "https://via.placeholder.com/40"}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.fullname}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                    u.isFriend
                      ? "bg-slate-700 text-white"
                      : u.requestSent
                      ? "bg-slate-300 text-slate-700"
                      : u.requestReceived
                      ? "bg-slate-200 text-slate-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {u.isFriend ? "Friend" : u.requestSent ? "Requested" : u.requestReceived ? "Respond" : "Add"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {user && (
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-800">{user.fullname}</span>
            <span className="text-xs text-slate-400">{user.email}</span>
          </div>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setOpen(!open)}>
              <img
                src={user.avatar || "https://via.placeholder.com/40"}
                alt="avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-brand"
              />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl neo-menu border py-2 z-50">
                <Link to="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Dashboard</Link>
                <Link to="/profile" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Profile</Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Logout</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

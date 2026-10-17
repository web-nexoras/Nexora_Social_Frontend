import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="text-center mt-16">
      <h1 className="text-5xl font-extrabold text-brand mb-4">Nexora Social</h1>
      <p className="text-slate-600 max-w-2xl mx-auto mb-8">
        Connect with friends, chat in realtime, and unlock premium groups.
      </p>
      {user ? (
        <div className="flex justify-center gap-4">
          <Link to="/profile" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-indigo-700 transition">Profile</Link>
          <Link to="/friends" className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-cyan-600 transition">Friends</Link>
          <Link to="/chat" className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition">Chat</Link>
        </div>
      ) : (
        <div className="flex justify-center gap-4">
          <Link to="/login" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-indigo-700 transition">Login</Link>
          <Link to="/signup" className="px-6 py-3 rounded-xl border border-brand text-brand font-semibold hover:bg-indigo-50 transition">Sign Up</Link>
        </div>
      )}
    </div>
  );
}

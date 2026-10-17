import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../api/usersApi";

// Floating action button — always available so any user can message an admin for free.
export default function AdminChatFab() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const openAdminChat = async () => {
    setBusy(true);
    try {
      const res = await usersApi.admins();
      const admin = res.data?.admins?.[0];
      if (admin) {
        navigate(`/chat?user=${admin._id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={openAdminChat}
      disabled={busy}
      title="Chat with admin"
      aria-label="Chat with admin"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand text-white shadow-lg hover:bg-slate-700 transition flex items-center justify-center text-2xl disabled:opacity-60"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </button>
  );
}

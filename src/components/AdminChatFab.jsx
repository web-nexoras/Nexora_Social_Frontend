import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usersApi } from "../api/usersApi";
import { FiMessageSquare } from "react-icons/fi";
import { useToast } from "../context/ToastContext";
import { useSocket } from "../context/SocketContext";

// Floating action button — available everywhere EXCEPT while a chat is open,
// so it never covers or interrupts an ongoing conversation.
export default function AdminChatFab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { chatOpen } = useSocket() || {};
  const [busy, setBusy] = useState(false);

  // Hidden on the chat route and whenever the chat screen is mounted/active.
  if (busy || chatOpen || location.pathname.startsWith("/chat")) return null;

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
      showToast(e?.response?.data?.message || "Could not connect to an admin", "error");
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
      <FiMessageSquare className="h-7 w-7" />
    </button>
  );
}

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { FiBell } from "react-icons/fi";
import { getAuthToken } from "../utils/authToken";
import { SOCKET_URL } from "../api/config";

const SocketContext = createContext({
  socket: null,
  onlineIds: new Set(),
  toast: null,
  showToast: () => {},
  dismissToast: () => {},
  goToChat: () => {},
});

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    // Wait until the API session is confirmed before opening a realtime socket.
    if (!user) {
      setOnlineIds(new Set());
      return;
    }
    const token = getAuthToken();

    const s = io(SOCKET_URL, {
      withCredentials: true,
      auth: token ? { token } : {},
    });
    socketRef.current = s;
    setSocket(s);

    s.on("presence:list", ({ onlineUserIds }) => {
      setOnlineIds(new Set(onlineUserIds || []));
    });
    s.on("user:online", ({ userId }) => {
      setOnlineIds((prev) => new Set(prev).add(userId));
    });
    s.on("user:offline", ({ userId }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on("message:new", (msg) => {
      const senderId = msg.sender?._id || msg.sender;
      const isMine = senderId === user?._id;
      if (isMine) return;

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}

      const convId = msg.conversation?._id || msg.conversation;
      setToast({ convId, text: `New message from ${msg.sender?.fullname || "Someone"}` });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    });

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineIds(new Set());
    };
  }, [user?._id]);

  const showToast = (text, convId = null) => {
    setToast({ convId, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  const dismissToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  };
  const goToChat = (convId) => {
    if (convId) navigate(`/chat?conversation=${convId}`);
    else navigate("/chat");
    dismissToast();
  };

  return (
    <SocketContext.Provider value={{ socket, onlineIds, toast, showToast, dismissToast, goToChat }}>
      {children}
      {toast && (
        <div
          onClick={() => goToChat(toast.convId)}
          className="fixed top-20 right-4 z-[70] bg-slate-900 border border-slate-700 shadow-lg rounded-xl px-4 py-3 text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition"
        >
          <FiBell className="shrink-0" />
          <span>{toast.text}</span>
          <span className="text-xs text-slate-400 ml-2">tap to open</span>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

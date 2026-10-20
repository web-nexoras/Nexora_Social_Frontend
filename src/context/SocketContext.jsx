import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { FiBell } from "react-icons/fi";
import { getAuthToken } from "../utils/authToken";
import { SOCKET_URL } from "../api/config";

const SocketContext = createContext({
  socket: null,
  socketConnected: false,
  onlineIds: new Set(),
  toast: null,
  showToast: () => {},
  dismissToast: () => {},
  goToChat: () => {},
  unreadMessages: 0,
  clearUnreadMessages: () => {},
});

const getSocketUserId = (payload) =>
  typeof payload === "string"
    ? payload
    : payload?.userId || payload?.user?._id || payload?._id || null;

const getSocketMessage = (payload) =>
  payload?.message && typeof payload.message === "object"
    ? payload.message
    : payload;

const getConversationId = (message) => {
  const conversation = message?.conversation;
  return typeof conversation === "string" ? conversation : conversation?._id || null;
};

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const toastTimer = useRef(null);

  useEffect(() => {
    // Wait until the API session is confirmed before opening a realtime socket.
    if (!user) {
      setOnlineIds(new Set());
      setSocketConnected(false);
      return;
    }
    const token = getAuthToken();

    const s = io(SOCKET_URL, {
      withCredentials: true,
      auth: token ? { token } : {},
    });
    socketRef.current = s;
    setSocket(s);
    s.on("connect", () => setSocketConnected(true));
    s.on("disconnect", () => {
      setSocketConnected(false);
      setOnlineIds(new Set());
    });
    s.on("connect_error", () => setSocketConnected(false));

    s.on("presence:list", (payload) => {
      const ids = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.onlineUserIds)
          ? payload.onlineUserIds
          : [];
      setOnlineIds(new Set(ids.map(getSocketUserId).filter(Boolean)));
    });
    s.on("user:online", (payload) => {
      const userId = getSocketUserId(payload);
      if (!userId) return;
      setOnlineIds((prev) => new Set(prev).add(userId));
    });
    s.on("user:offline", (payload) => {
      const userId = getSocketUserId(payload);
      if (!userId) return;
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on("message:new", (payload) => {
      const msg = getSocketMessage(payload);
      if (!msg || typeof msg !== "object") return;
      const senderId = msg.sender?._id || msg.sender;
      const isMine = String(senderId) === String(user?._id);
      if (isMine) return;

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Audio playback is unavailable");
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.onended = () => ctx.close().catch(() => {});
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        // Audio is optional and may be blocked by mobile browser policies.
      }

      const convId = getConversationId(msg);
      setToast({ convId, text: `New message from ${msg.sender?.fullname || "Someone"}` });
      setUnreadMessages((c) => c + 1);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    });

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setSocketConnected(false);
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
  const clearUnreadMessages = () => setUnreadMessages(0);

  return (
    <SocketContext.Provider value={{ socket, socketConnected, onlineIds, toast, showToast, dismissToast, goToChat, unreadMessages, clearUnreadMessages }}>
      {children}
      {toast && (
        <div
          onClick={() => goToChat(toast.convId)}
          className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[70] bg-slate-900 border border-slate-700 shadow-lg rounded-xl px-4 py-3 text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition"
        >
          <FiBell className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">{toast.text}</span>
          <span className="text-xs text-slate-400 ml-2 shrink-0">tap to open</span>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

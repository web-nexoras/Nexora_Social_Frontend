import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { FiBell } from "react-icons/fi";
import { getAuthToken, setAuthToken } from "../utils/authToken";
import { SOCKET_URL } from "../api/config";
import api from "../api/axios";
import IncomingCallOverlay from "../components/IncomingCallOverlay";

const SocketContext = createContext({
  socket: null,
  socketConnected: false,
  onlineIds: new Set(),
  lastSeenById: {},
  toast: null,
  showToast: () => {},
  dismissToast: () => {},
  goToChat: () => {},
  unreadMessages: 0,
  unreadConversations: new Set(),
  clearUnreadMessages: () => {},
  clearConversationUnread: () => {},
  setUnreadConversations: () => {},
  setActiveConversation: () => {},
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
  // userId -> last-seen ISO timestamp (from user:offline presence events)
  const [lastSeenById, setLastSeenById] = useState({});
  const [toast, setToast] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // Conversation ids that have unread messages. Kept here (not inside the Chat
  // page) so the highlight survives navigating away and back.
  const [unreadConversations, setUnreadConversations] = useState(new Set());
  const activeConversationRef = useRef(null);
  // True while the chat screen is mounted — lets other UI (e.g. the chat-with-admin
  // FAB) back off so it never overlaps an active conversation.
  const [chatOpen, setChatOpen] = useState(false);

  // ---------- Global call signaling ----------
  // Incoming call state lives here (not in Chat) so it can ring/show on ANY page.
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callType }
  const [callPendingAccept, setCallPendingAccept] = useState(false);
  const ringRef = useRef({ timer: null, ctx: null });
  const pcRef = useRef(null); // active RTCPeerConnection (managed by Chat)
  const iceBufferRef = useRef([]); // ICE candidates that arrived before the peer existed
  const incomingCallRef = useRef(null); // live mirror of incomingCall for socket handlers
  const refreshRetryRef = useRef(false);
  const toastTimer = useRef(null);

  // Ringtone (callee) / ringback (caller) using WebAudio — no asset files needed.
  const stopRing = () => {
    const r = ringRef.current;
    if (r.timer) {
      clearInterval(r.timer);
      r.timer = null;
    }
    if (r.ctx) {
      try {
        r.ctx.close();
      } catch {
        /* ignore */
      }
      r.ctx = null;
    }
  };

  const startRing = (kind = "ringtone") => {
    stopRing();
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      ringRef.current.ctx = ctx;
      const resume = () => {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      };
      document.addEventListener("pointerdown", resume, { once: true });
      document.addEventListener("touchstart", resume, { once: true, passive: true });
      resume();
      // Master bus with a compressor so the ring can be LOUD without clipping.
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 8;
      master.connect(comp);
      comp.connect(ctx.destination);

      const tone = (freq, at, dur, vol = 0.5, type = "triangle") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      };

      const beep = () => {
        try {
          const now = ctx.currentTime;
          if (kind === "ringback") {
            // Real-telecom dual-tone ringback (425 + 450 Hz) — clean and loud.
            tone(425, now, 1.2, 0.45, "sine");
            tone(450, now, 1.2, 0.45, "sine");
          } else {
            // Bright marimba-style ringtone (E5 · G#5 · B5 · E6) + sparkle
            // overtones, with a softer echo pass — loud, pleasant, premium.
            const notes = [659.25, 830.61, 987.77, 1318.51];
            notes.forEach((f, i) => {
              tone(f, now + i * 0.16, 0.5, 0.55);
              tone(f * 2, now + i * 0.16, 0.28, 0.12, "sine");
            });
            notes.slice(0, 3).forEach((f, i) => {
              tone(f, now + 0.85 + i * 0.16, 0.45, 0.32);
            });
          }
        } catch {
          /* ignore */
        }
      };
      beep();
      ringRef.current.timer = setInterval(beep, kind === "ringback" ? 3500 : 2400);
    } catch {
      // Audio is optional and may be blocked by browser policy.
    }
  };

  const attachPeer = (pc) => {
    pcRef.current = pc;
  };
  const detachPeer = () => {
    pcRef.current = null;
    iceBufferRef.current = [];
  };
  const handleRemoteIce = (candidate) => {
    if (!candidate) return;
    const pc = pcRef.current;
    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      iceBufferRef.current.push(candidate);
    }
  };
  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = iceBufferRef.current.splice(0);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore */
      }
    }
  };
  const clearIncomingCall = () => {
    setIncomingCall(null);
    stopRing();
  };
  const rejectIncomingCall = () => {
    const from = incomingCall?.from;
    if (socketRef.current && from) socketRef.current.emit("call:end", { to: from, reason: "declined" });
    setIncomingCall(null);
    setCallPendingAccept(false);
    stopRing();
  };

  // Socket handlers read the current incoming call through this ref.
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    // Wait until the API session is confirmed before opening a realtime socket.
    if (!user) {
      setOnlineIds(new Set());
      setSocketConnected(false);
      return;
    }
    // Ask for notification permission once on the first user gesture so calls
    // can ring via a system notification while the tab is in the background.
    const askNotifPermission = () => {
      try {
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      } catch {
        /* ignore */
      }
      document.removeEventListener("pointerdown", askNotifPermission);
      document.removeEventListener("touchstart", askNotifPermission);
    };
    document.addEventListener("pointerdown", askNotifPermission);
    document.addEventListener("touchstart", askNotifPermission);
    const s = io(SOCKET_URL, {
      withCredentials: true,
      // Access tokens expire (30m TTL). Read a FRESH token on every
      // (re)connect attempt — a stale snapshot made the socket fail auth
      // silently after any reconnect, so calls/messages stopped arriving.
      auth: (cb) => cb({ token: getAuthToken() }),
    });
    socketRef.current = s;
    setSocket(s);
    s.on("connect", () => {
      refreshRetryRef.current = false;
      setSocketConnected(true);
    });
    s.on("disconnect", () => {
      setSocketConnected(false);
      setOnlineIds(new Set());
    });
    s.on("connect_error", (err) => {
      setSocketConnected(false);
      // Likely an expired handshake token — refresh the session once and retry.
      const msg = String(err?.message || "");
      if (!refreshRetryRef.current && /token|auth/i.test(msg)) {
        refreshRetryRef.current = true;
        api
          .post("/auth/refresh-token")
          .then((res) => {
            const newToken = res.data?.accessToken;
            if (newToken) setAuthToken(newToken);
            s.connect();
          })
          .catch(() => {
            refreshRetryRef.current = false;
          });
      }
    });

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
      if (payload?.lastSeen) {
        setLastSeenById((prev) => ({ ...prev, [userId]: payload.lastSeen }));
      }
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

      // Call-log bubbles are history, not a real message — no popup/sound.
      if (msg.callMeta?.status) return;

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
      if (convId && convId !== activeConversationRef.current) {
        setUnreadConversations((prev) => {
          if (prev.has(convId)) return prev;
          const next = new Set(prev);
          next.add(convId);
          return next;
        });
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    });

    // ---------- Call signaling (works on every page) ----------
    // System notification so a call rings even when the tab is in the background
    // (browser Notification API — no FCM/service-worker setup needed).
    const showCallNotification = (callType) => {
      try {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        if (!document.hidden) return; // visible tab already shows the overlay + ringtone
        const n = new Notification(
          callType === "video" ? "Incoming video call" : "Incoming voice call",
          { body: "Open Nexora to answer", tag: "nexora-call", requireInteraction: true },
        );
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* notifications are optional */
      }
    };
    s.on("call:offer", ({ from, offer, callType }) => {
      if (!from || !offer) return;
      setCallPendingAccept(false);
      setIncomingCall({ from, offer, callType: callType === "video" ? "video" : "audio" });
      startRing("ringtone"); // callee rings until accept/decline/end
      showCallNotification(callType);
    });
    s.on("call:ice", ({ candidate }) => handleRemoteIce(candidate));
    s.on("call:end", () => {
      // Still ringing here → the other side gave up before we answered.
      const wasRinging = !!incomingCallRef.current;
      setIncomingCall(null);
      setCallPendingAccept(false);
      stopRing();
      if (wasRinging) {
        setToast({ convId: null, text: "Missed call" });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
      }
    });

    return () => {
      document.removeEventListener("pointerdown", askNotifPermission);
      document.removeEventListener("touchstart", askNotifPermission);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      stopRing();
      detachPeer();
      setIncomingCall(null);
      setCallPendingAccept(false);
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
  const clearConversationUnread = (conversationId) => {
    if (!conversationId) return;
    setUnreadConversations((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  };
  // Tracks which conversation is currently on screen so a message arriving in
  // that exact chat is never flagged as unread.
  const setActiveConversation = (conversationId) => {
    activeConversationRef.current = conversationId || null;
    if (conversationId) clearConversationUnread(conversationId);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        socketConnected,
        onlineIds,
        lastSeenById,
        toast,
        showToast,
        dismissToast,
        goToChat,
        unreadMessages,
        clearUnreadMessages,
        unreadConversations,
        clearConversationUnread,
        setUnreadConversations,
        setActiveConversation,
        chatOpen,
        setChatOpen,
        incomingCall,
        clearIncomingCall,
        rejectIncomingCall,
        callPendingAccept,
        setCallPendingAccept,
        startRing,
        stopRing,
        attachPeer,
        detachPeer,
        flushIce,
      }}
    >
      {children}
      <IncomingCallOverlay />
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

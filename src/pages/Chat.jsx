import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chatApi } from "../api/chatApi";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:5000";

export default function Chat() {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("user");
  const convParam = searchParams.get("conversation");
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const [highlighted, setHighlighted] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());
  const [toast, setToast] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const playNotificationSound = () => {
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
    } catch (e) {
      console.error("Sound error:", e);
    }
  };

  const loadConversations = async () => {
    const res = await chatApi.conversations();
    setConversations(res.data.conversations || []);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!convParam) return;
    setActiveId(convParam);
  }, [convParam]);

  useEffect(() => {
    if (!targetUserId) return;
    const init = async () => {
      try {
        const res = await chatApi.createDirect(targetUserId);
        const conv = res.data.conversation;
        setActiveId(conv._id);
        setConversations((prev) => {
          const exists = prev.find((c) => c._id === conv._id);
          if (exists) return prev;
          return [conv, ...prev];
        });
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, [targetUserId]);

  useEffect(() => {
    if (!activeId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await chatApi.messages(activeId);
        setMessages(res.data.messages || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeId]);

  useEffect(() => {
    if (activeId) setMobileView("chat");
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.emit("chat:join", { conversationId: activeId });

    socket.on("message:new", (msg) => {
      const senderId = msg.sender?._id || msg.sender;
      const isMine = senderId === user?._id;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (!isMine) {
        playNotificationSound();
        setToast(`New message from ${msg.sender?.fullname || "Someone"}`);
        setTimeout(() => setToast(""), 3000);
        if (msg.conversation !== activeId) {
          setUnreadIds((prev) => new Set(prev).add(msg.conversation));
        }
        setHighlighted((prev) => new Set(prev).add(msg._id));
        setTimeout(() => {
          setHighlighted((prev) => {
            const next = new Set(prev);
            next.delete(msg._id);
            return next;
          });
        }, 3000);
      }
    });

    socket.on("message:deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => socket.disconnect();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    try {
      const res = await chatApi.send(activeId, text);
      const msg = res.data?.message;
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      setText("");
    } catch (e) {
      console.error(e);
    }
  };

  const activeConv = conversations.find((c) => c._id === activeId);
  const otherParticipant = activeConv?.participants?.find((p) => p._id !== user?._id) || activeConv?.participants?.[0];

  const grouped = messages.reduce((acc, msg, idx) => {
    const prev = messages[idx - 1];
    const isSameSender = prev && (prev.sender?._id || prev.sender) === (msg.sender?._id || msg.sender);
    if (isSameSender && acc.length) {
      acc[acc.length - 1].messages.push(msg);
    } else {
      acc.push({ sender: msg.sender, messages: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-6">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-white border border-amber-300 shadow-lg rounded-xl px-4 py-3 text-sm text-slate-800">
          🔔 {toast}
        </div>
      )}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">
        {/* Conversation list */}
        <div className={`bg-white rounded-2xl shadow p-4 md:col-span-1 max-h-48 md:max-h-none md:h-[70vh] overflow-y-auto ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
          <h2 className="text-xl font-bold text-brand mb-4">Conversations</h2>
          {conversations.length === 0 && <p className="text-slate-500 text-sm">No conversations yet</p>}
          {conversations.map((c) => {
            const other = c.type === "group" ? null : c.participants?.find((p) => p._id !== user?._id);
            const unread = unreadIds.has(c._id);
            return (
              <button
                key={c._id}
                onClick={() => {
                  setActiveId(c._id);
                  setUnreadIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c._id);
                    return next;
                  });
                }}
                className={`w-full text-left p-3 rounded-xl mb-2 transition flex items-center gap-3 ${
                  unread ? "bg-amber-50 ring-2 ring-amber-300" : activeId === c._id ? "bg-indigo-100" : "hover:bg-slate-100"
                }`}
              >
                <img src={other?.avatar || "https://via.placeholder.com/40"} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">
                    {c.type === "group" ? c.groupName : other?.fullname}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{c.lastMessage?.text || "No messages yet"}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chat window */}
        <div className={`bg-white rounded-2xl shadow md:col-span-2 flex flex-col h-[60vh] md:h-[70vh] ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          <div className="px-6 py-4 border-b flex items-center gap-3">
            <button
              onClick={() => setMobileView("list")}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              aria-label="Back to list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {otherParticipant && (
              <img src={otherParticipant.avatar || "https://via.placeholder.com/40"} alt="" className="w-9 h-9 rounded-full object-cover" />
            )}
            <h2 className="text-xl font-bold text-brand">
              {activeConv
                ? activeConv.type === "group"
                  ? activeConv.groupName
                  : otherParticipant?.fullname
                : "Select a conversation"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading && <p className="text-center text-slate-400">Loading...</p>}
            {grouped.map((group, gi) => {
              const senderId = group.sender?._id || group.sender;
              const isMe = senderId === user?._id;
              return (
                <div key={gi} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    {!isMe && (
                      <div className="flex items-center gap-2 mb-1">
                        <img src={group.sender?.avatar || "https://via.placeholder.com/24"} alt="" className="w-6 h-6 rounded-full" />
                        <span className="text-xs font-semibold text-slate-500">{group.sender?.fullname}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {group.messages.map((m) => (
                        <div
                          key={m._id}
                          className={`px-4 py-2 rounded-2xl transition ${
                            highlighted.has(m._id)
                              ? "ring-2 ring-accent bg-accent/10"
                              : isMe
                              ? "bg-brand text-white rounded-br-sm"
                              : "bg-slate-100 text-slate-800 rounded-bl-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

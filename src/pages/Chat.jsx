import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { chatApi } from "../api/chatApi";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:5000";

export default function Chat() {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("user");
  const convParam = searchParams.get("conversation");

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  // Load conversations
  const loadConversations = async () => {
    const res = await chatApi.conversations();
    setConversations(res.data.conversations || []);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Load conversation from query param
  useEffect(() => {
    if (!convParam) return;
    setActiveId(convParam);
  }, [convParam]);

  // Create/get direct conversation if targetUserId provided
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

  // Load messages when active conversation changes
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

  // Socket connection
  useEffect(() => {
    if (!activeId) return;
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.emit("chat:join", { conversationId: activeId });

    socket.on("message:new", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("message:deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => socket.disconnect();
  }, [activeId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    try {
      await chatApi.send(activeId, text);
      setText("");
    } catch (e) {
      console.error(e);
    }
  };

  const activeConv = conversations.find((c) => c._id === activeId);

  return (
    <div className="max-w-6xl mx-auto mt-6 grid md:grid-cols-3 gap-6">
      {/* Conversation list */}
      <div className="bg-white rounded-2xl shadow p-4 md:col-span-1 h-[70vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-brand mb-4">Conversations</h2>
        {conversations.length === 0 && <p className="text-slate-500 text-sm">No conversations yet</p>}
        {conversations.map((c) => (
          <button
            key={c._id}
            onClick={() => setActiveId(c._id)}
            className={`w-full text-left p-3 rounded-xl mb-2 transition ${
              activeId === c._id ? "bg-indigo-100" : "hover:bg-slate-100"
            }`}
          >
            <p className="font-medium text-slate-800">
              {c.type === "group" ? c.groupName : c.participants?.map((p) => p.fullname).join(", ")}
            </p>
            <p className="text-xs text-slate-400 truncate">{c.lastMessage?.text || "No messages yet"}</p>
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div className="bg-white rounded-2xl shadow md:col-span-2 flex flex-col h-[70vh]">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-brand">
            {activeConv
              ? activeConv.type === "group"
                ? activeConv.groupName
                : activeConv.participants?.map((p) => p.fullname).join(", ")
              : "Select a conversation"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && <p className="text-center text-slate-400">Loading...</p>}
          {messages.map((m) => (
            <div key={m._id} className="bg-slate-100 rounded-xl px-4 py-2 max-w-[80%]">
              <p className="text-sm font-semibold text-brand">{m.sender?.fullname}</p>
              <p className="text-slate-700">{m.text}</p>
            </div>
          ))}
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
  );
}

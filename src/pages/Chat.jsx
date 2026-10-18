import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chatApi } from "../api/chatApi";
import { groupsApi, paymentsApi } from "../api/groupsApi";
import { usersApi } from "../api/usersApi";
import PaymentMethodModal from "../components/PaymentMethodModal";
import { io } from "socket.io-client";
import {
  FiBell,
  FiLock,
  FiPlus,
  FiTrash2,
  FiSave,
  FiX,
  FiEdit2,
  FiMoreVertical,
  FiArrowLeft,
} from "react-icons/fi";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:5000";

export default function Chat() {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("user");
  const convParam = searchParams.get("conversation");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const [highlighted, setHighlighted] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());
  const [toast, setToast] = useState("");
  const [lockedGroup, setLockedGroup] = useState(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [memberMsg, setMemberMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const [payTxn, setPayTxn] = useState(null);
  const [payMethod, setPayMethod] = useState("bkash");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [payDone, setPayDone] = useState(false);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [menuConvId, setMenuConvId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
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

  // Detect if the active conversation is a group the user is NOT a member of
  useEffect(() => {
    let alive = true;
    if (!activeId) {
      setLockedGroup(null);
      setActiveGroup(null);
      return;
    }
    // Reset the add-member panel when switching conversations
    setShowAddMember(false);
    setMemberQuery("");
    setMemberResults([]);
    setMemberMsg("");
    setGroupMembers([]);
    (async () => {
      try {
        const res = await groupsApi.byConversation(activeId);
        if (!alive) return;
        const group = res.data?.group || null;
        setActiveGroup(group);
        const isAdmin = user?.role === "admin";
        if (res.data?.isMember || isAdmin) {
          // Admin can always view/moderate any group
          setLockedGroup(null);
        } else {
          setLockedGroup(group);
          setShowSubscribe(true);
        }
      } catch (e) {
        // Not a group conversation (direct chat) — nothing locked
        if (alive) {
          setLockedGroup(null);
          setActiveGroup(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeId]);

  useEffect(() => {
    if (activeId) setMobileView("chat");
  }, [activeId]);

  // Keep the group member list in sync while the add-member panel is open
  useEffect(() => {
    if (showAddMember && activeGroup) loadMembers(activeGroup._id);
  }, [showAddMember, activeGroup]);

  useEffect(() => {
    const token = localStorage.getItem("accTkn");
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: token && token !== "undefined" ? { token } : {},
    });
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

    // A conversation was deleted (by admin or a participant) — drop it from the list
    socket.on("conversation:deleted", ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
      if (conversationId === activeId) {
        setActiveId(null);
        setMessages([]);
        setMobileView("list");
      }
    });

    // Presence — who is currently online (for the green "Active" indicator)
    socket.on("presence:list", ({ onlineUserIds }) => {
      setOnlineIds(new Set(onlineUserIds || []));
    });
    socket.on("user:online", ({ userId }) => {
      setOnlineIds((prev) => new Set(prev).add(userId));
    });
    socket.on("user:offline", ({ userId }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // A message was edited by its author (or an admin)
    socket.on("message:updated", ({ message }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? { ...m, text: message.text, editedAt: message.editedAt } : m))
      );
    });

    return () => socket.disconnect();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close the conversation options (⋮) menu when clicking anywhere else
  useEffect(() => {
    if (!menuConvId) return;
    const close = () => setMenuConvId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuConvId]);

  // ---- Message editing ----
  const startEdit = (m) => {
    setEditingId(m._id);
    setEditText(m.text || "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };
  const saveEdit = async (messageId) => {
    const nextText = editText.trim();
    if (!nextText) return;
    try {
      await chatApi.updateMessage(messageId, nextText);
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, text: nextText, editedAt: new Date() } : m))
      );
      cancelEdit();
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (lockedGroup) {
      setShowSubscribe(true);
      return;
    }
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

  const subscribeGroup = async () => {
    if (!lockedGroup) return;
    setSubscribing(true);
    setSubscribeMsg("");
    try {
      // Create the pending subscription, then open our own method picker
      // instead of redirecting to the SSLCommerz hosted page.
      const res = await paymentsApi.initSubscription(lockedGroup._id);
      setPayTxn(res.data?.transactionId || null);
      setPayMethod("bkash");
      setPayMsg("");
      setPayDone(false);
      setShowSubscribe(false);
      setShowPay(true);
    } catch (e) {
      setSubscribeMsg(e?.response?.data?.message || "Subscription failed");
    } finally {
      setSubscribing(false);
    }
  };

  const confirmPayment = async () => {
    if (!payTxn) {
      setPayMsg("No payment session found. Close and try again.");
      return;
    }
    setPaying(true);
    setPayMsg("");
    try {
      const res = await paymentsApi.demoConfirm(payTxn, payMethod);
      setPayMsg(res.data?.message || "Payment successful");
      setPayDone(true);
      // Now a member — refresh the conversation so the group unlocks
      setShowSubscribe(false);
      setLockedGroup(null);
      await loadConversations();
      if (activeId) {
        try {
          const mres = await chatApi.messages(activeId);
          setMessages(mres.data.messages || []);
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      setPayMsg(e?.response?.data?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const removeMessage = async (messageId) => {
    try {
      await chatApi.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (e) {
      console.error(e);
    }
  };

  const removeConversation = async (c) => {
    const label = c.type === "group" ? c.groupName : "this conversation";
    if (!window.confirm(`Delete "${label}" and all of its messages? This cannot be undone.`)) return;
    try {
      await chatApi.deleteConversation(c._id);
      setConversations((prev) => prev.filter((x) => x._id !== c._id));
      if (activeId === c._id) {
        setActiveId(null);
        setMessages([]);
        setMobileView("list");
      }
      setToast("Conversation deleted");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      console.error(e);
      setToast(e?.response?.data?.message || "Failed to delete conversation");
      setTimeout(() => setToast(""), 2500);
    }
  };

  const searchMembers = async (q) => {
    setMemberQuery(q);
    if (!q.trim()) {
      setMemberResults([]);
      return;
    }
    try {
      const res = await usersApi.search(q.trim());
      setMemberResults(res.data?.users || []);
    } catch (e) {
      setMemberResults([]);
    }
  };

  const loadMembers = async (groupId) => {
    try {
      const res = await groupsApi.members(groupId);
      setGroupMembers(res.data?.members || []);
    } catch (e) {
      setGroupMembers([]);
    }
  };

  const addMemberToGroup = async (userId, name) => {
    if (!activeGroup) return;
    setAdding(true);
    setMemberMsg("");
    try {
      const res = await groupsApi.addMembers(activeGroup._id, [userId]);
      const added = res.data?.addedCount ?? 0;
      setMemberMsg(added > 0 ? `${name || "Member"} was added to ${activeGroup.name}` : "Already a member of this group");
      setMemberQuery("");
      setMemberResults([]);
      loadMembers(activeGroup._id); // refresh so the added member shows in the list below
    } catch (e) {
      setMemberMsg(e?.response?.data?.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const activeConv = conversations.find((c) => c._id === activeId);
  const otherParticipant = activeConv?.participants?.find((p) => p._id !== user?._id) || activeConv?.participants?.[0];
  const isOtherOnline = Boolean(otherParticipant && onlineIds.has(otherParticipant._id));

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
        <div className="fixed top-20 right-4 z-50 bg-slate-900 border border-slate-700 shadow-lg rounded-xl px-4 py-3 text-sm text-white flex items-center gap-2">
          <FiBell className="shrink-0" /> {toast}
        </div>
      )}

      {lockedGroup && showSubscribe && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl neo-modal max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl mb-3">
              <FiLock />
            </div>
            <h3 className="text-xl font-bold text-brand mb-2">Join this group</h3>
            <p className="text-slate-600 mb-3">
              You are not a member of <strong>{lockedGroup.name}</strong> yet. If you want to be
              added to this group, you can subscribe.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              After a successful payment, the admin will add you to the group.
            </p>
            {subscribeMsg && <p className="text-sm text-red-500 mb-4">{subscribeMsg}</p>}
            <div className="flex gap-3">
              <button
                onClick={subscribeGroup}
                disabled={subscribing}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition disabled:opacity-60"
              >
                {subscribing ? "Redirecting..." : "Subscribe"}
              </button>
              <button
                onClick={() => setShowSubscribe(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: add a member to this group from inside the chat */}
      {showAddMember && activeGroup && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl neo-modal max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl mb-3">
              <FiPlus />
            </div>
            <h3 className="text-xl font-bold text-brand mb-1">Add member</h3>
            <p className="text-sm text-slate-500 mb-4">
              Adding to <strong>{activeGroup.name}</strong> — free, no payment needed.
            </p>
            <input
              value={memberQuery}
              onChange={(e) => searchMembers(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-4 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-brand"
            />
            <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
              {memberResults.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-2">
                  {memberQuery ? "No users found" : "Type to search users"}
                </p>
              )}
              {memberResults.map((u) => (
                <div key={u._id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <img src={u.avatar || "https://via.placeholder.com/32"} alt="" className="w-7 h-7 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.fullname}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => addMemberToGroup(u._id, u.fullname)}
                    disabled={adding}
                    className="text-xs px-3 py-1 rounded bg-brand text-white hover:bg-slate-700 disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
            {memberMsg && <p className="text-sm text-slate-700 mb-3">{memberMsg}</p>}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Current members ({groupMembers.length})
              </p>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {groupMembers.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-2">No members yet</p>
                )}
                {groupMembers.map((m) => (
                  <div key={m._id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <img
                      src={m.user?.avatar || "https://via.placeholder.com/32"}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{m.user?.fullname}</p>
                      <p className="text-xs text-slate-400 truncate">{m.user?.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowAddMember(false)}
              className="w-full px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Custom mobile-banking payment method picker (demo) */}
      {showPay && lockedGroup && (
        <PaymentMethodModal
          group={lockedGroup}
          selected={payMethod}
          onSelect={setPayMethod}
          onConfirm={confirmPayment}
          onCancel={() => setShowPay(false)}
          paying={paying}
          msg={payMsg}
        />
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
              <div
                key={c._id}
                onClick={() => {
                  setActiveId(c._id);
                  setUnreadIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c._id);
                    return next;
                  });
                }}
                className={`group/conv w-full text-left p-3 rounded-xl mb-2 transition flex items-center gap-3 cursor-pointer ${
                  unread ? "bg-slate-200 ring-2 ring-slate-400" : activeId === c._id ? "bg-slate-300" : "hover:bg-slate-100"
                }`}
              >
                <img src={other?.avatar || "https://via.placeholder.com/40"} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate flex items-center gap-1.5">
                    <span className="truncate">{c.type === "group" ? c.groupName : other?.fullname}</span>
                    {c.type !== "group" && other && (
                      <span
                        title={onlineIds.has(other._id) ? "Active now" : "Offline"}
                        className={`h-2 w-2 rounded-full shrink-0 ${onlineIds.has(other._id) ? "bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.9)]" : "bg-slate-300"}`}
                      />
                    )}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{c.lastMessage?.text || "No messages yet"}</p>
                </div>
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuConvId(menuConvId === c._id ? null : c._id);
                    }}
                    title="Conversation options"
                    aria-label="Conversation options"
                    aria-haspopup="menu"
                    className="shrink-0 p-1 rounded opacity-0 group-hover/conv:opacity-100 focus:opacity-100 text-slate-900 hover:text-slate-600 transition"
                  >
                    <FiMoreVertical />
                  </button>
                  {menuConvId === c._id && (
                    <div className="absolute right-0 z-30 mt-1 w-40 bg-white rounded-xl neo-menu border py-1 text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuConvId(null);
                          removeConversation(c);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-red-600 hover:bg-red-50"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
              <FiArrowLeft className="h-5 w-5 text-slate-700" />
            </button>
            {otherParticipant && (
              <img src={otherParticipant.avatar || "https://via.placeholder.com/40"} alt="" className="w-9 h-9 rounded-full object-cover" />
            )}
            <h2 className="text-xl font-bold text-brand">
              {lockedGroup
                ? lockedGroup.name
                : activeConv
                ? activeConv.type === "group"
                  ? activeConv.groupName
                  : otherParticipant?.fullname
                : "Select a conversation"}
              {lockedGroup && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <FiLock /> Not joined
                </span>
              )}
            </h2>
            {activeConv && activeConv.type !== "group" && otherParticipant && (
              <span
                title={isOtherOnline ? "Active now" : "Offline"}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  isOtherOnline ? "text-green-600" : "text-slate-400"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isOtherOnline
                      ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.9)]"
                      : "bg-slate-400"
                  }`}
                />
                {isOtherOnline ? "Active" : "Offline"}
              </span>
            )}
            {activeGroup && user?.role === "admin" && (
              <button
                onClick={() => setShowAddMember(true)}
                className="ml-auto shrink-0 text-xs px-3 py-1.5 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition"
              >
                + Add Member
              </button>
            )}
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
                      {group.messages.map((m) =>
                        editingId === m._id ? (
                          <div key={m._id} className="flex items-center gap-1">
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveEdit(m._id);
                                }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              className="px-3 py-2 rounded-2xl border border-slate-300 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-brand w-64 max-w-[60vw]"
                            />
                            <button
                              onClick={() => saveEdit(m._id)}
                              title="Save edit"
                              aria-label="Save edit"
                              className="shrink-0 p-1 text-slate-900 hover:text-slate-600 transition"
                            >
                              <FiSave size={15} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel edit"
                              aria-label="Cancel edit"
                              className="shrink-0 p-1 text-slate-500 hover:text-slate-700 transition"
                            >
                              <FiX size={15} />
                            </button>
                          </div>
                        ) : (
                          <div key={m._id} className="group/msg flex items-center gap-1">
                            <div
                              className={`px-4 py-2 rounded-2xl transition ${
                                highlighted.has(m._id)
                                  ? "ring-2 ring-accent bg-accent/10"
                                  : isMe
                                  ? "bg-brand text-white rounded-br-sm"
                                  : "bg-slate-100 text-slate-800 rounded-bl-sm"
                              }`}
                            >
                              {m.text}
                              {m.editedAt && (
                                <span className="ml-1.5 text-[10px] opacity-70 align-middle">(edited)</span>
                              )}
                            </div>
                            {isMe && (
                              <button
                                onClick={() => startEdit(m)}
                                title="Edit message"
                                aria-label="Edit message"
                                className="shrink-0 p-1 opacity-0 group-hover/msg:opacity-100 focus:opacity-100 text-slate-900 hover:text-slate-600 transition"
                              >
                                <FiEdit2 size={14} />
                              </button>
                            )}
                            {(isMe || isAdmin) && (
                              <button
                                onClick={() => removeMessage(m._id)}
                                title="Delete message"
                                aria-label="Delete message"
                                className="shrink-0 p-1 opacity-0 group-hover/msg:opacity-100 focus:opacity-100 text-slate-900 hover:text-slate-600 transition"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {lockedGroup ? (
            <div className="p-4 border-t text-center">
              <p className="text-sm text-slate-500 mb-2">
                You need a subscription to send messages in this group.
              </p>
              <button
                onClick={() => setShowSubscribe(true)}
                className="px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition"
              >
                Subscribe to Join
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

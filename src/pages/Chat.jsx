import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { chatApi } from "../api/chatApi";
import { groupsApi, paymentsApi } from "../api/groupsApi";
import { usersApi } from "../api/usersApi";
import { friendsApi } from "../api/friendsApi";
import { followsApi } from "../api/followsApi";
import PaymentMethodModal from "../components/PaymentMethodModal";
import InlineLoader from "../components/InlineLoader";
import Skeleton from "../components/Skeleton";
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
  FiSearch,
  FiUserPlus,
} from "react-icons/fi";

export default function Chat() {
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("user");
  const convParam = searchParams.get("conversation");
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  // highlighted state removed to avoid temporary color/border on new messages
  const [unreadIds, setUnreadIds] = useState(new Set());
  const { socket, socketConnected, onlineIds, clearUnreadMessages } = useSocket();
  const { showToast } = useToast();
  const [lockedGroup, setLockedGroup] = useState(null);

  const activeIdRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [memberMsg, setMemberMsg] = useState("");
  const memberSearchSequence = useRef(0);
  const [adding, setAdding] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const [payTxn, setPayTxn] = useState(null);
  const [payMethod, setPayMethod] = useState("bkash");
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [menuConvId, setMenuConvId] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [avatarMenuId, setAvatarMenuId] = useState(null);

  useEffect(() => {
    if (!avatarMenuId) return;
    const handler = (e) => {
      const target = e.target;
      // Keep menu open when interacting with the chat input area
      if (target && target.closest && target.closest("form")) return;
      if (target && target.closest && target.closest("[data-avatar-menu]")) return;
      setAvatarMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarMenuId]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const loadConversations = async () => {
    try {
      const res = await chatApi.conversations();
      setConversations(res.data?.conversations || []);
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not load conversations", "error");
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await usersApi.search(q.trim());
      setSearchResults(res.data?.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openDirectChat = async (userId) => {
    try {
      const res = await chatApi.createDirect(userId);
      const conv = res.data.conversation;
      setActiveId(conv._id);
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id);
        if (exists) return prev;
        return [conv, ...prev];
      });
      setSearchQuery("");
      setSearchResults([]);
      setMobileView("chat");
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not open chat", "error");
    }
  };

  useEffect(() => {
    loadConversations();
    clearUnreadMessages();
    (async () => {
      try {
        const res = await friendsApi.list();
        setFriendsList(res.data?.friends || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!convParam) return;
    setActiveId(convParam);
  }, [convParam]);

  useEffect(() => {
    if (!targetUserId || targetUserId === user?._id) return;
    let alive = true;
    const init = async () => {
      try {
        const res = await chatApi.createDirect(targetUserId);
        if (!alive) return;
        const conv = res.data.conversation;
        setActiveId(conv._id);
        setConversations((prev) => {
          const exists = prev.find((c) => c._id === conv._id);
          if (exists) return prev;
          return [conv, ...prev];
        });
      } catch (e) {
        if (!alive) return;
        const msg = e?.response?.data?.message || "Could not open chat";
        showToast(msg);
      }
    };
    init();
    return () => {
      alive = false;
    };
  }, [targetUserId]);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    const load = async () => {
      setMessages([]);
      setLoading(true);
      try {
        const res = await chatApi.messages(activeId);
        if (alive) setMessages(res.data?.messages || []);
      } catch (e) {
        if (alive) {
          showToast(e?.response?.data?.message || "Could not load messages", "error");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [activeId, showToast]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (!activeId) return;
    chatApi.markRead(activeId).catch(() => {});
    const msgs = messages;
    if (socket && msgs.length) {
      socket.emit("message:read", { conversationId: activeId, messageIds: msgs.map((m) => m._id) });
    }
  }, [activeId]);

  // Keep a pending group chat in sync when an admin approves the subscription.
  useEffect(() => {
    if (!activeId || !lockedGroup) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await groupsApi.byConversation(activeId);
        if (!res.data?.isMember) return;
        setLockedGroup(null);
        showToast("Your subscription was approved. You have joined the group.", "success");
        const messagesRes = await chatApi.messages(activeId);
        setMessages(messagesRes.data?.messages || []);
      } catch (e) {
        // Transient refresh errors should not interrupt the chat.
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [activeId, lockedGroup?._id]);

  // Detect if the active conversation is a group the user is NOT a member of
  useEffect(() => {
    let alive = true;
    if (!activeId) {
      setLockedGroup(null);
      setActiveGroup(null);
      return;
    }
    // Reset the add-member panel when switching conversations
    memberSearchSequence.current += 1;
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

  // Keep the latest active conversation available inside long-lived socket handlers
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ONE persistent socket for the whole chat session — switching conversations
  // never disconnects/reconnects (instant presence + instant messages)
  // Attach message handlers to the shared global socket (no reconnect on switch)
  useEffect(() => {
    if (!socket) return;

    const onMessageNew = (payload) => {
      const msg = payload?.message && typeof payload.message === "object"
        ? payload.message
        : payload;
      if (!msg || typeof msg !== "object") return;
      const conversation = msg.conversation;
      const convId = typeof conversation === "string" ? conversation : conversation?._id;
      if (!convId || !msg._id) return;
      const isActiveConv = String(convId) === String(activeIdRef.current);

      if (isActiveConv) {
        setMessages((prev) =>
          prev.some((m) => m._id === msg._id) ? prev : [...prev, msg],
        );
        // no temporary highlight; message keeps its normal color
      } else {
        setUnreadIds((prev) => new Set(prev).add(convId));
      }

      // Keep the conversation list preview + order fresh without a reload
      setConversations((prev) => {
        const next = prev.map((c) =>
          c._id === convId
            ? {
                ...c,
                lastMessage: { text: msg.text || "", sender: msg.sender },
                lastMessageAt: msg.createdAt || new Date().toISOString(),
              }
            : c,
        );
        return next.sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0),
        );
      });
    };

    const onMessageDeleted = (payload) => {
      const messageId = payload?.messageId || payload?.message?._id || payload?._id;
      if (!messageId) return;
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    // A conversation was deleted (by admin or a participant) — drop it from the list
    const onConversationDeleted = (payload) => {
      const rawConversationId = payload?.conversationId || payload?.conversation;
      const conversationId = typeof rawConversationId === "string"
        ? rawConversationId
        : rawConversationId?._id;
      if (!conversationId) return;
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
      if (conversationId === activeIdRef.current) {
        setActiveId(null);
        setMessages([]);
        setMobileView("list");
      }
    };

    // A message was edited by its author (or an admin)
    const onMessageUpdated = (payload) => {
      const message = payload?.message || payload;
      if (!message?._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === message._id
            ? { ...m, text: message.text, editedAt: message.editedAt }
            : m,
        ),
      );
    };

    socket.on("message:new", onMessageNew);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("conversation:deleted", onConversationDeleted);
    socket.on("message:updated", onMessageUpdated);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("conversation:deleted", onConversationDeleted);
      socket.off("message:updated", onMessageUpdated);
    };
  }, [socket]);

  // Join the open conversation's room (socket already alive — instant)
  useEffect(() => {
    if (activeId && socket) {
      socket.emit("chat:join", { conversationId: activeId });
    }
  }, [activeId, socket]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
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
        prev.map((m) =>
          m._id === messageId
            ? { ...m, text: nextText, editedAt: new Date() }
            : m,
        ),
      );
      cancelEdit();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Could not update message", "error");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (lockedGroup) {
      setShowSubscribe(true);
      return;
    }
    const content = text.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await chatApi.send(activeId, content);
      const msg = res.data?.message;
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    } catch (e) {
      console.error(e);
      setText(content);
      showToast(e?.response?.data?.message || "Message could not be sent", "error");
    } finally {
      setSending(false);
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
      await paymentsApi.demoConfirm(payTxn, payMethod);
      showToast("Payment successful. Your request was sent to the admin; group access starts after approval.", "success", 7000);
      setShowPay(false);
      setShowSubscribe(false);
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
      showToast(e?.response?.data?.message || "Could not delete message", "error");
    }
  };

  const removeConversation = async (c) => {
    const label = c.type === "group" ? c.groupName : "this conversation";
    if (
      !window.confirm(
        `Delete "${label}" and all of its messages? This cannot be undone.`,
      )
    )
      return;
    try {
      await chatApi.deleteConversation(c._id);
      setConversations((prev) => prev.filter((x) => x._id !== c._id));
      if (activeId === c._id) {
        setActiveId(null);
        setMessages([]);
        setMobileView("list");
      }
      showToast("Conversation deleted");
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Failed to delete conversation");
    }
  };

  const searchMembers = async (q) => {
    const sequence = ++memberSearchSequence.current;
    setMemberQuery(q);
    if (!q.trim()) {
      setMemberResults([]);
      return;
    }
    try {
      const res = await usersApi.search(q.trim());
      if (sequence === memberSearchSequence.current) {
        setMemberResults(res.data?.users || []);
      }
    } catch (e) {
      if (sequence === memberSearchSequence.current) setMemberResults([]);
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
      setMemberMsg(
        added > 0
          ? `${name || "Member"} was added to ${activeGroup.name}`
          : "Already a member of this group",
      );
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
  const otherParticipant =
    activeConv?.participants?.find((p) => p._id !== user?._id) ||
    activeConv?.participants?.[0];
  const isOtherOnline = Boolean(
    otherParticipant && onlineIds.has(otherParticipant._id),
  );

  const grouped = messages.reduce((acc, msg, idx) => {
    const prev = messages[idx - 1];
    const isSameSender =
      prev &&
      (prev.sender?._id || prev.sender) === (msg.sender?._id || msg.sender);
    if (isSameSender && acc.length) {
      acc[acc.length - 1].messages.push(msg);
    } else {
      acc.push({ sender: msg.sender, messages: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-6">
      {lockedGroup && showSubscribe && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl neo-modal max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl mb-3">
              <FiLock />
            </div>
            <h3 className="text-xl font-bold text-brand mb-2">
              Join this group
            </h3>
            <p className="text-slate-600 mb-3">
              You are not a member of <strong>{lockedGroup.name}</strong> yet.
              Subscribe to join and unlock the group chat.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Your membership activates after the admin approves your payment.
            </p>
            {subscribeMsg && (
              <p className="text-sm text-red-500 mb-4">{subscribeMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={subscribeGroup}
                disabled={subscribing}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-cyan-600 transition disabled:opacity-60"
              >
                {subscribing ? "Preparing payment..." : "Subscribe"}
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
              Adding to <strong>{activeGroup.name}</strong> — free, no payment
              needed.
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
                <div
                  key={u._id}
                  className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"
                >
                  <img
                    src={u.avatar || "https://via.placeholder.com/32"}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {u.fullname}
                    </p>
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
            {memberMsg && (
              <p className="text-sm text-slate-700 mb-3">{memberMsg}</p>
            )}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Current members ({groupMembers.length})
              </p>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {groupMembers.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-2">
                    No members yet
                  </p>
                )}
                {groupMembers.map((m) => (
                  <div
                    key={m._id}
                    className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <img
                      src={m.user?.avatar || "https://via.placeholder.com/32"}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">
                        {m.user?.fullname}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {m.user?.email}
                      </p>
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

      <div className="flex flex-col gap-6">
        {/* Conversation list */}
        <div
          className={`bg-white rounded-2xl shadow p-4 h-[calc(100vh-6rem)] overflow-y-auto ${activeId ? "hidden" : "block"}`}
        >
          {/* Search */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand"
            />
          </div>

          {searchQuery.trim() && (
            <div className="mb-3 space-y-1">
              {searching && <p className="text-xs text-slate-400">Searching...</p>}
              {!searching && searchResults.length === 0 && (
                <p className="text-xs text-slate-400">No users found</p>
              )}
              {searchResults.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                  onClick={() => openDirectChat(u._id)}
                >
                  <img src={u.avatar || "https://via.placeholder.com/32"} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.fullname}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDirectChat(u._id); }}
                    className="text-xs px-2 py-1 rounded bg-brand text-white"
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searchQuery.trim() && friendsList.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Friends</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {friendsList.map((f) => {
                  const person = f.friend;
                  if (!person) return null;
                  return (
                    <div key={person._id} className="shrink-0 flex flex-col items-center gap-1 cursor-pointer" onClick={() => openDirectChat(person._id)}>
                      <img src={person.avatar || "https://via.placeholder.com/40"} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-slate-200" />
                      <span className="text-xs truncate w-14 text-center">{person.fullname?.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Conversations</p>
          {conversations.length === 0 && !searchQuery.trim() && (
            <p className="text-slate-500 text-sm">No conversations yet</p>
          )}
          {conversations.map((c) => {
            const other =
              c.type === "group"
                ? null
                : c.participants?.find((p) => p._id !== user?._id);
            const unread = unreadIds.has(c._id);
            return (
              <div
                key={c._id}
                onClick={() => {
                  setActiveId(c._id);
                  setMobileView("chat");
                  setUnreadIds((prev) => {
                    const next = new Set(prev);
                    next.delete(c._id);
                    return next;
                  });
                }}
                className={`group/conv w-full text-left p-3 rounded-xl mb-2 transition flex items-center gap-3 cursor-pointer ${
                  unread
                    ? "bg-slate-200 ring-2 ring-slate-400"
                    : activeId === c._id
                      ? "bg-slate-300"
                      : "hover:bg-slate-100"
                }`}
              >
                <div className="relative">
                  <img
                    src={other?.avatar || "https://via.placeholder.com/40"}
                    alt=""
                    className={`w-10 h-10 rounded-full object-cover ${unread ? "ring-2 ring-brand" : ""}`}
                  />
                  {unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate flex items-center gap-1.5 ${unread ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>
                    <span className="truncate">
                      {c.type === "group" ? c.groupName : other?.fullname}
                    </span>
                    {c.type !== "group" && other && (
                      <span
                        title={
                          onlineIds.has(other._id) ? "Active now" : "Offline"
                        }
                        className={`h-2 w-2 rounded-full shrink-0 ${onlineIds.has(other._id) ? "bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.9)]" : "bg-slate-300"}`}
                      />
                    )}
                  </p>
                  <p className={`text-xs truncate ${unread ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
                    {c.lastMessage?.text || "No messages yet"}
                  </p>
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
                  {menuConvId === c._id && (c.type !== "group" || isAdmin) && (
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
        <div
          className={`bg-white rounded-2xl shadow flex flex-col h-[calc(100vh-6rem)] min-h-[20rem] ${activeId ? "flex" : "hidden"}`}
        >
          <div className="pl-2 pr-6 py-4 border-b flex items-center gap-3">
            <button
              onClick={() => { setActiveId(null); setMessages([]); setMobileView("list"); }}
              className="shrink-0 p-2 rounded-lg hover:bg-indigo-50 text-slate-600 hover:text-brand transition border-0"
              title="Back to conversations"
            >
              <FiArrowLeft />
            </button>
            {otherParticipant && (
              <img
                src={
                  otherParticipant.avatar || "https://via.placeholder.com/40"
                }
                alt=""
                className="w-9 h-9 rounded-full object-cover"
              />
            )}
            <button
              onClick={() => {
                if (activeConv?.type !== "group" && otherParticipant?._id) {
                  navigate(`/user/${otherParticipant._id}`);
                }
              }}
              className="text-xl font-bold text-brand"
            >
              {lockedGroup
                ? lockedGroup.name
                : activeConv
                  ? activeConv.type === "group"
                    ? activeConv.groupName
                    : otherParticipant?.fullname
                  : ""}
            </button>
            {lockedGroup && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <FiLock /> Not joined
              </span>
            )}
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
            {!socketConnected && (
              <span className="ml-auto shrink-0 text-xs font-medium text-amber-600" role="status">
                Reconnecting…
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
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-12 w-1/2 ml-auto" />
                <Skeleton className="h-12 w-3/4" />
              </div>
            )}
            {grouped.map((group, gi) => {
              const senderId = group.sender?._id || group.sender;
              const isMe = senderId === user?._id;
              return (
                <div
                  key={gi}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[75%]">
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
                          <div
                            key={m._id}
                            className="group/msg flex items-end gap-2"
                          >
                            {!isMe && (
                              <div className="relative shrink-0">
                                <img
                                  src={group.sender?.avatar || otherParticipant?.avatar || "https://via.placeholder.com/24"}
                                  alt=""
                                  className="w-6 h-6 rounded-full mb-1 cursor-pointer hover:ring-2 hover:ring-brand"
                                  onClick={() => setAvatarMenuId(avatarMenuId === m._id ? null : m._id)}
                                />
                                {avatarMenuId === m._id && (
                                  <div data-avatar-menu className="absolute left-0 top-full mt-1 z-30 w-36 bg-white rounded-xl neo-menu border py-1 text-sm shadow">
                                    <button
                                      onClick={() => {
                                        setAvatarMenuId(null);
                                        navigate(`/user/${group.sender?._id || otherParticipant?._id}`);
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-slate-50"
                                    >
                                      View profile
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAvatarMenuId(null);
                                        showToast("Block feature coming soon", "info");
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-2 text-red-600 hover:bg-red-50"
                                    >
                                      Block
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex flex-col">
                              {!isMe && activeConv?.type === "group" && (
                                <span className="text-[10px] font-semibold text-slate-500 mb-0.5 ml-1">
                                  {group.sender?.fullname}
                                </span>
                              )}
                            <div
                              className={`px-4 py-2 rounded-2xl transition ${
                                isMe
                                  ? "bg-brand text-white rounded-br-sm"
                                  : "bg-slate-100 text-slate-800 rounded-bl-sm"
                              }`}
                            >
                              {m.text}
                              {m.editedAt && (
                                <span className="ml-1.5 text-[10px] opacity-70 align-middle">
                                  (edited)
                                </span>
                              )}
                            </div>
                            {isMe && (
                              <div className="text-[10px] text-slate-300 text-right mt-0.5">
                                {Array.isArray(m.readBy) && m.readBy.some((r) => String(r) !== String(user?._id)) ? "Seen" : "Sent"}
                              </div>
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
                        ),
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

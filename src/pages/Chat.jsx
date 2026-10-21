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
import { ICE_SERVERS } from "../api/config";
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
  FiPhone,
  FiVideo,
  FiSmile,
  FiBookmark,
  FiInfo,
  FiPhoneOff,
  FiMic,
  FiMicOff,
  FiVideoOff,
  FiMinimize2,
} from "react-icons/fi";

// FB-style message reactions (long-press the bubble to open the picker)
const MSG_REACTIONS = [
  { key: "like", emoji: "👍", label: "Like" },
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "haha", emoji: "😂", label: "Haha" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "angry", emoji: "😠", label: "Angry" },
];
const MSG_EMOJI = Object.fromEntries(MSG_REACTIONS.map((r) => [r.key, r.emoji]));

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
  const { socket, socketConnected, onlineIds, lastSeenById, clearUnreadMessages, setChatOpen, incomingCall, clearIncomingCall, callPendingAccept, setCallPendingAccept, startRing, stopRing, attachPeer, detachPeer, flushIce } = useSocket();

  // Mark chat as active while this screen is open — hides the chat-with-admin FAB
  // so it never pops up over an ongoing conversation.
  useEffect(() => {
    setChatOpen(true);
    return () => setChatOpen(false);
  }, [setChatOpen]);
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
  const [msgMenuId, setMsgMenuId] = useState(null); // message 3-dot menu
  const [reactPickerFor, setReactPickerFor] = useState(null); // long-press reaction picker
  const pressTimerRef = useRef(null); // long-press timer
  const pickerOpenedAtRef = useRef(0); // ignores the click that follows a long-press
  const [editText, setEditText] = useState("");
  // Call UI: inCall = media session exists, callPhase = "calling" (ringing out)
  // or "connected" (answered).
  const [inCall, setInCall] = useState(false);
  const [callPhase, setCallPhase] = useState(null);
  const [callType, setCallType] = useState("audio");
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [callMinimized, setCallMinimized] = useState(false);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const answeredRef = useRef(false);
  const ringTimeoutRef = useRef(null);
  const activeConvRef = useRef(null);
  const otherParticipantRef = useRef(null);

  const fmtTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Live mirror of callPhase for socket handlers (avoids stale closures).
  const callPhaseRef = useRef(null);
  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  // Call duration ticks only while the call is actually connected
  useEffect(() => {
    if (callPhase !== "connected") return;
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callPhase]);

  const loadConversations = async () => {
    try {
      const res = await chatApi.conversations();
      setConversations(res.data?.conversations || []);
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not load conversations", "error");
    }
  };

  const startCall = async (type) => {
    if (!socket || !otherParticipant?._id || activeConv?.type !== "direct") {
      showToast("Calls only available in direct chats", "info");
      return;
    }
    if (inCall) return;
    const kind = type === "video" ? "video" : "audio";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      attachPeer(pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("call:ice", { to: otherParticipant._id, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        remoteStreamRef.current = e.streams[0];
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          // Autoplay can be blocked before a user gesture — retry explicitly.
          remoteAudioRef.current.play?.().catch(() => {});
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", {
        to: otherParticipant._id,
        offer,
        callType: kind,
        conversationId: activeConv?._id || null, // server writes the ONE call log
      });
      answeredRef.current = false;
      setInCall(true);
      setCallPhase("calling"); // ringing — not connected yet
      setCallType(kind);
      setCallSeconds(0);
      setMuted(false);
      setCamOff(false);
      setCallMinimized(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      startRing("ringback"); // ringback tone until the other side answers
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (!answeredRef.current) {
          showToast("No answer — call ended", "info");
          endCall();
        }
      }, 45000); // auto-cancel after 45s of ringing
    } catch (e) {
      showToast("Could not start call", "error");
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || inCall) return;
    stopRing();
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.callType === "video" });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      attachPeer(pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("call:ice", { to: incomingCall.from, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        remoteStreamRef.current = e.streams[0];
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          // Autoplay can be blocked before a user gesture — retry explicitly.
          remoteAudioRef.current.play?.().catch(() => {});
        }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { to: incomingCall.from, answer });
      await flushIce(); // candidates that arrived while it was still ringing
      answeredRef.current = true;
      setInCall(true);
      setCallPhase("connected");
      setCallType(incomingCall.callType === "video" ? "video" : "audio");
      setCallSeconds(0);
      setMuted(false);
      setCamOff(false);
      setCallMinimized(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      clearIncomingCall();
      setCallPendingAccept(false);
    } catch (e) {
      showToast("Could not accept call", "error");
      stopRing();
      setCallPendingAccept(false);
    }
  };

  const endCall = (notify = true) => {
    // The ONE call log is written server-side when call:end lands — the
    // frontend never emits a log anymore (kills duplicate log bubbles).
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    stopRing();
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    detachPeer();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamRef.current = null;
    setInCall(false);
    setCallPhase(null);
    setCallType("audio");
    setCallMinimized(false);
    setCallSeconds(0);
    setMuted(false);
    setCamOff(false);
    const to = incomingCall?.from || otherParticipantRef.current?._id;
    clearIncomingCall();
    setCallPendingAccept(false);
    // notify=false when the remote side already told us the call ended
    if (notify && socket && to) socket.emit("call:end", { to });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
  };

  // Global overlay pressed Accept → complete the WebRTC handshake here.
  useEffect(() => {
    if (callPendingAccept && incomingCall && !inCall) {
      setCallPendingAccept(false);
      acceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callPendingAccept, incomingCall, inCall]);

  // Video elements mount only once the call connects (or the minimized bar is
  // reopened) — re-attach the streams whenever that happens.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [inCall, callPhase, callMinimized, callType]);

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

    // A reaction was toggled on a message — sync live
    const onMessageReacted = (payload) => {
      const messageId = payload?.messageId || payload?.message?._id;
      if (!messageId || !Array.isArray(payload?.reactions)) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions: payload.reactions } : m)),
      );
    };

    socket.on("message:new", onMessageNew);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("conversation:deleted", onConversationDeleted);
    socket.on("message:updated", onMessageUpdated);
    socket.on("message:reacted", onMessageReacted);

    // call:offer + call:ice are handled globally by SocketContext (so the
    // incoming call screen shows on any page and early ICE is buffered).
    const onCallAnswer = async ({ answer }) => {
      try {
        if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        answeredRef.current = true;
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        stopRing();
        await flushIce();
        setCallPhase("connected");
        setCallSeconds(0);
      } catch {
        /* ignore malformed answers */
      }
    };
    const onCallEnd = ({ reason } = {}) => {
      // Tell the caller why it stopped while the call was still ringing out.
      if (callPhaseRef.current === "calling") {
        showToast(reason === "declined" ? "Call declined" : "No answer — call ended", "info");
      }
      endCall(false); // remote side hung up — don't echo
    };

    socket.on("call:answer", onCallAnswer);
    socket.on("call:end", onCallEnd);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("conversation:deleted", onConversationDeleted);
      socket.off("message:updated", onMessageUpdated);
      socket.off("message:reacted", onMessageReacted);
      socket.off("call:answer", onCallAnswer);
      socket.off("call:end", onCallEnd);
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

  // ---- Message reactions (FB-style long-press) ----
  const startPress = (m) => {
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pickerOpenedAtRef.current = Date.now();
      setReactPickerFor(m._id);
    }, 450);
  };
  const cancelPress = () => clearTimeout(pressTimerRef.current);

  const reactToMessage = async (m, type) => {
    setReactPickerFor(null);
    const prev = Array.isArray(m.reactions) ? m.reactions : [];
    const mineIdx = prev.findIndex((r) => (r.user?._id || r.user) === user?._id);
    // optimistic: same emoji again = remove, different = switch
    let next;
    if (mineIdx > -1 && prev[mineIdx].type === type) next = prev.filter((_, i) => i !== mineIdx);
    else if (mineIdx > -1) next = prev.map((r, i) => (i === mineIdx ? { ...r, type } : r));
    else next = [...prev, { user: { _id: user?._id }, type }];
    setMessages((prevMsgs) => prevMsgs.map((x) => (x._id === m._id ? { ...x, reactions: next } : x)));
    try {
      const res = await chatApi.reactMessage(m._id, type);
      const reactions = res.data?.reactions || [];
      setMessages((prevMsgs) => prevMsgs.map((x) => (x._id === m._id ? { ...x, reactions } : x)));
    } catch (e) {
      setMessages((prevMsgs) => prevMsgs.map((x) => (x._id === m._id ? { ...x, reactions: prev } : x)));
      showToast(e?.response?.data?.message || "Could not react", "error");
    }
  };

  // Close message menus / reaction picker on outside click
  useEffect(() => {
    if (!msgMenuId && !reactPickerFor) return;
    const close = (e) => {
      // a long-press fires a trailing click on the bubble — don't let it
      // instantly close the picker we just opened
      if (Date.now() - pickerOpenedAtRef.current < 400) return;
      if (e.target.closest?.("[data-msg-menu]") || e.target.closest?.("[data-react-picker]")) return;
      setMsgMenuId(null);
      setReactPickerFor(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [msgMenuId, reactPickerFor]);

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
      const res = await chatApi.send(activeId, { text: content });
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

  // Fresh mirrors for call handlers registered once on the socket.
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);
  useEffect(() => {
    otherParticipantRef.current = otherParticipant;
  }, [otherParticipant]);
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

  // "Seen" only under the LAST message I sent that someone else has read
  const lastOwnMessageId = [...messages]
    .reverse()
    .find((m) => (m.sender?._id || m.sender) === user?._id)?._id;

  // Human day label for the date separator between message groups
  const dayLabel = (dateInput) => {
    const d = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  };
  const fmtMsgTime = (dateInput) =>
    new Date(dateInput).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-7rem)] overflow-hidden">
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

      <div className="flex flex-col h-full gap-3 overflow-hidden">
        {/* Conversation list */}
        <div
          className={`bg-white rounded-2xl shadow p-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${activeId ? "hidden" : "block"}`}
        >
          {/* Search */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-9 pr-3 py-2 rounded-xl neo-input text-sm focus:ring-2 focus:ring-brand"
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
          className={`bg-white rounded-2xl shadow flex flex-col flex-1 min-h-0 overflow-hidden ${activeId ? "flex" : "hidden"}`}
        >
          <div className="pl-2 pr-3 sm:pr-6 py-3 sm:py-4 border-b flex items-center gap-2 sm:gap-3">
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
                className="shrink-0 w-9 h-9 rounded-full object-cover"
              />
            )}
            <button
              onClick={() => {
                if (activeConv?.type !== "group" && otherParticipant?._id) {
                  navigate(`/user/${otherParticipant._id}`);
                }
              }}
              className="min-w-0 flex-1 text-left text-base sm:text-xl font-bold text-brand flex items-center gap-2"
            >
              <span className="truncate">
                {lockedGroup
                  ? lockedGroup.name
                  : activeConv
                    ? activeConv.type === "group"
                      ? activeConv.groupName
                      : otherParticipant?.fullname
                    : ""}
              </span>
              {activeConv && activeConv.type !== "group" && otherParticipant && (
                <span
                  title={
                    isOtherOnline
                      ? "Active now"
                      : lastSeenById[otherParticipant._id]
                        ? `Last seen ${new Date(lastSeenById[otherParticipant._id]).toLocaleString()}`
                        : "Offline"
                  }
                  className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold ${
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
                  <span className="hidden sm:inline">
                    {isOtherOnline
                      ? "Active"
                      : lastSeenById[otherParticipant._id]
                        ? "Last seen"
                        : "Offline"}
                  </span>
                </span>
              )}
            </button>
            {lockedGroup && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <FiLock /> Not joined
              </span>
            )}
            {activeConv?.type === "direct" && otherParticipant && (
              <div className="shrink-0 flex items-center gap-1 sm:gap-2">
                <button onClick={() => startCall("audio")} className="shrink-0 p-2 rounded-full hover:bg-indigo-50 text-slate-600 hover:text-brand" title="Voice call">
                  <FiPhone />
                </button>
                <button onClick={() => startCall("video")} className="shrink-0 p-2 rounded-full hover:bg-indigo-50 text-slate-600 hover:text-brand" title="Video call">
                  <FiVideo />
                </button>
                <button onClick={() => showToast("Info panel coming soon", "info")} className="p-2 rounded-full hover:bg-indigo-50 text-slate-600 hover:text-brand max-sm:hidden" title="Info">
                  <FiInfo />
                </button>
              </div>
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
          {/* Outgoing call — "Calling…" ring screen (until the other side answers) */}
          {inCall && callPhase === "calling" && (
            <div className="fixed inset-0 z-[80] overflow-hidden text-white select-none">
              <img
                src={otherParticipant?.avatar || "https://via.placeholder.com/200"}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/85 via-[#1e1b4b]/90 to-[#020617]/95" />
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
              <div className="relative h-full flex flex-col items-center justify-center px-6 py-10">
                <div className="relative w-36 h-36 mb-9 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
                  <span className="absolute -inset-4 rounded-full bg-indigo-400/20 animate-ping [animation-delay:300ms]" />
                  <span className="absolute -inset-9 rounded-full bg-indigo-400/10 animate-ping [animation-delay:600ms]" />
                  <img
                    src={otherParticipant?.avatar || "https://via.placeholder.com/200"}
                    alt=""
                    className="relative w-36 h-36 rounded-full object-cover border-4 border-white/80 shadow-[0_0_60px_rgba(99,102,241,0.45)]"
                  />
                </div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-200/80 mb-3 text-center">
                  Outgoing {callType === "video" ? "video" : "voice"} call
                </p>
                <h2 className="text-3xl font-extrabold mb-3 text-center drop-shadow-lg">{otherParticipant?.fullname || "…"}</h2>
                <p className="flex items-center gap-2.5 text-sm text-white/60 mb-14">
                  Calling
                  <span className="flex gap-1 pb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
                  </span>
                </p>
                <button onClick={() => endCall()} className="flex flex-col items-center gap-3 group" aria-label="Cancel call">
                  <span className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.45)] flex items-center justify-center transition group-hover:scale-105 group-active:scale-95">
                    <FiPhoneOff className="w-8 h-8" />
                  </span>
                  <span className="text-xs text-white/70 group-hover:text-white transition">Cancel</span>
                </button>
                <p className="absolute bottom-8 text-[11px] text-white/35">Waiting for them to answer…</p>
              </div>
            </div>
          )}
          {/* Connected call — full screen with media + glass controls */}
          {inCall && callPhase === "connected" && !callMinimized && (
            <div className="fixed inset-0 z-[80] flex flex-col text-white bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] select-none">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[130px]" />
              </div>
              {/* Header */}
              <div className="relative flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                <img
                  src={otherParticipant?.avatar || "https://via.placeholder.com/44"}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover border-2 border-white/20"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate drop-shadow">{otherParticipant?.fullname || "…"}</p>
                  <p className="text-xs text-white/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {fmtTime(callSeconds)}
                  </p>
                </div>
                <span className="ml-auto text-[11px] px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/80 font-medium">
                  {callType === "video" ? "Video call" : "Voice call"}
                </span>
              </div>
              {/* Media */}
              <div className="relative flex-1 flex items-center justify-center p-4 sm:p-6 min-h-0">
                {callType === "video" ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="max-h-full max-w-full rounded-3xl bg-black object-contain shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-white/10"
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`absolute bottom-4 right-4 w-28 sm:w-44 aspect-[3/4] rounded-2xl object-cover border-2 border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.5)] -scale-x-100 transition ${camOff ? "opacity-0" : ""}`}
                    />
                  </>
                ) : (
                  <div className="relative w-44 h-44">
                    <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping" />
                    <span className="absolute -inset-5 rounded-full bg-indigo-400/15 animate-ping [animation-delay:300ms]" />
                    <span className="absolute -inset-10 rounded-full bg-indigo-400/10 animate-ping [animation-delay:600ms]" />
                    <img
                      src={otherParticipant?.avatar || "https://via.placeholder.com/176"}
                      alt=""
                      className="relative w-44 h-44 rounded-full object-cover border-4 border-white/70 shadow-[0_0_70px_rgba(99,102,241,0.4)]"
                    />
                  </div>
                )}
              </div>
              {/* Floating glass control bar */}
              <div className="relative flex items-center justify-center px-4 pb-8 pt-4">
                <div className="flex items-center gap-3 sm:gap-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-5 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
                  <button
                    onClick={toggleMute}
                    title={muted ? "Unmute" : "Mute"}
                    className={`w-[54px] h-[54px] rounded-full flex items-center justify-center transition ${
                      muted ? "bg-white text-red-500 shadow-[0_0_20px_rgba(255,255,255,0.25)]" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {muted ? <FiMicOff className="w-6 h-6" /> : <FiMic className="w-6 h-6" />}
                  </button>
                  {callType === "video" && (
                    <button
                      onClick={toggleCam}
                      title={camOff ? "Turn camera on" : "Turn camera off"}
                      className={`w-[54px] h-[54px] rounded-full flex items-center justify-center transition ${
                        camOff ? "bg-white text-red-500 shadow-[0_0_20px_rgba(255,255,255,0.25)]" : "bg-white/10 hover:bg-white/20"
                      }`}
                    >
                      {camOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
                    </button>
                  )}
                  <button
                    onClick={() => setCallMinimized(true)}
                    title="Minimize"
                    className="w-[54px] h-[54px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    <FiMinimize2 className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => endCall()}
                    title="End call"
                    className="w-[54px] h-[54px] rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.5)] flex items-center justify-center transition hover:scale-105 active:scale-95"
                  >
                    <FiPhoneOff className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Minimized call bar */}
          {inCall && callPhase === "connected" && callMinimized && (
            <div className="fixed top-20 right-4 z-[80] flex items-center gap-3 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.45)] px-4 py-3 text-white">
              <img
                src={otherParticipant?.avatar || "https://via.placeholder.com/40"}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate max-w-[120px]">{otherParticipant?.fullname || "…"}</p>
                <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {fmtTime(callSeconds)}
                </p>
              </div>
              <button
                onClick={() => setCallMinimized(false)}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-medium transition"
              >
                Open
              </button>
              <button
                onClick={() => endCall()}
                title="End call"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_6px_20px_rgba(239,68,68,0.5)] flex items-center justify-center transition hover:scale-105 active:scale-95"
              >
                <FiPhoneOff className="w-4 h-4" />
              </button>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 overflow-x-hidden">
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
              // Day separator: show when this group starts a new calendar day
              const firstMsgTime = new Date(group.messages[0]?.createdAt || Date.now());
              const prevGroupLast = gi > 0 ? grouped[gi - 1].messages[grouped[gi - 1].messages.length - 1] : null;
              const showDaySep =
                !prevGroupLast ||
                firstMsgTime.toDateString() !== new Date(prevGroupLast.createdAt).toDateString();
              return (
                <React.Fragment key={gi}>
                {showDaySep && (
                  <div className="flex items-center gap-3 py-1" role="separator">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[11px] font-semibold text-slate-400 select-none">
                      {dayLabel(firstMsgTime)}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
                <div
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className="space-y-1">
                      {group.messages.map((m) =>
                        m.callMeta?.status ? (
                          /* Call-history bubble (centered pill) — labels follow
                             the viewer's perspective: the caller sees
                             "Declined"/"No answer", the receiver sees "Missed". */
                          (() => {
                            const meta = m.callMeta;
                            const isVideo = meta.callType === "video";
                            const kindLabel = isVideo ? "Video" : "Voice";
                            const isCaller = String(m.sender?._id || m.sender) === String(user?._id);
                            let Icon, iconCls, label;
                            if (meta.status === "completed") {
                              Icon = isVideo ? FiVideo : FiPhone;
                              iconCls = "text-emerald-500";
                              label = `${kindLabel} call`;
                            } else if (meta.status === "declined") {
                              Icon = FiPhoneOff;
                              iconCls = "text-red-500";
                              label = isCaller
                                ? `${kindLabel} call declined`
                                : `Missed ${kindLabel.toLowerCase()} call`;
                            } else {
                              Icon = isVideo ? FiVideoOff : FiPhoneOff;
                              iconCls = "text-slate-400";
                              label = isCaller
                                ? `No answer — ${kindLabel.toLowerCase()} call`
                                : `Missed ${kindLabel.toLowerCase()} call`;
                            }
                            return (
                              <div key={m._id} className="flex justify-center py-1">
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm text-slate-500">
                                  <Icon className={`${iconCls} shrink-0`} />
                                  <span className="font-medium text-slate-600">{label}</span>
                                  {meta.status === "completed" && meta.durationSec > 0 && (
                                    <span>· {fmtTime(meta.durationSec)}</span>
                                  )}
                                  <span className="text-slate-400">
                                    · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : editingId === m._id ? (
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
                            className="group/msg relative flex items-end gap-2"
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
                            <div className="flex flex-col min-w-0">
                              {!isMe && activeConv?.type === "group" && (
                                <span className="text-[10px] font-semibold text-slate-500 mb-0.5 ml-1">
                                  {group.sender?.fullname}
                                </span>
                              )}
                              <div className="relative">
                                {/* Long-press (or right-click) this bubble to react */}
                                <div
                                  onPointerDown={() => startPress(m)}
                                  onPointerUp={cancelPress}
                                  onPointerLeave={cancelPress}
                                  onPointerCancel={cancelPress}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    pickerOpenedAtRef.current = Date.now();
                                    setReactPickerFor(m._id);
                                  }}
                                  className={`px-4 py-2 rounded-2xl transition select-none break-words ${
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

                                {/* FB-style floating reaction picker */}
                                {reactPickerFor === m._id && (
                                  <div
                                    data-react-picker
                                    className={`absolute bottom-full z-40 mb-1 flex items-end gap-0.5 rounded-full bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.15)] px-2 py-1.5 ${
                                      isMe ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {MSG_REACTIONS.map((r, i) => (
                                      <button
                                        key={r.key}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => reactToMessage(m, r.key)}
                                        title={r.label}
                                        className="group/emoji relative p-0.5 emoji-pop"
                                        style={{ animationDelay: `${i * 45}ms` }}
                                      >
                                        <span className="block text-2xl leading-none transition-transform duration-150 group-hover/emoji:scale-[1.7] group-hover/emoji:-translate-y-1.5">
                                          {r.emoji}
                                        </span>
                                        <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover/emoji:opacity-100 transition">
                                          {r.label}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Reactions under the bubble — click to toggle yours */}
                                {(() => {
                                  const reactions = Array.isArray(m.reactions) ? m.reactions : [];
                                  if (!reactions.length) return null;
                                  const counts = {};
                                  reactions.forEach((r) => {
                                    const t = r.type || "like";
                                    counts[t] = (counts[t] || 0) + 1;
                                  });
                                  return (
                                    <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                                      {Object.entries(counts).map(([type, count]) => (
                                        <button
                                          key={type}
                                          onClick={() => reactToMessage(m, type)}
                                          title={`${count} reacted (${type})`}
                                          className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 text-xs shadow-sm hover:scale-110 transition"
                                        >
                                          <span>{MSG_EMOJI[type] || "👍"}</span>
                                          <span className="text-slate-600 font-semibold">{count}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              {/* Time under every bubble; "Seen" only on my LAST message */}
                              <div className={`text-[10px] text-slate-400 mt-0.5 ${isMe ? "text-right" : "text-left ml-8"}`}>
                                {fmtMsgTime(m.createdAt)}
                                {isMe && m._id === lastOwnMessageId && (
                                  <span className={Array.isArray(m.readBy) && m.readBy.some((r) => String(r) !== String(user?._id)) ? "text-emerald-500 font-medium" : ""}>
                                    {" · "}
                                    {Array.isArray(m.readBy) && m.readBy.some((r) => String(r) !== String(user?._id)) ? "Seen" : "Sent"}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* 3-dot menu — absolutely placed so it adds ZERO gap to the bubble */}
                            {(isMe || isAdmin) && (
                              <div
                                data-msg-menu
                                className={`absolute top-0 ${isMe ? "right-full mr-1" : "left-full ml-1"} z-30`}
                              >
                                <button
                                  onClick={() => setMsgMenuId(msgMenuId === m._id ? null : m._id)}
                                  title="Message options"
                                  aria-label="Message options"
                                  className="p-1 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm opacity-0 group-hover/msg:opacity-100 focus:opacity-100 max-sm:opacity-70 transition"
                                >
                                  <FiMoreVertical size={13} />
                                </button>
                                {msgMenuId === m._id && (
                                  <div className={`absolute top-full mt-1 w-28 bg-white rounded-xl neo-menu border py-1 text-sm shadow ${isMe ? "right-0" : "left-0"}`}>
                                    {isMe && (
                                      <button
                                        onClick={() => {
                                          setMsgMenuId(null);
                                          startEdit(m);
                                        }}
                                        className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-slate-50"
                                      >
                                        <FiEdit2 size={13} /> Edit
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setMsgMenuId(null);
                                        removeMessage(m._id);
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"
                                    >
                                      <FiTrash2 size={13} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                </React.Fragment>
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
            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2 shrink-0">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand bg-slate-50"
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

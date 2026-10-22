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
import MessageAttachments from "../components/ChatMedia";
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
  FiSmile,
  FiBookmark,
  FiInfo,
  FiImage,
  FiSend,
} from "react-icons/fi";
import {
  LuPhone,
  LuPhoneOff,
  LuVideo,
  LuVideoOff,
  LuMic,
  LuMicOff,
  LuMinimize2,
  LuRefreshCw,
  LuSquare,
} from "react-icons/lu";

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

// Older call-log rows were stored as plain text (before `callMeta` existed).
// They should still render as centered system notes, never as chat bubbles.
const isLegacyCallText = (text) => {
  const t = String(text || "").trim();
  if (!t) return false;
  return /^(📞\s*)?((missed|declined|no answer)\s+)?(voice|video)\s+call\b/i.test(t) ||
    /^call (ended|declined|missed|answered)\b/i.test(t);
};

// One-line preview for the conversation list (photos/voice have no text).
const msgPreview = (m) => {
  const t = String(m?.text || "").trim();
  if (t) return t;
  const kind = m?.attachmentType;
  if (kind === "voice") return "🎤 Voice message";
  if (kind === "video") return "🎬 Video";
  if (kind === "file") return "📎 Attachment";
  if (Array.isArray(m?.attachments) && m.attachments.length) return "📷 Photo";
  return "No messages yet";
};

// Force every mic track through the strongest noise-cleaning pipeline the
// browser offers: noise suppression, echo cancellation, auto gain + voice
// isolation (Chrome/Edge). applyConstraints re-applies after the device gives
// us the track — some mics drop the flags from the initial request.
// `voiceIsolation` is not understood by every browser, so it is applied in a
// second pass: if the combined call rejects, the universal flags are retried on
// their own instead of all being silently dropped.
const primeAudioTrack = (track) => {
  const base = {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  };
  try {
    const attempt = track.applyConstraints({ ...base, voiceIsolation: true });
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // Chrome/Edge understand these; Safari/Firefox may not know
        // voiceIsolation — retry without it so the core cleanup still applies.
        try {
          track.applyConstraints(base).catch(() => {});
        } catch {
          /* keep whatever the browser gave us */
        }
      });
    }
  } catch {
    try {
      track.applyConstraints(base).catch(() => {});
    } catch {
      /* older browsers — default processing stays on */
    }
  }
};

// Extra DSP in front of MediaRecorder so the voice note only carries the
// speaker's voice: low rumble/hiss are filtered out, levels are evened out and
// a soft noise gate mutes whatever is below speaking level (fan noise, TV,
// people chatting in the background) instead of recording it.
const buildVoiceStream = async (rawStream, options = {}) => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !rawStream) return { stream: rawStream, cleanup: () => {} };
  // Voice notes use a gentle floor; live calls use a much lower one so the
  // mic is effectively muted between words (stronger noise cancellation).
  const silentGain = Number.isFinite(options.silentGain) ? options.silentGain : 0.08;
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.015;
  try {
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    // If the browser keeps the context suspended we would record pure silence,
    // so fall back to the raw (browser-cleaned) mic stream instead.
    if (ctx.state !== "running") {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
      return { stream: rawStream, cleanup: () => {} };
    }
    const source = ctx.createMediaStreamSource(rawStream);

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 95; // kills desk bumps / AC hum
    highpass.Q.value = 0.7;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 7600; // kills hiss / high-frequency chatter

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -55;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const gate = ctx.createGain();
    gate.gain.value = 1;

    // Level detection is SIDE-CHAINED: the analyser is a leaf (it never sits in
    // the audio path) so the recorded audio is always a clean, full-bandwidth
    // copy of the filtered mic. An AnalyserNode in series would still pass
    // audio, but keeping it out avoids any chance of downstream processing.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    const levels = new Float32Array(analyser.fftSize);

    const destination = ctx.createMediaStreamDestination();
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gate); // audio path: mic -> filters -> compressor -> gate -> out
    gate.connect(destination);
    compressor.connect(analyser); // side chain: tap only, not in the audio path

    // Speaking level opens the gate instantly; silence fades it out. 20 ms
    // keeps fast enough that no syllable start is clipped, while the 0.12 s
    // release stops the tail of a word from being chopped off.
    const gateTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(levels);
      let peak = 0;
      let sumSq = 0;
      for (let i = 0; i < levels.length; i += 1) {
        const v = levels[i];
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / levels.length);
      // Open on either a strong transient (peak) or sustained speech (rms), so
      // soft-spoken voices register instead of being gated into silence.
      const speaking = peak > threshold || rms > threshold * 0.5;
      gate.gain.setTargetAtTime(speaking ? 1 : silentGain, ctx.currentTime, speaking ? 0.008 : 0.12);
    }, 20);

    return {
      stream: destination.stream,
      cleanup: () => {
        clearInterval(gateTimer);
        try {
          ctx.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return { stream: rawStream, cleanup: () => {} };
  }
};

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
  // Composer extras: photo attachment + voice recording (Messenger-style).
  const [pendingImage, setPendingImage] = useState(null); // { file, url }
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const voiceCleanupRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordCancelledRef = useRef(false);
  const recordStartRef = useRef(0);
  const recordConvRef = useRef(null);
  const pendingImageRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  // Unread conversation highlight lives in SocketContext so it survives
  // navigating away from /chat and coming back.
  const { socket, socketConnected, onlineIds, lastSeenById, clearUnreadMessages, unreadConversations, clearConversationUnread, setUnreadConversations, setActiveConversation, setChatOpen, incomingCall, clearIncomingCall, callPendingAccept, setCallPendingAccept, startRing, stopRing, attachPeer, detachPeer, flushIce } = useSocket();

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
  const swallowNextClickRef = useRef(false); // eats the trailing click after a long-press (mobile)
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
  const [videoSwapped, setVideoSwapped] = useState(false); // Messenger-style tap-to-swap videos
  const [endedInfo, setEndedInfo] = useState(null); // { durationSec, name } on the "Call ended" screen
  const endScreenTimerRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const rawCallStreamRef = useRef(null); // untouched mic/camera stream (for hard stop)
  const callCleanupRef = useRef(null); // closes the call audio DSP graph
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
  // Human-readable call duration for the in-chat call log: "45 sec" / "4 min 21 sec"
  const fmtDur = (s) => {
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (!m) return `${sec} sec`;
    return sec ? `${m} min ${sec} sec` : `${m} min`;
  };

  // Live mirror of callPhase for socket handlers (avoids stale closures).
  const callPhaseRef = useRef(null);
  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  // Routes the call microphone through an extra cleanup chain: rumble/hiss
  // filters + compressor + an aggressive noise gate. What the other side
  // hears is only the voice, so calls sound clean and professional.
  const prepareCallMedia = async (rawStream) => {
    rawStream.getAudioTracks().forEach(primeAudioTrack);
    // Live calls: a little more gate headroom than voice notes so room noise
    // never reaches the other side, while the peak-OR-rms detection keeps even
    // soft-spoken voices audible.
    const cleaned = await buildVoiceStream(rawStream, { silentGain: 0.04, threshold: 0.035 });
    const sendStream = new MediaStream([
      ...cleaned.stream.getAudioTracks(),
      ...rawStream.getVideoTracks(),
    ]);
    return { sendStream, cleanup: cleaned.cleanup };
  };

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
      // Noise suppression + echo cancellation + auto gain + voice isolation —
      // keeps background noise out of the call (crystal-clear voice, Messenger-style).
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          voiceIsolation: true,
          channelCount: 1,
          advanced: [{ noiseSuppression: true, echoCancellation: true, autoGainControl: true }],
        },
        video: kind === "video",
      });
      const { sendStream: stream, cleanup: callCleanup } = await prepareCallMedia(rawStream);
      rawCallStreamRef.current = rawStream;
      callCleanupRef.current = callCleanup;
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
      setVideoSwapped(false);
      setEndedInfo(null);
      if (endScreenTimerRef.current) clearTimeout(endScreenTimerRef.current);
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

  // Release the mic, camera and DSP graph if the screen unmounts mid-call.
  useEffect(
    () => () => {
      try {
        pcRef.current?.close();
      } catch {
        /* ignore */
      }
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        rawCallStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        callCleanupRef.current?.();
      } catch {
        /* ignore */
      }
    },
    []
  );

  const acceptCall = async () => {
    if (!incomingCall || inCall) return;
    stopRing();
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    try {
      // Same clean-audio constraints on the accepting side.
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          voiceIsolation: true,
          channelCount: 1,
          advanced: [{ noiseSuppression: true, echoCancellation: true, autoGainControl: true }],
        },
        video: incomingCall.callType === "video",
      });
      const { sendStream: stream, cleanup: callCleanup } = await prepareCallMedia(rawStream);
      rawCallStreamRef.current = rawStream;
      callCleanupRef.current = callCleanup;
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
      setVideoSwapped(false);
      setEndedInfo(null);
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
    // The mic owns the raw tracks; the DSP context must be closed too so the
    // microphone indicator really turns off after hanging up.
    if (rawCallStreamRef.current) rawCallStreamRef.current.getTracks().forEach((t) => t.stop());
    rawCallStreamRef.current = null;
    try {
      callCleanupRef.current?.();
    } catch {
      /* ignore */
    }
    callCleanupRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamRef.current = null;
    const wasAnswered = answeredRef.current; // a real conversation → show "Call ended"
    const endedDuration = callSeconds;
    const endedName = otherParticipantRef.current?.fullname || "";
    answeredRef.current = false;
    setInCall(false);
    setCallPhase(null);
    setCallType("audio");
    setCallMinimized(false);
    setCallSeconds(0);
    setMuted(false);
    setCamOff(false);
    setVideoSwapped(false);
    const to = incomingCall?.from || otherParticipantRef.current?._id;
    clearIncomingCall();
    setCallPendingAccept(false);
    // notify=false when the remote side already told us the call ended
    if (notify && socket && to) socket.emit("call:end", { to });
    // Messenger-style "Call ended" splash — name + duration, auto-hides.
    if (wasAnswered && endedName) {
      setEndedInfo({ durationSec: endedDuration, name: endedName });
      if (endScreenTimerRef.current) clearTimeout(endScreenTimerRef.current);
      endScreenTimerRef.current = setTimeout(() => setEndedInfo(null), 2400);
    }
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
    if (!activeId) {
      setActiveConversation(null);
      return;
    }
    chatApi.markRead(activeId).catch(() => {});
    // Clear the conversation-list highlight/unread badge for the opened chat.
    setActiveConversation(activeId);
    setConversations((prev) =>
      prev.map((c) => (c._id === activeId ? { ...c, unreadCount: 0 } : c)),
    );
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
      const isMine = String(msg.sender?._id || msg.sender) === String(user?._id);

      if (isActiveConv) {
        setMessages((prev) =>
          prev.some((m) => m._id === msg._id) ? prev : [...prev, msg],
        );
        // no temporary highlight; message keeps its normal color
      } else if (!isMine) {
        // Global unread set — the conversation row stays highlighted even if
        // the user leaves /chat and comes back.
        setUnreadConversations((prev) => {
          if (prev.has(convId)) return prev;
          const next = new Set(prev);
          next.add(convId);
          return next;
        });
      }

      // Keep the conversation list preview + order fresh without a reload
      setConversations((prev) => {
        // Unknown conversation (e.g. brand-new chat with someone)? Reload the
        // list so it appears with its unread badge instead of being dropped.
        if (!prev.some((c) => c._id === convId)) {
          if (!isActiveConv && !isMine) loadConversations();
          return prev;
        }
        const next = prev.map((c) =>
          c._id === convId
            ? {
                ...c,
                lastMessage: { text: msgPreview(msg), sender: msg.sender },
                lastMessageAt: msg.createdAt || new Date().toISOString(),
                // Only unseen messages count — messages in the open chat are
                // read immediately, so they never bump the badge.
                unreadCount:
                  isActiveConv || isMine ? c.unreadCount || 0 : (c.unreadCount || 0) + 1,
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
      clearConversationUnread(conversationId);
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
    // Media messages (photo / voice / video / file) are not editable —
    // only plain text can be changed; anything else can just be deleted.
    if (Array.isArray(m.attachments) && m.attachments.length > 0) {
      showToast("Media messages can't be edited — you can delete it instead", "info");
      return;
    }
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
      // The finger-lift after a long-press fires a trailing click that would
      // instantly close the picker — swallow exactly that one click.
      swallowNextClickRef.current = true;
      setTimeout(() => {
        swallowNextClickRef.current = false;
      }, 900);
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
      if (e.target.closest?.("[data-msg-menu]") || e.target.closest?.("[data-react-picker]")) return;
      // swallow the single trailing click that follows a long-press open
      if (swallowNextClickRef.current) {
        swallowNextClickRef.current = false;
        return;
      }
      setMsgMenuId(null);
      setReactPickerFor(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [msgMenuId, reactPickerFor]);

  // ---------- Photo & voice messages (Messenger-style) ----------
  const clearPendingImage = () => {
    const current = pendingImageRef.current;
    if (current?.url) URL.revokeObjectURL(current.url);
    pendingImageRef.current = null;
    setPendingImage(null);
  };

  const setPendingImageFile = (next) => {
    const prev = pendingImageRef.current;
    if (prev?.url && prev.url !== next?.url) URL.revokeObjectURL(prev.url);
    pendingImageRef.current = next;
    setPendingImage(next);
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast("Image is too large (max 25 MB)", "error");
      return;
    }
    setPendingImageFile({ file, url: URL.createObjectURL(file) });
  };

  const uploadChatFile = async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await chatApi.uploadMedia(form);
    const url = res.data?.url;
    if (!url) throw new Error("Upload failed");
    return { url, type: res.data?.type };
  };

  const appendMessage = (msg) => {
    if (!msg?._id) return;
    const convId = typeof msg.conversation === "string" ? msg.conversation : msg.conversation?._id;
    setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
    if (convId) {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === convId
            ? {
                ...c,
                lastMessage: { text: msgPreview(msg), sender: msg.sender },
                lastMessageAt: msg.createdAt || new Date().toISOString(),
              }
            : c,
        ),
      );
    }
  };

  const stopMicTracks = () => {
    try {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    recordStreamRef.current = null;
    try {
      voiceCleanupRef.current?.();
    } catch {
      /* ignore */
    }
    voiceCleanupRef.current = null;
  };

  const stopRecording = (cancelled = false) => {
    recordCancelledRef.current = !!cancelled;
    const rec = recorderRef.current;
    if (!rec) {
      stopMicTracks();
      setRecording(false);
      return;
    }
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      stopMicTracks();
      recorderRef.current = null;
      setRecording(false);
    }
  };

  const startRecording = async () => {
    if (recording || sending || uploading || !activeId) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast("Voice recording is not supported in this browser", "error");
      return;
    }
    if (!window.isSecureContext) {
      showToast("Voice recording needs HTTPS (or localhost)", "error");
      return;
    }
    if (pendingImage) {
      showToast("Send or remove the photo first", "info");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          voiceIsolation: true,
          channelCount: 1,
        },
      });
    } catch {
      showToast("Microphone permission denied", "error");
      return;
    }
    stream.getAudioTracks().forEach((t) => primeAudioTrack(t));

    // Browser-suppressed mic ➜ extra filter + noise gate before recording.
    const cleaned = await buildVoiceStream(stream);

    let rec;
    let mimeType = "";
    try {
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
      mimeType = preferred.find((t) => {
        try {
          return MediaRecorder.isTypeSupported(t);
        } catch {
          return false;
        }
      }) || "";
      rec = new MediaRecorder(cleaned.stream, mimeType ? { mimeType } : undefined);
    } catch {
      cleaned.cleanup?.();
      stream.getTracks().forEach((t) => t.stop());
      showToast("Could not start recording", "error");
      return;
    }
    voiceCleanupRef.current = cleaned.cleanup;

    const capturedConv = activeId;
    const capturedMime = (rec.mimeType || mimeType || "audio/webm").split(";")[0];

    recordChunksRef.current = [];
    recordCancelledRef.current = false;
    recordStartRef.current = Date.now();
    recordConvRef.current = capturedConv;
    recordStreamRef.current = stream;
    recorderRef.current = rec;

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordChunksRef.current.push(ev.data);
    };
    rec.onerror = () => {
      showToast("Recording failed", "error");
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
    };
    rec.onstop = async () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      stopMicTracks();
      try {
        voiceCleanupRef.current?.();
      } catch {
        /* ignore */
      }
      voiceCleanupRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setRecordSec(0);

      const seconds = Math.max(0, Math.round((Date.now() - recordStartRef.current) / 1000));
      const chunks = recordChunksRef.current;
      recordChunksRef.current = [];
      if (recordCancelledRef.current) return;
      if (!chunks.length) {
        showToast("Nothing was recorded", "error");
        return;
      }
      if (seconds < 1) {
        showToast("Too short — hold and speak a bit longer", "info");
        return;
      }

      const blob = new Blob(chunks, { type: capturedMime });
      const ext = capturedMime.includes("mp4") ? "m4a" : capturedMime.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice-${seconds}s.${ext}`, { type: capturedMime });

      setSending(true);
      setUploading(true);
      try {
        const up = await uploadChatFile(file);
        const res = await chatApi.send(capturedConv, {
          text: "",
          attachments: [up.url],
          attachmentType: "voice",
        });
        appendMessage(res.data?.message);
      } catch (err) {
        console.error(err);
        showToast(err?.response?.data?.message || "Voice message could not be sent", "error");
      } finally {
        setUploading(false);
        setSending(false);
      }
    };

    try {
      rec.start(250);
    } catch {
      stopMicTracks();
      try {
        voiceCleanupRef.current?.();
      } catch {
        /* ignore */
      }
      voiceCleanupRef.current = null;
      recorderRef.current = null;
      showToast("Could not start recording", "error");
      return;
    }
    setRecording(true);
    setRecordSec(0);
    recordTimerRef.current = setInterval(() => {
      setRecordSec((s) => (s < 3600 ? s + 1 : s));
    }, 1000);
  };

  // Hard cap a voice note at 3 minutes so uploads stay small.
  useEffect(() => {
    if (recording && recordSec >= 180) stopRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recordSec]);

  // Leaving/switching a conversation clears the composer previews and stops
  // any invisible recording that would otherwise keep the mic open.
  useEffect(() => {
    if (recorderRef.current) stopRecording(true);
    if (pendingImageRef.current) clearPendingImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Release the microphone + object URLs when the screen unmounts.
  useEffect(
    () => () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.onstop = null;
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      try {
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        voiceCleanupRef.current?.();
      } catch {
        /* ignore */
      }
      voiceCleanupRef.current = null;
      const p = pendingImageRef.current;
      if (p?.url) URL.revokeObjectURL(p.url);
    },
    [],
  );

  const sendMessage = async (e) => {
    e.preventDefault();
    if (lockedGroup) {
      setShowSubscribe(true);
      return;
    }
    if (sending || uploading || recording) return;
    const content = text.trim();
    const image = pendingImage;
    if ((!content && !image) || !activeId) return;

    const convId = activeId;
    setSending(true);
    setText("");
    try {
      let payload = { text: content };
      if (image) {
        setUploading(true);
        const up = await uploadChatFile(image.file);
        payload = { text: content, attachments: [up.url], attachmentType: up.type || "image" };
      }
      const res = await chatApi.send(convId, payload);
      appendMessage(res.data?.message);
      if (image) clearPendingImage();
    } catch (err) {
      console.error(err);
      if (content) setText(content);
      showToast(err?.response?.data?.message || "Message could not be sent", "error");
    } finally {
      setUploading(false);
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
            const unreadCount = c.unreadCount || 0;
            const unread = unreadCount > 0 || unreadConversations.has(c._id);
            return (
              <div
                key={c._id}
                onClick={() => {
                  setActiveId(c._id);
                  setMobileView("chat");
                  setConversations((prev) =>
                    prev.map((x) =>
                      x._id === c._id ? { ...x, unreadCount: 0 } : x,
                    ),
                  );
                  clearConversationUnread(c._id);
                }}
                className={`group/conv w-full text-left p-3 rounded-xl mb-2 transition flex items-center gap-3 cursor-pointer ${
                  activeId === c._id ? "bg-slate-300" : "hover:bg-slate-100"
                }`}
              >
                <div className="relative">
                  <img
                    src={other?.avatar || "https://via.placeholder.com/40"}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate flex items-center gap-1.5 ${unread ? "font-bold text-brand" : "font-medium text-slate-800"}`}>
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
                  <p className={`text-xs truncate ${unread ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                    {c.lastMessage?.text || "No messages yet"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
                <button onClick={() => startCall("audio")} className="shrink-0 p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-brand transition" title="Voice call">
                  <LuPhone className="w-4 h-4" />
                </button>
                <button onClick={() => startCall("video")} className="shrink-0 p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-brand transition" title="Video call">
                  <LuVideo className="w-4 h-4" />
                </button>
                <button onClick={() => showToast("Info panel coming soon", "info")} className="p-2 rounded-full hover:bg-indigo-50 text-slate-600 hover:text-brand" title="Info">
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
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-9 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
                  <span className="absolute -inset-4 rounded-full bg-indigo-400/20 animate-ping [animation-delay:300ms]" />
                  <span className="absolute -inset-9 rounded-full bg-indigo-400/10 animate-ping [animation-delay:600ms]" />
                  <img
                    src={otherParticipant?.avatar || "https://via.placeholder.com/200"}
                    alt=""
                    className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white/80 shadow-[0_0_60px_rgba(99,102,241,0.45)]"
                  />
                </div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-indigo-200/80 mb-3 text-center">
                  Outgoing {callType === "video" ? "video" : "voice"} call
                </p>
                <h2 className="text-2xl font-extrabold mb-3 text-center drop-shadow-lg">{otherParticipant?.fullname || "…"}</h2>
                <p className="flex items-center gap-2.5 text-xs text-white/60 mb-14">
                  Calling {otherParticipant?.fullname?.split(" ")[0] || ""}
                  <span className="flex gap-1 pb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
                  </span>
                </p>
                <button onClick={() => endCall()} className="flex flex-col items-center gap-2.5 group" aria-label="Cancel call">
                  <span className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.45)] flex items-center justify-center transition group-hover:scale-105 group-active:scale-95">
                    <LuPhoneOff className="w-6 h-6" />
                  </span>
                  <span className="text-xs text-white/70 group-hover:text-white transition">Cancel</span>
                </button>
                <p className="absolute bottom-8 text-[10px] text-white/35">Waiting for them to answer…</p>
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
                  <p className="font-semibold text-[13px] truncate drop-shadow">{otherParticipant?.fullname || "…"}</p>
                  <p className="text-[11px] text-white/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {fmtTime(callSeconds)}
                  </p>
                </div>
                <span className="ml-auto text-[10px] px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/80 font-medium">
                  {callType === "video" ? "Video call" : "Voice call"}
                </span>
              </div>
              {/* Media — Messenger-style. Tap either video to swap big/small. */}
              <div className="relative flex-1 min-h-0 overflow-hidden">
                {callType === "video" ? (
                  <>
                    {/* Remote (big by default) */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      onClick={() => setVideoSwapped((s) => !s)}
                      className={`absolute bg-black object-cover cursor-pointer transition-all ${
                        videoSwapped
                          ? "bottom-4 right-4 z-10 w-28 sm:w-40 aspect-[3/4] rounded-2xl border-2 border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                          : "inset-0 w-full h-full"
                      }`}
                    />
                    {/* Local (small PIP by default, mirrored) */}
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      onClick={() => setVideoSwapped((s) => !s)}
                      className={`absolute bg-black object-cover -scale-x-100 cursor-pointer transition-all ${
                        videoSwapped
                          ? "inset-0 w-full h-full"
                          : "bottom-4 right-4 z-10 w-28 sm:w-40 aspect-[3/4] rounded-2xl border-2 border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                      } ${camOff ? "opacity-0" : ""}`}
                    />
                    {/* Cam-off state over the big view */}
                    {camOff && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 pointer-events-none">
                        <div className="text-center">
                          <img
                            src={videoSwapped ? user?.avatar || "https://via.placeholder.com/120" : otherParticipant?.avatar || "https://via.placeholder.com/120"}
                            alt=""
                            className="w-28 h-28 mx-auto rounded-full object-cover border-4 border-white/20 opacity-80"
                          />
                          <p className="mt-3 text-sm text-white/60">{videoSwapped ? "Your camera is off" : `${otherParticipant?.fullname?.split(" ")[0] || "They"}'s camera is off`}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Voice call — profile stays dead-centre of the media area
                     (before this it collapsed into the top-left corner). */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 sm:gap-6 px-6">
                    <div className="relative w-32 h-32 sm:w-44 sm:h-44 shrink-0">
                      <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping" />
                      <span className="absolute -inset-5 rounded-full bg-indigo-400/15 animate-ping [animation-delay:300ms]" />
                      <span className="absolute -inset-10 rounded-full bg-indigo-400/10 animate-ping [animation-delay:600ms]" />
                      <img
                        src={otherParticipant?.avatar || "https://via.placeholder.com/176"}
                        alt=""
                        className="relative w-32 h-32 sm:w-44 sm:h-44 rounded-full object-cover border-4 border-white/70 shadow-[0_0_70px_rgba(99,102,241,0.4)]"
                      />
                    </div>
                    <div className="text-center max-w-[80vw]">
                      <p className="text-lg sm:text-xl font-bold text-white drop-shadow-lg truncate">
                        {otherParticipant?.fullname || "…"}
                      </p>
                      <p className="mt-1.5 text-xs text-white/60 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {fmtTime(callSeconds)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* Floating glass control bar */}
              <div className="relative flex items-center justify-center px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] max-w-[94vw]">
                  <button
                    onClick={toggleMute}
                    title={muted ? "Unmute" : "Mute"}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                      muted ? "bg-white text-red-500 shadow-[0_0_20px_rgba(255,255,255,0.25)]" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {muted ? <LuMicOff className="w-5 h-5" /> : <LuMic className="w-5 h-5" />}
                  </button>
                  {callType === "video" && (
                    <button
                      onClick={toggleCam}
                      title={camOff ? "Turn camera on" : "Turn camera off"}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                        camOff ? "bg-white text-red-500 shadow-[0_0_20px_rgba(255,255,255,0.25)]" : "bg-white/10 hover:bg-white/20"
                      }`}
                    >
                      {camOff ? <LuVideoOff className="w-5 h-5" /> : <LuVideo className="w-5 h-5" />}
                    </button>
                  )}
                  {callType === "video" && (
                    <button
                      onClick={() => setVideoSwapped((s) => !s)}
                      title="Swap videos"
                      className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    >
                      <LuRefreshCw className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setCallMinimized(true)}
                    title="Minimize"
                    className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    <LuMinimize2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => endCall()}
                    title="End call"
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_10px_30px_rgba(239,68,68,0.5)] flex items-center justify-center transition hover:scale-105 active:scale-95"
                  >
                    <LuPhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Messenger-style "Call ended" splash — auto-hides after ~2.4s */}
          {endedInfo && (
            <div className="call-enter fixed inset-0 z-[85] flex items-center justify-center text-white select-none pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/70 via-[#1e1b4b]/75 to-[#020617]/80 backdrop-blur-md" />
              <div className="relative flex flex-col items-center gap-4 px-6">
                <div className="relative w-28 h-28">
                  <span className="absolute inset-0 rounded-full bg-red-400/25 animate-ping" />
                  <span className="absolute -inset-3 rounded-full bg-red-400/10 animate-ping [animation-delay:300ms]" />
                  <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_15px_45px_rgba(239,68,68,0.5)] flex items-center justify-center">
                    <LuPhoneOff className="w-11 h-11" />
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-extrabold drop-shadow-lg">Call ended</h2>
                  <p className="mt-1.5 text-xs text-white/60">
                    {endedInfo.name} · {fmtTime(endedInfo.durationSec)}
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Minimized call bar */}
          {inCall && callPhase === "connected" && callMinimized && (
            <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.45)] px-3 sm:px-4 py-3 text-white w-[min(92vw,340px)]">
              <img
                src={otherParticipant?.avatar || "https://via.placeholder.com/40"}
                alt=""
                className="w-10 h-10 shrink-0 rounded-full object-cover border-2 border-white/20"
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
                className="shrink-0 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-medium transition"
              >
                Open
              </button>
              <button
                onClick={() => endCall()}
                title="End call"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_6px_20px_rgba(239,68,68,0.5)] flex items-center justify-center transition hover:scale-105 active:scale-95"
              >
                <LuPhoneOff className="w-4 h-4" />
              </button>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          <div ref={messagesContainerRef} className="chat-scroll flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 overflow-x-hidden">
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
              // The row is always full width so call-history notes can sit
              // dead-centre; each bubble caps itself at 85%/75% instead.
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
                  <div className="w-full">
                    <div className="space-y-1">
                      {group.messages.map((m) =>
                        m.callMeta?.status || isLegacyCallText(m.text) ? (
                          /* Call-history note (centered system text) — labels follow
                             the viewer's perspective: the caller sees
                             "Declined"/"No answer", the receiver sees "Missed". */
                          (() => {
                            const meta = m.callMeta || {};
                            const isVideo = meta.callType === "video";
                            const kindLabel = isVideo ? "Video" : "Voice";
                            const isCaller = String(m.sender?._id || m.sender) === String(user?._id);
                            let label;
                            if (!meta.status) {
                              label = String(m.text || "").trim();
                            } else if (meta.status === "completed") {
                              const d = fmtDur(meta.durationSec);
                              label = `${kindLabel} call${d ? ` · ${d}` : ""}`;
                            } else if (isCaller) {
                              label = meta.status === "declined" ? "Your call declined" : "No answer";
                            } else {
                              label = `Missed ${kindLabel.toLowerCase()} call`;
                            }
                            const stamp = new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            return (
                              /* Borderless tiny centered text — no icons, no
                                 inline clock. Hover reveals the send time
                                 (desktop only) beside the note. */
                              <div key={m._id} className="flex w-full justify-center py-0.5 px-3">
                                <span
                                  title={stamp}
                                  className="group/call relative inline-flex items-center select-none text-[10px] leading-none text-slate-400"
                                >
                                  {label}
                                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 text-[9px] text-slate-300 opacity-0 group-hover/call:opacity-100 transition whitespace-nowrap max-sm:hidden">
                                    {stamp}
                                  </span>
                                </span>
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
                        ) : (() => {
                          const hasMedia = Array.isArray(m.attachments) && m.attachments.length > 0;
                          const hasText = !!String(m.text || "").trim();
                          // Photos/videos sit flush — no bubble frame or padding,
                          // so no coloured border shows around the image.
                          const flushMedia = hasMedia && !hasText && m.attachmentType !== "voice" && m.attachmentType !== "file";
                          return (
                          <div
                            key={m._id}
                            className={`group/msg relative flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
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
                            <div className="flex flex-col min-w-0 max-w-[85%] sm:max-w-[75%]">
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
                                    setReactPickerFor(m._id);
                                  }}
                                  className={`text-[13px] leading-snug rounded-[18px] transition select-none break-words ${
                                    flushMedia
                                      ? "p-0 bg-transparent"
                                      : hasMedia
                                        ? (m.attachmentType === "voice" ? "p-2" : "p-1")
                                        : "px-3.5 py-1.5"
                                  } ${
                                    flushMedia
                                      ? ""
                                      : isMe
                                        ? "bg-brand text-white rounded-br-md"
                                        : "bg-slate-100 text-slate-800 rounded-bl-md"
                                  }`}
                                >
                                  {hasMedia && (
                                    <MessageAttachments
                                      message={m}
                                      isMe={isMe}
                                      ignoreNextClickRef={swallowNextClickRef}
                                    />
                                  )}
                                  {!!String(m.text || "").trim() && (
                                    <span className={hasMedia ? "block px-1.5 py-1" : ""}>{m.text}</span>
                                  )}
                                  {m.editedAt && (
                                    <span className={`text-[10px] opacity-70 align-middle ${hasMedia ? "px-1.5" : "ml-1.5"}`}>
                                      (edited)
                                    </span>
                                  )}
                                </div>

                                {/* 3-dot — anchored to the bubble itself so it is
                                    always level with the message (never high/low) */}
                                {(isMe || isAdmin) && (
                                  <div
                                    data-msg-menu
                                    className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "right-full mr-1.5" : "left-full ml-1.5"} z-30`}
                                  >
                                    <button
                                      onClick={() => setMsgMenuId(msgMenuId === m._id ? null : m._id)}
                                      title="Message options"
                                      aria-label="Message options"
                                      className="p-1 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm opacity-0 group-hover/msg:opacity-100 focus:opacity-100 max-sm:hidden transition"
                                    >
                                      <FiMoreVertical size={13} />
                                    </button>
                                    {msgMenuId === m._id && (
                                      <div className={`absolute top-full mt-1 w-28 bg-white rounded-xl neo-menu border py-1 text-sm shadow ${isMe ? "right-0" : "left-0"}`}>
                                        {isMe && !hasMedia && (
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

                                {/* FB-style floating reaction picker */}
                                {reactPickerFor === m._id && (
                                  <div
                                    data-react-picker
                                    className={`absolute bottom-full z-40 mb-1 flex items-end gap-0.5 rounded-full bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.15)] px-2 py-1.5 max-sm:scale-90 origin-bottom ${
                                      isMe ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {MSG_REACTIONS.map((r, i) => (
                                      <button
                                        key={r.key}
                                        /* react on press (Messenger-style) — works
                                           100% on touch where trailing clicks get
                                           swallowed after a long-press */
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          reactToMessage(m, r.key);
                                        }}
                                        title={r.label}
                                        className="group/emoji relative p-0.5 emoji-pop"
                                        style={{ animationDelay: `${i * 45}ms` }}
                                      >
                                        <span className="block text-xl sm:text-2xl leading-none transition-transform duration-150 group-hover/emoji:scale-[1.7] group-hover/emoji:-translate-y-1.5">
                                          {r.emoji}
                                        </span>
                                        <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover/emoji:opacity-100 transition">
                                          {r.label}
                                        </span>
                                      </button>
                                    ))}
                                    {/* Edit/Delete live inside the picker too —
                                        the 3-dot is hidden on mobile, so this
                                        is the touch path to both actions */}
                                    {(isMe || isAdmin) && (
                                      <>
                                        <span className="w-px self-stretch bg-slate-200 mx-0.5" />
                                        {isMe && !hasMedia && (
                                          <button
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={() => {
                                              setReactPickerFor(null);
                                              startEdit(m);
                                            }}
                                            title="Edit message"
                                            className="p-1.5 text-slate-500 hover:text-brand transition"
                                          >
                                            <FiEdit2 className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={() => {
                                            setReactPickerFor(null);
                                            removeMessage(m._id);
                                          }}
                                          title="Delete message"
                                          className="p-1.5 text-slate-500 hover:text-red-500 transition"
                                        >
                                          <FiTrash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
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
                              {/* "Seen"/"Sent" only on my LAST message — the
                                  timestamp itself is hover-only so bubbles
                                  never feel crowded with metadata */}
                              {isMe && m._id === lastOwnMessageId && (
                                <div className="text-[9px] text-slate-400 mt-0.5 text-right">
                                  <span className={Array.isArray(m.readBy) && m.readBy.some((r) => String(r) !== String(user?._id)) ? "text-emerald-500 font-medium" : ""}>
                                    {Array.isArray(m.readBy) && m.readBy.some((r) => String(r) !== String(user?._id)) ? "Seen" : "Sent"}
                                  </span>
                                </div>
                              )}
                              {/* Send-time — hidden until hover (desktop only);
                                  sits OUTSIDE the bubble beside the 3-dot so
                                  the two never overlap */}
                              <span
                                title={fmtMsgTime(m.createdAt)}
                                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[9px] text-slate-400 opacity-0 group-hover/msg:opacity-100 transition whitespace-nowrap max-sm:hidden ${isMe ? "right-full mr-8" : "left-full ml-8"}`}
                              >
                                {fmtMsgTime(m.createdAt)}
                              </span>
                            </div>
                          </div>
                          );
                        })(),
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
            <form onSubmit={sendMessage} className="border-t shrink-0 pb-[env(safe-area-inset-bottom)] bg-white">
              {pendingImage && !recording && (
                <div className="px-3 sm:px-4 pt-3 flex items-center gap-2">
                  <div className="relative shrink-0">
                    <img
                      src={pendingImage.url}
                      alt="Selected attachment preview"
                      className="h-14 w-14 rounded-xl object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={clearPendingImage}
                      title="Remove photo"
                      aria-label="Remove photo"
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow hover:bg-slate-700 transition"
                    >
                      <FiX size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 truncate min-w-0 flex-1">
                    {uploading ? "Uploading photo…" : `${pendingImage.file.name} · ready to send`}
                  </p>
                </div>
              )}

              <div className="p-3 sm:p-4 flex items-end gap-2">
                {recording ? (
                  <div className="flex flex-1 items-center gap-2 min-w-0 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                    </span>
                    <span className="text-xs font-semibold text-rose-600 tabular-nums">
                      {fmtTime(recordSec)}
                    </span>
                    <span className="text-xs text-rose-500/80 truncate min-w-0 flex-1">Recording…</span>
                    <button
                      type="button"
                      onClick={() => stopRecording(true)}
                      title="Cancel recording"
                      aria-label="Cancel recording"
                      className="shrink-0 p-1.5 rounded-full text-rose-600 hover:bg-rose-100 transition"
                    >
                      <FiX size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => stopRecording(false)}
                      title="Send voice message"
                      aria-label="Send voice message"
                      className="shrink-0 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition"
                    >
                      <FiSend size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={pickImage}
                      className="hidden"
                      aria-label="Attach a photo"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || sending}
                      title="Send a photo"
                      aria-label="Send a photo"
                      className="shrink-0 p-2.5 rounded-full text-slate-600 hover:bg-indigo-50 hover:text-brand transition disabled:opacity-40"
                    >
                      <FiImage size={20} />
                    </button>

                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={pendingImage ? "Add a caption..." : "Type a message..."}
                      className="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand bg-slate-50 text-sm"
                    />

                    {text.trim() || pendingImage ? (
                      <button
                        type="submit"
                        disabled={sending || uploading}
                        title="Send message"
                        aria-label="Send message"
                        className="shrink-0 h-10 w-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending || uploading ? (
                          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : (
                          <FiSend size={17} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        title="Record a voice message"
                        aria-label="Record a voice message"
                        className="shrink-0 h-10 w-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-indigo-700 transition"
                      >
                        <LuMic size={18} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

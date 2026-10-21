import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usersApi } from "../api/usersApi";
import { LuVideo, LuMic, LuPhone, LuPhoneOff } from "react-icons/lu";

// Premium full-screen incoming call UI — rendered globally (from SocketContext)
// so it rings on EVERY page, including Home. Theme-matched indigo glass design.
export default function IncomingCallOverlay() {
  const { incomingCall, rejectIncomingCall, setCallPendingAccept } = useSocket() || {};
  const navigate = useNavigate();
  const [caller, setCaller] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!incomingCall?.from) {
      setCaller(null);
      return;
    }
    setCaller(null);
    usersApi
      .get(incomingCall.from)
      .then((res) => {
        if (alive) setCaller(res.data?.user || res.data?.profile || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [incomingCall?.from]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === "video";
  const avatar = caller?.avatar || "https://via.placeholder.com/200";
  const name = caller?.fullname || "Someone";

  const accept = () => {
    // Chat screen picks this up and completes the WebRTC handshake.
    setCallPendingAccept(true);
    navigate("/chat");
  };

  return (
    <div className="call-enter fixed inset-0 z-[95] overflow-hidden text-white select-none">
      {/* Blurred caller backdrop */}
      <img src={avatar} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/85 via-[#1e1b4b]/90 to-[#020617]/95" />
      {/* Theme-matched glow orbs */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-indigo-500/25 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-24 w-[420px] h-[420px] rounded-full bg-cyan-400/10 blur-[120px] pointer-events-none" />

      <div className="relative h-full flex flex-col items-center justify-center px-6 py-10">
        {/* Avatar with layered pulse rings */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-8 shrink-0">
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
          <span className="absolute -inset-4 rounded-full bg-indigo-400/20 animate-ping [animation-delay:300ms]" />
          <span className="absolute -inset-9 rounded-full bg-indigo-400/10 animate-ping [animation-delay:600ms]" />
          <img
            src={avatar}
            alt=""
            className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white/80 shadow-[0_0_60px_rgba(99,102,241,0.45)]"
          />
        </div>

        {/* Glass identity card */}
        <div className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 px-6 py-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-200/80 mb-2 flex items-center justify-center gap-2">
            {isVideo ? <LuVideo /> : <LuMic />}
            Incoming {isVideo ? "video" : "voice"} call
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 drop-shadow-lg truncate px-2">{name}</h2>
          <p className="flex items-center justify-center gap-2.5 text-sm text-white/60">
            Ringing
            <span className="flex gap-1 pb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
            </span>
          </p>
        </div>

        {/* Action buttons — glass ring + gradient core */}
        <div className="flex items-start gap-8 sm:gap-10 mt-10">
          <button onClick={rejectIncomingCall} className="flex flex-col items-center gap-2.5 group" aria-label="Decline call">
            <span className="relative w-16 h-16 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center transition group-hover:scale-105 group-active:scale-95">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/30 to-red-600/30" />
              <LuPhoneOff className="w-6 h-6 relative text-red-100 drop-shadow" />
            </span>
            <span className="text-xs text-white/70 group-hover:text-white transition">Decline</span>
          </button>

          <button onClick={accept} className="flex flex-col items-center gap-2.5 group" aria-label="Accept call">
            <span className="relative w-16 h-16 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center transition group-hover:scale-105 group-active:scale-95">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_10px_30px_rgba(16,185,129,0.5)]" />
              <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
              <LuPhone className="w-6 h-6 relative drop-shadow" />
            </span>
            <span className="text-xs text-white/70 group-hover:text-white transition">Accept</span>
          </button>
        </div>

        <p className="mt-12 text-[11px] text-white/35 flex items-center gap-1.5">
          {isVideo ? <LuVideo /> : <LuMic />}
          {isVideo ? "Camera & microphone will be requested" : "Microphone will be requested"}
        </p>
      </div>
    </div>
  );
}

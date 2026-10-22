import React, { useEffect, useRef, useState } from "react";
import { LuPlay, LuPause, LuDownload, LuX, LuMic } from "react-icons/lu";

// Fixed "waveform" — deterministic so every voice note looks the same and no
// random re-render jitter happens while the audio plays.
const BARS = [
  7, 11, 15, 10, 17, 12, 8, 14, 20, 12, 9, 16, 13, 7, 10, 18, 12, 8, 14, 11,
  16, 9, 7, 13, 18, 10, 12, 8, 15, 11, 6, 13,
];

const fmtDur = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const guessKind = (url, type) => {
  if (type && type !== "file") return type;
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|bmp|heic)$/.test(clean)) return "image";
  if (/\.(mp4|mov|webm|mkv|m4v)$/.test(clean)) return "video";
  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/.test(clean)) return "voice";
  return type || "file";
};

function VoicePlayer({ src, isMe }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  // MediaRecorder blobs (webm) often report duration = Infinity. Seeking far
  // past the end forces the browser to compute the real duration.
  const loaded = () => {
    const a = audioRef.current;
    if (!a) return;
    if (Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
      return;
    }
    const fix = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setDuration(a.duration);
        try {
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
        a.removeEventListener("timeupdate", fix);
      }
    };
    a.addEventListener("timeupdate", fix);
    try {
      a.currentTime = 1e101;
    } catch {
      /* ignore */
    }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    try {
      a.currentTime = ratio * duration;
      setCurrent(a.currentTime);
    } catch {
      /* ignore */
    }
  };

  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
  const filled = isMe ? "#ffffff" : "#1e293b";
  const empty = isMe ? "rgba(255,255,255,0.35)" : "rgba(30,41,59,0.18)";
  const sub = isMe ? "rgba(255,255,255,0.85)" : "#64748b";

  return (
    <div className="flex items-center gap-2.5 w-[218px] max-w-[64vw]">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition active:scale-95 ${
          isMe
            ? "bg-white text-brand hover:bg-white/90"
            : "bg-brand text-white hover:bg-indigo-700"
        }`}
      >
        {playing ? <LuPause size={17} /> : <LuPlay size={17} className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          onClick={seek}
          role="slider"
          aria-label="Voice message progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(current) || 0}
          className="flex items-center gap-[1.5px] h-7 cursor-pointer select-none"
        >
          {BARS.map((h, i) => (
            <span
              key={i}
              style={{
                height: h,
                width: 2.5,
                borderRadius: 999,
                background: i / BARS.length <= ratio ? filled : empty,
                transition: "background 140ms linear",
              }}
            />
          ))}
        </div>
        <div
          className="flex items-center justify-between mt-0.5 text-[10px] leading-none tabular-nums"
          style={{ color: sub }}
        >
          <span>{fmtDur(current)}</span>
          <span className="flex items-center gap-1">
            <LuMic size={9} />
            {duration > 0 ? fmtDur(duration) : "--:--"}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={loaded}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        className="hidden"
      />
    </div>
  );
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/90 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-3 right-3 sm:top-5 sm:right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
      >
        <LuX size={20} />
      </button>
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86dvh] max-w-[94vw] object-contain rounded-xl shadow-2xl"
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition"
      >
        <LuDownload size={14} /> Open original
      </a>
    </div>
  );
}

// Renders everything that can travel inside a message: photos (tap to zoom),
// voice notes (waveform player), videos and generic files. `ignoreNextClickRef`
// lets us ignore the trailing click that follows a long-press reaction.
export default function MessageAttachments({ message, isMe, ignoreNextClickRef }) {
  const [preview, setPreview] = useState(null);
  const raw = Array.isArray(message?.attachments) ? message.attachments : [];
  const urls = raw
    .map((a) => (typeof a === "string" ? a : a?.url || a?.secure_url || ""))
    .filter(Boolean);
  if (!urls.length) return null;

  return (
    <>
      <div className="space-y-1">
        {urls.map((url, i) => {
          const kind = guessKind(url, message?.attachmentType);

          if (kind === "voice") {
            return <VoicePlayer key={`${url}-${i}`} src={url} isMe={isMe} />;
          }

          if (kind === "video") {
            return (
              <video
                key={`${url}-${i}`}
                src={url}
                controls
                playsInline
                preload="metadata"
                className="block max-h-[280px] sm:max-h-[340px] w-auto max-w-[min(70vw,320px)] rounded-[18px] bg-black"
              />
            );
          }

          if (kind === "image") {
            return (
              <img
                key={`${url}-${i}`}
                src={url}
                alt="attachment"
                loading="lazy"
                onClick={() => {
                  if (ignoreNextClickRef?.current) return;
                  setPreview(url);
                }}
                className="block max-h-[260px] sm:max-h-[320px] w-auto max-w-[min(72vw,320px)] rounded-[18px] object-cover cursor-zoom-in"
              />
            );
          }

          return (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-1 py-0.5 text-xs underline break-all"
            >
              <LuDownload size={13} className="shrink-0" /> Attachment
            </a>
          );
        })}
      </div>

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

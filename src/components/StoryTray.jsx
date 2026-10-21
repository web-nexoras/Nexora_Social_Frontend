import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { storiesApi } from "../api/storiesApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Skeleton from "./Skeleton";
import { FiPlus, FiTrash2, FiChevronLeft, FiChevronRight, FiX, FiHeart, FiSend, FiEye } from "react-icons/fi";

const AUTO_MS = 6500; // slightly longer than FB's 5s so photos aren't rushed

const fmtWhen = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/**
 * FB-style story system inside the Feed:
 *  - "Your story" tile uploads instantly (24h on the server)
 *  - One gradient-ring circle per author; grey ring = already seen
 *  - Full-screen viewer: progress segments, tap right/left to move,
 *    photos auto-advance, videos play through
 *  - ❤ like (optimistic) + "Reply to …" box — replies land directly in
 *    the author's chat, exactly like replying to a FB story
 *  - Own stories: delete + viewer count
 */
export default function StoryTray() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const [viewer, setViewer] = useState(null); // { authorId, index }
  const [viewed, setViewed] = useState(() => new Set());
  const [reply, setReply] = useState("");
  const [paused, setPaused] = useState(false);
  const [videoProg, setVideoProg] = useState(0);

  const timerRef = useRef(null);
  const remainRef = useRef(AUTO_MS);
  const startedRef = useRef(Date.now());

  const load = async () => {
    setLoading(true);
    try {
      const res = await storiesApi.list();
      setStories(res.data?.stories || []);
    } catch {
      showToast("Failed to load stories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  // Group by author — one card per person (FB style).
  // Own story lives ONLY in the first "Your story" card (no duplicate below).
  const groups = [];
  const byAuthor = new Map();
  for (const s of stories) {
    const id = s.author?._id || s.author;
    if (!byAuthor.has(id)) {
      const g = { author: s.author || {}, id, list: [] };
      byAuthor.set(id, g);
      groups.push(g);
    }
    byAuthor.get(id).list.push(s);
  }
  const ownGroup = groups.find((g) => String(g.id) === String(user?._id));
  const friendGroups = groups.filter((g) => String(g.id) !== String(user?._id));

  const viewerGroup = viewer ? groups.find((g) => String(g.id) === String(viewer.authorId)) : null;
  const viewerList = viewerGroup?.list || [];
  const current = viewer ? viewerList[viewer.index] || null : null;

  // ---------- auto-advance (photos) ----------
  const scheduleNext = (ms) => {
    clearTimeout(timerRef.current);
    startedRef.current = Date.now();
    remainRef.current = ms;
    timerRef.current = setTimeout(() => step(1), ms);
  };

  useEffect(() => {
    if (!viewer || !current) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [viewer, current]);

  useEffect(() => {
    if (!viewer || !current) return;
    storiesApi.view(current._id).catch(() => {});
    setViewed((v) => new Set(v).add(current._id));
    setVideoProg(0);
    if (current.mediaType !== "video" && !paused) scheduleNext(remainRef.current || AUTO_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line
  }, [viewer?.authorId, viewer?.index]); // eslint-disable-line

  // Pause while the user is typing a reply (like FB), resume after
  useEffect(() => {
    if (!viewer || !current || current.mediaType === "video") return;
    if (paused) {
      remainRef.current = Math.max(300, remainRef.current - (Date.now() - startedRef.current));
      clearTimeout(timerRef.current);
    } else if (remainRef.current !== AUTO_MS || viewed.has(current._id)) {
      scheduleNext(remainRef.current);
    }
    // eslint-disable-next-line
  }, [paused]); // eslint-disable-line

  // ---------- navigation ----------
  const step = (dir) => {
    if (!viewer) return;
    const next = viewer.index + dir;
    if (next < 0) return;
    if (next >= viewerList.length) { setViewer(null); return; } // past the end → close
    remainRef.current = AUTO_MS;
    setViewer({ ...viewer, index: next });
  };

  const openGroup = (g) => {
    const firstUnseen = g.list.findIndex((s) => !viewed.has(s._id));
    remainRef.current = AUTO_MS;
    setReply("");
    setPaused(false);
    setViewer({ authorId: g.id, index: firstUnseen < 0 ? 0 : firstUnseen });
  };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e) => {
      if (e.key === "Escape") setViewer(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [viewer, viewerList.length]); // eslint-disable-line

  // ---------- actions ----------
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("media", file);
      const res = await storiesApi.create(fd);
      const s = res.data?.story;
      if (s) setStories((prev) => [s, ...prev]);
      showToast("Story posted — stays for 24 hours", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to post story", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleLike = async (s) => {
    const me = user?._id;
    const wasLiked = (s.likes || []).some((l) => (l._id || l) === me);
    // optimistic flip
    setStories((prev) => prev.map((x) => x._id === s._id
      ? { ...x, likes: wasLiked ? (x.likes || []).filter((l) => (l._id || l) !== me) : [...(x.likes || []), me] }
      : x));
    try {
      await storiesApi.like(s._id);
    } catch {
      // revert on failure
      setStories((prev) => prev.map((x) => x._id === s._id
        ? { ...x, likes: wasLiked ? [...(x.likes || []), me] : (x.likes || []).filter((l) => (l._id || l) !== me) }
        : x));
      showToast("Could not update like", "error");
    }
  };

  const removeStory = async (s) => {
    if (!window.confirm("Delete this story?")) return;
    try {
      await storiesApi.remove(s._id);
      const remaining = (viewerGroup?.list || []).filter((x) => x._id !== s._id);
      setStories((prev) => prev.filter((x) => x._id !== s._id));
      if (remaining.length === 0) setViewer(null); // else stay put → next story shows
      showToast("Story deleted", "success");
    } catch {
      showToast("Failed to delete story", "error");
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !current) return;
    const name = current.author?.fullname?.split(" ")[0] || "friend";
    try {
      const res = await storiesApi.comment(current._id, reply.trim());
      setReply("");
      setViewer(null); // close the story viewer
      // Jump straight into the chat with the author — the reply is already
      // sitting there as the latest message (FB Messenger behaviour).
      const convId = res.data?.conversationId;
      showToast(`Sent — opening ${name}'s chat`, "success");
      if (convId) navigate(`/chat?conversation=${convId}`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send reply", "error");
    }
  };

  const isOwn = current && (current.author?._id || current.author) === user?._id;
  const likedByMe = current && (current.likes || []).some((l) => (l._id || l) === user?._id);

  return (
    <>
      {/* ---------------- Tray — FB-style SQUARE story cards ---------------- */}
      <div className="bg-white rounded-2xl shadow px-4 py-3">
        <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-1">
          {/* Your story — first card (FB: your pic; tap to view your story,
              ⊕ to add a new one; if none yet, tap = upload) */}
          <div
            onClick={() => (ownGroup ? openGroup(ownGroup) : fileRef.current?.click())}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && (ownGroup ? openGroup(ownGroup) : fileRef.current?.click())}
            className={`group relative shrink-0 w-[80px] h-[120px] sm:w-24 sm:h-36 rounded-xl overflow-hidden bg-slate-100 cursor-pointer text-left ${
              ownGroup ? "border-2 border-transparent bg-clip-padding" : "border border-slate-200 hover:border-brand"
            }`}
            style={ownGroup ? { borderColor: "#6366f1" } : undefined}
          >
            {ownGroup?.list?.[0]?.mediaType === "image" && ownGroup.list[0].mediaUrl ? (
              <img src={ownGroup.list[0].mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            ) : user?.avatar ? (
              <img src={user.avatar} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-50 transition" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-3xl font-bold">
                {(user?.fullname || "U").charAt(0).toUpperCase()}
              </span>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              className="absolute top-2 left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand text-white flex items-center justify-center border-2 border-white hover:scale-110 transition"
            >
              <FiPlus size={14} />
            </span>
            <span className="absolute bottom-0 left-0 right-0 bg-white px-1.5 py-2 text-center">
              <span className="block text-[11px] sm:text-xs font-semibold text-slate-700 truncate">
                {uploading ? "Uploading…" : ownGroup ? "Your story" : "Create story"}
              </span>
            </span>
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={handleUpload} disabled={uploading} />

          {/* One square card per friend — story thumbnail + name, gradient
              border while unseen (grey when fully seen), FB-style */}
          {friendGroups.map((g) => {
            const allSeen = g.list.every((s) => viewed.has(s._id));
            const cover = g.list.find((s) => s.mediaType === "image") || g.list[0];
            return (
              <button
                key={g.id}
                onClick={() => openGroup(g)}
                className={`relative shrink-0 w-[80px] h-[120px] sm:w-24 sm:h-36 rounded-xl overflow-hidden p-[3px] text-left ${
                  allSeen ? "bg-slate-300 dark:bg-slate-600" : "bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-amber-400"
                }`}
              >
                <span className="absolute inset-0 m-[3px] rounded-[9px] overflow-hidden bg-slate-200">
                  {cover?.mediaType === "image" && cover.mediaUrl ? (
                    <img src={cover.mediaUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : g.author?.avatar ? (
                    <img src={g.author.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-slate-500 text-3xl font-bold bg-slate-200">
                      {(g.author?.fullname || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                  {/* name overlay at the bottom (FB style) */}
                  <span className="absolute bottom-0 left-0 right-0 px-1.5 pt-6 pb-1.5 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {g.author?.avatar && (
                        <img src={g.author.avatar} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/70 shrink-0" />
                      )}
                      <span className="text-white text-[11px] sm:text-xs font-semibold truncate drop-shadow">
                        {String(g.id) === String(user?._id) ? "Your story" : (g.author?.fullname || "User").split(" ")[0]}
                      </span>
                    </span>
                  </span>
                </span>
                {/* count badge for multi-story authors */}
                {g.list.length > 1 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-black/55 text-white text-[10px] font-bold flex items-center justify-center">
                    {g.list.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex gap-2.5 sm:gap-3 pt-1">
            <Skeleton className="shrink-0 w-[80px] h-[120px] sm:w-24 sm:h-36 rounded-xl" count={4} />
          </div>
        )}
      </div>

      {/* ---------------- Full-screen FB-style viewer ---------------- */}
      {viewer && current && (
        <div className="fixed inset-0 z-[95] bg-black flex items-center justify-center">
          {/* Progress segments — one per story of this author */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3 max-w-lg mx-auto">
            {viewerList.map((s, i) => (
              <div key={s._id} className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden">
                {i < viewer.index && <div className="h-full w-full bg-white" />}
                {i === viewer.index && (
                  current.mediaType === "video" ? (
                    <div className="h-full bg-white" style={{ width: `${videoProg}%` }} />
                  ) : (
                    <div
                      key={`bar-${s._id}`}
                      className="h-full bg-white"
                      style={{
                        width: "100%",
                        animation: `storybar ${AUTO_MS}ms linear forwards`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                    />
                  )
                )}
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-2.5 px-4 max-w-lg mx-auto">
            {current.author?.avatar ? (
              <img src={current.author.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/30" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold">
                {(current.author?.fullname || "U").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {isOwn ? "Your story" : current.author?.fullname || "User"}
              </p>
              <p className="text-white/60 text-xs">{fmtWhen(current.createdAt)}</p>
            </div>
            {isOwn && (
              <button
                onClick={() => removeStory(current)}
                aria-label="Delete story"
                className="text-white/70 hover:text-red-400 p-2"
              >
                <FiTrash2 size={18} />
              </button>
            )}
            <button onClick={() => setViewer(null)} aria-label="Close story" className="text-white/80 hover:text-white p-2">
              <FiX size={26} />
            </button>
          </div>

          {/* Tap zones: left third = previous, right two-thirds = next (FB behaviour) */}
          <button
            onClick={() => step(-1)}
            disabled={viewer.index === 0}
            aria-label="Previous story"
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-start pl-2 disabled:cursor-default"
          >
            {viewer.index > 0 && (
              <span className="hidden sm:flex bg-white/10 hover:bg-white/25 text-white rounded-full p-2">
                <FiChevronLeft size={20} />
              </span>
            )}
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Next story"
            className="absolute right-0 top-0 bottom-0 w-2/3 z-10 flex items-center justify-end pr-2"
          >
            <span className="hidden sm:flex bg-white/10 hover:bg-white/25 text-white rounded-full p-2">
              <FiChevronRight size={20} />
            </span>
          </button>

          {/* Media — object-contain so the ORIGINAL image is fully visible */}
          <div className="relative z-0 w-full h-full flex items-center justify-center px-3 pt-24 pb-24 pointer-events-none">
            {current.mediaType === "video" ? (
              <video
                key={current._id}
                src={current.mediaUrl}
                className="max-w-full max-h-full rounded-xl object-contain"
                autoPlay
                playsInline
                onEnded={() => step(1)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setVideoProg((v.currentTime / v.duration) * 100);
                }}
              />
            ) : (
              <img
                key={current._id}
                src={current.mediaUrl}
                alt=""
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            )}
          </div>

          {current.caption && (
            <p className="absolute bottom-24 left-0 right-0 z-20 text-center text-white/90 text-sm px-8">
              {current.caption}
            </p>
          )}

          {/* Bottom bar */}
          {isOwn ? (
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-2 pb-5 pt-4 bg-gradient-to-t from-black/80 to-transparent">
              <span className="flex items-center gap-1.5 text-white/80 text-sm">
                <FiEye size={16} /> {(current.viewers || []).length} view{(current.viewers || []).length === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <form
              onSubmit={sendReply}
              className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2 px-4 pb-5 pt-4 bg-gradient-to-t from-black/80 to-transparent max-w-lg mx-auto"
            >
              <button
                type="button"
                onClick={() => toggleLike(current)}
                aria-label={likedByMe ? "Unlike story" : "Like story"}
                className={`shrink-0 p-2 transition-transform active:scale-125 ${likedByMe ? "text-red-500" : "text-white/80 hover:text-white"}`}
              >
                <FiHeart size={22} className={likedByMe ? "fill-current" : ""} />
                {(current.likes || []).length > 0 && (
                  <span className="block text-[10px] text-white/70 leading-none mt-0.5">{current.likes.length}</span>
                )}
              </button>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={`Reply to ${(current.author?.fullname || "friend").split(" ")[0]}…`}
                maxLength={500}
                className="flex-1 min-w-0 bg-white/10 border border-white/25 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50"
              />
              <button
                type="submit"
                disabled={!reply.trim()}
                aria-label="Send reply"
                className="shrink-0 p-2 text-white disabled:opacity-30 hover:text-white/80 transition"
              >
                <FiSend size={20} />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { storiesApi } from "../api/storiesApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Skeleton from "./Skeleton";
import { FiPlus, FiTrash2, FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

/**
 * FB-style story tray for the top of the Feed:
 *  - "Your story" tile uploads right away (images/videos, 24h on server)
 *  - One circle per author; tap to open the full-screen viewer
 *  - Own stories get a delete option, viewers are counted server-side
 */
export default function StoryTray() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const [viewer, setViewer] = useState(null); // { authorId, list, index }

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

  // Group stories by author — one circle per person (FB style)
  const groups = [];
  const byAuthor = new Map();
  for (const s of stories) {
    const id = s.author?._id || s.author;
    if (!byAuthor.has(id)) {
      const g = { author: s.author || {}, list: [] };
      byAuthor.set(id, g);
      groups.push(g);
    }
    byAuthor.get(id).list.push(s);
  }

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

  const openGroup = (g) => {
    g.list.forEach((s) => { storiesApi.view(s._id).catch(() => {}); });
    setViewer({ authorId: g.author?._id, list: g.list, index: 0 });
  };

  const step = (dir) =>
    setViewer((v) => {
      if (!v) return v;
      const next = v.index + dir;
      if (next < 0 || next >= v.list.length) return v;
      return { ...v, index: next };
    });

  const removeStory = async (s) => {
    if (!window.confirm("Delete this story?")) return;
    try {
      await storiesApi.remove(s._id);
      setStories((prev) => prev.filter((x) => x._id !== s._id));
      setViewer(null);
      showToast("Story deleted", "success");
    } catch {
      showToast("Failed to delete story", "error");
    }
  };

  const current = viewer?.list?.[viewer.index];
  const currentOwner = current && (current.author?._id || current.author) === user?._id;

  return (
    <>
      <div className="bg-white rounded-2xl shadow px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {/* Your story — upload tile */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="shrink-0 w-[84px] sm:w-24 text-center group"
          >
            <span className="relative block w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-brand transition">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover opacity-80" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-slate-400 text-2xl font-bold">
                  {(user?.fullname || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute bottom-1 right-1 bg-brand text-white rounded-full p-[3px] border-2 border-white">
                <FiPlus size={12} />
              </span>
            </span>
            <span className="block text-[11px] text-slate-600 mt-1.5 truncate">
              {uploading ? "Uploading…" : "Your story"}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={handleUpload} disabled={uploading} />

          {/* One circle per author */}
          {groups.map((g) => {
            const id = g.author?._id || g.author;
            return (
              <button key={id} onClick={() => openGroup(g)} className="shrink-0 w-[84px] sm:w-24 text-center">
                <span className="relative block w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full p-[3px] bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-amber-400">
                  <span className="block w-full h-full rounded-full p-[2px] bg-white">
                    {g.author?.avatar ? (
                      <img src={g.author.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-2xl font-bold">
                        {(g.author?.fullname || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
                <span className="block text-[11px] text-slate-600 mt-1.5 truncate">
                  {id === user?._id ? "Your story" : (g.author?.fullname || "User").split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex gap-3 pt-1">
            <Skeleton className="shrink-0 w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full" count={4} />
          </div>
        )}
      </div>

      {/* Full-screen story viewer */}
      {viewer && current && (
        <div className="fixed inset-0 z-[95] bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setViewer(null)}
            aria-label="Close story"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <FiX size={26} />
          </button>

          {viewer.list.length > 1 && (
            <>
              <button
                onClick={() => step(-1)}
                disabled={viewer.index === 0}
                aria-label="Previous story"
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-full p-2.5"
              >
                <FiChevronLeft size={22} />
              </button>
              <button
                onClick={() => step(1)}
                disabled={viewer.index === viewer.list.length - 1}
                aria-label="Next story"
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-full p-2.5"
              >
                <FiChevronRight size={22} />
              </button>
            </>
          )}

          <div className="max-w-md w-full">
            <div className="flex items-center gap-2.5 mb-3 px-1">
              {current.author?.avatar ? (
                <img src={current.author.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold">
                  {(current.author?.fullname || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">
                  {(current.author?.fullname || "User") === user?.fullname ? "Your story" : current.author?.fullname || "User"}
                </p>
                <p className="text-white/60 text-xs">
                  {new Date(current.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {currentOwner && (
                <button
                  onClick={() => removeStory(current)}
                  aria-label="Delete story"
                  className="text-white/70 hover:text-red-400 p-2"
                >
                  <FiTrash2 size={18} />
                </button>
              )}
            </div>

            {current.mediaType === "video" ? (
              <video
                key={current._id}
                src={current.mediaUrl}
                className="w-full max-h-[70vh] rounded-2xl bg-black object-contain"
                autoPlay
                playsInline
                controls
              />
            ) : (
              <img
                key={current._id}
                src={current.mediaUrl}
                alt=""
                className="w-full max-h-[70vh] rounded-2xl object-contain"
              />
            )}

            <p className="text-white/50 text-xs text-center mt-3">
              {viewer.index + 1} / {viewer.list.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { storiesApi } from "../api/storiesApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Skeleton from "../components/Skeleton";
import { FiPlus, FiImage } from "react-icons/fi";

export default function Stories() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const res = await storiesApi.list();
      setStories(res.data?.stories || []);
    } catch (e) {
      showToast("Failed to load stories", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("media", file);
      const res = await storiesApi.create(fd);
      const s = res.data?.story;
      if (s) setStories((prev) => [s, ...prev]);
      showToast("Story posted", "success");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to post story", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleView = async (story) => {
    try { await storiesApi.view(story._id); } catch {}
  };

  const handleDelete = async (story) => {
    if (!window.confirm("Delete story?")) return;
    try {
      await storiesApi.remove(story._id);
      setStories((prev) => prev.filter((s) => s._id !== story._id));
      showToast("Story deleted", "success");
    } catch (e) {
      showToast("Failed to delete", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-4">Stories</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        <label className="shrink-0 w-28 h-44 bg-slate-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-slate-300 hover:border-brand">
          <FiPlus size={24} />
          <span className="text-xs mt-2">{uploading ? "Uploading..." : "Your story"}</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={handleCreate} disabled={uploading} />
        </label>
        {stories.map((s) => {
          const author = s.author || {};
          const isOwner = author._id === user?._id;
          return (
            <div key={s._id} className="shrink-0 w-28 h-44 rounded-2xl overflow-hidden relative bg-slate-200" onClick={() => handleView(s)}>
              {s.mediaType === "video" ? (
                <video src={s.mediaUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={s.mediaUrl} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-xs truncate">{author.fullname || "User"}</p>
              </div>
              {isOwner && (
                <button onClick={(e) => { e.stopPropagation(); handleDelete(s); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {loading && (
        <div className="flex gap-4 overflow-hidden pb-4">
          <Skeleton className="shrink-0 w-28 h-44 rounded-2xl" count={4} />
        </div>
      )}
      {!loading && stories.length === 0 && <p className="text-slate-500">No stories yet.</p>}
    </div>
  );
}
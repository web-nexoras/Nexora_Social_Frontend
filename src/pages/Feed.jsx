import React, { useEffect, useState, useRef } from "react";
import { postsApi } from "../api/postsApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiImage, FiSend, FiMoreHorizontal, FiEdit2, FiTrash2, FiChevronUp, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import Skeleton from "../components/Skeleton";

const REACTIONS = [
  { key: "like", emoji: "👍", label: "Like" },
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "haha", emoji: "😂", label: "Haha" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "angry", emoji: "😠", label: "Angry" },
];

const EMOJI = { like: "👍", love: "❤️", haha: "😂", wow: "😮", sad: "😢", angry: "😠" };

/**
 * FB-style photo layout:
 *  - 1 photo  → full-width, keeps its natural ratio (never stretched)
 *  - 2 photos → two squares side by side
 *  - 3 photos → big left + two stacked right
 *  - 4+       → 2-column square grid
 * Clicking any photo opens the full-screen viewer.
 */
function PostImages({ images, onOpen }) {
  const count = images.length;

  if (count === 1) {
    return (
      <div
        className="rounded-lg overflow-hidden bg-black/5 border border-slate-200/60 cursor-zoom-in"
        onClick={() => onOpen(0)}
      >
        <img src={images[0]} alt="" className="w-full max-h-[480px] sm:max-h-[560px] object-contain" />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 rounded-lg overflow-hidden h-56 sm:h-72">
        <img
          src={images[0]}
          alt=""
          onClick={() => onOpen(0)}
          className="row-span-2 h-full w-full object-cover cursor-zoom-in hover:brightness-95 transition"
        />
        {images.slice(1, 3).map((url, i) => (
          <img
            key={i}
            src={url}
            alt=""
            onClick={() => onOpen(i + 1)}
            className="h-full w-full object-cover cursor-zoom-in hover:brightness-95 transition"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
      {images.slice(0, 4).map((url, i) => (
        <div key={i} className="relative aspect-square">
          <img
            src={url}
            alt=""
            onClick={() => onOpen(i)}
            className="h-full w-full object-cover cursor-zoom-in hover:brightness-95 transition"
          />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center text-2xl font-bold">
              +{count - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [comments, setComments] = useState({});
  const [reactionModal, setReactionModal] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareText, setShareText] = useState("");
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef();
  const [menuPostId, setMenuPostId] = useState(null); // owner-only post menu
  const [editTarget, setEditTarget] = useState(null); // post being edited
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editRemove, setEditRemove] = useState([]); // image URLs to drop on save
  const [editFiles, setEditFiles] = useState([]); // newly picked images
  const editFileRef = useRef();
  const [pickerPostId, setPickerPostId] = useState(null); // hover reaction picker
  const [lightbox, setLightbox] = useState(null); // { images: [], index: 0 } full-screen viewer
  const pickerTimerRef = useRef(null);

  // Close the post menu when clicking anywhere outside it.
  // NOTE: a shared ref can't track every post's menu (only the last rendered
  // one holds it), which made Edit/Delete clicks get cancelled by this very
  // handler before firing — so detect the menu via a data attribute instead.
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest?.("[data-post-menu]")) setMenuPostId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openPicker = (postId) => {
    if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
    setPickerPostId(postId);
  };
  const scheduleClosePicker = () => {
    if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
    // small delay so the cursor can travel into the popup
    pickerTimerRef.current = setTimeout(() => setPickerPostId(null), 350);
  };
  useEffect(() => () => pickerTimerRef.current && clearTimeout(pickerTimerRef.current), []);

  // Full-screen viewer: Esc closes, arrows navigate
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight")
        setLightbox((l) => (l ? { ...l, index: (l.index + 1) % l.images.length } : l));
      else if (e.key === "ArrowLeft")
        setLightbox((l) => (l ? { ...l, index: (l.index - 1 + l.images.length) % l.images.length } : l));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // prevent background scroll
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  const loadFeed = async (nextCursor = null) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await postsApi.feed(nextCursor);
      const newPosts = res.data?.posts || [];
      setPosts((prev) => (nextCursor ? [...prev, ...newPosts] : newPosts));
      setCursor(res.data?.nextCursor || null);
      setHasMore(!!res.data?.hasMore);
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to load feed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!text.trim() && !files.length) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("text", text);
      files.forEach((f) => fd.append("images", f));
      const res = await postsApi.create(fd);
      const post = res.data?.post;
      if (post) setPosts((prev) => [post, ...prev]);
      setText("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      showToast("Post created", "success");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to create post", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (post, type) => {
    try {
      const res = await postsApi.react("post", post._id, type);
      const data = res.data || {};
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== post._id) return p;
          return {
            ...p,
            likesCount: data.total ?? p.likesCount,
            reactionCounts: data.reactionCounts || p.reactionCounts,
            myReaction: data.myReaction ?? (data.action === "removed" ? null : type),
          };
        }),
      );
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to react", "error");
    }
  };

  const toggleComments = async (postId) => {
    if (openComments[postId]) {
      setOpenComments((prev) => ({ ...prev, [postId]: false }));
      return;
    }
    setOpenComments((prev) => ({ ...prev, [postId]: true }));
    if (!comments[postId]) {
      try {
        const res = await postsApi.comments(postId);
        setComments((prev) => ({ ...prev, [postId]: res.data?.comments || [] }));
      } catch (e) {
        showToast("Failed to load comments", "error");
      }
    }
  };

  const submitComment = async (postId) => {
    const content = (commentText[postId] || "").trim();
    if (!content) return;
    try {
      const res = await postsApi.addComment(postId, content);
      const c = res.data?.comment;
      if (c) setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), c] }));
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)));
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to comment", "error");
    }
  };

  const handleSave = async (post) => {
    try {
      const res = await postsApi.save(post._id);
      showToast(res.data?.saved ? "Saved" : "Unsaved", "success");
    } catch (e) {
      showToast("Failed", "error");
    }
  };

  const handleShare = (post) => {
    setShareTarget(post);
    setShareText("");
  };

  const submitShare = async () => {
    if (!shareTarget || sharing) return;
    setSharing(true);
    try {
      const fd = new FormData();
      fd.append("text", shareText.trim()); // caption optional — user decides
      fd.append("sharedPostId", shareTarget._id);
      const res = await postsApi.create(fd);
      const newPost = res.data?.post;
      if (newPost) setPosts((prev) => [newPost, ...prev]);
      showToast("Shared to your feed", "success");
      setShareTarget(null);
      setShareText("");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to share", "error");
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await postsApi.remove(post._id);
      setPosts((prev) => prev.filter((p) => p._id !== post._id));
      showToast("Post deleted", "success");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to delete", "error");
    }
  };

  const openEdit = (post) => {
    setMenuPostId(null);
    setEditTarget(post);
    setEditText(post.text || "");
    setEditRemove([]);
    setEditFiles([]);
  };

  const submitEdit = async () => {
    if (!editTarget || savingEdit) return;
    const keptImages = (editTarget.attachments || []).filter((url) => !editRemove.includes(url));
    if (!editText.trim() && !keptImages.length && !editFiles.length && !editTarget.sharedPost) {
      showToast("Post cannot be empty — add text or an image", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await postsApi.update(editTarget._id, {
        text: editText.trim(),
        images: editFiles,
        removeImages: editRemove,
      });
      const updated = res.data?.post;
      if (updated) setPosts((prev) => prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)));
      showToast("Post updated", "success");
      setEditTarget(null);
      setEditRemove([]);
      setEditFiles([]);
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to update post", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Create post — slim single-row style */}
      <div className="bg-white rounded-2xl shadow px-4 pt-4 pb-2.5">
        <form onSubmit={handleCreate} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full neo-input rounded-lg px-3 py-2 text-sm resize-none placeholder:text-slate-400"
            rows={2}
          />
          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => (
                <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded">{f.name}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-slate-600 hover:text-brand text-sm py-1">
              <FiImage /> Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <button type="submit" disabled={posting} className="px-3.5 py-1.5 rounded-lg bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </div>

      {/* Feed */}
      {posts.map((post) => {
        const author = post.author || {};
        const isOwner = author._id === user?._id || author === user?._id;
        const totalReactions = REACTIONS.reduce((s, r) => s + (post.reactionCounts?.[r.key] || 0), 0);
        return (
          <div key={post._id} className="bg-white rounded-2xl shadow p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <img src={author.avatar || "https://via.placeholder.com/40"} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{author.fullname || "User"}</p>
                  <p className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {isOwner && (
                <div data-post-menu className="relative shrink-0">
                  <button
                    onClick={() => setMenuPostId(menuPostId === post._id ? null : post._id)}
                    className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Post options"
                  >
                    <FiMoreHorizontal />
                  </button>
                  {menuPostId === post._id && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-white rounded-xl neo-menu border py-1 text-sm shadow">
                      <button onClick={() => openEdit(post)} className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-slate-50">
                        <FiEdit2 /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setMenuPostId(null);
                          handleDelete(post);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-red-600 hover:bg-red-50"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {post.text && <p className="whitespace-pre-wrap break-words">{post.text}</p>}
            {post.sharedPost && (
              <div className="border rounded-lg p-3 bg-slate-50">
                <p className="text-xs text-slate-500 mb-1">Shared post by {post.sharedPost?.author?.fullname || "User"}</p>
                <p className="text-sm">{post.sharedPost?.text}</p>
                {post.sharedPost?.attachments?.length > 0 && (
                  <img src={post.sharedPost.attachments[0]} alt="" className="mt-2 rounded-lg w-full object-cover max-h-60" />
                )}
              </div>
            )}
            {post.attachments?.length > 0 && (
              <PostImages images={post.attachments} onOpen={(idx) => setLightbox({ images: post.attachments, index: idx })} />
            )}
            {post.hashtags?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.hashtags.map((h) => (
                  <span key={h} className="text-brand text-sm">#{h}</span>
                ))}
              </div>
            )}
            {/* Single row: reactions + comment + share + save */}
            <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1.5 border-t pt-2 text-sm text-slate-500">
              {/* Reactions — hover the like button (or tap ▲ on mobile) for the emoji picker */}
              <div className="relative flex items-center gap-1 min-w-0" onMouseEnter={() => openPicker(post._id)} onMouseLeave={scheduleClosePicker}>
                {pickerPostId === post._id && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 flex items-end gap-0.5 rounded-full bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.15)] px-2.5 sm:px-3 py-2">
                    {REACTIONS.map((r, i) => (
                      <button
                        key={r.key}
                        onClick={() => {
                          handleReact(post, r.key);
                          setPickerPostId(null);
                        }}
                        title={r.label}
                        className="group/emoji relative p-1 emoji-pop"
                        style={{ animationDelay: `${i * 45}ms` }}
                      >
                        <span className="block text-2xl sm:text-3xl leading-none transition-transform duration-150 group-hover/emoji:scale-[1.7] group-hover/emoji:-translate-y-1.5">
                          {r.emoji}
                        </span>
                        <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover/emoji:opacity-100 transition">
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleReact(post, post.myReaction || "like")}
                  title={post.myReaction ? "Remove reaction" : "Like"}
                  className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-100 transition"
                >
                  <span className="text-xl leading-none">{EMOJI[post.myReaction || "like"]}</span>
                  {totalReactions > 0 && <span className="text-xs font-semibold text-slate-600">{totalReactions}</span>}
                </button>
                {/* Mobile: tap the caret to toggle the picker (no hover on touch) */}
                <button
                  onClick={() => (pickerPostId === post._id ? setPickerPostId(null) : openPicker(post._id))}
                  className="sm:hidden p-1 rounded-full hover:bg-slate-100 text-slate-400"
                  aria-label="Choose reaction"
                >
                  <FiChevronUp className={`transition ${pickerPostId === post._id ? "rotate-180" : ""}`} />
                </button>
                {totalReactions > 0 && (
                  <button
                    onClick={() =>
                      postsApi
                        .reactions("post", post._id)
                        .then((res) => setReactionModal({ post, data: res.data }))
                        .catch(() => showToast("Failed to load reactions", "error"))
                    }
                    className="text-xs text-slate-500 hover:text-brand hover:underline ml-0.5 whitespace-nowrap"
                  >
                    {post.myReaction
                      ? totalReactions > 1
                        ? `You and ${totalReactions - 1} other${totalReactions - 1 > 1 ? "s" : ""}`
                        : "You"
                      : `${totalReactions} ${totalReactions === 1 ? "person" : "people"} reacted`}
                  </button>
                )}
              </div>
              {/* Comment (center) */}
              <button onClick={() => toggleComments(post._id)} className="flex items-center gap-1 hover:text-brand px-2 py-1">
                <FiMessageCircle /> {post.commentsCount || 0}
              </button>
              {/* Share + Save (right) */}
              <div className="flex items-center gap-3">
                <button onClick={() => handleShare(post)} className="flex items-center gap-1 hover:text-brand px-2 py-1">
                  <FiShare2 /> {post.sharesCount || 0}
                </button>
                <button onClick={() => handleSave(post)} className="flex items-center gap-1 hover:text-brand px-2 py-1">
                  <FiBookmark /> {post.savesCount || 0}
                </button>
              </div>
            </div>

            {/* Comments */}
            {openComments[post._id] && (
              <div className="space-y-2 border-t pt-2">
                {(comments[post._id] || []).map((c) => (
                  <div key={c._id} className="flex gap-2">
                    <img src={c.author?.avatar || "https://via.placeholder.com/28"} alt="" className="w-7 h-7 rounded-full object-cover" />
                    <div className="bg-slate-50 rounded-lg px-3 py-2 flex-1">
                      <p className="text-sm font-semibold">{c.author?.fullname}</p>
                      <p className="text-sm">{c.text}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 min-w-0">
                  <input
                    value={commentText[post._id] || ""}
                    onChange={(e) => setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))}
                    placeholder="Write a comment..."
                    className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button onClick={() => submitComment(post._id)} className="px-3 py-2 rounded-lg bg-brand text-white text-sm">
                    <FiSend />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {reactionModal && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl neo-modal p-4 sm:p-5 w-full max-w-md max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-brand">Reactions ({reactionModal.data?.total || 0})</h3>
              <button onClick={() => setReactionModal(null)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            {Object.entries(reactionModal.data?.grouped || {}).map(([type, users]) => (
              <div key={type} className="mb-3">
                <p className="text-sm font-semibold text-slate-700 mb-1">{EMOJI[type] || type} {users.length}</p>
                <div className="space-y-1">
                  {(users || []).map((u) => (
                    <div key={u._id} className="flex items-center gap-2">
                      <img src={u.avatar || "https://via.placeholder.com/24"} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <span className="text-sm text-slate-800">{u.fullname}</span>
                      {u._id === user?._id && <span className="text-xs text-slate-400">(You)</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!reactionModal.data?.total && <p className="text-slate-500 text-sm">No reactions yet</p>}
          </div>
        </div>
      )}

      {/* Full-screen image viewer (FB-style lightbox) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-lg transition"
            aria-label="Close"
          >
            <FiX />
          </button>

          {lightbox.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => ({ ...l, index: (l.index - 1 + l.images.length) % l.images.length }));
                }}
                className="absolute left-2 sm:left-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl transition"
                aria-label="Previous image"
              >
                <FiChevronLeft />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => ({ ...l, index: (l.index + 1) % l.images.length }));
                }}
                className="absolute right-2 sm:right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl transition"
                aria-label="Next image"
              >
                <FiChevronRight />
              </button>
            </>
          )}

          <img
            src={lightbox.images[lightbox.index]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl select-none"
          />

          {lightbox.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-white/10 px-3 py-1 rounded-full">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          )}
        </div>
      )}

      {/* Edit post modal — author only (backend enforces too) */}
      {editTarget && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => !savingEdit && setEditTarget(null)}
        >
          <div
            className="bg-white rounded-2xl neo-modal p-4 sm:p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand">Edit post</h3>
              <button onClick={() => setEditTarget(null)} disabled={savingEdit} className="text-slate-500 hover:text-slate-800 disabled:opacity-50">
                ✕
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              disabled={savingEdit}
              className="w-full neo-input rounded-lg p-3 resize-none focus:ring-2 focus:ring-brand focus:outline-none text-sm"
            />

            {/* Images — remove old ones, add new ones */}
            {(((editTarget.attachments || []).some((url) => !editRemove.includes(url))) ||
              editFiles.length > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {(editTarget.attachments || [])
                  .filter((url) => !editRemove.includes(url))
                  .map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="rounded-lg w-full h-24 object-cover" />
                      <button
                        onClick={() => setEditRemove((prev) => [...prev, url])}
                        disabled={savingEdit}
                        title="Remove image"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow hover:bg-red-600 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                {editFiles.map((f, i) => (
                  <div key={`new-${i}`} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="rounded-lg w-full h-24 object-cover" />
                    <span className="absolute bottom-1 left-1 text-[9px] bg-emerald-600 text-white px-1 rounded">New</span>
                    <button
                      onClick={() => setEditFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={savingEdit}
                      title="Remove"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow hover:bg-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => editFileRef.current?.click()}
                disabled={savingEdit}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand disabled:opacity-50"
              >
                <FiImage /> {editFiles.length ? "Add more photos" : "Change photos"}
              </button>
              <span className="text-xs text-slate-400">
                {(editTarget.attachments || []).filter((url) => !editRemove.includes(url)).length + editFiles.length}/5 photos
              </span>
            </div>
            <input
              ref={editFileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                const kept = (editTarget.attachments || []).filter((url) => !editRemove.includes(url)).length;
                const room = Math.max(0, 5 - kept - editFiles.length);
                if (picked.length > room) showToast(`Only ${room} more photo${room === 1 ? "" : "s"} allowed`, "info");
                setEditFiles((prev) => [...prev, ...picked.slice(0, room)]);
                e.target.value = "";
              }}
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditTarget(null)}
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={savingEdit}
                className="px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal — caption optional, user decides */}
      {shareTarget && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => !sharing && setShareTarget(null)}
        >
          <div className="bg-white rounded-2xl neo-modal p-4 sm:p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand">Share post</h3>
              <button onClick={() => setShareTarget(null)} disabled={sharing} className="text-slate-500 hover:text-slate-800 disabled:opacity-50">✕</button>
            </div>
            <textarea
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              placeholder="Add an optional caption... (leave empty to share as is)"
              className="w-full border rounded-lg p-3 resize-none focus:ring-2 focus:ring-brand focus:outline-none"
              rows={3}
              disabled={sharing}
            />
            <div className="border rounded-lg p-3 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">
                {shareTarget._id === user?._id ? "Your post" : `Post by ${shareTarget.author?.fullname || "Unknown"}`}
              </p>
              <p className="text-sm line-clamp-4">{shareTarget.text || "(no text)"}</p>
              {shareTarget.attachments?.length > 0 && (
                <img src={shareTarget.attachments[0]} alt="" className="mt-2 rounded-lg w-full object-cover max-h-40" />
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShareTarget(null)}
                disabled={sharing}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitShare}
                disabled={sharing}
                className="px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {sharing ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {hasMore && (
        <button onClick={() => loadFeed(cursor)} disabled={loading} className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200">
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
      {loading && posts.length === 0 && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" count={3} />
        </div>
      )}
      {!loading && posts.length === 0 && <p className="text-center text-slate-500">No posts yet. Be the first!</p>}
    </div>
  );
}
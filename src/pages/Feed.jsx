import React, { useEffect, useState, useRef } from "react";
import { postsApi } from "../api/postsApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiImage, FiSend, FiMoreHorizontal } from "react-icons/fi";
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
        return (
          <div key={post._id} className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={author.avatar || "https://via.placeholder.com/40"} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold">{author.fullname || "User"}</p>
                  <p className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {isOwner && (
                <button onClick={() => handleDelete(post)} className="text-slate-400 hover:text-red-500">
                  <FiMoreHorizontal />
                </button>
              )}
            </div>
            {post.text && <p className="whitespace-pre-wrap">{post.text}</p>}
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
              <div className="grid gap-2">
                {post.attachments.map((url, i) => (
                  <img key={i} src={url} alt="" className="rounded-lg w-full object-cover max-h-96" />
                ))}
              </div>
            )}
            {post.hashtags?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.hashtags.map((h) => (
                  <span key={h} className="text-brand text-sm">#{h}</span>
                ))}
              </div>
            )}
            {/* Single row: reactions + comment + share + save */}
            <div className="flex items-center justify-between flex-wrap gap-y-1 border-t pt-2 text-sm text-slate-500">
              {/* Reactions (left, compact) */}
              <div className="flex items-center gap-1 flex-wrap">
                {REACTIONS.map((r) => {
                  const count = post.reactionCounts?.[r.key] || 0;
                  return (
                    <button
                      key={r.key}
                      onClick={() => handleReact(post, r.key)}
                      title={r.label}
                      className={`flex items-center gap-0 px-1 py-1 rounded-full transition transform hover:scale-125 ${
                        post.myReaction === r.key ? "bg-indigo-100 text-brand font-semibold scale-110" : "hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-lg">{r.emoji}</span>
                      {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                    </button>
                  );
                })}
                {(() => {
                  const total = REACTIONS.reduce((s, r) => s + (post.reactionCounts?.[r.key] || 0), 0);
                  if (!total) return null;
                  const label = post.myReaction
                    ? total > 1
                      ? `You and ${total - 1} other${total - 1 > 1 ? "s" : ""}`
                      : "You"
                    : `${total} ${total === 1 ? "person" : "people"} reacted`;
                  return (
                    <button
                      onClick={() =>
                        postsApi
                          .reactions("post", post._id)
                          .then((res) => setReactionModal({ post, data: res.data }))
                          .catch(() => showToast("Failed to load reactions", "error"))
                      }
                      className="text-xs text-slate-500 hover:text-brand hover:underline ml-0.5 whitespace-nowrap"
                    >
                      {label}
                    </button>
                  );
                })()}
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
                <div className="flex gap-2">
                  <input
                    value={commentText[post._id] || ""}
                    onChange={(e) => setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))}
                    placeholder="Write a comment..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
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
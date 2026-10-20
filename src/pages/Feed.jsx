import React, { useEffect, useState, useRef } from "react";
import { postsApi } from "../api/postsApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiImage, FiSend, FiMoreHorizontal } from "react-icons/fi";

const REACTIONS = ["like", "love", "haha", "wow", "sad", "angry"];

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
      const action = res.data?.action;
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== post._id) return p;
          let count = p.likesCount || 0;
          if (action === "added") count += 1;
          if (action === "removed") count = Math.max(0, count - 1);
          return { ...p, likesCount: count, myReaction: action === "removed" ? null : type };
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

  const handleShare = async (post) => {
    try {
      await postsApi.share(post._id);
      showToast("Shared", "success");
    } catch (e) {
      showToast("Failed", "error");
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
      {/* Create post */}
      <div className="bg-white rounded-2xl shadow p-4">
        <form onSubmit={handleCreate} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full border rounded-lg p-3 resize-none focus:ring-2 focus:ring-brand"
            rows={3}
          />
          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => (
                <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded">{f.name}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-slate-600 hover:text-brand">
              <FiImage /> Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <button type="submit" disabled={posting} className="px-4 py-2 rounded-lg bg-brand text-white font-semibold disabled:opacity-50">
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
            <div className="flex items-center justify-between text-sm text-slate-500 border-t pt-2">
              <button onClick={() => handleReact(post, "like")} className="flex items-center gap-1 hover:text-brand">
                <FiHeart /> {post.likesCount || 0}
              </button>
              <button onClick={() => toggleComments(post._id)} className="flex items-center gap-1 hover:text-brand">
                <FiMessageCircle /> {post.commentsCount || 0}
              </button>
              <button onClick={() => handleShare(post)} className="flex items-center gap-1 hover:text-brand">
                <FiShare2 /> {post.sharesCount || 0}
              </button>
              <button onClick={() => handleSave(post)} className="flex items-center gap-1 hover:text-brand">
                <FiBookmark /> {post.savesCount || 0}
              </button>
            </div>

            {/* Reactions quick */}
            <div className="flex gap-2 flex-wrap">
              {REACTIONS.map((r) => (
                <button key={r} onClick={() => handleReact(post, r)} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
                  {r}
                </button>
              ))}
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

      {hasMore && (
        <button onClick={() => loadFeed(cursor)} disabled={loading} className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200">
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
      {!loading && posts.length === 0 && <p className="text-center text-slate-500">No posts yet. Be the first!</p>}
    </div>
  );
}
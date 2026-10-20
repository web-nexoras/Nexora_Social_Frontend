import React, { useEffect, useState } from "react";
import { notificationsApi } from "../api/notificationsApi";
import { useToast } from "../context/ToastContext";
import { useSocket } from "../context/SocketContext";
import { Link } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
import Skeleton from "../components/Skeleton";

export default function Notifications() {
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list(1);
      setNotifications(res.data?.notifications || []);
      setUnread(res.data?.unreadCount || 0);
    } catch (e) {
      showToast("Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnread((c) => c + 1);
      showToast(n?.title || "New notification", "info");
    };
    socket.on("notification:new", handler);
    return () => socket.off("notification:new", handler);
  }, [socket]);

  const markRead = async (n) => {
    try {
      await notificationsApi.markRead(n._id);
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
      showToast("All marked as read", "success");
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-brand flex items-center gap-2">
          <FiBell /> Notifications {unread > 0 && <span className="text-sm bg-red-500 text-white rounded-full px-2">{unread}</span>}
        </h1>
        {unread > 0 && (
          <button onClick={markAll} className="text-sm text-brand hover:underline flex items-center gap-1">
            <FiCheck /> Mark all read
          </button>
        )}
      </div>

      {loading && <div className="space-y-3"><Skeleton className="h-16 w-full" count={5} /></div>}

      {!loading && notifications.length === 0 && <p className="text-slate-500 text-sm">No notifications yet</p>}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n._id}
            onClick={() => !n.read && markRead(n)}
            className={`bg-white rounded-xl shadow p-4 cursor-pointer transition ${n.read ? "opacity-70" : "ring-2 ring-brand/30"}`}
          >
            <p className="font-semibold text-slate-800">{n.title}</p>
            <p className="text-sm text-slate-600">{n.body}</p>
            <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            {n.data?.postId && (
              <Link to={`/feed`} className="text-xs text-brand hover:underline">View post</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
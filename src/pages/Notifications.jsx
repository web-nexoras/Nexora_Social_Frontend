import React, { useEffect, useState } from "react";
import { notificationsApi } from "../api/notificationsApi";
import { useToast } from "../context/ToastContext";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck, FiArrowRight } from "react-icons/fi";
import Skeleton from "../components/Skeleton";
import { getNotificationTarget } from "../utils/notificationTarget";

export default function Notifications() {
  const { showToast } = useToast();
  const { socket } = useSocket();
  const navigate = useNavigate();
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

  // A notification is an entry point, not just a status badge: mark it read
  // and open the screen it belongs to (post, chat, friend requests, ...).
  const openNotification = (n) => {
    if (!n.read) markRead(n);
    const target = getNotificationTarget(n);
    if (target) navigate(target);
  };

  const handleKeyDown = (e, n) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openNotification(n);
    }
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
        {notifications.map((n) => {
          const target = getNotificationTarget(n);
          return (
            <div
              key={n._id}
              role="button"
              tabIndex={0}
              onClick={() => openNotification(n)}
              onKeyDown={(e) => handleKeyDown(e, n)}
              className={`bg-white rounded-xl shadow p-4 cursor-pointer transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                n.read ? "opacity-70" : "ring-2 ring-brand/30"
              }`}
            >
              <p className="font-semibold text-slate-800">{n.title}</p>
              <p className="text-sm text-slate-600">{n.body}</p>
              <div className="flex items-center justify-between gap-3 mt-1">
                <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                {target && (
                  <span className="text-xs text-brand font-semibold flex items-center gap-1 shrink-0">
                    Open <FiArrowRight />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
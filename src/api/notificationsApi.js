import api from "./axios";

export const notificationsApi = {
  list: (page = 1, unread = false) => api.get("/notifications", { params: { page, unread } }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/all/read"),
};
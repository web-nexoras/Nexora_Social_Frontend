import api from "./axios";

export const chatApi = {
  conversations: () => api.get("/chat/conversations"),
  createDirect: (userId) => api.post(`/chat/conversations/direct/${userId}`),
  messages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  send: (conversationId, payload) =>
    api.post(`/chat/conversations/${conversationId}/messages`, payload),
  deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
  updateMessage: (messageId, text) => api.put(`/chat/messages/${messageId}`, { text }),
  deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
  markRead: (conversationId) => api.post(`/chat/conversations/${conversationId}/read`),
  reactMessage: (messageId, type) => api.post(`/chat/messages/${messageId}/react`, { type }),
  pinMessage: (messageId) => api.patch(`/chat/messages/${messageId}/pin`),
  searchMessages: (conversationId, q) => api.get(`/chat/conversations/${conversationId}/search`, { params: { q } }),
  muteConversation: (conversationId) => api.post(`/chat/conversations/${conversationId}/mute`),
  archiveConversation: (conversationId) => api.post(`/chat/conversations/${conversationId}/archive`),
  uploadMedia: (formData) => api.post("/chat/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
};

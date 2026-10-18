import api from "./axios";

export const chatApi = {
  conversations: () => api.get("/chat/conversations"),
  createDirect: (userId) => api.post(`/chat/conversations/direct/${userId}`),
  messages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  send: (conversationId, text, attachments = []) =>
    api.post(`/chat/conversations/${conversationId}/messages`, {
      text,
      attachments,
    }),
  deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
  updateMessage: (messageId, text) => api.put(`/chat/messages/${messageId}`, { text }),
  deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
};

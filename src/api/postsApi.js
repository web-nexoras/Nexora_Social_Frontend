import api from "./axios";

export const postsApi = {
  feed: (cursor, limit = 20) =>
    api.get("/posts/feed", { params: { cursor, limit } }),
  create: (formData) => api.post("/posts", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  get: (id) => api.get(`/posts/${id}`),
  remove: (id) => api.delete(`/posts/${id}`),
  share: (id) => api.post(`/posts/${id}/share`),
  save: (id) => api.post(`/posts/${id}/save`),
  saved: () => api.get("/posts/saved"),
  byHashtag: (tag, limit = 20) => api.get(`/posts/hashtag/${tag}`, { params: { limit } }),
  react: (targetType, targetId, type) =>
    api.post(`/posts/${targetType}/${targetId}/react`, { type }),
  addComment: (postId, text, parentId) =>
    api.post(`/posts/${postId}/comments`, { text, parentId }),
  comments: (postId, page = 1, parentId) =>
    api.get(`/posts/${postId}/comments`, { params: { page, parentId } }),
  updateComment: (id, text) => api.put(`/posts/comments/${id}`, { text }),
  deleteComment: (id) => api.delete(`/posts/comments/${id}`),
};
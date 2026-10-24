import api from "./axios";

export const followsApi = {
  follow: (id) => api.post(`/follows/${id}`),
  unfollow: (id) => api.delete(`/follows/${id}`),
  status: (id) => api.get(`/follows/${id}/status`),
  followers: (id) => api.get(`/follows/${id}/followers`),
  following: (id) => api.get(`/follows/${id}/following`),
};

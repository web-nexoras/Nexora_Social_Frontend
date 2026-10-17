import api from "./axios";

export const usersApi = {
  list: (params) => api.get("/users", { params }),
  search: (q) => api.get("/users/search", { params: { q } }),
  admins: () => api.get("/users/admins"),
  get: (id) => api.get(`/users/${id}`),
  approve: (id) => api.patch(`/users/${id}/approve`),
  reject: (id) => api.patch(`/users/${id}/reject`),
  toggle: (id) => api.patch(`/users/${id}/toggle-active`),
  remove: (id) => api.delete(`/users/${id}`),
};

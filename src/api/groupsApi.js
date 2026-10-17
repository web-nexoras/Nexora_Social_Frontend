import api from "./axios";

export const groupsApi = {
  list: () => api.get("/groups"),
  create: (data) => api.post("/groups", data),
  get: (id) => api.get(`/groups/${id}`),
  update: (id, data) => api.patch(`/groups/${id}`, data),
  remove: (id) => api.delete(`/groups/${id}`),
  members: (id) => api.get(`/groups/${id}/members`),
  addMembers: (id, userIds) => api.post(`/groups/${id}/members`, { userIds }),
};

export const paymentsApi = {
  initSubscription: (groupId) => api.post("/payments/subscription/init", { groupId }),
  mySubscriptions: () => api.get("/payments/my-subscriptions"),
};

import api from "./axios";

export const groupsApi = {
  list: () => api.get("/groups"),
  create: (data) => api.post("/groups", data),
  get: (id) => api.get(`/groups/${id}`),
  byConversation: (conversationId) => api.get(`/groups/by-conversation/${conversationId}`),
  update: (id, data) => api.patch(`/groups/${id}`, data),
  remove: (id) => api.delete(`/groups/${id}`),
  members: (id) => api.get(`/groups/${id}/members`),
  subscribers: (id) => api.get(`/groups/${id}/subscribers`),
  addMembers: (id, userIds) => api.post(`/groups/${id}/members`, { userIds }),
};

export const paymentsApi = {
  initSubscription: (groupId) => api.post("/payments/subscription/init", { groupId }),
  demoConfirm: (transactionId, method) => api.post("/payments/subscription/demo-confirm", { transactionId, method }),
  mySubscriptions: () => api.get("/payments/my-subscriptions"),
  removeMy: (id) => api.delete(`/payments/my-subscriptions/${id}`),
  adminAll: (params) => api.get("/payments/subscription/admin/all", { params }),
  approve: (id) => api.patch(`/payments/subscription/${id}/approve`),
  reject: (id) => api.patch(`/payments/subscription/${id}/reject`),
};

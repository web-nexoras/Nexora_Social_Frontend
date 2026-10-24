import api from "./axios";

export const friendsApi = {
  suggestions: (search) =>
    api.get("/friends/suggestions", { params: search ? { search } : {} }),
  sendRequest: (userId) => api.post(`/friends/request/${userId}`),
  incoming: () => api.get("/friends/requests/incoming"),
  sent: () => api.get("/friends/requests/sent"),
  accept: (id) => api.patch(`/friends/requests/${id}/accept`),
  reject: (id) => api.patch(`/friends/requests/${id}/reject`),
  cancel: (id) => api.patch(`/friends/requests/${id}/cancel`),
  list: () => api.get("/friends"),
  profile: (userId) => api.get(`/friends/profile/${userId}`),
};

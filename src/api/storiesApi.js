import api from "./axios";

export const storiesApi = {
  list: () => api.get("/stories"),
  create: (formData) => api.post("/stories", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  view: (id) => api.post(`/stories/${id}/view`),
  remove: (id) => api.delete(`/stories/${id}`),
};
import api from "./axios";

export const storiesApi = {
  list: () => api.get("/stories"),
  create: (formData) => api.post("/stories", formData),
  view: (id) => api.post(`/stories/${id}/view`),
  remove: (id) => api.delete(`/stories/${id}`),
};
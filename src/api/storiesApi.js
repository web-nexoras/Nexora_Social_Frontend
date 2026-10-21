import api from "./axios";

export const storiesApi = {
  list: () => api.get("/stories"),
  create: (formData) => api.post("/stories", formData),
  view: (id) => api.post(`/stories/${id}/view`),
  like: (id) => api.post(`/stories/${id}/like`),
  // FB-style: the comment is delivered as a chat message to the story author
  comment: (id, text) => api.post(`/stories/${id}/comment`, { text }),
  remove: (id) => api.delete(`/stories/${id}`),
};

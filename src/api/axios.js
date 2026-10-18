import axios from "axios";

// Central axios instance for API calls (cookies enabled + Bearer token fallback)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});

// Attach token from localStorage only if valid (never send literal "undefined" or "null")
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accTkn");
  if (token && token !== "undefined" && token !== "null" && token.trim() !== "") {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

export default api;

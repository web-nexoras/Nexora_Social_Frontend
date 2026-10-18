import axios from "axios";

// Central axios instance for API calls (cookies enabled + Bearer token fallback)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});

// Attach token from localStorage if available (ensures cross-site auth works reliably)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accTkn");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

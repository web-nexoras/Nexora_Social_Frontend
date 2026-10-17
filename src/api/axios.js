import axios from "axios";

// Central axios instance for API calls (cookies enabled)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});

export default api;

import axios from "axios";
import { getAuthToken } from "../utils/authToken";
import { API_BASE_URL } from "./config";

// Central axios instance for API calls (cookies enabled + Bearer token fallback)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Attach token from localStorage only if valid (never send literal "undefined" or "null")
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

export default api;

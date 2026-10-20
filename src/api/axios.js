import axios from "axios";
import { getAuthToken, setAuthToken, clearAuthToken } from "../utils/authToken";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  pendingQueue = [];
};

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;

    // Only attempt refresh for 401s, and never for the refresh endpoint itself.
    if (
      status === 401 &&
      original &&
      !original._retry &&
      !String(original.url || "").includes("/auth/refresh-token") &&
      !String(original.url || "").includes("/auth/signin")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const res = await api.post("/auth/refresh-token");
        const newToken = res.data?.accessToken;
        if (newToken) setAuthToken(newToken);
        processQueue(null, newToken);
        if (newToken) original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthToken();
        // Redirect to sign-in on refresh failure
        if (typeof window !== "undefined" && !window.location.pathname.includes("/signin")) {
          window.location.href = "/signin";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
import api from "./axios";

export const authApi = {
  signup: (fullname, email, password) =>
    api.post("/auth/signup", { fullname, email, password }),
  verifyOtp: (email, otp) => api.post("/auth/verify-otp", { email, otp }),
  resendOtp: (email) => api.post("/auth/resend-otp", { email }),
  signin: (email, password) => api.post("/auth/signin", { email, password }),
  signout: () => api.post("/auth/signout"),
  getProfile: () => api.get("/auth/me"),
  updateProfile: (formData) => api.put("/auth/me", formData),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, email, password) =>
    api.post(`/auth/reset-password/${token}`, { email, password }),
  refreshToken: () => api.post("/auth/refresh-token"),
};

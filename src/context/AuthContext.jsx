import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current user on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data?.user || res.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/signin", { email, password });
    // refresh user
    const me = await api.get("/auth/me");
    setUser(me.data?.user || me.data);
    return res.data;
  };

  const signup = async (fullname, email, password) => {
    const res = await api.post("/auth/signup", { fullname, email, password });
    return res.data;
  };

  const verifyOtp = async (email, otp) => {
    const res = await api.post("/auth/verify-otp", { email, otp });
    return res.data;
  };

  const logout = async () => {
    await api.post("/auth/signout");
    setUser(null);
  };

  const updateProfile = async (formData) => {
    const res = await api.put("/auth/me", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUser(res.data?.user || res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifyOtp, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

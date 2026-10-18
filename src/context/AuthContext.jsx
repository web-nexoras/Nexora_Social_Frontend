import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current user on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await authApi.getProfile();
        setUser(res.data?.user || res.data);
      } catch (error) {
        setUser(null);
        localStorage.removeItem("accTkn");
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await authApi.signin(email, password);
    if (res.data?.accessToken) {
      localStorage.setItem("accTkn", res.data.accessToken);
    }
    if (res.data?.user) {
      setUser(res.data.user);
    } else {
      const me = await authApi.getProfile();
      setUser(me.data?.user || me.data);
    }
    return res.data;
  };

  const signup = async (fullname, email, password) => {
    const res = await authApi.signup(fullname, email, password);
    return res.data;
  };

  const verifyOtp = async (email, otp) => {
    const res = await authApi.verifyOtp(email, otp);
    return res.data;
  };

  const logout = async () => {
    try {
      await authApi.signout();
    } finally {
      localStorage.removeItem("accTkn");
      setUser(null);
    }
  };

  const updateProfile = async (formData) => {
    const res = await authApi.updateProfile(formData);
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

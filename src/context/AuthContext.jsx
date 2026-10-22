import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { authApi } from "../api/authApi";
import { clearAuthToken, setAuthToken } from "../utils/authToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // A social login can finish while the initial session check is still in
  // flight. Never let that older response wipe the freshly signed-in user.
  const loginApplied = useRef(false);

  // Load current user on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Always check the session so httpOnly-cookie sessions survive refreshes.
        const res = await authApi.getProfile();
        if (!loginApplied.current) setUser(res.data?.user || res.data);
      } catch (error) {
        if (!loginApplied.current) {
          setUser(null);
          // A temporary network/server failure must not erase a still-valid token.
          if ([401, 403].includes(error?.response?.status)) clearAuthToken();
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await authApi.signin(email, password);
    const token = res.data?.accessToken;
    setAuthToken(token);
    loginApplied.current = true;
    if (res.data?.user) {
      setUser(res.data.user);
      return res.data;
    }
    const me = await authApi.getProfile();
    setUser(me.data?.user || me.data);
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

  const oauthLogin = async (idToken) => {
    const res = await authApi.oauthAuth0(idToken);
    const token = res.data?.accessToken;
    setAuthToken(token);
    loginApplied.current = true;
    if (res.data?.user) {
      setUser(res.data.user);
    } else {
      const me = await authApi.getProfile();
      setUser(me.data?.user || me.data);
    }
    return res.data;
  };

  const logout = async () => {
    try {
      await authApi.signout();
    } catch {
      // Sign out locally even when the API cannot be reached.
    } finally {
      clearAuthToken();
      setUser(null);
    }
  };

  const updateProfile = async (formData) => {
    const res = await authApi.updateProfile(formData);
    setUser(res.data?.user || res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifyOtp, oauthLogin, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

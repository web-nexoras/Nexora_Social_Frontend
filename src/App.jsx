import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import PublicLayout from "./components/PublicLayout";
import DashboardShell from "./components/DashboardShell";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFail from "./pages/PaymentFail";
import PaymentCancel from "./pages/PaymentCancel";
import AdminGroups from "./pages/AdminGroups";
import AdminUsers from "./pages/AdminUsers";
import PaymentHistory from "./pages/PaymentHistory";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SocketProvider>
            <ToastProvider>
              <Routes>
          {/* Auth pages — clean, full screen, no navbar */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Public pages (with navbar) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/fail" element={<PaymentFail />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
          </Route>

          {/* Protected routes with sidebar + topbar */}
          <Route element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:id" element={<UserProfile />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/payments" element={<PaymentHistory />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/groups" element={<AdminGroups />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
      </SocketProvider>
    </BrowserRouter>
  </AuthProvider>
</ThemeProvider>
  );
}

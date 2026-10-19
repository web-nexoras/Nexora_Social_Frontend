import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import PublicLayout from "./components/PublicLayout";
import DashboardShell from "./components/DashboardShell";
import ProtectedRoute from "./components/ProtectedRoute";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const Profile = lazy(() => import("./pages/Profile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Friends = lazy(() => import("./pages/Friends"));
const Chat = lazy(() => import("./pages/Chat"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Groups = lazy(() => import("./pages/Groups"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const AdminGroups = lazy(() => import("./pages/AdminGroups"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SocketProvider>
            <ToastProvider>
              <Suspense
                fallback={
                  <div
                    className="flex min-h-[40vh] items-center justify-center"
                    role="status"
                  >
                    Loading page...
                  </div>
                }
              >
                <Routes>
                  {/* Auth pages — clean, full screen, no navbar */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/verify-otp" element={<VerifyOtp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/reset-password/:token" element={<ResetPassword />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

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
              </Suspense>
      </ToastProvider>
      </SocketProvider>
    </BrowserRouter>
  </AuthProvider>
</ThemeProvider>
  );
}

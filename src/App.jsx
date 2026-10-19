import React, { Component, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import PublicLayout from "./components/PublicLayout";
import DashboardShell from "./components/DashboardShell";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingState from "./components/LoadingState";
import { hasShownInitialLoader, markInitialLoaderShown } from "./utils/initialLoader";

const lazyPage = (loadPage) => lazy(() => loadPage().then((page) => {
  markInitialLoaderShown();
  return page;
}));

const Home = lazyPage(() => import("./pages/Home"));
const Login = lazyPage(() => import("./pages/Login"));
const Signup = lazyPage(() => import("./pages/Signup"));
const VerifyOtp = lazyPage(() => import("./pages/VerifyOtp"));
const Profile = lazyPage(() => import("./pages/Profile"));
const UserProfile = lazyPage(() => import("./pages/UserProfile"));
const Friends = lazyPage(() => import("./pages/Friends"));
const Chat = lazyPage(() => import("./pages/Chat"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Groups = lazyPage(() => import("./pages/Groups"));
const PaymentSuccess = lazyPage(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazyPage(() => import("./pages/PaymentFail"));
const PaymentCancel = lazyPage(() => import("./pages/PaymentCancel"));
const AdminGroups = lazyPage(() => import("./pages/AdminGroups"));
const AdminUsers = lazyPage(() => import("./pages/AdminUsers"));
const PaymentHistory = lazyPage(() => import("./pages/PaymentHistory"));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const AuthCallback = lazyPage(() => import("./pages/AuthCallback"));

class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Page failed to render", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
            <h1 className="text-xl font-bold text-slate-900">This page could not load</h1>
            <p className="mt-2 text-sm text-slate-600">
              Check your connection and try loading the page again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SocketProvider>
            <ToastProvider>
              <RouteErrorBoundary>
                <Suspense
                  fallback={hasShownInitialLoader() ? (
                    <div className="flex min-h-[24vh] items-center justify-center" role="status" aria-label="Loading page">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                    </div>
                  ) : <LoadingState label="Opening page..." />}
                >
                  <Routes>
                    {/* Auth pages — clean, full screen, no navbar */}
                    <Route path="/signin" element={<Login />} />
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
                    <Route
                      element={
                        <ProtectedRoute>
                          <DashboardShell />
                        </ProtectedRoute>
                      }
                    >
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
              </RouteErrorBoundary>
            </ToastProvider>
          </SocketProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

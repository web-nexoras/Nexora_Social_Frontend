import React, { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AdminChatFab from "./AdminChatFab";
import { PageContentSkeleton } from "./PageLoader";

export default function DashboardShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return <ShellInner sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />;
}

/* h-screen + overflow-hidden = ONLY the <main> scrolls. Sidebar and
   Topbar keep their own fixed height so page scrolling can never
   drag them out of view (was: min-h-screen let the whole page scroll). */
function ShellInner({ sidebarOpen, setSidebarOpen }) {
  return (
    <div className="flex h-screen overflow-hidden neo-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 md:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto">
          {/* The Suspense boundary wraps ONLY the page content: while a lazy
              page chunk downloads the sidebar / topbar stay mounted and just
              the <main> area shows the skeleton. */}
          <Suspense fallback={<PageContentSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Floating button — message an admin for free from anywhere */}
      <AdminChatFab />
    </div>
  );
}

import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import PageLoader from "./PageLoader";

// While the page chunk is downloading only the full-screen skeleton is shown —
// the navbar (with its Sign In / Sign Up links) is mounted AFTER that Suspense
// boundary resolves, so it can never flash before the page content.
export default function PublicLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </Suspense>
  );
}

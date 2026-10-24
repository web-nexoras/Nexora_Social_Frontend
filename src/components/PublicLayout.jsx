import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { PageContentSkeleton } from "./PageLoader";

// The navbar stays mounted while a lazy page chunk downloads — only the page
// body under it shows the skeleton, so the top bar never disappears on a
// navigation.
export default function PublicLayout() {
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Suspense fallback={<PageContentSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}

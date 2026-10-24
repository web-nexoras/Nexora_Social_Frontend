import React from "react";
import Skeleton from "./Skeleton";

// Full-screen skeleton shown while a lazy page chunk downloads. It renders
// OUTSIDE any layout (navbar / sidebar / topbar), so during loading the user
// never sees the Sign In / Sign Up links or the dashboard chrome — only the
// shimmer placeholders.
// `neo-surface` paints the SAME theme background as the rest of the app
// (light in light mode, dark in dark mode), so the loader never flashes a
// colour that clashes with the user's chosen theme.
export default function PageLoader() {
  return (
    <div className="neo-surface min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-5/6" />
        <Skeleton className="h-12 w-2/3" />
      </div>
    </div>
  );
}

// Skeleton for the PAGE CONTENT only. Used inside the dashboard shell and the
// public navbar layout: the sidebar / topbar / navbar stay mounted and only
// the <Outlet /> area shimmers, so navigating between routes never makes the
// app chrome disappear and reappear.
export function PageContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" count={2} />
    </div>
  );
}

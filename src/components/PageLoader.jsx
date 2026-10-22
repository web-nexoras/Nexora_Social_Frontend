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

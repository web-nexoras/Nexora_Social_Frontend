import React from "react";

export default function InlineLoader({ label = "Loading...", compact = false }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 text-sm text-slate-500 ${compact ? "py-3" : "min-h-[28vh]"}`}
      role="status"
      aria-live="polite"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      <span>{label}</span>
    </div>
  );
}

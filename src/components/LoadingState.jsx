import React from "react";

export default function LoadingState({ label = "Loading...", compact = false }) {
  return (
    <div
      className={`relative isolate flex items-center justify-center overflow-hidden ${
        compact
          ? "min-h-28 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 py-6"
          : "fixed inset-0 z-[100] h-screen h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-10"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative w-full max-w-lg">
        {!compact && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.24em] text-slate-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-300 text-sm text-slate-950 shadow-lg shadow-indigo-950/50">
              N
            </span>
            NEXORA SOCIAL
          </div>
        )}

        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-6 text-center shadow-2xl backdrop-blur-sm">
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-white/10" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-indigo-400" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-400">Please wait a moment</p>
          <div className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" />
          </div>
        </div>

        {!compact && (
          <div className="mt-4 grid grid-cols-3 gap-3 opacity-70" aria-hidden="true">
            {["w-2/3", "w-1/2", "w-3/4"].map((width, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                <div className="mb-3 h-2 w-8 rounded-full bg-cyan-200/30" />
                <div className={`h-2 ${width} animate-pulse rounded-full bg-white/20`} />
              </div>
            ))}
          </div>
        )}
        </div>
    </div>
  );
}

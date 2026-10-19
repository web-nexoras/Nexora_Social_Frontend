import React from "react";
import { Link } from "react-router-dom";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-screen min-h-[100dvh] neo-surface flex items-center justify-center overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-5 sm:py-8">
      <section className="my-auto w-full min-w-0 max-w-md neo-raised rounded-3xl p-5 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          {/* <div className="w-16 h-16 rounded-2xl neo-raised-sm flex items-center justify-center text-3xl">
            🌐
          </div> */}
          <h1 className="text-2xl font-extrabold text-slate-700 mt-4">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {children}

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </section>
    </main>
  );
}

export function AuthBrand() {
  return (
    <Link to="/" className="text-brand font-extrabold tracking-tight">
      Nexora Social
    </Link>
  );
}

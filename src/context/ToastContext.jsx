import React, { createContext, useContext, useState, useCallback } from "react";
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    if (!message) return;
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 left-0 right-0 z-50 mx-auto flex w-full max-w-sm flex-col gap-2.5 pointer-events-none px-4 sm:left-auto sm:right-5 sm:mx-0 sm:px-0">
        {toasts.map((toast) => {
          let bg = "bg-slate-900/95 text-white border-slate-700/70";
          let icon = <FiInfo className="text-sky-400 text-lg shrink-0 mt-0.5" />;

          if (toast.type === "success") {
            bg = "bg-slate-900/95 text-emerald-100 border-emerald-600/50 shadow-emerald-950/30";
            icon = <FiCheckCircle className="text-emerald-400 text-lg shrink-0 mt-0.5" />;
          } else if (toast.type === "error") {
            bg = "bg-slate-900/95 text-rose-100 border-rose-600/50 shadow-rose-950/30";
            icon = <FiAlertCircle className="text-rose-400 text-lg shrink-0 mt-0.5" />;
          } else if (toast.type === "warning") {
            bg = "bg-slate-900/95 text-amber-100 border-amber-600/50 shadow-amber-950/30";
            icon = <FiAlertTriangle className="text-amber-400 text-lg shrink-0 mt-0.5" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 ${bg}`}
            >
              {icon}
              <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5 transition"
                aria-label="Close toast"
              >
                <FiX className="text-sm" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => console.log("[Toast]", msg) };
  }
  return context;
}

import React from "react";

// Brand icon snippets (inline SVG so they always render, no network needed)
const ICONS = {
  bkash: (
    <svg viewBox="0 0 48 48" className="w-9 h-9">
      <rect width="48" height="48" rx="12" fill="#e2136e" />
      <path
        d="M17 12v13.5c0 3 1.6 4.7 4.3 4.7 1.4 0 2.6-.4 3.7-1.2l2.7 3.2c-1.7 1.4-3.9 2.1-6.5 2.1-5.2 0-8.5-3.2-8.5-8.7V12h4z"
        fill="#fff"
      />
      <path d="M28.5 18.2l2.2-2.2 4.3 4.3-2.2 2.2z" fill="#fff" />
      <circle cx="31.5" cy="30" r="4.5" fill="none" stroke="#fff" strokeWidth="2.6" />
    </svg>
  ),
  nagad: (
    <svg viewBox="0 0 48 48" className="w-9 h-9">
      <rect width="48" height="48" rx="12" fill="#f6921e" />
      <path d="M14 34V14h4l8 12V14h4v20h-4l-8-12v12z" fill="#fff" />
      <path d="M32 14h4v20h-4z" fill="#fff" opacity="0.85" />
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 48 48" className="w-9 h-9">
      <rect width="48" height="48" rx="12" fill="#8c3494" />
      <path d="M24 10c6 4 9 9 9 15l-3 6h-12l-3-6c0-6 3-11 9-15z" fill="#fff" />
      <circle cx="24" cy="22" r="3.4" fill="#8c3494" />
      <path d="M18 34l-3 5 6-2zM30 34l3 5-6-2z" fill="#fff" />
    </svg>
  ),
  upay: (
    <svg viewBox="0 0 48 48" className="w-9 h-9">
      <rect width="48" height="48" rx="12" fill="#ed017f" />
      <path d="M13 16l5 12 5-12h4l-7 16h-4l-7-16z" fill="#fff" />
      <path d="M27 16h5l2.5 6L37 16h5l-7 16h-4z" fill="#fff" />
    </svg>
  ),
};

const METHODS = [
  { id: "bkash", name: "bKash" },
  { id: "nagad", name: "Nagad" },
  { id: "rocket", name: "Rocket" },
  { id: "upay", name: "Upay" },
];

// Custom mobile-banking payment screen shown instead of the SSLCommerz hosted page.
export default function PaymentMethodModal({ group, selected, onSelect, onConfirm, onCancel, paying, msg }) {
  const currency = group?.currency || "BDT";
  const symbol = currency === "BDT" ? "৳" : "";
  const chosen = METHODS.find((m) => m.id === selected);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl neo-modal max-w-md w-full p-6">
        <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-2xl mb-3">
          💳
        </div>
        <h3 className="text-xl font-bold text-brand mb-1">Choose payment method</h3>
        <p className="text-sm text-slate-500 mb-4">
          {group?.name} — <strong>{symbol}{group?.price} {currency}</strong>
        </p>

        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Mobile Banking</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                selected === m.id ? "border-brand ring-2 ring-brand bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              {ICONS[m.id]}
              <span className="font-semibold text-slate-800 text-sm">{m.name}</span>
            </button>
          ))}
        </div>

        {msg && <p className="text-sm text-slate-700 mb-3">{msg}</p>}

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={!selected || paying}
            className="flex-1 px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-slate-700 transition disabled:opacity-60"
          >
            {paying ? "Processing..." : chosen ? `Pay with ${chosen.name}` : "Select a method"}
          </button>
          <button
            onClick={onCancel}
            disabled={paying}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

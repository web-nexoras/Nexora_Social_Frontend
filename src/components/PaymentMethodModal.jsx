import React from "react";
import { FiCreditCard } from "react-icons/fi";
import bkashLogo from "../assets/bkash2.png";
import nagadLogo from "../assets/nagad.png";
import upayLogo from "../assets/upay.svg";

// Rocket has no public logo asset — drawn inline in its brand purple
const RocketMark = () => (
  <span className="flex items-center gap-2">
    <svg viewBox="0 0 48 48" className="h-8 w-8 shrink-0">
      <rect width="48" height="48" rx="12" fill="#8c3494" />
      <path
        d="M31 9.5c-8.6 1.4-15.3 8-17.8 16.6l-3.4 6.8 3.4 1.7 1.9-4.4c6.4-1.5 12.7-5.2 17.2-11.7l-4.2 3.4-4.4-4.4 7.3-8z"
        fill="#fff"
      />
      <circle cx="18.5" cy="31.5" r="1.7" fill="#fff" opacity="0.85" />
      <path d="M12 36l4-1.5-2.4-2.4z" fill="#fff" opacity="0.7" />
    </svg>
    <span className="font-bold text-slate-800 text-sm">Rocket</span>
  </span>
);

const METHODS = [
  { id: "bkash", name: "bKash", logo: bkashLogo },
  { id: "nagad", name: "Nagad", logo: nagadLogo },
  { id: "rocket", name: "Rocket", mark: <RocketMark /> },
  { id: "upay", name: "Upay", logo: upayLogo },
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
          <FiCreditCard />
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
              className={`flex items-center justify-center p-3 rounded-xl border transition ${
                selected === m.id ? "border-brand ring-2 ring-brand bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              {m.logo ? (
                <img src={m.logo} alt={m.name} className="h-8 w-auto max-w-[120px] object-contain" />
              ) : (
                m.mark
              )}
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

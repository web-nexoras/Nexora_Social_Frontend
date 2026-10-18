import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  name,
  required = true,
  autoComplete = "current-password",
  className = "",
  error = "",
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full neo-input rounded-xl px-4 py-3 pr-12 text-slate-700 text-sm transition ${
            error ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : ""
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand transition"
        >
          {show ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
        </button>
      </div>
      {error && <p className="text-rose-500 text-xs px-1 font-medium">{error}</p>}
    </div>
  );
}

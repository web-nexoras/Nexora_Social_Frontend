import React from "react";
import { Link } from "react-router-dom";

export default function PaymentSuccess() {
  return (
    <div className="max-w-xl mx-auto neo-raised rounded-3xl p-8 mt-10 text-center">
      <div className="w-16 h-16 rounded-full bg-brand text-white flex items-center justify-center text-3xl mb-4">
        ✓
      </div>
      <h1 className="text-2xl font-extrabold text-brand mb-2">Payment Successful</h1>
      <p className="text-slate-600 mb-6">
        Your subscription has been activated and you have been added to the group. You can now open its chat.
      </p>
      <Link to="/groups" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold neo-btn">
        Go to Groups
      </Link>
    </div>
  );
}

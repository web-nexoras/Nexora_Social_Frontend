import React from "react";
import { Link } from "react-router-dom";

export default function PaymentSuccess() {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-8 mt-10 text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">Payment Successful</h1>
      <p className="text-slate-600 mb-6">Your subscription has been activated. You can now access the group.</p>
      <Link to="/groups" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-indigo-700 transition">
        Go to Groups
      </Link>
    </div>
  );
}

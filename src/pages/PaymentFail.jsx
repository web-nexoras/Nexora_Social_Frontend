import React from "react";
import { Link } from "react-router-dom";

export default function PaymentFail() {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-8 mt-10 text-center">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Payment Failed</h1>
      <p className="text-slate-600 mb-6">Your payment could not be processed. Please try again.</p>
      <Link to="/groups" className="px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-indigo-700 transition">
        Back to Groups
      </Link>
    </div>
  );
}

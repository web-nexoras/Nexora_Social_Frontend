import React, { useEffect, useState } from "react";
import { paymentsApi } from "../api/groupsApi";

export default function PaymentHistory() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await paymentsApi.mySubscriptions();
        setSubs(res.data.subscriptions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold text-brand mb-6">My Subscriptions</h1>
      {subs.length === 0 && <p className="text-slate-500">No subscriptions yet.</p>}
      <div className="space-y-4">
        {subs.map((s) => (
          <div key={s._id} className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{s.group?.name}</h3>
                <p className="text-sm text-slate-500">{s.group?.description}</p>
                <p className="text-sm mt-1">Amount: {s.amount} {s.currency}</p>
                <p className="text-sm">Status: <span className="font-semibold">{s.status}</span></p>
                {s.expiresAt && <p className="text-sm">Expires: {new Date(s.expiresAt).toLocaleDateString()}</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.status === "active" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

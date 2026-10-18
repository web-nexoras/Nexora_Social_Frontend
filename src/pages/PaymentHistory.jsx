import React, { useEffect, useState } from "react";
import { paymentsApi } from "../api/groupsApi";
import { useAuth } from "../context/AuthContext";
import { FiCheck, FiX, FiUsers } from "react-icons/fi";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const statusStyles = {
  active: "bg-green-100 text-green-700",
  pending: "bg-slate-200 text-slate-600",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-600",
  expired: "bg-red-100 text-red-700",
};

function SubscriberCard({ s }) {
  const cls = statusStyles[s.status] || "bg-slate-200 text-slate-600";
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-start gap-4">
        <img
          src={s.user?.avatar || "https://via.placeholder.com/48"}
          alt={s.user?.fullname || "Subscriber"}
          className="w-12 h-12 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800 truncate">{s.user?.fullname || "Unknown user"}</h3>
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
              {s.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 truncate">{s.user?.email || "—"}</p>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Group</p>
              <p className="font-medium text-slate-700 truncate">{s.group?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Amount</p>
              <p className="font-medium text-slate-700">
                {s.amount} {s.currency}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Paid on</p>
              <p className="font-medium text-slate-700">{fmtDate(s.paidAt || s.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Expires (6 months)</p>
              <p className={`font-medium ${s.isExpired ? "text-red-500" : "text-green-600"}`}>
                {fmtDate(s.expiresAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [subs, setSubs] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);

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

  // Admin only: full subscriber list across every group
  useEffect(() => {
    if (!isAdmin) return;
    const loadAll = async () => {
      setAllLoading(true);
      try {
        const res = await paymentsApi.adminAll();
        setAllSubs(res.data.subscriptions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setAllLoading(false);
      }
    };
    loadAll();
  }, [isAdmin]);

  const activeCount = allSubs.filter((s) => s.status === "active" && !s.isExpired).length;

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="mt-6 space-y-10">
      <section>
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
                  <p className="text-sm">Status: <span className="font-semibold capitalize">{s.status}</span></p>
                  {s.expiresAt && <p className="text-sm">Expires: {fmtDate(s.expiresAt)}</p>}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    s.status === "active" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admin: everyone who has subscribed */}
      {isAdmin && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-brand">All Subscribers</h2>
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <FiUsers />
              {allSubs.length} total · <FiCheck className="text-green-600" /> {activeCount} active
            </span>
          </div>

          {allLoading && <p className="text-slate-400">Loading subscribers...</p>}
          {!allLoading && allSubs.length === 0 && (
            <p className="text-slate-500">No subscribers yet.</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {allSubs.map((s) => (
              <SubscriberCard key={s._id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import React, { useEffect, useState, useMemo } from "react";
import { paymentsApi } from "../api/groupsApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FiCheck, FiX, FiUsers, FiClock, FiCreditCard, FiTrash2 } from "react-icons/fi";
import InlineLoader from "../components/InlineLoader";
import Skeleton from "../components/Skeleton";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const daysLeft = (d) => {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

const statusStyles = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-600",
  expired: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  const cls = statusStyles[status] || "bg-slate-200 text-slate-600";
  return (
    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

// Admin card: who subscribed, how much, and when the 6-month access ends.
function SubscriberCard({ s, onAction, busy }) {
  const active = s.status === "active";
  const expired = !!s.isExpired;
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
      {/* Top row: avatar + name + badge */}
      <div className="flex items-center gap-3">
        <img
          src={s.user?.avatar || "https://via.placeholder.com/48"}
          alt={s.user?.fullname || "Subscriber"}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 truncate text-sm sm:text-base">{s.user?.fullname || "Unknown user"}</h3>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 truncate">{s.user?.email || "—"}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Group</p>
          <p className="font-medium text-slate-700 truncate text-xs sm:text-sm">{s.group?.name || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Amount</p>
          <p className="font-medium text-slate-700 text-xs sm:text-sm">{s.amount} {s.currency}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Paid on</p>
          <p className="font-medium text-slate-700 text-xs sm:text-sm">{fmtDate(s.paidAt || s.createdAt)}</p>
        </div>
        {active && (
          <div>
            <p className="text-xs text-slate-400">Expires</p>
            <p className={`font-medium text-xs sm:text-sm ${expired ? "text-red-500" : "text-green-600"}`}>
              {fmtDate(s.expiresAt)}
            </p>
          </div>
        )}
      </div>

      {/* Approve / Reject buttons */}
      {s.status === "pending" && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onAction(s._id, "approve")}
            disabled={busy}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-slate-700 transition disabled:opacity-60"
          >
            <FiCheck /> Approve
          </button>
          <button
            onClick={() => onAction(s._id, "reject")}
            disabled={busy}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-60"
          >
            <FiX /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

// Subscriber's own card: shows the expiry date up front so nobody has to ask.
function MySubscriptionCard({ s, onAction, busy }) {
  const active = s.status === "active";
  const rejectedByAdmin = s.status === "cancelled" && s.cancelledBy === "admin";
  const left = daysLeft(s.expiresAt);
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">{s.group?.name}</h3>
          <p className="text-xs sm:text-sm text-slate-500 truncate">{s.group?.description}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Admin rejected notice */}
      {rejectedByAdmin && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2.5">
          <p className="text-xs sm:text-sm font-semibold text-red-600">Cancelled by admin</p>
          <button
            onClick={() => onAction(s._id, "removeMine")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition disabled:opacity-60"
          >
            <FiTrash2 /> Remove
          </button>
        </div>
      )}

      {/* Info grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Amount</p>
          <p className="font-medium text-slate-700 text-xs sm:text-sm">{s.amount} {s.currency}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Paid on</p>
          <p className="font-medium text-slate-700 text-xs sm:text-sm">{fmtDate(s.paidAt || s.createdAt)}</p>
        </div>
        {active && (
          <div className="col-span-2">
            <p className="text-xs text-slate-400">Expires (6 months)</p>
            <p className="text-sm sm:text-base font-bold text-green-600">{fmtDate(s.expiresAt)}</p>
            {left !== null && (
              <p className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <FiClock /> {left > 0 ? `${left} days left` : "expired"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default function PaymentHistory() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";
  const [subs, setSubs] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadMy = async () => {
    try {
      const res = await paymentsApi.mySubscriptions();
      setSubs(res.data.subscriptions || []);
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Could not load your subscriptions", "error");
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMy().finally(() => setLoading(false));
  }, []);

  // Admin only: full subscriber list across every group
  const loadAll = async () => {
    try {
      const res = await paymentsApi.adminAll();
      setAllSubs(res.data.subscriptions || []);
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Could not load subscribers", "error");
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    setAllLoading(true);
    loadAll().finally(() => setAllLoading(false));
  }, [isAdmin]);

  const handleAction = async (id, action) => {
    if (action === "reject") {
      if (!window.confirm("Reject this payment request? It will leave the admin list and the subscriber will see \"cancelled by admin\".")) return;
    }
    if (action === "removeMine") {
      if (!window.confirm("Remove this subscription record from your list?")) return;
    }
    setBusyId(id);
    try {
      if (action === "approve") await paymentsApi.approve(id);
      else if (action === "reject") await paymentsApi.reject(id);
      else if (action === "removeMine") await paymentsApi.removeMy(id);
      await loadAll();
      await loadMy();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Could not update payment", "error");
    } finally {
      setBusyId(null);
    }
  };

  // One card per person: keep the record that matters most.
  // A pending payment request wins (so Approve/Reject always stays reachable),
  // then an active subscription, then anything else. Newest wins ties.
  const dedupedSubs = useMemo(() => {
    const rank = (s) => {
      if (s.status === "pending") return 3;
      if (s.status === "active" && !s.isExpired) return 2;
      if (s.status === "active") return 1;
      return 0;
    };
    const best = new Map();
    for (const s of allSubs) {
      const key = s.user?._id || String(s.user);
      const prev = best.get(key);
      if (
        !prev ||
        rank(s) > rank(prev) ||
        (rank(s) === rank(prev) && new Date(s.createdAt) > new Date(prev.createdAt))
      ) {
        best.set(key, s);
      }
    }
    return Array.from(best.values());
  }, [allSubs]);

  const activeCount = dedupedSubs.filter((s) => s.status === "active" && !s.isExpired).length;
  const pendingCount = dedupedSubs.filter((s) => s.status === "pending").length;

  if (loading) return <div className="mt-6 space-y-3"><Skeleton className="h-12 w-full" count={5} /></div>;

  return (
    <div className="mt-6 space-y-10">
      <section>
        <div className="grid gap-4 md:grid-cols-2">
          {subs.map((s) => (
            <MySubscriptionCard key={s._id} s={s} onAction={handleAction} busy={busyId === s._id} />
          ))}
        </div>
      </section>

      {/* Admin: everyone who has subscribed */}
      {isAdmin && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold text-brand">All Subscribers</h2>

            {/* Card-style summary pills */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl neo-raised-sm text-sm font-bold text-slate-700">
                <FiUsers className="text-slate-500" />
                {dedupedSubs.length}
                <span className="text-slate-400 font-medium">Total</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl neo-raised-sm text-sm font-bold text-green-700">
                <FiCheck className="text-green-600" />
                {activeCount}
                <span className="text-green-600/70 font-medium">Active</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl neo-raised-sm text-sm font-bold text-amber-700">
                <FiCreditCard className="text-amber-600" />
                {pendingCount}
                <span className="text-amber-600/70 font-medium">Pending</span>
              </span>
            </div>
          </div>

          {allLoading && <div className="space-y-2"><Skeleton className="h-10 w-full" count={4} /></div>}
          {!allLoading && dedupedSubs.length === 0 && (
            <p className="text-slate-500">No subscribers yet.</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {dedupedSubs.map((s) => (
              <SubscriberCard
                key={s._id}
                s={s}
                onAction={handleAction}
                busy={busyId === s._id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

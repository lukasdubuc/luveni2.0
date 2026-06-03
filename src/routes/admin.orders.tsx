import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/orders")({
  beforeLoad: requireAdmin,
  component: OrdersPage,
});

type Order = {
  id: string;
  email: string;
  name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  paid:      { label: "Paid",      cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",  Icon: CheckCircle2 },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",  Icon: CheckCircle2 },
  pending:   { label: "Pending",   cls: "bg-amber-50 text-amber-700 ring-amber-600/20",        Icon: Clock },
  failed:    { label: "Failed",    cls: "bg-rose-50 text-rose-700 ring-rose-600/20",           Icon: XCircle },
  refunded:  { label: "Refunded",  cls: "bg-slate-100 text-slate-700 ring-slate-500/20",       Icon: XCircle },
};

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((cents || 0) / 100);
}

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        o.email?.toLowerCase().includes(q) ||
        o.name?.toLowerCase().includes(q) ||
        o.provider_ref?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  const totals = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid" || o.status === "completed");
    return {
      count: orders.length,
      revenue: paid.reduce((sum, o) => sum + (o.amount_cents || 0), 0),
      pending: orders.filter((o) => o.status === "pending").length,
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
            <p className="mt-1 text-sm text-slate-500">All checkout transactions captured from Stripe.</p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total orders" value={totals.count.toString()} />
          <StatCard label="Revenue (paid)" value={fmtMoney(totals.revenue)} />
          <StatCard label="Pending" value={totals.pending.toString()} />
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, name, or reference…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "paid", "pending", "failed", "refunded"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 transition ${
                  statusFilter === s
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No orders match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((o) => {
                    const cfg = STATUS[o.status] || { label: o.status, cls: "bg-slate-100 text-slate-700 ring-slate-500/20", Icon: Clock };
                    const Icon = cfg.Icon;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          <div className="font-medium text-slate-900">{new Date(o.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{o.name || "—"}</div>
                          <div className="text-xs text-slate-500">{o.email}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {fmtMoney(o.amount_cents, o.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {o.provider_ref || o.id.slice(0, 8)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRevenueStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: RevenuePage,
});

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function RevenuePage() {
  const fetchStats = useServerFn(getRevenueStats);
  const { data, isLoading } = useQuery({ queryKey: ["revenue"], queryFn: () => fetchStats() });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const tiles = [
    { label: "Total revenue", value: fmt(data.totalCents, data.currency) },
    { label: "Last 7 days", value: fmt(data.recentCents, data.currency) },
    { label: "Paid orders", value: String(data.paidCount) },
    { label: "Leads captured", value: String(data.leadCount) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Revenue</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
            <p className="mt-2 text-2xl font-semibold">{t.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Recent orders</h2>
        {data.recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">When</th>
                <th>Email</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((o: any) => (
                <tr key={o.created_at + o.email} className="border-t border-border">
                  <td className="py-2">{new Date(o.created_at).toLocaleString()}</td>
                  <td>{o.email}</td>
                  <td>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{o.status}</span>
                  </td>
                  <td className="text-right">{fmt(o.amount_cents, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

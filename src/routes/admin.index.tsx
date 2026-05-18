import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getRevenueStats, purgeOrders } from "@/lib/admin.functions";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getStats = useServerFn(getRevenueStats);
  const runPurge = useServerFn(purgeOrders);

  const { data: stats, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats(),
  });

  const handlePurge = async () => {
    if (!confirm("Clear all unpaid test orders? This keeps your real revenue data clean.")) return;
    try {
      const res = await runPurge();
      if (res?.ok) {
        toast.success("Test history cleared");
        refetch(); // This updates the UI without a full page reload
      }
    } catch (error) {
      toast.error("Cleanup failed");
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: stats?.currency || "USD",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Revenue</p>
          <h3 className="text-2xl font-black mt-1 tracking-tighter">{formatPrice(stats?.totalCents || 0)}</h3>
        </div>
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Leads</p>
          <h3 className="text-2xl font-black mt-1 tracking-tighter">{stats?.leadCount || 0}</h3>
        </div>
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Paid Orders</p>
          <h3 className="text-2xl font-black mt-1 tracking-tighter">{stats?.paidCount || 0}</h3>
        </div>
      </div>

      {/* Orders Table Section */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <h2 className="text-xs font-black uppercase tracking-widest">Order History</h2>
          <button 
            onClick={handlePurge}
            className="text-[9px] font-bold uppercase tracking-tighter border px-2 py-1 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            Purge Test Noise
          </button>
        </div>
        
        <div className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              <tr>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats?.recent?.length ? (
                stats.recent.map((order: any) => (
                  <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{order.email}</td>
                    <td className="px-6 py-4">{formatPrice(order.amount_cents)}</td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right opacity-50">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground uppercase tracking-widest opacity-30">
                    No active orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
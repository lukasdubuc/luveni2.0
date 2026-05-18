import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getRevenueStats, purgeOrders } from "@/lib/admin.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getStats = useServerFn(getRevenueStats);
  const runPurge = useServerFn(purgeOrders);
  const queryClient = useQueryClient();

  const { data: stats, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats(),
  });

  const handlePurge = async () => {
    if (!confirm("Clear test noise? This permanently removes unpaid orders.")) return;
    
    const tid = toast.loading("Syncing with database...");
    try {
      const res = await runPurge();
      if (res?.ok) {
        // Invalidate and refetch to force the UI to update
        await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        await refetch();
        toast.success("Environment Reset", { id: tid });
      }
    } catch (error) {
      toast.error("Purge failed. Verify database connection.", { id: tid });
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: stats?.currency || "USD",
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Revenue</p>
          <h3 className="text-2xl font-black tracking-tighter">{formatPrice(stats?.totalCents || 0)}</h3>
        </div>
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Total Leads</p>
          <h3 className="text-2xl font-black tracking-tighter">{stats?.leadCount || 0}</h3>
        </div>
        <div className="p-6 rounded-xl border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Successes</p>
          <h3 className="text-2xl font-black tracking-tighter">{stats?.paidCount || 0}</h3>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Live Order Stream</h2>
          <button 
            onClick={handlePurge}
            className="text-[9px] font-bold uppercase tracking-tighter px-3 py-1 border rounded-full hover:bg-red-500 hover:text-white transition-all"
          >
            Purge Test Noise
          </button>
        </div>
        
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b text-[9px] uppercase tracking-widest opacity-70">
            <tr>
              <th className="px-6 py-3">Identifier</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats?.recent?.length ? (
              stats.recent.map((order: any) => (
                <tr key={order.id} className="hover:bg-muted/10">
                  <td className="px-6 py-4 font-medium">{order.email}</td>
                  <td className="px-6 py-4">{formatPrice(order.amount_cents)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      order.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right opacity-40">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center opacity-20 uppercase tracking-[0.5em] text-[10px]">
                  No Data Detected
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
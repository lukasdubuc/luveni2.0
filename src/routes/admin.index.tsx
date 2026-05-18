import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/start/client";
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
    if (!confirm("Wipe unpaid test noise? This is permanent.")) return;
    const tid = toast.loading("Purging test data...");
    try {
      const res = await runPurge();
      if (res?.ok) {
        // This forces the UI to re-pull fresh data from the DB
        await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        await refetch();
        toast.success("Database Cleaned", { id: tid });
      }
    } catch (e) {
      toast.error("Action failed. Check permissions.", { id: tid });
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: stats?.currency || "USD",
    }).format(cents / 100);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Revenue</div>
          <div className="text-3xl font-black tracking-tighter mt-1">{formatPrice(stats?.totalCents || 0)}</div>
        </div>
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Total Leads</div>
          <div className="text-3xl font-black tracking-tighter mt-1">{stats?.leadCount || 0}</div>
        </div>
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Paid Sales</div>
          <div className="text-3xl font-black tracking-tighter mt-1">{stats?.paidCount || 0}</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <div className="text-[10px] font-black uppercase tracking-widest">Order Feed</div>
          <button 
            onClick={handlePurge} 
            className="text-[9px] font-black uppercase border px-3 py-1.5 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-95"
          >
            Purge Test Noise
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/10 text-[9px] uppercase tracking-widest opacity-50">
                <th className="p-4 font-bold">Identifier</th>
                <th className="p-4 font-bold">Value</th>
                <th className="p-4 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats?.recent?.length ? (
                stats.recent.map((o: any) => (
                  <tr key={o.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 truncate max-w-[200px]">{o.email}</td>
                    <td className="p-4 font-medium">{formatPrice(o.amount_cents)}</td>
                    <td className="p-4 text-right">
                      <span className="bg-muted px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter border">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-muted-foreground uppercase text-[10px] tracking-[0.3em] opacity-30">
                    No active stream data
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
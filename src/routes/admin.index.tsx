import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/start/client";
import { getRevenueStats, purgeOrders, updateOrderStatus } from "@/lib/admin.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const getStats = useServerFn(getRevenueStats);
  const runPurge = useServerFn(purgeOrders);
  const updateStatus = useServerFn(updateOrderStatus);
  const queryClient = useQueryClient();

  const { data: stats, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats(),
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    const tid = toast.loading(`Updating to ${newStatus}...`);
    try {
      await updateStatus({ id, status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      await refetch();
      toast.success("Order Updated", { id: tid });
    } catch (e) {
      toast.error("Update failed", { id: tid });
    }
  };

  const handlePurge = async () => {
    if (!confirm("Clear unpaid test history?")) return;
    const tid = toast.loading("Cleaning database...");
    try {
      const res = await runPurge();
      if (res?.ok) {
        await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        await refetch();
        toast.success("Test Noise Removed", { id: tid });
      }
    } catch (e) {
      toast.error("Cleanup failed", { id: tid });
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Revenue</p>
          <h3 className="text-3xl font-black tracking-tighter mt-1">{formatPrice(stats?.totalCents || 0)}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Total Leads</p>
          <h3 className="text-3xl font-black tracking-tighter mt-1">{stats?.leadCount || 0}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Paid Sales</p>
          <h3 className="text-3xl font-black tracking-tighter mt-1">{stats?.paidCount || 0}</h3>
        </div>
      </div>

      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <h2 className="text-[10px] font-black uppercase tracking-widest">Order Stream</h2>
          <button 
            onClick={handlePurge} 
            className="text-[9px] font-black uppercase border px-3 py-1.5 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-95"
          >
            Purge Noise
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/10 text-[9px] uppercase tracking-widest opacity-50">
                <th className="p-4 font-bold">User</th>
                <th className="p-4 font-bold">Amount</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 text-right font-bold">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats?.recent?.length ? (
                stats.recent.map((o: any) => (
                  <tr key={o.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 truncate max-w-[200px]">{o.email}</td>
                    <td className="p-4 font-medium">{formatPrice(o.amount_cents)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase border ${
                        o.status === 'paid' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-muted text-foreground'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {o.status !== 'paid' && (
                        <button 
                          onClick={() => handleStatusChange(o.id, 'paid')}
                          className="text-[9px] font-bold uppercase bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-80"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button 
                        onClick={() => handleStatusChange(o.id, 'cancelled')}
                        className="text-[9px] font-bold uppercase border px-2 py-1 rounded hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-muted-foreground uppercase text-[10px] tracking-[0.3em] opacity-20">
                    No records found
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

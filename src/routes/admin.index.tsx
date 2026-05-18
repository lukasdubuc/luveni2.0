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
    if (!confirm("Wipe test orders?")) return;
    const tid = toast.loading("Processing...");
    try {
      const res = await runPurge();
      if (res?.ok) {
        await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        await refetch();
        toast.success("Cleanup successful", { id: tid });
      }
    } catch (e) {
      toast.error("Action failed", { id: tid });
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
        <div className="p-6 border rounded-2xl bg-card">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Revenue</div>
          <div className="text-3xl font-black tracking-tighter">{formatPrice(stats?.totalCents || 0)}</div>
        </div>
        <div className="p-6 border rounded-2xl bg-card">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Leads</div>
          <div className="text-3xl font-black tracking-tighter">{stats?.leadCount || 0}</div>
        </div>
        <div className="p-6 border rounded-2xl bg-card">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Paid</div>
          <div className="text-3xl font-black tracking-tighter">{stats?.paidCount || 0}</div>
        </div>
      </div>

      <div className="border rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <div className="text-[10px] font-black uppercase tracking-widest">Order Feed</div>
          <button onClick={handlePurge} className="text-[9px] font-black uppercase border px-3 py-1 rounded-full hover:bg-red-500 hover:text-white transition-all">
            Clear Noise
          </button>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/10 text-[9px] uppercase tracking-widest opacity-50">
              <th className="p-4">Customer</th>
              <th className="p-4">Amount</th>
              <th className="p-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats?.recent?.map((o: any) => (
              <tr key={o.id} className="hover:bg-muted/5 transition-colors">
                <td className="p-4">{o.email}</td>
                <td className="p-4 font-medium">{formatPrice(o.amount_cents)}</td>
                <td className="p-4 text-right">
                  <span className="bg-muted px-2 py-0.5 rounded text-[9px] font-bold uppercase">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
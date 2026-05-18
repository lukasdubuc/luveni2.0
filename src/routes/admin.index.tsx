import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, leads: 0, sales: 0 });
  const [loading, setLoading] = useState(true);

  const syncHub = async () => {
    setLoading(true);
    const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leadCount } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orderData || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setOrders(orderData || []);
    setStats({ revenue, leads: leadCount || 0, sales: paid.length });
    setLoading(false);
  };

  const patchOrder = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast.success(`ORDER_${id.slice(0, 4).toUpperCase()}: ${status.toUpperCase()}`);
    syncHub();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("PERMANENT_ERASURE_CONFIRM?")) return;
    await supabase.from("orders").delete().eq("id", id);
    toast.error("RECORD_PURGED");
    syncHub();
  };

  const purgeCancelled = async () => {
    if (!confirm("PURGE_ALL_NON_PAID_RECORDS?")) return;
    await supabase.from("orders").delete().in("status", ["cancelled", "failed"]);
    toast.info("CLEANUP_COMPLETE");
    syncHub();
  };

  useEffect(() => { syncHub(); }, []);

  if (loading) return (
    <div className="p-20 text-center text-[10px] font-mono font-bold uppercase tracking-[0.8em] animate-pulse">
      Syncing_Terminal_v2...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-8 font-sans text-black">
      <div className="max-w-7xl mx-auto flex justify-between items-end border-b border-black/10 pb-8 mb-12 text-black">
        <div>
          <h1 className="text-4xl font-light tracking-tighter uppercase italic leading-none">Control_Hub</h1>
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.4em] opacity-30 mt-3">Operational Unit // Tulsa_Branch</p>
        </div>
        <div className="flex gap-3">
          <button onClick={purgeCancelled} className="text-[10px] border border-red-200 text-red-400 px-4 py-2 uppercase hover:bg-red-50 transition-all">Purge_Failed</button>
          <button onClick={syncHub} className="text-[10px] border border-black px-6 py-2 uppercase hover:bg-black hover:text-white transition-all">Refresh_Feed</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatBox label="Net Revenue" value={`$${(stats.revenue / 100).toLocaleString()}`} />
          <StatBox label="Active Leads" value={stats.leads} />
          <StatBox label="Closed Sales" value={stats.sales} />
        </div>

        <div className="border border-black/10 rounded-sm overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F8F8F8] text-black/40 text-[9px] uppercase tracking-[0.3em] border-b border-black/10">
                <th className="p-6">Identity</th>
                <th className="p-6">Valuation</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="p-6">
                    <div className="font-bold uppercase text-sm truncate max-w-[200px]">{o.email}</div>
                    <div className="text-[9px] font-mono opacity-30 uppercase tracking-widest mt-1 italic">{o.id.slice(0, 8)}</div>
                  </td>
                  <td className="p-6 font-mono font-bold italic text-lg opacity-80">${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="p-6 text-center">
                    <span className={`px-3 py-1 text-[9px] font-bold uppercase border ${o.status === 'paid' ? 'bg-black text-white border-black' : 'bg-white border-black/10 text-black/40'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-6 text-right space-x-6 font-bold uppercase italic text-[10px]">
                    <button onClick={() => patchOrder(o.id, 'paid')} className="opacity-30 hover:opacity-100">Paid</button>
                    <button onClick={() => patchOrder(o.id, 'cancelled')} className="opacity-30 hover:opacity-100">Cancel</button>
                    <button onClick={() => deleteRecord(o.id)} className="text-red-300 hover:text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-8 border border-black/10 bg-white shadow-sm rounded-sm">
      <p className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-30 mb-3">{label}</p>
      <p className="text-5xl font-light italic tracking-tighter uppercase leading-none">{value}</p>
    </div>
  );
}

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
    // Direct fetch - no server functions to trigger build errors
    const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leadCount } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orderData || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setOrders(orderData || []);
    setStats({ revenue, leads: leadCount || 0, sales: paid.length });
    setLoading(false);
  };

  const patchOrder = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("UPDATE_FAILED");
    } else {
      toast.success(`ORDER_UPDATED: ${status.toUpperCase()}`);
      syncHub();
    }
  };

  useEffect(() => { syncHub(); }, []);

  if (loading) return (
    <div className="p-20 text-center text-[10px] font-black uppercase tracking-[0.8em] animate-pulse">
      Syncing_Data_Stream...
    </div>
  );

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-end border-b-4 border-black pb-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Tulsa_HQ</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30 mt-2">Operational Command Portal</p>
        </div>
        <button onClick={syncHub} className="text-[10px] font-black border-2 border-black px-6 py-2 rounded-full uppercase hover:bg-black hover:text-white transition-all">
          Refresh_Stream
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricCard label="Net Revenue" value={`$${(stats.revenue / 100).toLocaleString()}`} />
        <MetricCard label="Inbound Leads" value={stats.leads} />
        <MetricCard label="Paid Sales" value={stats.sales} />
      </div>

      {/* Table */}
      <div className="border-4 border-black rounded-[2.5rem] overflow-hidden bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black text-white text-[10px] uppercase tracking-[0.2em]">
              <th className="p-6">Identity</th>
              <th className="p-6">Value</th>
              <th className="p-6 text-center">Status</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-4 divide-black/5">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 font-black uppercase tracking-tight text-sm truncate max-w-[200px]">{o.email}</td>
                <td className="p-6 font-black italic text-lg">${(o.amount_cents / 100).toFixed(2)}</td>
                <td className="p-6 text-center">
                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border-2 ${
                    o.status === 'paid' ? 'bg-black text-white border-black' : 'bg-white border-black/20 text-black/40'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-6 text-right space-x-6 font-black uppercase italic text-[11px]">
                  <button onClick={() => patchOrder(o.id, 'paid')} className="hover:underline decoration-2 text-black underline-offset-4">Mark_Paid</button>
                  <button onClick={() => patchOrder(o.id, 'cancelled')} className="hover:underline decoration-2 text-red-600 underline-offset-4">Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-10 border-4 border-black rounded-[2.5rem] bg-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">{label}</p>
      <p className="text-5xl font-black mt-2 tracking-tighter italic uppercase leading-none">{value}</p>
    </div>
  );
}

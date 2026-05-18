import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [data, setData] = useState<{ orders: any[], stats: any }>({ 
    orders: [], 
    stats: { revenue: 0, leads: 0, sales: 0 } 
  });
  const [loading, setLoading] = useState(true);

  const syncHub = async () => {
    setLoading(true);
    // Direct browser-to-Supabase fetch - No server function "leaks"
    const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leads } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orders || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setData({
      orders: orders || [],
      stats: { revenue, leads: leads || 0, sales: paid.length }
    });
    setLoading(false);
  };

  useEffect(() => { syncHub(); }, []);

  const patchOrder = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("UPDATE_FAILED");
    } else {
      toast.success(`ORDER_UPDATED: ${status.toUpperCase()}`);
      syncHub();
    }
  };

  if (loading) return (
    <div className="p-20 text-center text-[10px] font-black uppercase tracking-[0.8em] animate-pulse">
      Syncing_Tulsa_Hub...
    </div>
  );

  return (
    <div className="p-8 space-y-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-black pb-4">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic">Control_Center</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Management Terminal // Direct Access</p>
        </div>
        <button onClick={syncHub} className="text-[10px] font-black border-2 border-black px-6 py-2 rounded-full uppercase hover:bg-black hover:text-white transition-all active:scale-95">
          Refresh_Stream
        </button>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricBox label="Net Revenue" value={`$${(data.stats.revenue / 100).toLocaleString()}`} />
        <MetricBox label="Leads Generated" value={data.stats.leads} />
        <MetricBox label="Closed Sales" value={data.stats.sales} />
      </div>

      {/* Order Table */}
      <div className="border-4 border-black rounded-[2rem] overflow-hidden bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-black text-white text-[10px] uppercase tracking-[0.2em]">
                <th className="p-6 font-black">Identity</th>
                <th className="p-6 font-black">Valuation</th>
                <th className="p-6 font-black text-center">Status</th>
                <th className="p-6 font-black text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {data.orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6 font-bold uppercase tracking-tight truncate max-w-[200px]">{o.email}</td>
                  <td className="p-6 font-black italic">${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="p-6 text-center">
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border-2 ${
                      o.status === 'paid' ? 'bg-black text-white border-black' : 'bg-transparent border-black/20 text-black/40'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-6 text-right space-x-6 font-black uppercase italic text-[11px]">
                    <button onClick={() => patchOrder(o.id, 'paid')} className="hover:underline text-black decoration-2 underline-offset-4">Mark_Paid</button>
                    <button onClick={() => patchOrder(o.id, 'cancelled')} className="hover:underline text-red-600 decoration-2 underline-offset-4">Cancel</button>
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

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-8 border-4 border-black rounded-[2rem] bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">{label}</p>
      <p className="text-5xl font-black mt-2 tracking-tighter italic uppercase">{value}</p>
    </div>
  );
}

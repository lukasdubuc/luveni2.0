import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, leads: 0 });
  const [loading, setLoading] = useState(true);

  const syncHub = async () => {
    setLoading(true);
    // Fetch Data
    const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leadCount } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orderData || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setOrders(orderData || []);
    setStats({ revenue, leads: leadCount || 0 });
    setLoading(false);
  };

  useEffect(() => { syncHub(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("ACTION_FAILED");
    else {
      toast.success(`ORDER_${status.toUpperCase()}`);
      syncHub();
    }
  };

  if (loading) return <div className="p-20 text-center text-[10px] font-black tracking-[0.8em] animate-pulse">SYNCING_HUB...</div>;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-10 border-4 border-black rounded-[2.5rem] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Total_Revenue</p>
          <p className="text-6xl font-black mt-2 tracking-tighter italic">${(stats.revenue / 100).toLocaleString()}</p>
        </div>
        <div className="p-10 border-4 border-black rounded-[2.5rem] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Active_Leads</p>
          <p className="text-6xl font-black mt-2 tracking-tighter italic">{stats.leads}</p>
        </div>
      </div>

      {/* Control Stream */}
      <div className="border-4 border-black rounded-[2.5rem] overflow-hidden bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <div className="p-6 border-b-4 border-black flex justify-between items-center bg-slate-50">
          <h2 className="text-sm font-black uppercase tracking-[0.2em]">Live_Order_Feed</h2>
          <button onClick={syncHub} className="text-[10px] font-black border-2 border-black px-4 py-1 rounded-full uppercase hover:bg-black hover:text-white transition-all">Refresh</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black text-white text-[9px] uppercase tracking-widest">
              <th className="p-6">Identity</th>
              <th className="p-6">Value</th>
              <th className="p-4 text-right">Operations</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 font-bold uppercase tracking-tighter">
                  <div>{o.email}</div>
                  <div className={`text-[9px] mt-1 inline-block px-2 py-0.5 rounded border-2 border-black ${o.status === 'paid' ? 'bg-black text-white' : 'bg-transparent'}`}>
                    {o.status}
                  </div>
                </td>
                <td className="p-6 font-black italic">${(o.amount_cents / 100).toFixed(2)}</td>
                <td className="p-6 text-right space-x-6 font-black uppercase italic text-[11px]">
                  <button onClick={() => updateStatus(o.id, 'paid')} className="hover:underline decoration-2">Mark_Paid</button>
                  <button onClick={() => updateStatus(o.id, 'cancelled')} className="text-red-500 hover:underline decoration-2">Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

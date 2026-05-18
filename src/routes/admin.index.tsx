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

  const syncData = async () => {
    setLoading(true);
    // Direct client fetch - this is the "safe" way to bypass the split error
    const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leadCount } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orderData || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setOrders(orderData || []);
    setStats({ revenue, leads: leadCount || 0 });
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error("Update failed");
    } else {
      toast.success(`Order set to ${status.toUpperCase()}`);
      syncData();
    }
  };

  useEffect(() => { syncData(); }, []);

  if (loading) return (
    <div className="p-20 text-center text-[10px] font-black uppercase tracking-[0.8em] animate-pulse">
      Syncing_Data...
    </div>
  );

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-end border-b-4 border-black pb-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">Tulsa_Hub</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30 mt-2">Operational Command Portal</p>
        </div>
        <button onClick={syncData} className="text-[10px] font-black border-2 border-black px-6 py-2 rounded-full uppercase hover:bg-black hover:text-white transition-all">
          Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-black">
        <div className="p-10 border-4 border-black rounded-[2.5rem] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Net_Revenue</p>
          <p className="text-6xl font-black mt-2 tracking-tighter italic uppercase leading-none">${(stats.revenue / 100).toLocaleString()}</p>
        </div>
        <div className="p-10 border-4 border-black rounded-[2.5rem] bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Active_Leads</p>
          <p className="text-6xl font-black mt-2 tracking-tighter italic uppercase leading-none">{stats.leads}</p>
        </div>
      </div>

      {/* Control Stream */}
      <div className="border-4 border-black rounded-[2.5rem] overflow-hidden bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-black text-white text-[10px] uppercase tracking-[0.2em]">
              <th className="p-6 font-black">Identity</th>
              <th className="p-6 font-black">Value</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-4 divide-black/10">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors font-bold uppercase">
                <td className="p-6 tracking-tight truncate max-w-[200px]">
                  <div>{o.email}</div>
                  <div className={`text-[9px] mt-1 inline-block px-2 py-0.5 rounded border-2 border-black ${o.status === 'paid' ? 'bg-black text-white' : ''}`}>
                    {o.status}
                  </div>
                </td>
                <td className="p-6 font-black italic text-lg">${(o.amount_cents / 100).toFixed(2)}</td>
                <td className="p-6 text-right space-x-6 font-black italic text-[11px]">
                  <button onClick={() => updateStatus(o.id, 'paid')} className="hover:underline decoration-2 text-black underline-offset-4">Paid</button>
                  <button onClick={() => updateStatus(o.id, 'cancelled')} className="hover:underline decoration-2 text-red-600 underline-offset-4">Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

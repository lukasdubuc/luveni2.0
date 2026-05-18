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

  const loadData = async () => {
    setLoading(true);
    const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { count: leadCount } = await supabase.from("leads").select("*", { count: 'exact', head: true });

    const paid = (orderData || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
    const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

    setOrders(orderData || []);
    setStats({ revenue, leads: leadCount || 0 });
    setLoading(false);
  };

  const updateOrder = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    if (error) toast.error("Update failed");
    else {
      toast.success(`Order set to ${newStatus}`);
      loadData();
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="p-20 text-center font-black uppercase tracking-widest opacity-20">Loading_System...</div>;

  return (
    <div className="p-8 space-y-10">
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <h1 className="text-5xl font-black tracking-tighter uppercase italic">Tulsa_Hub</h1>
        <button onClick={loadData} className="text-[10px] font-black border-2 border-black px-4 py-1 rounded-full hover:bg-black hover:text-white transition-all">Sync</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Net Revenue</p>
          <p className="text-5xl font-black mt-2">${(stats.revenue / 100).toLocaleString()}</p>
        </div>
        <div className="p-8 border-4 border-black rounded-[2rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Active Leads</p>
          <p className="text-5xl font-black mt-2">{stats.leads}</p>
        </div>
      </div>

      <div className="border-4 border-black rounded-[2.5rem] overflow-hidden bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
        <table className="w-full text-left">
          <thead className="bg-black text-white text-[10px] uppercase">
            <tr>
              <th className="p-5">Customer</th>
              <th className="p-5 text-center">Status</th>
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {orders.map(o => (
              <tr key={o.id} className="text-xs font-bold uppercase">
                <td className="p-5">
                  <div className="font-black">{o.email}</div>
                  <div className="text-[9px] opacity-40 font-normal italic">${(o.amount_cents/100).toFixed(2)}</div>
                </td>
                <td className="p-5 text-center">
                  <span className={`px-3 py-1 rounded-full border-2 border-black ${o.status === 'paid' ? 'bg-black text-white' : ''}`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-5 text-right space-x-4">
                  <button onClick={() => updateOrder(o.id, 'paid')} className="underline decoration-2">Paid</button>
                  <button onClick={() => updateOrder(o.id, 'cancelled')} className="text-red-500 underline decoration-2">Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

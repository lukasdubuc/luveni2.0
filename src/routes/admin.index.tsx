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
    stats: { revenue: 0, leadCount: 0, paidCount: 0 } 
  });
  const [loading, setLoading] = useState(true);

  const loadEverything = async () => {
    setLoading(true);
    
    // 1. Fetch Orders
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    // 2. Fetch Leads
    const { count: leadCount } = await supabase
      .from("leads")
      .select("*", { count: 'exact', head: true });

    if (orderError) {
      toast.error("Database connection error");
    } else {
      const paid = (orders || []).filter(o => o.status === 'paid' || o.status === 'fulfilled');
      const revenue = paid.reduce((acc, o) => acc + (o.amount_cents || 0), 0);

      setData({
        orders: orders || [],
        stats: { revenue, leadCount: leadCount || 0, paidCount: paid.length }
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEverything();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success(`Order set to ${status}`);
      loadEverything(); // Refresh data immediately
    }
  };

  if (loading) return (
    <div className="p-20 text-center text-[10px] uppercase tracking-[0.5em] animate-pulse">
      Syncing Tulsa Hub...
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-2xl bg-card">
          <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Revenue</p>
          <h3 className="text-3xl font-black tracking-tighter">${(data.stats.revenue / 100).toLocaleString()}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-card">
          <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Total Leads</p>
          <h3 className="text-3xl font-black tracking-tighter">{data.stats.leadCount}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-card">
          <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Paid Orders</p>
          <h3 className="text-3xl font-black tracking-tighter">{data.stats.paidCount}</h3>
        </div>
      </div>

      {/* Control Center Table */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
          <h2 className="text-[10px] font-black uppercase tracking-widest">Order Customization</h2>
          <button onClick={loadEverything} className="text-[9px] font-bold border px-3 py-1 rounded-full uppercase hover:bg-black hover:text-white transition-all">
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/10 text-[9px] uppercase tracking-widest opacity-50 border-b">
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Manual Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.orders.map(o => (
                <tr key={o.id} className="hover:bg-muted/5 transition-colors">
                  <td className="p-4 font-medium">{o.email}</td>
                  <td className="p-4 font-mono">${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-tighter">
                      {o.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-3">
                    <button 
                      onClick={() => updateStatus(o.id, 'paid')} 
                      className="text-[10px] font-bold uppercase underline hover:text-green-600 transition-colors"
                    >
                      Mark Paid
                    </button>
                    <button 
                      onClick={() => updateStatus(o.id, 'cancelled')} 
                      className="text-[10px] font-bold uppercase underline text-red-500 hover:text-red-700 transition-colors"
                    >
                      Cancel
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

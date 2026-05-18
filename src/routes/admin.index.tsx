import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, RefreshCcw, ExternalLink } from "lucide-react";

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

  // PERMANENT SERVER DELETION
  const hardDelete = async (id: string) => {
    if (!confirm("CONFIRM_PERMANENT_ERASURE?")) return;
    
    const { error } = await supabase.from("orders").delete().eq("id", id);
    
    if (error) {
      toast.error("DELETE_FAILED_DATABASE_PROTECTED");
    } else {
      toast.success("RECORD_PURGED_FROM_SERVER");
      syncHub(); // Refresh the feed
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast.success(`STATUS_UPDATED: ${status.toUpperCase()}`);
    syncHub();
  };

  useEffect(() => { syncHub(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center font-mono text-[10px] tracking-[1em] uppercase opacity-20">
      Syncing_Systems...
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* HEADER SECTION */}
      <nav className="p-10 flex justify-between items-start border-b border-black/[0.03]">
        <div>
          <h1 className="text-6xl font-light tracking-tighter italic uppercase leading-none">Control.</h1>
          <p className="text-[10px] font-mono tracking-[0.5em] uppercase opacity-30 mt-4 italic">Tulsa_Logistics // v2.0</p>
        </div>
        <button onClick={syncHub} className="group flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-bold uppercase tracking-widest">Refresh_Feed</span>
          <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
        </button>
      </nav>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-black/[0.03]">
        <StatTile label="Net Revenue" value={`$${(stats.revenue / 100).toLocaleString()}`} />
        <StatTile label="Capture Rate" value={stats.leads} unit="Leads" />
        <StatTile label="Conversion" value={stats.sales} unit="Sales" />
      </div>

      {/* ORDERS LIST */}
      <div className="p-10 space-y-24">
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.8em] opacity-20 mb-12 italic">Incoming_Stream</h2>
          
          <div className="space-y-1">
            {orders.map((o) => (
              <div key={o.id} className="group flex flex-col md:flex-row md:items-center justify-between py-8 border-b border-black/[0.03] hover:bg-gray-50/50 px-4 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-medium tracking-tight truncate max-w-[300px]">{o.email}</span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 border ${o.status === 'paid' ? 'bg-black text-white border-black' : 'border-black/10 opacity-40'}`}>
                      {o.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono opacity-20 uppercase tracking-widest mt-2">ID_{o.id.slice(0, 8)} // {new Date(o.created_at).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-12 mt-4 md:mt-0">
                  <div className="text-2xl font-light italic tracking-tighter tabular-nums">
                    ${(o.amount_cents / 100).toFixed(2)}
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {o.status !== 'paid' && (
                      <button onClick={() => updateStatus(o.id, 'paid')} className="text-[10px] font-bold uppercase opacity-30 hover:opacity-100 hover:line-through transition-all">Mark_Paid</button>
                    )}
                    <button 
                      onClick={() => hardDelete(o.id)} 
                      className="text-red-300 hover:text-red-600 transition-colors"
                      title="Delete from Server"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit = "" }: { label: string, value: string | number, unit?: string }) {
  return (
    <div className="p-12 border-r border-black/[0.03] last:border-r-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-20 mb-6">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-light tracking-tighter italic">{value}</span>
        {unit && <span className="text-[10px] font-bold uppercase opacity-20 tracking-widest">{unit}</span>}
      </div>
    </div>
  );
}

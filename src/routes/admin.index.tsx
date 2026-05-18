import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, X, ChevronRight, Activity, ShieldCheck, Database } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStream = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) toast.error("CONNECTION_ERROR");
    else setOrders(data || []);
    setLoading(false);
  };

  const purgeRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents opening the panel when clicking delete
    if (!confirm("ACTION_REQUIRED: PERMANENT_DATABASE_REMOVAL?")) return;

    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (error) {
      console.error(error);
      toast.error(`PURGE_DENIED: ${error.message}`);
    } else {
      toast.success("DATA_REMOVED_FROM_VAULT");
      setSelectedOrder(null);
      fetchStream();
    }
  };

  useEffect(() => { fetchStream(); }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] font-sans antialiased overflow-hidden flex flex-col">
      {/* ADVANCED TOP NAV */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl p-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold tracking-[0.2em] uppercase italic">System_Admin</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] font-mono text-white/30 uppercase tracking-[0.3em]">Node_Live // Tulsa_Central</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 border border-white/5 bg-white/5 flex items-center gap-3">
             <Database size={12} className="text-white/20" />
             <span className="text-[10px] font-mono font-bold tracking-widest">{orders.length} RECORDS</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-4 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
             <Activity className="animate-spin text-white/20" size={32} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-2">
            {orders.map((order) => (
              <div 
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="group flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer rounded-sm"
              >
                <div className="flex items-center gap-6">
                  <div className={`h-2 w-2 rounded-full ${order.status === 'paid' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                  <div>
                    <p className="text-sm font-bold tracking-tight uppercase">{order.email}</p>
                    <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest mt-1">
                      {new Date(order.created_at).toLocaleDateString()} // ID: {order.id.split('-')[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <span className="text-lg font-light italic tabular-nums tracking-tighter">
                    ${(order.amount_cents / 100).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => purgeRecord(order.id, e)}
                      className="p-2 hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* THE "DRAWER" - ADVANCED DETAIL VIEW */}
      {selectedOrder && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-[#0A0A0A] border-l border-white/10 shadow-2xl z-50 animate-in slide-in-from-right duration-300">
          <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/30">Object_Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-8 flex-1">
              <div>
                <label className="text-[8px] font-mono uppercase text-white/20 tracking-widest block mb-2">Subject_Identity</label>
                <p className="text-2xl font-light tracking-tight truncate">{selectedOrder.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[8px] font-mono uppercase text-white/20 tracking-widest block mb-2">Transaction_Value</label>
                  <p className="text-xl italic font-light">${(selectedOrder.amount_cents / 100).toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-[8px] font-mono uppercase text-white/20 tracking-widest block mb-2">Network_Status</label>
                  <p className="text-xs font-bold uppercase flex items-center gap-2">
                    <ShieldCheck size={12} className="text-green-500" />
                    {selectedOrder.status}
                  </p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <label className="text-[8px] font-mono uppercase text-white/20 tracking-widest block mb-2">Metadata_Dump</label>
                <div className="bg-black p-4 rounded border border-white/5 overflow-auto max-h-[300px]">
                  <pre className="text-[10px] font-mono text-green-500/70 whitespace-pre-wrap">
                    {JSON.stringify(selectedOrder, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <button 
              onClick={(e) => purgeRecord(selectedOrder.id, e)}
              className="w-full py-4 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-red-500 hover:text-white transition-all"
            >
              Destroy_Record_Permanently
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

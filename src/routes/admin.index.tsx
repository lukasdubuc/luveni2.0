import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, X, ChevronRight, Terminal, Zap, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const sync = async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const hardDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      toast.error(`ROOT_ACCESS_DENIED: ${error.message}`);
    } else {
      toast.success("DATA_PURGED");
      setSelectedOrder(null);
      sync();
    }
  };

  useEffect(() => { sync(); }, []);

  return (
    <div className="min-h-screen bg-[#000] text-[#fff] font-sans selection:bg-white selection:text-black">
      {/* HUD HEADER */}
      <header className="p-8 border-b border-white/10 flex justify-between items-end bg-black sticky top-0 z-30">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={12} className="text-white/40" />
            <span className="text-[10px] font-mono tracking-[0.4em] text-white/40 uppercase">System.Root.Tulsa</span>
          </div>
          <h1 className="text-5xl font-light italic tracking-tighter uppercase leading-none">Command_Vault</h1>
        </div>
        <div className="flex gap-8">
          <Stat value={orders.length} label="Live_Nodes" />
          <Stat value={`$${(orders.reduce((acc, o) => acc + (o.amount_cents || 0), 0) / 100).toLocaleString()}`} label="Net_Volume" />
        </div>
      </header>

      {/* STREAM FEED */}
      <main className="p-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="py-20 text-center animate-pulse font-mono text-[10px] tracking-[1em] opacity-20">Accessing_Database...</div>
        ) : (
          <div className="space-y-1">
            {orders.map((o) => (
              <div 
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="group flex items-center justify-between p-6 border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-8">
                  <div className={`h-1.5 w-1.5 rounded-full ${o.status === 'paid' ? 'bg-white shadow-[0_0_8px_#fff]' : 'bg-white/10'}`} />
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight">{o.email}</p>
                    <p className="text-[9px] font-mono opacity-20 uppercase tracking-[0.2em] mt-1">{o.id.slice(0,8)} // {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-10">
                  <span className="text-xl font-light italic tabular-nums tracking-tighter">${(o.amount_cents / 100).toFixed(2)}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-4">
                    <button onClick={(e) => hardDelete(o.id, e)} className="p-2 hover:bg-white hover:text-black transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className="opacity-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DETAIL SIDE-DRAWER */}
      {selectedOrder && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setSelectedOrder(null)} />
          <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-black border-l border-white/10 z-50 p-12 flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
            <div className="flex justify-between items-start mb-20">
              <Zap size={20} className="text-white" />
              <button onClick={() => setSelectedOrder(null)} className="hover:rotate-90 transition-transform duration-300">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 space-y-12">
              <div>
                <label className="text-[9px] font-mono uppercase opacity-30 tracking-[0.4em] block mb-4">Identity_Ref</label>
                <h2 className="text-4xl font-light italic tracking-tighter truncate">{selectedOrder.email}</h2>
              </div>

              <div className="grid grid-cols-2 gap-12 pt-12 border-t border-white/10">
                <div>
                  <label className="text-[9px] font-mono uppercase opacity-30 tracking-[0.4em] block mb-2">Value</label>
                  <p className="text-2xl font-light">${(selectedOrder.amount_cents / 100).toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-[9px] font-mono uppercase opacity-30 tracking-[0.4em] block mb-2">Status</label>
                  <p className="text-xs font-bold uppercase tracking-widest bg-white text-black px-2 py-1 inline-block">{selectedOrder.status}</p>
                </div>
              </div>

              <div className="pt-12">
                <label className="text-[9px] font-mono uppercase opacity-30 tracking-[0.4em] block mb-4">Payload_Data</label>
                <div className="bg-white/[0.03] p-6 rounded-sm border border-white/5 max-h-[250px] overflow-auto">
                  <pre className="text-[10px] font-mono text-white/50 leading-relaxed">
                    {JSON.stringify(selectedOrder, null, 4)}
                  </pre>
                </div>
              </div>
            </div>

            <button 
              onClick={(e) => hardDelete(selectedOrder.id, e)}
              className="mt-12 w-full py-5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.5em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 group"
            >
              <ShieldAlert size={14} className="group-hover:animate-bounce" />
              Purge_From_Vault
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: any, label: string }) {
  return (
    <div className="text-right">
      <p className="text-[24px] font-light italic tracking-tighter leading-none">{value}</p>
      <p className="text-[8px] font-mono uppercase opacity-30 tracking-[0.3em] mt-1">{label}</p>
    </div>
  );
}

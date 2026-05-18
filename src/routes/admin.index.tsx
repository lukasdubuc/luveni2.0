import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, X, BarChart3, Target, Layers, Database, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOps = async () => {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const hardPurge = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("PURGE_DATA_PERMANENTLY?")) return;
    
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error("ACCESS_DENIED_BY_DB_POLICY");
    else {
      toast.success("RECORD_WIPED");
      setSelectedItem(null);
      fetchOps();
    }
  };

  useEffect(() => { fetchOps(); }, []);

  const totalRev = orders.reduce((acc, o) => acc + (o.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-white selection:text-black antialiased">
      {/* GLOBAL HUD */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto p-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="h-10 w-10 bg-white flex items-center justify-center rounded-sm">
              <Layers size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-[0.4em]">Operations_Manager</h1>
              <p className="text-[10px] font-mono opacity-30 mt-1 uppercase tracking-widest italic">Core // Tulsa_Relocation_Unit</p>
            </div>
          </div>
          <div className="flex gap-12">
            <Metric label="GROSS_VOLUME" value={`$${totalRev.toLocaleString()}`} color="text-white" />
            <Metric label="ACTIVE_RECORDS" value={orders.length} color="text-white" />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
        {/* LEFT: THE TRANSACTION STREAM */}
        <section className="col-span-12 lg:col-span-8 space-y-2">
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 italic">Incoming_Revenue_Stream</h2>
            <button onClick={fetchOps} className="text-[10px] font-bold uppercase hover:opacity-50 transition-all underline underline-offset-4">Sync_Vault</button>
          </div>

          <div className="grid gap-[1px] bg-white/5 border border-white/5">
            {orders.map((o) => (
              <div 
                key={o.id}
                onClick={() => setSelectedItem(o)}
                className="group flex items-center justify-between p-5 bg-[#0A0A0A] hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-6">
                  <span className={`text-[8px] font-bold px-2 py-0.5 border ${o.status === 'paid' ? 'bg-white text-black border-white' : 'border-white/10 opacity-30 uppercase'}`}>
                    {o.status}
                  </span>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-tight leading-none mb-1">{o.email}</p>
                    <p className="text-[10px] font-mono opacity-20 uppercase tracking-tighter">REF: {o.id.slice(0, 8)} // {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-10">
                  <div className="text-right">
                    <p className="text-xl font-light italic tabular-nums leading-none">${(o.amount_cents / 100).toFixed(2)}</p>
                  </div>
                  <button onClick={(e) => hardPurge(o.id, e)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: INSIGHTS & TOOLBOX */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="p-8 border border-white/5 bg-white/[0.02]">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
              <BarChart3 size={12} /> Strategic_Overview
            </h3>
            <div className="space-y-6">
              <QuickAction label="Scrape Real Estate Leads" icon={<Target size={14} />} />
              <QuickAction label="Update Digital Inventory" icon={<Database size={14} />} />
              <QuickAction label="View TikTok Performance" icon={<ArrowUpRight size={14} />} />
            </div>
          </div>
          
          <div className="p-8 border border-white/5 bg-white/[0.02] text-center italic opacity-20">
             <p className="text-[10px] uppercase tracking-[0.3em]">Operational // Efficiency // Tulsa</p>
          </div>
        </aside>
      </main>

      {/* DETAIL MODAL - FOR DEEP MANAGEMENT */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0F0F0F] border border-white/10 shadow-2xl p-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors">
              <X size={24} />
            </button>

            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-30 block mb-6">Record_Inspection</label>
            <h2 className="text-4xl font-light italic uppercase tracking-tighter mb-12">{selectedItem.email}</h2>

            <div className="grid grid-cols-2 gap-12 mb-12 border-y border-white/5 py-12">
              <div>
                <p className="text-[10px] font-mono opacity-30 uppercase mb-2">Transaction_Volume</p>
                <p className="text-3xl font-light tabular-nums">${(selectedItem.amount_cents / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-30 uppercase mb-2">Timestamp</p>
                <p className="text-sm font-bold uppercase tracking-widest">{new Date(selectedItem.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-black/50 p-6 rounded border border-white/5 mb-12">
               <pre className="text-[10px] font-mono text-white/40 overflow-auto max-h-[200px]">
                 {JSON.stringify(selectedItem, null, 2)}
               </pre>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => hardPurge(selectedItem.id)}
                className="flex-1 py-4 bg-red-600/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-red-600 hover:text-white transition-all"
              >
                Destroy_Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string, value: any, color: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-1 leading-none">{label}</p>
      <p className={`text-2xl font-light italic tracking-tighter leading-none ${color}`}>{value}</p>
    </div>
  );
}

function QuickAction({ label, icon }: { label: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer group">
      <span className="text-[10px] font-bold uppercase tracking-widest group-hover:italic">{label}</span>
      <span className="opacity-40 group-hover:opacity-100">{icon}</span>
    </div>
  );
}

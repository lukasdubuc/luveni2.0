import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, TrendingUp, Package, DollarSign, X, 
  ChevronRight, Clock, Plus, ShieldCheck, 
  BarChart3, Activity, Archive, Zap
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    if (session.user.email?.toLowerCase() !== "lukasdubuc@gmail.com") {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inventory'>('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [stripeId, setStripeId] = useState(""); 

  const fetchData = useCallback(async () => {
    setLoading(true);
    // We use a try/catch to prevent the "Page didn't load" crash if a table is missing a column
    try {
      const [orderRes, productRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false })
      ]);
      
      // Filter out archived items on the frontend to ensure refresh-persistence
      setOrders((orderRes.data || []).filter(o => o.status !== 'archived'));
      setProducts((productRes.data || []).filter(p => p.status !== 'archived'));
    } catch (err) {
      console.error("Fetch Error:", err);
      toast.error("Sync Error: Check database columns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleArchive = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const toastId = toast.loading("Archiving...");

    const { error } = await supabase
      .from(table)
      .update({ status: 'archived' })
      .eq("id", id);
    
    if (error) {
      toast.error("Archive failed. Hiding locally.", { id: toastId });
    } else {
      toast.success("Archived successfully", { id: toastId });
    }

    if (activeTab === 'orders') setOrders(prev => prev.filter(i => i.id !== id));
    else setProducts(prev => prev.filter(i => i.id !== id));
    setSelectedItem(null);
  };

  const saveProduct = async () => {
    if (!newTitle || !newPrice) return toast.error("Missing Info");
    const { data, error } = await supabase.from("products").insert([{ 
      title: newTitle, 
      price_cents: Math.round(parseFloat(newPrice) * 100),
      stripe_price_id: stripeId,
      status: 'active'
    }]).select();

    if (error) {
      toast.error("Deploy failed: " + error.message);
    } else {
      setProducts(prev => [data[0], ...prev]);
      setNewTitle(""); setNewPrice(""); setStripeId("");
      toast.success("Service Deployed Live");
    }
  };

  // Business Logic Calculations
  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;
  const recentSales = orders.slice(0, 5);
  
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row font-sans text-white antialiased">
      {/* SIDEBAR */}
      <nav className="w-full md:w-72 bg-[#0a0a0a] border-r border-white/5 p-8 flex md:flex-col gap-3">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <Zap size={22} className="text-black" />
          </div>
          <div>
            <p className="font-black text-xs uppercase tracking-tighter italic">Command</p>
            <p className="text-[9px] text-white/30 uppercase font-bold">Northwind_HQ</p>
          </div>
        </div>

        <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}>
          <BarChart3 size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Overview</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}>
          <DollarSign size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Sales</span>
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'inventory' ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}>
          <Package size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
        </button>
      </nav>

      {/* CONTENT */}
      <main className="flex-1 p-6 md:p-16 max-w-6xl mx-auto w-full">
        {activeTab === 'overview' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <h1 className="text-5xl font-black italic uppercase tracking-tighter">HQ_Analytics</h1>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Real_Time_Data</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Gross Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="Lifetime" />
              <StatCard label="Sales Volume" value={orders.length} sub="Completed" />
              <StatCard label="Avg Order" value={`$${orders.length ? (totalRevenue / orders.length).toFixed(2) : '0'}`} sub="Per user" />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 mb-8">Recent_Flow</p>
              <div className="space-y-4">
                {recentSales.map(o => (
                  <div key={o.id} className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-xs font-bold">{o.email}</span>
                    <span className="font-mono text-xs text-white/50">${(o.amount_cents/100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="p-10 bg-white text-black rounded-[2.5rem] shadow-[0_0_50px_rgba(255,255,255,0.1)]">
              <p className="text-[10px] font-black uppercase tracking-widest mb-8 opacity-40">Push_New_Service</p>
              <div className="grid gap-4 md:grid-cols-4">
                <input placeholder="Service Name" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none border-none" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <input placeholder="Price" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none border-none" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                <input placeholder="Stripe ID" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none border-none" value={stripeId} onChange={e => setStripeId(e.target.value)} />
                <button onClick={saveProduct} className="bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-80 transition-all">Deploy</button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-8 text-[9px] font-black uppercase text-white/30 text-left">Item_Identifier</th>
                    <th className="p-8 text-[9px] font-black uppercase text-white/30 text-right">Unit_Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map(p => (
                    <tr key={p.id} onClick={() => setSelectedItem(p)} className="hover:bg-white/5 cursor-pointer transition-all">
                      <td className="p-8 font-bold text-sm">{p.title}</td>
                      <td className="p-8 text-right font-mono text-sm">${(p.price_cents/100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden animate-in fade-in">
             <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-8 text-[9px] font-black uppercase text-white/30 text-left">Customer_Email</th>
                    <th className="p-8 text-[9px] font-black uppercase text-white/30 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedItem(o)} className="hover:bg-white/5 cursor-pointer transition-all">
                      <td className="p-8 font-bold text-sm">{o.email}</td>
                      <td className="p-8 text-right font-mono text-sm">${(o.amount_cents/100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </main>

      {/* OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[4rem] w-full max-w-xl">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-10 break-words">{selectedItem.email || selectedItem.title}</h2>
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div>
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Value</p>
                <p className="text-xl font-bold">${((selectedItem.amount_cents || selectedItem.price_cents) / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Date</p>
                <p className="text-xl font-bold">{new Date(selectedItem.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button onClick={() => handleArchive(selectedItem.id)} className="w-full bg-white text-black p-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 mb-4">
              <Archive size={16} /> Archive Record
            </button>
            <button onClick={() => setSelectedItem(null)} className="w-full p-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] group hover:bg-white/10 transition-all">
      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">{label}</p>
      <h2 className="text-5xl font-black italic tracking-tighter mb-2">{value}</h2>
      <p className="text-[10px] text-white/40 font-bold uppercase">{sub}</p>
    </div>
  );
}

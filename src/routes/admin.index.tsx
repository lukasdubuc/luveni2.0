import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, TrendingUp, Package, DollarSign, X, 
  ChevronRight, Clock, Plus, ShieldCheck, 
  BarChart3, Activity, Archive, Zap, Lock
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  // STEP 1: Strict Route Guard
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const authorizedEmail = "lukasdubuc@gmail.com";

    if (!session) {
      throw redirect({ to: "/login" });
    }

    if (session.user.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
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
  const [isVerifying, setIsVerifying] = useState(true); // Security handshake state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [stripeId, setStripeId] = useState(""); 

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, productRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false })
      ]);
      
      setOrders((orderRes.data || []).filter(o => o.status !== 'archived'));
      setProducts((productRes.data || []).filter(p => p.status !== 'archived'));
    } catch (err) {
      console.error("Sync Error:", err);
      toast.error("Cloud Sync Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // STEP 2: Session Validation Hook
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.email === "lukasdubuc@gmail.com") {
        setIsVerifying(false);
        fetchData();
      } else {
        window.location.href = "/login";
      }
    };
    checkUser();
  }, [fetchData]);

  const handleArchive = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const toastId = toast.loading("Archiving...");
    const { error } = await supabase.from(table).update({ status: 'archived' }).eq("id", id);
    
    if (!error) {
      toast.success("Archived", { id: toastId });
      if (activeTab === 'orders') setOrders(prev => prev.filter(i => i.id !== id));
      else setProducts(prev => prev.filter(i => i.id !== id));
      setSelectedItem(null);
    } else {
      toast.error("Action Denied", { id: toastId });
    }
  };

  const saveProduct = async () => {
    if (!newTitle || !newPrice) return toast.error("Incomplete Fields");
    const { data, error } = await supabase.from("products").insert([{ 
      title: newTitle, 
      price_cents: Math.round(parseFloat(newPrice) * 100),
      stripe_price_id: stripeId,
      status: 'active'
    }]).select();

    if (!error) {
      setProducts(prev => [data[0], ...prev]);
      setNewTitle(""); setNewPrice(""); setStripeId("");
      toast.success("Service Deployed");
    }
  };

  // STEP 3: Security Loading State
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Lock className="mx-auto text-white animate-pulse" size={32} />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Verifying_Identity</p>
        </div>
      </div>
    );
  }

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row font-sans text-white antialiased">
      <nav className="w-full md:w-72 bg-[#0a0a0a] border-r border-white/5 p-8 flex md:flex-col gap-3">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xl shadow-white/5">
            <Zap size={22} className="text-black" />
          </div>
          <div>
            <p className="font-black text-xs uppercase tracking-tighter italic">Command</p>
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Authorized_Only</p>
          </div>
        </div>

        <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'overview' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}>
          <BarChart3 size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Overview</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}>
          <DollarSign size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Sales</span>
        </button>
        <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all ${activeTab === 'inventory' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}>
          <Package size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
        </button>
      </nav>

      <main className="flex-1 p-6 md:p-16 max-w-6xl mx-auto w-full">
        {activeTab === 'overview' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter">HQ_Analytics</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Gross Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="Lifetime" />
              <StatCard label="Sales Volume" value={orders.length} sub="Orders" />
              <StatCard label="Avg Ticket" value={`$${orders.length ? (totalRevenue / orders.length).toFixed(2) : '0'}`} sub="USD" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 mb-8">Recent_Sales_Flow</p>
              <div className="space-y-4">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
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
            <div className="p-10 bg-white text-black rounded-[2.5rem]">
              <p className="text-[10px] font-black uppercase tracking-widest mb-8 opacity-40">System_Deployment</p>
              <div className="grid gap-4 md:grid-cols-4">
                <input placeholder="Service Title" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <input placeholder="Price" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                <input placeholder="Stripe ID" className="bg-black/5 p-5 rounded-2xl text-xs font-bold outline-none" value={stripeId} onChange={e => setStripeId(e.target.value)} />
                <button onClick={saveProduct} className="bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-80">Deploy</button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <table className="w-full">
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

      {selectedItem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[4rem] w-full max-w-xl">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-10 break-words">{selectedItem.email || selectedItem.title}</h2>
            <button onClick={() => handleArchive(selectedItem.id)} className="w-full bg-white text-black p-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">
              <Archive size={16} /> Archive Record
            </button>
            <button onClick={() => setSelectedItem(null)} className="w-full mt-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] hover:bg-white/10 transition-all cursor-default">
      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">{label}</p>
      <h2 className="text-5xl font-black italic tracking-tighter mb-2">{value}</h2>
      <p className="text-[10px] text-white/40 font-bold uppercase">{sub}</p>
    </div>
  );
}

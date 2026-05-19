import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, TrendingUp, Package, DollarSign, X, 
  ChevronRight, Clock, Plus, ShieldCheck 
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });

    const authorizedEmail = "lukasdubuc@gmail.com";
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
      setOrders(orderRes.data || []);
      setProducts(productRes.data || []);
    } catch (err) {
      toast.error("Sync Interrupted");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveProduct = async () => {
    if (!newTitle || !newPrice) return toast.error("Missing Title/Price");
    const { data, error } = await supabase.from("products").insert([{ 
      title: newTitle, 
      price_cents: Math.round(parseFloat(newPrice) * 100),
      stripe_price_id: stripeId 
    }]).select();

    if (error) {
      toast.error("Upload failed: " + error.message);
    } else {
      setProducts(prev => [data[0], ...prev]);
      setNewTitle(""); setNewPrice(""); setStripeId("");
      toast.success("OFFER_UPDATED_LIVE");
    }
  };

  const handleHardPurge = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const toastId = toast.loading("Executing permanent purge...");

    // UI FORCE-SYNC: This makes it disappear from your screen instantly
    if (activeTab === 'orders') {
      setOrders(prev => prev.filter(item => item.id !== id));
    } else {
      setProducts(prev => prev.filter(item => item.id !== id));
    }

    // Database attempt
    const { error } = await supabase.from(table).delete().eq("id", id);
    
    if (error) {
      console.error("DB_ERROR:", error);
      toast.error("Locked: Item hidden but still in DB.", { id: toastId });
    } else {
      toast.success("Record Wiped", { id: toastId });
    }
    setSelectedItem(null);
  };

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row font-sans text-gray-900 antialiased">
      <nav className="w-full md:w-64 bg-white border-r border-gray-100 p-6 flex md:flex-col gap-2">
        <div className="hidden md:flex items-center gap-3 mb-10 px-2">
          <ShieldCheck size={20} className="text-black" />
          <span className="font-black text-xs uppercase tracking-tight italic">Root Admin</span>
        </div>
        {['overview', 'orders', 'inventory'].map((t: any) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-black text-white shadow-xl' : 'text-gray-400 hover:text-black'}`}>
            {t}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        {activeTab === 'overview' && (
          <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm mb-8 animate-in fade-in">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-4">Life_Revenue</p>
            <h2 className="text-5xl font-black tracking-tighter">${totalRevenue.toFixed(2)}</h2>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="mb-12 p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-6">Service_Config</p>
            <div className="grid gap-4 md:grid-cols-4">
              <input placeholder="Name" className="bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <input placeholder="Price" className="bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
              <input placeholder="Stripe ID" className="bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none border-none" value={stripeId} onChange={e => setStripeId(e.target.value)} />
              <button onClick={saveProduct} className="bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">Push_Live</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-20 text-center text-xs font-bold opacity-10 animate-pulse uppercase tracking-[0.4em]">Syncing_Database...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(activeTab === 'orders' ? orders : products).map(item => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className="p-6 hover:bg-gray-50 flex justify-between items-center cursor-pointer group transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-white group-hover:text-black transition-all">
                      {activeTab === 'orders' ? <Clock size={18}/> : <Package size={18}/>}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{item.email || item.title}</p>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{item.status || 'Verified'}</p>
                    </div>
                  </div>
                  <p className="font-mono font-bold text-sm text-gray-900">${((item.amount_cents || item.price_cents) / 100).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
            <h2 className="text-3xl font-black tracking-tighter mb-10 break-words">{selectedItem.email || selectedItem.title}</h2>
            <button onClick={() => handleHardPurge(selectedItem.id)} className="w-full bg-red-50 text-red-500 p-6 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
              <Trash2 size={16} /> Wipe From Database
            </button>
            <button onClick={() => setSelectedItem(null)} className="w-full mt-6 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

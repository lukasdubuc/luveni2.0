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
  const [stripeId, setStripeId] = useState(""); // Link to your Stripe Product

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [orderRes, productRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false })
    ]);
    setOrders(orderRes.data || []);
    setProducts(productRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveProduct = async () => {
    if (!newTitle || !newPrice) return toast.error("Missing fields");
    const { data, error } = await supabase.from("products").insert([{ 
      title: newTitle, 
      price_cents: Math.round(parseFloat(newPrice) * 100),
      stripe_price_id: stripeId 
    }]).select();

    if (!error) {
      setProducts(prev => [data[0], ...prev]);
      setNewTitle(""); setNewPrice(""); setStripeId("");
      toast.success("OFFER_PUSHED_LIVE");
    }
  };

  const handleHardPurge = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const { error } = await supabase.from(table).delete().eq("id", id);
    
    if (!error) {
      if (activeTab === 'orders') setOrders(prev => prev.filter(i => i.id !== id));
      else setProducts(prev => prev.filter(i => i.id !== id));
      setSelectedItem(null);
      toast.success("DELETED_PERMANENTLY");
    } else {
      toast.error("DELETE_FAILED: Check RLS Policies");
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-white border-r p-6 flex md:flex-col gap-4">
        <div className="hidden md:flex items-center gap-2 mb-8"><ShieldCheck /> <b className="text-sm">OWNER</b></div>
        <button onClick={() => setActiveTab('overview')} className={`p-3 rounded-xl text-xs font-bold ${activeTab === 'overview' ? 'bg-black text-white' : ''}`}>OVERVIEW</button>
        <button onClick={() => setActiveTab('orders')} className={`p-3 rounded-xl text-xs font-bold ${activeTab === 'orders' ? 'bg-black text-white' : ''}`}>ORDERS</button>
        <button onClick={() => setActiveTab('inventory')} className={`p-3 rounded-xl text-xs font-bold ${activeTab === 'inventory' ? 'bg-black text-white' : ''}`}>STOCK</button>
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-5xl">
        {activeTab === 'inventory' && (
          <div className="mb-12 p-8 bg-white rounded-3xl border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Command_Input</p>
            <div className="grid gap-4 md:grid-cols-4">
              <input placeholder="Service Name" className="bg-gray-50 p-3 rounded-xl text-sm outline-none" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <input placeholder="Price" className="bg-gray-50 p-3 rounded-xl text-sm outline-none" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
              <input placeholder="Stripe Price ID" className="bg-gray-50 p-3 rounded-xl text-sm outline-none" value={stripeId} onChange={e => setStripeId(e.target.value)} />
              <button onClick={saveProduct} className="bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest">Deploy</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border overflow-hidden">
          {loading ? <div className="p-20 text-center animate-pulse text-xs font-bold">SYNCING...</div> : (
            <div className="divide-y">
              {(activeTab === 'orders' ? orders : products).map(item => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className="p-6 hover:bg-gray-50 flex justify-between cursor-pointer">
                  <div>
                    <p className="font-bold text-sm">{item.email || item.title}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{item.status || 'Active'}</p>
                  </div>
                  <p className="font-mono font-bold">${((item.amount_cents || item.price_cents) / 100).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{selectedItem.email || selectedItem.title}</h2>
            <button onClick={() => handleHardPurge(selectedItem.id)} className="w-full bg-red-50 text-red-500 p-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
              WIPE RECORD
            </button>
            <button onClick={() => setSelectedItem(null)} className="w-full mt-4 text-xs font-bold text-gray-400">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

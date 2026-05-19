import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, TrendingUp, Package, DollarSign, X, 
  ChevronRight, Clock, Plus, ShieldCheck, 
  BarChart3, Activity, Users, Archive
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
    const [orderRes, productRes] = await Promise.all([
      supabase.from("orders").select("*").neq('status', 'archived').order("created_at", { ascending: false }),
      supabase.from("products").select("*").neq('status', 'archived').order("created_at", { ascending: false })
    ]);
    setOrders(orderRes.data || []);
    setProducts(productRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // THE FIX: Archive instead of Delete to bypass RLS locks
  const handleArchive = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const toastId = toast.loading("Archiving record...");

    const { error } = await supabase
      .from(table)
      .update({ status: 'archived' })
      .eq("id", id);
    
    if (error) {
      // If even update is blocked, we just hide it locally for the session
      toast.error("Cloud sync failed. Hiding locally.", { id: toastId });
    } else {
      toast.success("Record Archived", { id: toastId });
    }

    if (activeTab === 'orders') setOrders(prev => prev.filter(i => i.id !== id));
    else setProducts(prev => prev.filter(i => i.id !== id));
    setSelectedItem(null);
  };

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;
  const avgOrder = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row font-sans text-white antialiased">
      {/* PROFESSIONAL SIDEBAR */}
      <nav className="w-full md:w-72 bg-[#0a0a0a] border-r border-white/5 p-8 flex md:flex-col gap-3">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <ShieldCheck size={22} className="text-black" />
          </div>
          <div>
            <p className="font-black text-xs uppercase tracking-tighter leading-none">Northwind</p>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Terminal_v2</p>
          </div>
        </div>

        <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={18}/>} label="Analytics" />
        <NavBtn active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<DollarSign size={18}/>} label="Sales" />
        <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={18}/>} label="Inventory" />
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 md:p-16 max-w-6xl mx-auto w-full">
        {activeTab === 'overview' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-5xl font-black tracking-tight uppercase italic">Dashboard</h1>
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Real-time Performance Metrics</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">System_Live</span>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatBox label="Gross Revenue" value={`$${totalRevenue.toFixed(2)}`} sub="Lifetime sales" trend="+12%" />
              <StatBox label="Active Orders" value={orders.length} sub="Pending fulfillment" trend="Stable" />
              <StatBox label="Avg Ticket" value={`$${avgOrder}`} sub="Per customer" trend="+5%" />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Recent Activity</h3>
                <Activity size={16} className="text-white/20" />
              </div>
              <div className="space-y-4">
                {orders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500"><TrendingUp size={14}/></div>
                      <span className="text-sm font-bold">{o.email}</span>
                    </div>
                    <span className="font-mono text-xs text-white/50">${(o.amount_cents/100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="mb-12 p-10 bg-white/5 border border-white/10 rounded-[3rem] animate-in slide-in-from-top-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-8">Push_New_Offer</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <input placeholder="Service Title" className="bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold outline-none focus:border-white/40 transition-all" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <input placeholder="Price" className="bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold outline-none focus:border-white/40 transition-all" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
              <input placeholder="Stripe ID" className="bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold outline-none focus:border-white/40 transition-all" value={stripeId} onChange={e => setStripeId(e.target.value)} />
              <button onClick={saveProduct} className="bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Plus size={14} /> Deploy
              </button>
            </div>
          </div>
        )}

        {(activeTab === 'orders' || activeTab === 'inventory') && (
          <div className="bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden">
            {loading ? (
              <div className="p-32 text-center text-[10px] font-black uppercase tracking-[0.5em] opacity-20 animate-pulse">Syncing_Nodes...</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="p-8 text-[10px] font-black uppercase tracking-widest text-white/20">Identifer</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-widest text-white/20 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(activeTab === 'orders' ? orders : products).map(item => (
                    <tr key={item.id} onClick={() => setSelectedItem(item)} className="group hover:bg-white/[0.02] cursor-pointer transition-all">
                      <td className="p-8">
                        <p className="font-bold text-sm tracking-tight">{item.email || item.title}</p>
                        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest mt-1">{item.status || 'Verified'}</p>
                      </td>
                      <td className="p-8 text-right font-mono text-sm font-bold text-white/80 group-hover:text-white">
                        ${((item.amount_cents || item.price_cents) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* THE ACTION OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-[#0a0a0a] border border-white/10 p-12 rounded-[4rem] w-full max-w-xl shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">Record_Details</p>
                <h2 className="text-4xl font-black tracking-tighter uppercase italic break-words">{selectedItem.email || selectedItem.title}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"><X size={20}/></button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-12">
              <Detail label="Total Amount" value={`$${((selectedItem.amount_cents || selectedItem.price_cents) / 100).toFixed(2)}`} />
              <Detail label="Created On" value={new Date(selectedItem.created_at).toLocaleDateString()} />
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => handleArchive(selectedItem.id)} className="w-full bg-white text-black p-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-white/90 transition-all flex items-center justify-center gap-3">
                <Archive size={16} /> Move to Archive
              </button>
              <button onClick={() => setSelectedItem(null)} className="w-full p-4 text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-all">Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-4 px-6 py-5 rounded-[1.5rem] transition-all group ${active ? 'bg-white text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
      {icon}
      <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatBox({ label, value, sub, trend }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] relative overflow-hidden group">
      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">{label}</p>
      <div className="flex items-baseline gap-4">
        <h2 className="text-4xl font-black tracking-tighter italic">{value}</h2>
        <span className="text-[10px] font-black text-green-400">{trend}</span>
      </div>
      <p className="text-[10px] text-white/40 font-bold uppercase mt-2">{sub}</p>
    </div>
  );
}

function Detail({ label, value }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{label}</p>
      <p className="text-lg font-bold text-white/80 tracking-tight">{value}</p>
    </div>
  );
}

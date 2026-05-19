import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, 
  TrendingUp, 
  Package, 
  DollarSign, 
  X, 
  ChevronRight, 
  Clock, 
  CheckCircle2,
  LayoutDashboard
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    // SECURITY GATE: Check session and identity before rendering anything
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw redirect({ to: "/login" });
    }

    // Strict Email Verification
    const authorizedEmail = "lukasdubuc@gmail.com";
    if (session.user.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
      console.error("UNAUTHORIZED_ACCESS_ATTEMPT:", session.user.email);
      // Sign them out immediately if they aren't you
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, productRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false })
      ]);
      setOrders(orderRes.data || []);
      setProducts(productRes.data || []);
    } catch (error: any) {
      toast.error("SYNC_ERROR: Check database connection");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleHardPurge = async (id: string) => {
    const table = activeTab === 'orders' ? 'orders' : 'products';
    const toastId = toast.loading("Executing database purge...");

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", id);

      if (error) throw error;

      // UPDATE UI IMMEDIATELY
      if (activeTab === 'orders') {
        setOrders(prev => prev.filter(item => item.id !== id));
      } else {
        setProducts(prev => prev.filter(item => item.id !== id));
      }

      setSelectedItem(null);
      toast.success("Record wiped successfully", { id: toastId });
    } catch (err: any) {
      console.error("Purge Error:", err);
      toast.error(`Purge Failed: ${err.message}. Check Supabase RLS Policies.`, { id: toastId });
    }
  };

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans antialiased pb-24 md:pb-0">
      {/* SIDEBAR/DOCK */}
      <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:w-64 md:h-screen bg-white border-t md:border-t-0 md:border-r border-gray-200 z-50 flex md:flex-col p-2 md:p-6 justify-around md:justify-start gap-2">
        <div className="hidden md:flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <span className="font-bold tracking-tight">Admin Portal</span>
        </div>
        
        <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<TrendingUp size={20}/>} label="Overview" />
        <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<DollarSign size={20}/>} label="Orders" />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20}/>} label="Stock" />
      </nav>

      <main className="md:ml-64 p-4 md:p-10 max-w-5xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-black tracking-tighter uppercase">Dashboard</h1>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">System Status: Optimal</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Revenue" value={`$${totalRevenue.toFixed(2)}`} />
              <StatCard label="Orders" value={orders.length} />
              <StatCard label="Stock" value={products.length} />
            </div>

            <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Recent Transactions</h3>
              <div className="space-y-4">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                      <p className="text-sm font-bold text-gray-700">{o.email}</p>
                    </div>
                    <span className="font-mono font-bold text-sm text-gray-900">${(o.amount_cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {(activeTab === 'orders' || activeTab === 'inventory') && (
          <div className="animate-in fade-in duration-300">
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-8">{activeTab}</h1>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-20 text-center text-xs font-bold uppercase tracking-[0.3em] opacity-20">Refreshing_Data...</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(activeTab === 'orders' ? orders : products).map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      className="flex items-center justify-between p-5 hover:bg-gray-50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                          {activeTab === 'orders' ? <Clock size={20}/> : <Package size={20}/>}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-800">{item.email || item.title}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.status || 'Verified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-mono font-bold text-gray-900">${((item.amount_cents || item.price_cents || 0) / 100).toFixed(2)}</p>
                        <ChevronRight size={18} className="text-gray-200 group-hover:text-black transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* DETAIL OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2rem] p-10 shadow-2xl animate-in slide-in-from-bottom-20 duration-500">
            <div className="flex justify-between items-center mb-10">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Management Node</span>
              <button onClick={() => setSelectedItem(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"><X size={20}/></button>
            </div>
            
            <h2 className="text-3xl font-black tracking-tighter mb-8 break-words">{selectedItem.email || selectedItem.title}</h2>
            
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Valuation</p>
                <p className="text-xl font-bold">${((selectedItem.amount_cents || selectedItem.price_cents) / 100).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Timestamp</p>
                <p className="text-xl font-bold">{new Date(selectedItem.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <button 
              onClick={() => handleHardPurge(selectedItem.id)}
              className="w-full bg-red-50 text-red-500 font-black text-xs uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <Trash2 size={18} /> Wipe From Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 px-4 py-4 md:w-full rounded-2xl transition-all ${active ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-300 hover:text-black hover:bg-gray-50'}`}
    >
      {icon}
      <span className="text-[9px] md:text-sm font-black uppercase md:capitalize md:font-bold tracking-widest md:tracking-normal">{label}</span>
    </button>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3">{label}</p>
      <h2 className="text-3xl font-black tracking-tighter">{value}</h2>
    </div>
  );
}

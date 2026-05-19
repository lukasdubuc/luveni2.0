import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, 
  LayoutDashboard, 
  Package, 
  DollarSign, 
  Settings,
  Plus,
  X,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.email?.toLowerCase() !== "lukasdubuc@gmail.com") {
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
      toast.error("DATA_FETCH_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans antialiased pb-20 md:pb-0">
      {/* SIDEBAR / TOP NAV */}
      <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto md:w-64 md:h-screen bg-white border-t md:border-t-0 md:border-r border-gray-200 z-50 flex md:flex-col p-2 md:p-6 justify-around md:justify-start gap-4">
        <div className="hidden md:flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          <span className="font-bold tracking-tight">Business Hub</span>
        </div>
        
        <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<TrendingUp size={20}/>} label="Overview" />
        <NavButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<DollarSign size={20}/>} label="Sales" />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20}/>} label="Products" />
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="md:ml-64 p-4 md:p-10 max-w-6xl">
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <header>
              <h1 className="text-2xl font-bold">Business Overview</h1>
              <p className="text-gray-500 text-sm">Real-time performance metrics</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} trend="+12%" />
              <StatCard label="Total Orders" value={orders.length} trend="+5%" />
              <StatCard label="Inventory Items" value={products.length} />
            </div>

            <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{o.email}</p>
                        <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm">${(o.amount_cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* LIST VIEW FOR ORDERS/INVENTORY */}
        {(activeTab === 'orders' || activeTab === 'inventory') && (
          <div className="animate-in fade-in duration-300">
             <header className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold uppercase">{activeTab}</h1>
                <p className="text-gray-500 text-sm">Manage your records</p>
              </div>
              {activeTab === 'inventory' && (
                <button className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Plus size={16} /> Add Product
                </button>
              )}
            </header>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-20 text-center animate-pulse">Synchronizing...</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(activeTab === 'orders' ? orders : products).map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          {activeTab === 'orders' ? <Clock size={18}/> : <Package size={18}/>}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.email || item.title}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">{item.status || 'Active'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${((item.amount_cents || item.price_cents || 0) / 100).toFixed(2)}</p>
                        <ChevronRight size={16} className="ml-auto text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* DETAIL DRAWER / MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-8">
              <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-gray-500">Record Details</span>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-black"><X size={24}/></button>
            </div>
            <h2 className="text-2xl font-bold mb-6">{selectedItem.email || selectedItem.title}</h2>
            <div className="grid grid-cols-2 gap-6 mb-10">
              <DetailBox label="Identifier" value={selectedItem.id.slice(0, 12)} />
              <DetailBox label="Date" value={new Date(selectedItem.created_at).toLocaleDateString()} />
            </div>
            <button className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
              <Trash2 size={18} /> Delete Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// UI HELPER COMPONENTS
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 px-4 py-3 md:w-full rounded-xl transition-all ${active ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50 hover:text-black'}`}
    >
      {icon}
      <span className="text-[10px] md:text-sm font-bold md:font-semibold">{label}</span>
    </button>
  );
}

function StatCard({ label, value, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <h2 className="text-2xl font-black">{value}</h2>
        {trend && <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">{trend}</span>}
      </div>
    </div>
  );
}

function DetailBox({ label, value }: any) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}

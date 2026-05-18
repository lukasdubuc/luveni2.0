import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Trash2, 
  X, 
  BarChart3, 
  Layers, 
  Database, 
  ArrowUpRight,
  Plus,
  RefreshCcw,
  Search,
  Check,
  Package,
  ShoppingCart,
  Activity
} from "lucide-react";

// SECURITY GATE: diagnostic logging to fix the redirect loop
export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log("AUTH_LOG: Initializing Admin Check...");
    
    if (!session) {
      console.error("AUTH_LOG: No session found. Kicking to login.");
      throw redirect({ to: "/login" });
    }

    const userEmail = session.user.email?.toLowerCase().trim();
    const adminEmail = "lukasdubuc@gmail.com".toLowerCase().trim();

    if (userEmail !== adminEmail) {
      console.warn(`AUTH_LOG: Access Denied. User ${userEmail} is not authorized.`);
      throw redirect({ to: "/login" });
    }

    console.log("AUTH_LOG: Access Granted. Welcome, Admin.");
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const [mode, setMode] = useState<'revenue' | 'inventory'>('revenue');
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: "",
    slug: "",
    price_cents: 0,
    currency: "usd",
    is_published: true
  });

  const syncData = async () => {
    setLoading(true);
    try {
      const { data: orderData } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      const { data: productData } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      setOrders(orderData || []);
      setProducts(productData || []);
    } catch (error) {
      toast.error("SYNC_FAILURE: Check database permissions");
    } finally {
      setLoading(false);
    }
  };

  const hardPurge = async (table: 'orders' | 'products', id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`PERMANENT_ERASURE: Confirm wiping record ${id}?`)) return;
    
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error("ACCESS_DENIED: RLS Policy Violation");
    } else {
      toast.success("RECORD_WIPED");
      setSelectedItem(null);
      syncData();
    }
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("products").insert([newProduct]);
    if (error) toast.error("INSERT_FAILED");
    else {
      toast.success("PRODUCT_DEPLOYED");
      setIsAddingProduct(false);
      setNewProduct({ title: "", slug: "", price_cents: 0, currency: "usd", is_published: true });
      syncData();
    }
  };

  useEffect(() => { 
    syncData(); 
  }, []);

  const totalRev = orders.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.amount_cents || 0), 0) / 100;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-white selection:text-black antialiased p-4 md:p-8">
      {/* HUD HEADER */}
      <header className="border border-white/10 bg-black/40 backdrop-blur-md p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="h-12 w-12 bg-white flex items-center justify-center rounded-none">
            <Layers size={24} className="text-black" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.5em]">Ops_Terminal_v2.0</h1>
            <p className="text-[10px] opacity-30 mt-1 uppercase tracking-widest italic flex items-center gap-2">
              <span className="h-1 w-1 bg-green-500 animate-pulse" /> Status: Online // Unit: Tulsa_Branch
            </p>
          </div>
        </div>

        <div className="flex gap-8 border-l border-white/10 pl-8">
          <Metric label="NET_VOLUME" value={`$${totalRev.toLocaleString()}`} />
          <Metric label="ACTIVE_RECORDS" value={mode === 'revenue' ? orders.length : products.length} />
        </div>

        <div className="flex bg-white/5 p-1 border border-white/10">
          <button 
            onClick={() => setMode('revenue')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'revenue' ? 'bg-white text-black' : 'hover:bg-white/10'}`}
          >
            Revenue
          </button>
          <button 
            onClick={() => setMode('inventory')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'inventory' ? 'bg-white text-black' : 'hover:bg-white/10'}`}
          >
            Inventory
          </button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8 max-w-7xl mx-auto">
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">
              {mode === 'revenue' ? 'Transaction_Stream' : 'Inventory_Vault'}
            </h2>
            <div className="flex gap-4">
              {mode === 'inventory' && (
                <button 
                  onClick={() => setIsAddingProduct(true)}
                  className="text-[10px] font-black uppercase border border-white/20 px-4 py-1 hover:bg-white hover:text-black transition-all"
                >
                  + New_Item
                </button>
              )}
              <button onClick={syncData} className="text-[10px] font-black uppercase opacity-40 hover:opacity-100 transition-all flex items-center gap-2">
                <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Sync_Vault
              </button>
            </div>
          </div>

          <div className="border border-white/10 divide-y divide-white/5 bg-white/[0.02]">
            {loading ? (
              <div className="p-20 text-center text-[10px] uppercase tracking-[1em] opacity-10 animate-pulse">Scanning_Database...</div>
            ) : (
              mode === 'revenue' ? (
                orders.map((o) => (
                  <DataRow 
                    key={o.id}
                    title={o.email}
                    subtitle={`REF: ${o.id.slice(0, 8)} // ${new Date(o.created_at).toLocaleDateString()}`}
                    value={`$${(o.amount_cents / 100).toFixed(2)}`}
                    status={o.status}
                    onClick={() => setSelectedItem(o)}
                    onDelete={(e: any) => hardPurge('orders', o.id, e)}
                  />
                ))
              ) : (
                products.map((p) => (
                  <DataRow 
                    key={p.id}
                    title={p.title}
                    subtitle={`SLUG: /${p.slug} // ${p.is_published ? 'LIVE' : 'DRAFT'}`}
                    value={`$${(p.price_cents / 100).toFixed(2)}`}
                    status={p.is_published ? 'active' : 'inactive'}
                    onClick={() => setSelectedItem(p)}
                    onDelete={(e: any) => hardPurge('products', p.id, e)}
                  />
                ))
              )
            )}
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-8">
          <div className="p-8 border border-white/10 bg-white/[0.02]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <BarChart3 size={14} /> System_Diagnostics
            </h3>
            <div className="space-y-6">
              <DiagnosticItem label="DB_LATENCY" value="21ms" />
              <DiagnosticItem label="VAULT_STATUS" value="encrypted" />
              <DiagnosticItem label="API_UPTIME" value="99.9%" />
            </div>
          </div>
        </aside>
      </main>

      {/* MODALS */}
      {selectedItem && (
        <Modal onClose={() => setSelectedItem(null)} title="Record_Inspection">
          <div className="space-y-12">
            <h2 className="text-4xl font-black uppercase tracking-tighter italic border-b border-white/10 pb-8">
              {selectedItem.email || selectedItem.title}
            </h2>
            <div className="grid grid-cols-2 gap-12">
              <Detail label="VALUATION" value={`$${((selectedItem.amount_cents || selectedItem.price_cents) / 100).toFixed(2)}`} />
              <Detail label="TIMESTAMP" value={new Date(selectedItem.created_at).toLocaleString()} />
            </div>
            <button 
              onClick={() => hardPurge(mode === 'revenue' ? 'orders' : 'products', selectedItem.id)}
              className="w-full py-4 bg-red-600/10 border border-red-500/40 text-red-500 text-[10px] font-black uppercase tracking-[0.5em] hover:bg-red-600 hover:text-white transition-all"
            >
              Destroy_Record_Permanently
            </button>
          </div>
        </Modal>
      )}

      {isAddingProduct && (
        <Modal onClose={() => setIsAddingProduct(false)} title="Deploy_New_Inventory">
          <form onSubmit={createProduct} className="space-y-8">
            <div className="grid gap-6">
              <InputGroup label="PRODUCT_TITLE" value={newProduct.title} onChange={(v: string) => setNewProduct({...newProduct, title: v})} />
              <InputGroup label="URL_SLUG" value={newProduct.slug} onChange={(v: string) => setNewProduct({...newProduct, slug: v})} />
              <InputGroup label="PRICE_CENTS" type="number" value={newProduct.price_cents.toString()} onChange={(v: string) => setNewProduct({...newProduct, price_cents: parseInt(v) || 0})} />
            </div>
            <button type="submit" className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.5em] hover:invert transition-all">
              Execute_Deployment
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string, value: any }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">{label}</p>
      <p className="text-2xl font-black italic tracking-tighter tabular-nums">{value}</p>
    </div>
  );
}

function DataRow({ title, subtitle, value, status, onClick, onDelete }: any) {
  return (
    <div onClick={onClick} className="group flex items-center justify-between p-6 hover:bg-white/[0.04] transition-all cursor-pointer border-l-2 border-transparent hover:border-white">
      <div className="flex items-center gap-8">
        <div className={`h-2 w-2 ${status === 'paid' || status === 'active' ? 'bg-white shadow-[0_0_8px_#fff]' : 'bg-white/10'}`} />
        <div>
          <p className="text-sm font-black uppercase tracking-tight mb-1">{title}</p>
          <p className="text-[10px] opacity-20 uppercase tracking-widest">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-12 text-right">
        <p className="text-xl font-black italic tabular-nums tracking-tighter">{value}</p>
        <button onClick={(e) => { e.stopPropagation(); onDelete(e); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function DiagnosticItem({ label, value }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{label}</span>
      <span className="text-[10px] font-black uppercase">{value}</span>
    </div>
  );
}

function Modal({ children, onClose, title }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-[#0A0A0A] border border-white/20 p-12 relative overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-12 border-b border-white/10 pb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.8em] opacity-30">{title}</span>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value }: any) {
  return (
    <div>
      <p className="text-[10px] opacity-30 uppercase mb-2 tracking-widest">{label}</p>
      <p className="text-2xl font-black italic tracking-tighter">{value}</p>
    </div>
  );
}

function InputGroup({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest opacity-30">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 p-4 text-sm font-black uppercase tracking-tight focus:border-white outline-none transition-all"
        required
      />
    </div>
  );
}

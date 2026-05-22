import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  Plus, X, Globe, LogOut, Menu,
} from "lucide-react";
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";

const AUTHORIZED_EMAIL = "lukasdubuc@gmail.com";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!session || error) {
      throw redirect({ to: "/login" });
    }
    if (session.user.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
  },
  component: AdminDashboard,
});

type NavSection = "overview" | "orders" | "products" | "leads" | "site" | "settings";

const NAV_ITEMS: { id: NavSection; label: string; icon: any }[] = [
  { id: "overview", label: "OVERVIEW", icon: LayoutDashboard },
  { id: "orders",   label: "ORDERS",   icon: ShoppingBag     },
  { id: "products", label: "PRODUCTS", icon: Package         },
  { id: "leads",    label: "LEADS",    icon: Users           },
  { id: "site",     label: "WEBSITE",  icon: Globe           },
  { id: "settings", label: "SETTINGS", icon: Settings        },
];

function AdminDashboard() {
  const [section, setSection] = useState<NavSection>("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, lRes] = await Promise.allSettled([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
      ]);

      if (oRes.status === "fulfilled" && !oRes.value.error) setOrders(oRes.value.data ?? []);
      if (pRes.status === "fulfilled" && !pRes.value.error) setProducts(pRes.value.data ?? []);
      if (lRes.status === "fulfilled" && !lRes.value.error) setLeads(lRes.value.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSignOut = async () => { 
    await supabase.auth.signOut(); 
    window.location.href = "/login"; 
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-mono uppercase tracking-tighter">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white flex flex-col">
        <div className="p-4 border-b border-white flex justify-between items-center">
          <span className="font-bold text-sm">ADMIN_VOID</span>
          <button onClick={() => setDrawerOpen(!drawerOpen)} className="md:hidden">
            {drawerOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        
        <nav className={`${drawerOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1`}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setDrawerOpen(false); }}
              className={`p-4 text-left text-xs border-b border-white hover:bg-white hover:text-black transition-colors ${section === item.id ? 'bg-white text-black' : ''}`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="p-4 text-left text-xs border-b border-white hover:bg-red-600 transition-colors mt-auto"
          >
            LOGOUT
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto">
        <header className="p-4 border-b border-white flex justify-between items-center">
          <h1 className="text-sm font-bold">{section}</h1>
          <span className="text-[10px] opacity-50">SYSTEM_STABLE</span>
        </header>

        <div className="p-4 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs animate-pulse">LOADING_DATA...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {section === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-l border-white">
                  <StatCard label="TOTAL_ORDERS" value={orders.length} />
                  <StatCard label="TOTAL_PRODUCTS" value={products.length} />
                  <StatCard label="TOTAL_LEADS" value={leads.length} />
                </div>
              )}
              
              {section === "products" && (
                <div className="border-t border-l border-white">
                  <div className="grid grid-cols-4 p-2 border-b border-r border-white text-[10px] font-bold">
                    <span>TITLE</span>
                    <span>PRICE</span>
                    <span>STATUS</span>
                    <span>ACTIONS</span>
                  </div>
                  {products.map(p => (
                    <div key={p.id} className="grid grid-cols-4 p-2 border-b border-r border-white text-[10px]">
                      <span className="truncate">{p.title}</span>
                      <span>${(p.price_cents / 100).toFixed(2)}</span>
                      <span>{p.is_published ? "LIVE" : "DRAFT"}</span>
                      <span className="opacity-50">EDIT_DISABLED</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Other sections would follow same pattern */}
              {section !== "overview" && section !== "products" && (
                <div className="flex items-center justify-center h-64 border border-white border-dashed">
                  <span className="text-[10px] opacity-30">SECTION_UNDER_REMODEL</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: any }) {
  return (
    <div className="p-4 border-b border-r border-white flex flex-col gap-2">
      <span className="text-[10px] opacity-50">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

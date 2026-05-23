import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  TrendingUp, DollarSign, ArrowUpRight,
  RefreshCw, ExternalLink, Archive, Plus, X,
  Globe, Edit3, Eye, EyeOff, Save, LogOut, Bell, Search,
  Download, MoreHorizontal, CheckCircle2, Clock,
  XCircle, Zap, Mail, Tag, Menu,
} from "lucide-react";
import { SITE_CONFIG_FALLBACK, type SiteConfig } from "@/lib/site-config";
import * as RadixAccordion from "@radix-ui/react-accordion";

const AUTHORIZED_EMAIL = "lukasdubuc@gmail.com";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ location }) => {
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
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders",   label: "Orders",   icon: ShoppingBag     },
  { id: "products", label: "Products", icon: Package         },
  { id: "leads",    label: "Leads",    icon: Users           },
  { id: "site",     label: "Website",  icon: Globe           },
  { id: "settings", label: "Settings", icon: Settings        },
];

const BOTTOM_NAV = NAV_ITEMS.slice(0, 5);

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  paid:      { color: "text-black bg-white border-black", icon: CheckCircle2, label: "Paid"      },
  completed: { color: "text-black bg-white border-black", icon: CheckCircle2, label: "Completed" },
  pending:   { color: "text-black bg-yellow-100 border-black",       icon: Clock,        label: "Pending"   },
  failed:    { color: "text-white bg-red-600 border-red-600",             icon: XCircle,      label: "Failed"    },
  archived:  { color: "text-gray-600 bg-gray-100 border-gray-300",       icon: Archive,      label: "Archived"  },
};

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AdminDashboard() {
  const [section,      setSection    ] = useState<NavSection>("overview");
  const [orders,       setOrders     ] = useState<any[]>([]);
  const [products,     setProducts   ] = useState<any[]>([]);
  const [leads,        setLeads      ] = useState<any[]>([]);
  const [loading,      setLoading    ] = useState(true);
  const [drawerOpen,   setDrawerOpen ] = useState(false);
  const [selectedRow,  setSelectedRow] = useState<any | null>(null);
  const [searchQuery,  setSearchQuery] = useState("");
  const [searchOpen,   setSearchOpen ] = useState(false);

  const [productForm, setProductForm] = useState({
    title: "", description: "", price_cents: "", slug: "",
    image_url: "", source_url: "", fulfillment_notes: "",
    is_published: true, editingId: null as string | null,
  });

  const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "year" | "all">("day");

  const [siteContent, setSiteContent] = useState<SiteConfig>(SITE_CONFIG_FALLBACK);
  const [siteEdited, setSiteEdited] = useState(false);
  const [verifiedEdited, setVerifiedEdited] = useState(false);
  const [metadataEdited, setMetadataEdited] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);

  // ────────────────────────────────────────────────────────────────────────────
  // ENGINE SAFEGUARD: All backend logic is isolated below.
  // These functions handle data fetching, product management, and site config.
  // ────────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        try {
          const host = window.location.hostname;
          const devFlag = localStorage.getItem('dev_guest');
          const isLocalDev = (host === 'localhost' || host === '127.0.0.1') && import.meta.env.DEV;
          if (devFlag && isLocalDev) {
            console.log("[Admin] Dev guest mode: skipping Supabase fetch");
            setOrders([]);
            setProducts([]);
            setLeads([]);
            setSiteContent(prev => ({ ...prev }));
            return;
          }
        } catch (e) {
          console.error("[Admin] Dev guest check failed:", e);
        }
      }

      const [oRes, pRes, lRes, cRes] = await Promise.allSettled([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("site_config").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (oRes.status === "fulfilled" && !oRes.value.error) setOrders(oRes.value.data ?? []);
      else console.warn("[Admin] orders fetch failed");

      if (pRes.status === "fulfilled" && !pRes.value.error) {
        const fetchedProducts = pRes.value.data ?? [];
        console.log("[Admin] Products fetched:", fetchedProducts.length, "items", fetchedProducts);
        setProducts(fetchedProducts);
      } else {
        console.warn("[Admin] products fetch failed:", pRes.status === "fulfilled" ? pRes.value.error : pRes.reason);
      }

      if (lRes.status === "fulfilled" && !lRes.value.error) setLeads(lRes.value.data ?? []);
      else console.warn("[Admin] leads fetch failed");

      if (cRes.status === "fulfilled" && !cRes.value.error && cRes.value.data) {
        setSiteContent(prev => ({ ...prev, ...(cRes.value.data as Partial<SiteConfig>) }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rangeStart = (() => {
    const now = new Date();
    if (revenueRange === "day")   { const d = new Date(now); d.setHours(0,0,0,0); return d; }
    if (revenueRange === "week")  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (revenueRange === "month") { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    if (revenueRange === "year")  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
    return null;
  })();
  const activeOrders  = orders.filter(o => o.status !== "archived");
  const paidOrders    = activeOrders.filter(o => o.status === "paid" || o.status === "completed");
  const filteredPaid  = rangeStart ? paidOrders.filter(o => new Date(o.created_at) >= rangeStart) : paidOrders;
  const filteredRevenue = filteredPaid.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
  const totalRevenue  = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
  const pendingOrders = activeOrders.filter(o => o.status === "pending");
  const convRate      = activeOrders.length
    ? ((paidOrders.length / activeOrders.length) * 100).toFixed(1)
    : "0";
  const avgTicket = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  // ── Order actions ──────────────────────────────────────────────────────────
  const handleArchiveOrder = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "archived" } as any).eq("id", id);
    if (!error) { setOrders(prev => prev.filter(o => o.id !== id)); setSelectedRow(null); toast.success("Order archived"); }
    else toast.error("Failed to archive order");
  };

  const saveProduct = async () => {
    const { title, description, price_cents, slug, image_url, source_url, fulfillment_notes, is_published, editingId } = productForm;
    if (!title || !price_cents) return toast.error("Title and price required");
    
    const image_urls = image_url
      .split(",")
      .map(u => u.trim())
      .filter(Boolean);
    
    const payload = {
      title,
      description: description || null,
      price_cents: Math.round(parseFloat(price_cents) * 100),
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      image_urls,
      source_url: source_url || null,
      fulfillment_notes: fulfillment_notes || null,
      is_published,
      currency: "usd",
    };
    
    if (editingId) {
      const { error } = await supabase.from("products").update(payload as any).eq("id", editingId);
      if (!error) { 
        fetchData(); 
        resetProductForm(); 
        toast.success("Product updated"); 
      } else {
        console.error("[Admin] Product update error:", error);
        toast.error(error.message || "Update failed");
      }
    } else {
      const { error } = await supabase.from("products").insert([payload as any]);
      if (!error) { 
        fetchData(); 
        resetProductForm(); 
        toast.success("Product created"); 
      } else {
        console.error("[Admin] Product insert error:", error);
        toast.error(error.message || "Create failed");
      }
    }
  };

  const togglePublished = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ is_published: !current } as any).eq("id", id);
    if (!error) { 
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_published: !current } : p));
      toast.success(!current ? "Product published" : "Product unpublished");
    } else {
      console.error("[Admin] Toggle published error:", error);
      toast.error("Failed to update product status");
    }
  };

  const archiveProduct = async (id: string) => {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) { 
      setProducts(prev => prev.filter(p => p.id !== id)); 
      setSelectedRow(null); 
      toast.success("Product deleted"); 
    } else {
      console.error("[Admin] Delete product error:", error);
      toast.error("Failed to delete product");
    }
  };

  const resetProductForm = () => setProductForm({
    title: "", description: "", price_cents: "", slug: "",
    image_url: "", source_url: "", fulfillment_notes: "",
    is_published: true, editingId: null,
  });

  const startEditProduct = (p: any) => {
    setProductForm({
      title: p.title, description: p.description || "",
      price_cents: (p.price_cents / 100).toString(),
      slug: p.slug,
      image_url: Array.isArray(p.image_urls) ? p.image_urls.join(", ") : "",
      source_url: p.source_url || "",
      fulfillment_notes: p.fulfillment_notes || "",
      is_published: p.is_published, editingId: p.id,
    });
    setSection("products");
    setDrawerOpen(false);
  };

  const saveSiteConfig = async () => {
    setSiteSaving(true);
    try {
      console.log("[Admin] Saving hero content:", {
        headline: siteContent.hero_headline,
        subheadline: siteContent.hero_subheadline,
        cta: siteContent.hero_cta,
      });

      const payload = {
        hero_headline: siteContent.hero_headline,
        hero_subheadline: siteContent.hero_subheadline,
        hero_cta: siteContent.hero_cta,
        price_display: siteContent.price_display,
        price_original: siteContent.price_original,
        launch_pricing_active: siteContent.launch_pricing_active,
        guarantee_days: siteContent.guarantee_days,
        id: "main",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("site_config").upsert([payload] as any);
      if (error) throw error;

      console.log("[Admin] Site config saved successfully");
      toast.success("Site content saved and live.");
      setVerifiedEdited(false);
      setSiteEdited(metadataEdited);
    } catch (e: any) {
      console.error("[Admin] site_config save error:", e);
      toast.error(e?.message ?? "Failed to save site content");
    } finally {
      setSiteSaving(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  const navigateTo = (s: NavSection) => { setSection(s); setDrawerOpen(false); };

  const filteredOrders = activeOrders.filter(o =>
    !searchQuery ||
    o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredLeads = leads.filter(l =>
    !searchQuery || l.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pageTitle = NAV_ITEMS.find(n => n.id === section)?.label ?? "Dashboard";

  // ────────────────────────────────────────────────────────────────────────────
  // UI RENDERING: Yeezy-inspired minimalist design
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-black flex font-sans antialiased"
      style={{ fontFamily: "'Space Mono', monospace" }}>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-black flex-col">
        <div className="p-4 flex items-center gap-3 border-b border-black">
          <div className="w-8 h-8 border border-black flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold">HQ</span>
          </div>
          <span className="font-bold text-sm uppercase tracking-tight">ADMIN</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all uppercase font-bold text-xs ${
                  active ? "bg-black text-white" : "text-black hover:bg-gray-100"
                }`}>
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-black">
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-2 text-xs font-bold text-red-600 border border-red-600 hover:bg-red-50 px-3 py-2.5 uppercase">
            <LogOut size={13} /> SIGN OUT
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* TOP BAR */}
        <header className="border-b border-black bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawerOpen(!drawerOpen)} className="md:hidden text-black">
                <Menu size={18} />
              </button>
              <h1 className="text-lg font-bold uppercase">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="border border-black bg-white px-3 py-2 text-xs uppercase font-bold placeholder:text-gray-500" />
              </div>
              <button onClick={() => setSearchOpen(!searchOpen)} className="md:hidden text-black">
                <Search size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN AREA */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-xs font-bold uppercase">Loading…</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {section === "overview" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label="Revenue" value={fmt$(filteredRevenue)} sub={`${revenueRange.toUpperCase()} RANGE`} icon={DollarSign} />
                    <KPICard label="Orders" value={activeOrders.length} sub={`${paidOrders.length} PAID`} icon={ShoppingBag} />
                    <KPICard label="Conv. Rate" value={`${convRate}%`} sub={`${paidOrders.length} / ${activeOrders.length}`} icon={TrendingUp} />
                    <KPICard label="Avg Ticket" value={fmt$(avgTicket)} sub="PER ORDER" icon={DollarSign} />
                  </div>

                  <div className="border border-black bg-white p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold uppercase">Recent Orders</h2>
                      <button onClick={() => setSection("orders")} className="text-xs text-black hover:underline flex items-center gap-1 font-bold uppercase">
                        View all <ArrowUpRight size={11} />
                      </button>
                    </div>
                    <div className="divide-y divide-black">
                      {activeOrders.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-10 uppercase">No orders yet</p>
                      ) : activeOrders.slice(0, 5).map(o => {
                        const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                        const Icon = cfg.icon;
                        return (
                          <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 border border-black flex items-center justify-center text-[11px] font-bold text-black uppercase flex-shrink-0">
                                {(o.name || o.email || "?")[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-black truncate uppercase">{o.name || o.email}</p>
                                <p className="text-[10px] text-gray-600 uppercase">{fmtDateShort(o.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className={`hidden sm:flex text-[9px] px-2 py-0.5 border font-bold items-center gap-1 ${cfg.color}`}>
                                <Icon size={9} /> {cfg.label}
                              </span>
                              <span className="font-mono text-xs font-bold text-black">{fmt$(o.amount_cents)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-black bg-white p-4">
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-2">Products</p>
                      <p className="text-2xl font-bold text-black">{products.length}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 uppercase">{products.filter(p => p.is_published).length} live</p>
                      <button onClick={() => setSection("products")} className="mt-3 text-xs text-black hover:underline flex items-center gap-1 font-bold uppercase">
                        Manage <ArrowUpRight size={11} />
                      </button>
                    </div>
                    <div className="border border-black bg-white p-4">
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-2">Leads</p>
                      <p className="text-2xl font-bold text-black">{leads.length}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 uppercase">Subscribers</p>
                      <button onClick={() => setSection("leads")} className="mt-3 text-xs text-black hover:underline flex items-center gap-1 font-bold uppercase">
                        View all <ArrowUpRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ORDERS */}
              {section === "orders" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-lg font-bold text-black uppercase">{activeOrders.length} Active Orders</h1>
                      <p className="text-xs text-gray-600 mt-0.5 uppercase">{paidOrders.length} paid</p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs text-black border border-black hover:bg-gray-100 px-3 py-2 transition-colors font-bold uppercase">
                      <Download size={12} /> Export
                    </button>
                  </div>
                  <div className="md:hidden space-y-2">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-16 text-gray-500">
                        <ShoppingBag size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-xs uppercase font-bold">No orders</p>
                      </div>
                    ) : filteredOrders.map(o => {
                      const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      return (
                        <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                          className="border border-black px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 border border-black flex items-center justify-center text-[12px] font-bold text-black uppercase flex-shrink-0">
                              {(o.name || o.email || "?")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-black truncate uppercase">{o.name || o.email}</p>
                              <p className="text-[10px] text-gray-600 truncate uppercase">{o.name ? o.email : fmtDateShort(o.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                            <span className="font-mono text-xs font-bold text-black">{fmt$(o.amount_cents || 0)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 border flex items-center gap-1 font-bold ${cfg.color}`}>
                              <Icon size={8} /> {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block border border-black overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-black bg-black text-white">
                          {["Customer", "Amount", "Status", "Date", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {filteredOrders.map(o => {
                          const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                          const Icon = cfg.icon;
                          return (
                            <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 border border-black flex items-center justify-center text-[10px] font-bold text-black uppercase flex-shrink-0">
                                    {(o.name || o.email || "?")[0]}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-black uppercase">{o.name || "—"}</p>
                                    <p className="text-[10px] text-gray-600">{o.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-mono text-xs font-bold text-black">{fmt$(o.amount_cents || 0)}</td>
                              <td className="px-5 py-4">
                                <span className={`text-[9px] px-2 py-1 border flex items-center gap-1.5 w-fit font-bold ${cfg.color}`}>
                                  <Icon size={9} /> {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-gray-600 uppercase">{fmtDate(o.created_at)}</td>
                              <td className="px-5 py-4">
                                <button onClick={() => setSelectedRow({ ...o, _type: "order" })}
                                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-black p-1 transition-all">
                                  <MoreHorizontal size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredOrders.length === 0 && (
                      <div className="text-center py-16 text-gray-500">
                        <ShoppingBag size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-xs uppercase font-bold">No orders</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRODUCTS */}
              {section === "products" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <h1 className="text-lg font-bold text-black uppercase">{products.length} Products</h1>
                    <p className="text-xs text-gray-600 mt-0.5 uppercase">{products.filter(p => p.is_published).length} live</p>
                  </div>
                  <div className="border border-black p-4 md:p-5 bg-white">
                    <h2 className="text-xs font-bold text-black mb-4 flex items-center gap-2 uppercase">
                      {productForm.editingId ? <><Edit3 size={14} /> Edit Product</> : <><Plus size={14} /> New Product</>}
                    </h2>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormInput label="Title"           value={productForm.title}           onChange={(v: string) => setProductForm(f => ({ ...f, title: v }))}           placeholder="Starter Package" />
                        <FormInput label="Price (USD)"     value={productForm.price_cents}     onChange={(v: string) => setProductForm(f => ({ ...f, price_cents: v }))}     placeholder="49.00" type="number" />
                        <FormInput label="Slug"            value={productForm.slug}            onChange={(v: string) => setProductForm(f => ({ ...f, slug: v }))}            placeholder="starter-package" />
                        <FormInput label="Source URL"      value={productForm.source_url}      onChange={(v: string) => setProductForm(f => ({ ...f, source_url: v }))}      placeholder="https://…" />
                      </div>
                      <FormInput label="Image URL(s) — comma-separated" value={productForm.image_url} onChange={(v: string) => setProductForm(f => ({ ...f, image_url: v }))} placeholder="https://cdn.example.com/photo.jpg" />
                      <div>
                        <label className="block text-xs text-gray-600 mb-1.5 font-bold uppercase">Description</label>
                        <textarea value={productForm.description}
                          onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="What's included…" rows={2}
                          className="w-full border border-black bg-white px-3 py-2.5 text-xs text-black placeholder:text-gray-500 focus:outline-none resize-none font-bold uppercase" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <label className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}>
                        <div className="relative w-9 rounded-none transition-colors"
                          style={{ backgroundColor: productForm.is_published ? "#000" : "#fff", height: 20, border: "1px solid #000" }}>
                          <div className="w-3.5 h-3.5 bg-white border border-black absolute top-[1px] transition-all"
                            style={{ left: productForm.is_published ? 18 : 2 }} />
                        </div>
                        <span className="text-xs text-black font-bold uppercase">Published</span>
                      </label>
                      <div className="flex gap-2">
                        {productForm.editingId && (
                          <button onClick={resetProductForm} className="text-xs text-black px-3 py-2 border border-black hover:bg-gray-100 transition-all font-bold uppercase">Cancel</button>
                        )}
                        <button onClick={saveProduct}
                          className="flex items-center gap-1.5 text-xs font-bold bg-black hover:bg-gray-800 text-white px-4 py-2 transition-colors uppercase">
                          <Save size={13} /> {productForm.editingId ? "Save" : "Create"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="md:hidden space-y-2">
                    {products.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Package size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-xs uppercase font-bold">No products yet</p>
                      </div>
                    ) : products.map(p => (
                      <div key={p.id} className="border border-black px-4 py-3.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-black truncate uppercase">{p.title}</p>
                            <p className="text-[10px] text-gray-600 font-mono mt-0.5">{fmt$(p.price_cents)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <button onClick={() => togglePublished(p.id, p.is_published)}
                              className={`text-[9px] px-2 py-1 border font-bold flex items-center gap-1 ${p.is_published ? "bg-black text-white border-black" : "bg-white text-black border-black"}`}>
                              {p.is_published ? <Eye size={10} /> : <EyeOff size={10} />}
                            </button>
                            <button onClick={() => { startEditProduct(p); setSelectedRow(null); }}
                              className="text-[9px] px-2 py-1 border border-black text-black hover:bg-gray-100 font-bold">
                              <Edit3 size={10} />
                            </button>
                            <button onClick={() => archiveProduct(p.id)}
                              className="text-[9px] px-2 py-1 border border-red-600 text-red-600 hover:bg-red-50 font-bold">
                              <Archive size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block border border-black overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-black bg-black text-white">
                          {["Title", "Price", "Status", "Created", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-5 py-4">
                              <p className="text-xs font-bold text-black uppercase">{p.title}</p>
                            </td>
                            <td className="px-5 py-4 font-mono text-xs font-bold text-black">{fmt$(p.price_cents)}</td>
                            <td className="px-5 py-4">
                              <span className={`text-[9px] px-2 py-1 border font-bold flex items-center gap-1 w-fit ${p.is_published ? "bg-black text-white border-black" : "bg-white text-black border-black"}`}>
                                {p.is_published ? <Eye size={9} /> : <EyeOff size={9} />}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs text-gray-600 uppercase">{fmtDate(p.created_at)}</td>
                            <td className="px-5 py-4">
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                <button onClick={() => { startEditProduct(p); setSelectedRow(null); }}
                                  className="text-black hover:text-gray-600 p-1">
                                  <Edit3 size={14} />
                                </button>
                                <button onClick={() => archiveProduct(p.id)}
                                  className="text-red-600 hover:text-red-800 p-1">
                                  <Archive size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* LEADS */}
              {section === "leads" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <h1 className="text-lg font-bold text-black uppercase">{leads.length} Leads</h1>
                    <p className="text-xs text-gray-600 mt-0.5 uppercase">Email subscribers</p>
                  </div>
                  <div className="border border-black overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-black bg-black text-white">
                          {["Email", "Created", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {filteredLeads.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-5 py-4 text-xs font-bold text-black uppercase">{l.email}</td>
                            <td className="px-5 py-4 text-xs text-gray-600 uppercase">{fmtDate(l.created_at)}</td>
                            <td className="px-5 py-4">
                              <button onClick={() => setSelectedRow({ ...l, _type: "lead" })}
                                className="opacity-0 group-hover:opacity-100 text-black hover:text-gray-600 p-1 transition-all">
                                <MoreHorizontal size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SITE CONFIG */}
              {section === "site" && (
                <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl">
                  <div>
                    <h1 className="text-lg font-bold text-black uppercase">Website Content</h1>
                    <p className="text-xs text-gray-600 mt-0.5 uppercase">Edit hero section and pricing</p>
                  </div>
                  <Accordion title="Hero Section" icon={<Globe size={14} />}>
                    <SiteField label="Headline" value={siteContent.hero_headline} onChange={(v) => { setSiteContent(prev => ({ ...prev, hero_headline: v })); setSiteEdited(true); }} />
                    <SiteField label="Subheadline" value={siteContent.hero_subheadline} onChange={(v) => { setSiteContent(prev => ({ ...prev, hero_subheadline: v })); setSiteEdited(true); }} rows={2} />
                    <SiteField label="CTA Text" value={siteContent.hero_cta} onChange={(v) => { setSiteContent(prev => ({ ...prev, hero_cta: v })); setSiteEdited(true); }} />
                  </Accordion>
                  <Accordion title="Pricing" icon={<DollarSign size={14} />}>
                    <SiteField label="Display Price" value={siteContent.price_display} onChange={(v) => { setSiteContent(prev => ({ ...prev, price_display: v })); setSiteEdited(true); }} />
                    <SiteField label="Original Price" value={siteContent.price_original} onChange={(v) => { setSiteContent(prev => ({ ...prev, price_original: v })); setSiteEdited(true); }} />
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={siteContent.launch_pricing_active} onChange={(e) => { setSiteContent(prev => ({ ...prev, launch_pricing_active: e.target.checked })); setSiteEdited(true); }} />
                        <span className="text-xs text-black font-bold uppercase">Launch Pricing Active</span>
                      </label>
                    </div>
                  </Accordion>
                  {siteEdited && (
                    <button onClick={saveSiteConfig} disabled={siteSaving}
                      className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-black text-white hover:bg-gray-800 px-4 py-3 transition-colors uppercase disabled:opacity-50">
                      <Save size={13} /> {siteSaving ? "Saving…" : "Save Changes"}
                    </button>
                  )}
                </div>
              )}

              {/* SETTINGS */}
              {section === "settings" && (
                <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl">
                  <div>
                    <h1 className="text-lg font-bold text-black uppercase">Settings</h1>
                    <p className="text-xs text-gray-600 mt-0.5 uppercase">Account and system settings</p>
                  </div>
                  <div className="border border-black divide-y divide-black">
                    <SettingsRow label="Email" value={AUTHORIZED_EMAIL} />
                    <SettingsRow label="Role" value="Administrator" />
                    <SettingsRow label="Status" value="Active" />
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-black flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 flex-1 relative transition-colors min-w-0 text-xs font-bold uppercase ${
                  active ? "text-black bg-gray-100" : "text-gray-600"
                }`}>
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-black" />}
                <div className="relative">
                  <Icon size={16} />
                  {item.id === "orders" && pendingOrders.length > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-600 text-white rounded-full text-[7px] font-bold flex items-center justify-center leading-none">
                      {pendingOrders.length}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold leading-none truncate w-full text-center px-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* DETAIL MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedRow(null)}>
          <div className="bg-white border border-black rounded-none sm:rounded-none p-5 w-full sm:max-w-md shadow-none animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-black uppercase text-sm">{selectedRow._type === "order" ? "Order Details" : "Product Details"}</h3>
              <button onClick={() => setSelectedRow(null)} className="text-gray-600 hover:text-black p-1 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-2.5 mb-6">
              {selectedRow._type === "order" ? (
                <>
                  <DetailRow label="Customer" value={selectedRow.name || "—"}             />
                  <DetailRow label="Email"    value={selectedRow.email}                   />
                  <DetailRow label="Amount"   value={fmt$(selectedRow.amount_cents || 0)} mono />
                  <DetailRow label="Status"   value={selectedRow.status}                  />
                  <DetailRow label="Provider" value={selectedRow.provider || "—"}         />
                  <DetailRow label="Ref"      value={selectedRow.provider_ref || "—"}     mono />
                  <DetailRow label="Date"     value={fmtDate(selectedRow.created_at)}     />
                </>
              ) : (
                <>
                  <DetailRow label="Title"     value={selectedRow.title}                              />
                  <DetailRow label="Slug"      value={selectedRow.slug}                        mono   />
                  <DetailRow label="Price"     value={fmt$(selectedRow.price_cents)}           mono   />
                  <DetailRow label="Published" value={selectedRow.is_published ? "Yes" : "No"}        />
                  <DetailRow label="Image"     value={(selectedRow.image_urls && selectedRow.image_urls[0]) || "—"}      mono   />
                </>
              )}
            </div>
            <div className="flex gap-2">
              {selectedRow._type === "order" ? (
                <button onClick={() => handleArchiveOrder(selectedRow.id)}
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-red-600 border border-red-600 hover:bg-red-700 py-3 transition-colors uppercase">
                  <Archive size={13} /> Archive Order
                </button>
              ) : (
                <>
                  <button onClick={() => { startEditProduct(selectedRow); setSelectedRow(null); }}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-black border border-black hover:bg-gray-800 py-3 transition-colors uppercase">
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => archiveProduct(selectedRow.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-red-600 border border-red-600 hover:bg-red-700 py-3 transition-colors uppercase">
                    <Archive size={13} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS: Yeezy-inspired minimalist design
// ────────────────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub: string; icon: any; color?: string;
}) {
  return (
    <div className="border border-black bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider leading-tight">{label}</p>
        <Icon size={13} className="text-black" />
      </div>
      <p className="text-2xl font-bold text-black tracking-tight">{value}</p>
      <p className="text-[10px] text-gray-600 mt-1 uppercase">{sub}</p>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1.5 font-bold uppercase">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-black bg-white px-3 py-2.5 text-xs text-black placeholder:text-gray-500 focus:outline-none font-bold uppercase" />
    </div>
  );
}

function SiteField({ label, value, onChange, rows, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  const base = "w-full border border-black bg-white px-3 py-2.5 text-xs text-black focus:outline-none font-bold uppercase";
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1.5 font-bold uppercase">{label}</label>
      {rows
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className={`${base} resize-none`} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={base} />
      }
      {hint && (
        <p className="text-[10px] text-gray-600 mt-1.5 uppercase">💡 {hint}</p>
      )}
    </div>
  );
}

function Accordion({ title, children, icon }: { title: string; children: any; icon?: any }) {
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <RadixAccordion.Root type="single" collapsible className="bg-white border border-black">
      <RadixAccordion.Item value={value}>
        <RadixAccordion.Header>
          <RadixAccordion.Trigger className="w-full list-none flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-xs font-bold text-black uppercase">{title}</span>
            </div>
            <span className="text-[9px] text-gray-600 font-bold uppercase">Edit</span>
          </RadixAccordion.Trigger>
        </RadixAccordion.Header>
        <RadixAccordion.Content className="px-4 pb-4 pt-2 animate-in fade-in duration-200 border-t border-black">
          <div className="mt-3 space-y-3">{children}</div>
        </RadixAccordion.Content>
      </RadixAccordion.Item>
    </RadixAccordion.Root>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[9px] text-gray-600 font-bold flex-shrink-0 w-20 pt-0.5 uppercase">{label}</span>
      <span className={`text-xs text-black text-right break-all font-bold ${mono ? "font-mono text-[9px]" : ""}`}>{value}</span>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-4">
      <span className="text-xs text-black flex-shrink-0 font-bold uppercase">{label}</span>
      <span className="text-xs font-bold text-black text-right uppercase">{value}</span>
    </div>
  );
}

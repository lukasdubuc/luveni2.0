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
  // beforeLoad is the STRICT gatekeeper. It runs before any component renders.
  // It is the authoritative security boundary for the entire /admin tree.
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
  paid:      { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2, label: "Paid"      },
  completed: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2, label: "Completed" },
  pending:   { color: "text-amber-400 bg-amber-400/10 border-amber-400/20",       icon: Clock,        label: "Pending"   },
  failed:    { color: "text-red-400 bg-red-400/10 border-red-400/20",             icon: XCircle,      label: "Failed"    },
  archived:  { color: "text-slate-400 bg-slate-400/10 border-slate-400/20",       icon: Archive,      label: "Archived"  },
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

  // Keep only ONE of these declarations
const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "year" | "all">("day");

const [siteContent, setSiteContent] = useState<SiteConfig>(SITE_CONFIG_FALLBACK);
const [siteEdited, setSiteEdited] = useState(false);
const [verifiedEdited, setVerifiedEdited] = useState(false);
const [metadataEdited, setMetadataEdited] = useState(false);
const [siteSaving, setSiteSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Dev guest mode: only skip for LOCAL dev, NOT for production builds
      if (typeof window !== 'undefined') {
        try {
          const host = window.location.hostname;
          const devFlag = localStorage.getItem('dev_guest');
          // Only bypass fetching if running locally WITH dev_guest flag
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
      image_urls, // Text array stored in Supabase
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

  // ── Site config save ───────────────────────────────────────────────────────
  const saveSiteConfig = async () => {
    setSiteSaving(true);
    try {
      // Log the content being saved to verify HTML preservation
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

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 flex font-sans antialiased"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-[#13151c] border-r border-white/5 flex-col">
        <div className="p-4 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Northwind HQ</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active ? "bg-violet-500/15 text-violet-300 font-medium" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}>
                <Icon size={16} className="flex-shrink-0" />
                <span>{item.label}</span>
                {item.id === "orders" && pendingOrders.length > 0 && (
                  <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      <div className="p-2 border-t border-white/5 space-y-0.5">
          <a
            href="/"
            target="_blank"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
          >
            <ExternalLink size={16} className="flex-shrink-0" />
            <span>View Site</span>
          </a>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-64 bg-[#13151c] flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Zap size={14} className="text-white" />
                </div>
                <span className="font-semibold text-sm">Northwind HQ</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-500 hover:text-white p-1 rounded transition-colors">
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button key={item.id} onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                      active ? "bg-violet-500/15 text-violet-300 font-medium" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}>
                    <Icon size={17} className="flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.id === "orders" && pendingOrders.length > 0 && (
                      <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                        {pendingOrders.length}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
          <div className="p-3 border-t border-white/5 space-y-1">
              <a
                href="/"
                target="_blank"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
              >
                <ExternalLink size={16} /> View Site
              </a>
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-white/5 bg-[#0f1117]/90 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <Menu size={18} />
            </button>
            <button onClick={fetchData}
              className="hidden md:flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Refresh data">
              <RefreshCw size={14} />
            </button>
            <h1 className="font-semibold text-sm text-white md:hidden">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(v => !v)}
              className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <Search size={16} />
            </button>
            <div className="relative hidden md:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 w-48 transition-all" />
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0">L</div>
              <span className="text-sm text-slate-300 font-medium hidden sm:block">Lukas</span>
            </div>
          </div>
        </header>

        {searchOpen && (
          <div className="md:hidden px-4 py-2 bg-[#0f1117] border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, leads…"
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading…</p>
              </div>
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {section === "overview" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="hidden md:block">
                    <h1 className="text-xl font-semibold text-white">Overview</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Your business at a glance</p>
                  </div>

                  <div className="flex gap-1 bg-white/5 border border-white/8 rounded-lg p-1 w-fit">
                    {(["day","week","month","year","all"] as const).map(r => (
                      <button key={r} onClick={() => setRevenueRange(r)}
                        className={"px-2.5 py-1 rounded text-xs font-medium transition-colors " + (revenueRange === r ? "bg-violet-500 text-white" : "text-slate-400 hover:text-white")}>
                        {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KPICard label="Revenue"    value={fmt$(filteredRevenue)}  sub={revenueRange === "all" ? "All time" : `This ${revenueRange}`}     icon={DollarSign}  color="violet"  />
                    <KPICard label="Orders"     value={paidOrders.length}   sub="Completed"    icon={ShoppingBag} color="indigo"  />
                    <KPICard label="Conversion" value={`${convRate}%`}      sub="Paid / total" icon={TrendingUp}  color="emerald" />
                    <KPICard label="Avg Ticket" value={fmt$(avgTicket)}     sub="Per order"    icon={Tag}         color="amber"   />
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                      <h2 className="font-medium text-sm text-white">Recent Orders</h2>
                      <button onClick={() => setSection("orders")} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                        View all <ArrowUpRight size={11} />
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {activeOrders.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-10">No orders yet</p>
                      ) : activeOrders.slice(0, 5).map(o => {
                        const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                        const Icon = cfg.icon;
                        return (
                          <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                            className="flex items-center justify-between px-4 py-3 hover:bg-white/3 active:bg-white/5 cursor-pointer transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-[11px] font-bold text-slate-400 uppercase flex-shrink-0">
                                {(o.name || o.email || "?")[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate">{o.name || o.email}</p>
                                <p className="text-xs text-slate-500">{fmtDateShort(o.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className={`hidden sm:flex text-[10px] px-2 py-0.5 rounded-full border items-center gap-1 ${cfg.color}`}>
                                <Icon size={9} /> {cfg.label}
                              </span>
                              <span className="font-mono text-sm font-semibold text-slate-100">{fmt$(o.amount_cents)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">Products</p>
                      <p className="text-2xl font-semibold text-white">{products.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{products.filter(p => p.is_published).length} live</p>
                      <button onClick={() => setSection("products")} className="mt-3 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                        Manage <ArrowUpRight size={11} />
                      </button>
                    </div>
                    <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">Leads</p>
                      <p className="text-2xl font-semibold text-white">{leads.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Subscribers</p>
                      <button onClick={() => setSection("leads")} className="mt-3 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
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
                      <h1 className="text-lg md:text-xl font-semibold text-white">Orders</h1>
                      <p className="text-xs md:text-sm text-slate-500 mt-0.5">{activeOrders.length} active · {paidOrders.length} paid</p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                      <Download size={12} /> Export
                    </button>
                  </div>
                  <div className="md:hidden space-y-2">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-16 text-slate-500">
                        <ShoppingBag size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No orders</p>
                      </div>
                    ) : filteredOrders.map(o => {
                      const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      return (
                        <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                          className="bg-[#13151c] border border-white/5 rounded-xl px-4 py-3.5 flex items-center justify-between active:bg-white/5 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-[12px] font-bold text-slate-400 uppercase flex-shrink-0">
                              {(o.name || o.email || "?")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{o.name || o.email}</p>
                              <p className="text-xs text-slate-500 truncate">{o.name ? o.email : fmtDateShort(o.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                            <span className="font-mono text-sm font-semibold text-slate-100">{fmt$(o.amount_cents || 0)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                              <Icon size={8} /> {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Customer", "Amount", "Status", "Date", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3">
                        {filteredOrders.map(o => {
                          const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending;
                          const Icon = cfg.icon;
                          return (
                            <tr key={o.id} className="hover:bg-white/2 transition-colors group">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-bold text-slate-400 uppercase flex-shrink-0">
                                    {(o.name || o.email || "?")[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-200">{o.name || "—"}</p>
                                    <p className="text-xs text-slate-500">{o.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-mono text-sm font-medium text-slate-200">{fmt$(o.amount_cents || 0)}</td>
                              <td className="px-5 py-4">
                                <span className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1.5 w-fit ${cfg.color}`}>
                                  <Icon size={9} /> {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-500">{fmtDate(o.created_at)}</td>
                              <td className="px-5 py-4">
                                <button onClick={() => setSelectedRow({ ...o, _type: "order" })}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white p-1 rounded transition-all">
                                  <MoreHorizontal size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredOrders.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <ShoppingBag size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No orders</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRODUCTS */}
              {section === "products" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <h1 className="text-lg md:text-xl font-semibold text-white">Products</h1>
                    <p className="text-xs md:text-sm text-slate-500 mt-0.5">{products.length} total · {products.filter(p => p.is_published).length} live</p>
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl p-4 md:p-5">
                    <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
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
                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Description</label>
                        <textarea value={productForm.description}
                          onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="What's included…" rows={2}
                          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 resize-none" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <label className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}>
                        <div className="relative w-9 rounded-full transition-colors"
                          style={{ backgroundColor: productForm.is_published ? "#8b5cf6" : "rgba(255,255,255,0.1)", height: 20 }}>
                          <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-[2px] transition-all"
                            style={{ left: productForm.is_published ? 18 : 2 }} />
                        </div>
                        <span className="text-sm text-slate-400">Published</span>
                      </label>
                      <div className="flex gap-2">
                        {productForm.editingId && (
                          <button onClick={resetProductForm} className="text-sm text-slate-400 px-3 py-2 rounded-lg border border-white/8 hover:bg-white/5 transition-all">Cancel</button>
                        )}
                        <button onClick={saveProduct}
                          className="flex items-center gap-1.5 text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 rounded-lg transition-colors">
                          <Save size={13} /> {productForm.editingId ? "Save" : "Create"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="md:hidden space-y-2">
                    {products.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Package size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No products yet</p>
                      </div>
                    ) : products.map(p => (
                      <div key={p.id} className="bg-[#13151c] border border-white/5 rounded-xl px-4 py-3.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{p.title}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{fmt$(p.price_cents)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <button onClick={() => togglePublished(p.id, p.is_published)}
                              className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 ${
                                p.is_published ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                              }`}>
                              {p.is_published ? <Eye size={9} /> : <EyeOff size={9} />}
                              {p.is_published ? "Live" : "Draft"}
                            </button>
                            <button onClick={() => setSelectedRow({ ...p, _type: "product" })}
                              className="text-slate-500 hover:text-white p-1 rounded transition-colors">
                              <MoreHorizontal size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Product", "Price", "Status", "Image", "Created", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-white/2 transition-colors group">
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-200">{p.title}</p>
                              <p className="text-xs text-slate-500">{p.slug}</p>
                            </td>
                            <td className="px-5 py-4 font-mono text-sm text-slate-200">{fmt$(p.price_cents)}</td>
                            <td className="px-5 py-4">
                              <button onClick={() => togglePublished(p.id, p.is_published)}
                                className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1.5 w-fit transition-colors ${
                                  p.is_published ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-slate-400 bg-slate-400/10 border-slate-400/20"
                                }`}>
                                {p.is_published ? <Eye size={9} /> : <EyeOff size={9} />}
                                {p.is_published ? "Live" : "Draft"}
                              </button>
                            </td>
                            <td className="px-5 py-4">{Array.isArray(p.image_urls) && p.image_urls[0] ? <img src={p.image_urls[0]} alt="" className="h-9 w-9 object-cover rounded border border-white/10" /> : <span className="text-xs text-slate-600">—</span>}</td>
                            <td className="px-5 py-4 text-sm text-slate-500">{fmtDate(p.created_at)}</td>
                            <td className="px-5 py-4">
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                <button onClick={() => startEditProduct(p)} className="text-slate-500 hover:text-violet-400 p-1 rounded transition-colors"><Edit3 size={13} /></button>
                                <button onClick={() => setSelectedRow({ ...p, _type: "product" })} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"><Archive size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {products.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <Package size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No products yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LEADS */}
              {section === "leads" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-lg md:text-xl font-semibold text-white">Email Leads</h1>
                      <p className="text-xs md:text-sm text-slate-500 mt-0.5">{leads.length} subscribers</p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                      <Download size={12} /> Export
                    </button>
                  </div>
                  <div className="md:hidden space-y-2">
                    {filteredLeads.length === 0 ? (
                      <div className="text-center py-16 text-slate-500">
                        <Users size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No leads yet</p>
                      </div>
                    ) : filteredLeads.map(l => (
                      <div key={l.id} className="bg-[#13151c] border border-white/5 rounded-xl px-4 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
                            <Mail size={13} className="text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-200 truncate">{l.email}</p>
                            <p className="text-xs text-slate-500 capitalize">{l.source || "homepage"}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{fmtDateShort(l.created_at)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Email", "Source", "Date", "Metadata"].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3">
                        {filteredLeads.map(l => (
                          <tr key={l.id} className="hover:bg-white/2 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <Mail size={13} className="text-slate-500" />
                                <span className="text-sm text-slate-200">{l.email}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-400 capitalize">{l.source || "homepage"}</td>
                            <td className="px-5 py-3 text-sm text-slate-500">{fmtDate(l.created_at)}</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-600 truncate max-w-[180px]">
                              {l.metadata ? JSON.stringify(l.metadata).slice(0, 50) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredLeads.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <Users size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No leads yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SITE */}
              {section === "site" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-lg md:text-xl font-semibold text-white">Website</h1>
                      <p className="text-xs md:text-sm text-slate-500 mt-0.5">Edit live site content</p>
                    </div>
                    <div className="flex items-center gap-2">
                    <a
                      href="/"
                      target="_blank"
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink size={12} /> Preview
                    </a>
                    {siteEdited && (
                      <button 
                        onClick={saveSiteConfig} 
                        disabled={siteSaving}
                        className="flex items-center gap-1.5 text-xs font-medium bg-violet-500 hover:bg-violet-400 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Save size={12} /> {siteSaving ? "Saving…" : "Save & Publish"}
                      </button>
                    )}
                  </div>
                  </div>

                  <Accordion title="Hero Section" icon={<Edit3 size={14} />}>
                    <div className="space-y-4">
                      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3">
                        <p className="text-xs text-indigo-300 font-medium">💡 HTML Support Enabled</p>
                        <p className="text-xs text-indigo-200 mt-1">Enter HTML to style text. Example for purple words:</p>
                        <code className="text-[11px] text-indigo-100 block mt-1.5 font-mono bg-indigo-950/50 p-2 rounded border border-indigo-500/20">
                          {"Build <span class='text-gradient'>your dream</span> today"}
                        </code>
                        <p className="text-xs text-indigo-200 mt-1.5">Other options: &lt;strong&gt;bold&lt;/strong&gt;, &lt;em&gt;italic&lt;/em&gt;</p>
                      </div>

                      <SiteField
                        label="Headline"
                        value={siteContent.hero_headline}
                        rows={2}
                        onChange={(v: string) => { setSiteContent(s => ({ ...s, hero_headline: v })); setVerifiedEdited(true); setSiteEdited(true); }}
                        hint="Renders as HTML with class support (text-gradient = purple effect)"
                      />
                      <SiteField
                        label="Subheadline"
                        value={siteContent.hero_subheadline}
                        rows={2}
                        onChange={(v: string) => { setSiteContent(s => ({ ...s, hero_subheadline: v })); setVerifiedEdited(true); setSiteEdited(true); }}
                        hint="Renders as HTML with full tag support"
                      />
                      <SiteField
                        label="CTA Button"
                        value={siteContent.hero_cta}
                        onChange={(v: string) => { setSiteContent(s => ({ ...s, hero_cta: v })); setVerifiedEdited(true); setSiteEdited(true); }}
                      />
                    </div>
                  </Accordion>

                  <Accordion title="Pricing" icon={<Tag size={14} />}>
                    <div className="grid grid-cols-2 gap-3">
                      <SiteField
                        label="Display Price"
                        value={siteContent.price_display}
                        onChange={(v: string) => { setSiteContent(s => ({ ...s, price_display: v })); setSiteEdited(true); }}
                      />
                      <SiteField
                        label="Original Price"
                        value={siteContent.price_original}
                        onChange={(v: string) => { setSiteContent(s => ({ ...s, price_original: v })); setSiteEdited(true); }}
                      />
                    </div>
                    <SiteField
                      label="Guarantee (days)"
                      value={siteContent.guarantee_days}
                      onChange={(v: string) => { setSiteContent(s => ({ ...s, guarantee_days: v })); setSiteEdited(true); }}
                    />
                    <div className="flex items-center justify-between py-2.5 px-3 bg-white/3 rounded-lg">
                      <span className="text-sm text-slate-300">Launch Pricing Active</span>
                      <button
                        onClick={() => { setSiteContent(s => ({ ...s, launch_pricing_active: !s.launch_pricing_active })); setSiteEdited(true); }}
                        className="relative w-10 rounded-full flex-shrink-0 transition-colors"
                        style={{
                          backgroundColor: siteContent.launch_pricing_active ? "#8b5cf6" : "rgba(255,255,255,0.1)",
                          height: 22,
                        }}
                      >
                        <div
                          className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all"
                          style={{ left: siteContent.launch_pricing_active ? 22 : 3 }}
                        />
                      </button>
                    </div>
                  </Accordion>

                  <Accordion title="Newsletter" icon={<Mail size={14} />}>
                    <SiteField
                      label="Title"
                      value={siteContent.metadata?.newsletter_title ?? ""}
                      onChange={(v: string) => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_title: v } })); setSiteEdited(true); }}
                    />
                    <SiteField
                      label="Subtitle"
                      value={siteContent.metadata?.newsletter_subtitle ?? ""}
                      rows={2}
                      onChange={(v: string) => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_subtitle: v } })); setSiteEdited(true); }}
                    />
                    <SiteField
                      label="Button Text"
                      value={siteContent.metadata?.newsletter_button_text ?? ""}
                      onChange={(v: string) => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_button_text: v } })); setSiteEdited(true); }}
                    />
                  </Accordion>

                  <Accordion title="Footer" icon={<Settings size={14} />}>
                    <SiteField
                      label="Footer Description"
                      value={siteContent.metadata?.footer_description ?? ""}
                      rows={2}
                      onChange={(v: string) => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, footer_description: v } })); setSiteEdited(true); }}
                    />
                  </Accordion>

                  {/* Inline reminder — replaced the dead-end warning with an actionable note */}
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-start gap-3">
                    <Bell size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-300/80 leading-relaxed">
                      Changes are saved to the <code className="font-mono text-emerald-300 bg-emerald-300/10 px-1 rounded">site_config</code> table
                      and go live immediately. Your public site reads this table on every page load.
                    </p>
                  </div>
                </div>
              )}

              {/* SETTINGS */}
              {section === "settings" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div>
                    <h1 className="text-lg md:text-xl font-semibold text-white">Settings</h1>
                    <p className="text-xs md:text-sm text-slate-500 mt-0.5">Account & application</p>
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl divide-y divide-white/5">
                    <SettingsRow label="Admin Email" value={AUTHORIZED_EMAIL}      />
                    <SettingsRow label="Auth"        value="Google OAuth + Email"  />
                    <SettingsRow label="Database"    value="Supabase (PostgreSQL)" />
                    <SettingsRow label="Payments"    value="Stripe"                />
                    <SettingsRow label="Deployment"  value="Cloudflare Workers"    />
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Danger Zone</p>
                    <button onClick={handleSignOut}
                      className="flex items-center justify-center gap-2 text-sm text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 px-4 py-2.5 rounded-lg transition-colors w-full">
                      <LogOut size={13} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#13151c]/95 backdrop-blur border-t border-white/8 flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 flex-1 relative transition-colors min-w-0 ${
                  active ? "text-violet-400" : "text-slate-500"
                }`}>
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-violet-400 rounded-full" />}
                <div className="relative">
                  <Icon size={19} />
                  {item.id === "orders" && pendingOrders.length > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-bold text-black flex items-center justify-center leading-none">
                      {pendingOrders.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none truncate w-full text-center px-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* DETAIL MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedRow(null)}>
          <div className="bg-[#13151c] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{selectedRow._type === "order" ? "Order Details" : "Product Details"}</h3>
              <button onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white p-1 rounded transition-colors"><X size={16} /></button>
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
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 py-3 rounded-xl transition-colors">
                  <Archive size={13} /> Archive Order
                </button>
              ) : (
                <>
                  <button onClick={() => { startEditProduct(selectedRow); setSelectedRow(null); }}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-violet-400 border border-violet-400/20 bg-violet-400/5 hover:bg-violet-400/10 py-3 rounded-xl transition-colors">
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => archiveProduct(selectedRow.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 py-3 rounded-xl transition-colors">
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

// SUB-COMPONENTS

function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub: string; icon: any; color: string;
}) {
  const border: Record<string, string> = {
    violet: "border-violet-500/15", indigo: "border-indigo-500/15",
    emerald: "border-emerald-500/15", amber: "border-amber-500/15",
  };
  const iconCol: Record<string, string> = {
    violet: "text-violet-400", indigo: "text-indigo-400",
    emerald: "text-emerald-400", amber: "text-amber-400",
  };
  return (
    <div className={`bg-[#13151c] border ${border[color]} rounded-xl p-3.5 md:p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider leading-tight">{label}</p>
        <Icon size={13} className={iconCol[color]} />
      </div>
      <p className="text-xl md:text-2xl font-semibold text-white tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors" />
    </div>
  );
}

function SiteField({ label, value, onChange, rows, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  const base = "w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors";
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      {rows
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className={`${base} resize-none`} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={base} />
      }
      {hint && (
        <p className="text-[11px] text-slate-400 mt-1.5">💡 {hint}</p>
      )}
    </div>
  );
}

function Accordion({ title, children, icon }: { title: string; children: any; icon?: any }) {
  const value = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <RadixAccordion.Root type="single" collapsible className="bg-[#13151c] border border-white/5 rounded-xl">
      <RadixAccordion.Item value={value}>
        <RadixAccordion.Header>
          <RadixAccordion.Trigger className="w-full list-none flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium text-white">{title}</span>
            </div>
            <span className="text-xs text-slate-400">Edit</span>
          </RadixAccordion.Trigger>
        </RadixAccordion.Header>
        <RadixAccordion.Content className="px-4 pb-4 pt-2 animate-in fade-in duration-200">
          <div className="mt-3 space-y-3">{children}</div>
        </RadixAccordion.Content>
      </RadixAccordion.Item>
    </RadixAccordion.Root>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 font-medium flex-shrink-0 w-20 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-200 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-4">
      <span className="text-sm text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-200 text-right">{value}</span>
    </div>
  );
}

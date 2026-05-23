/**
 * @LOCK_PROTOCOL_ACTIVE
 * DO NOT MODIFY. DO NOT REFACTOR. DO NOT RE-IMPLEMENT.
 * ACCESS RESTRICTED.
 */
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
  XCircle, Zap, Mail, Tag, Menu, ChevronDown,
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

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  paid:      { color: "text-green-600", icon: CheckCircle2, label: "Paid"      },
  completed: { color: "text-green-600", icon: CheckCircle2, label: "Completed" },
  pending:   { color: "text-amber-600", icon: Clock,        label: "Pending"   },
  failed:    { color: "text-red-600",   icon: XCircle,      label: "Failed"    },
  archived:  { color: "text-gray-400",   icon: Archive,      label: "Archived"  },
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
  const [selectedRow,  setSelectedRow] = useState<any | null>(null);
  const [searchQuery,  setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    title: "", description: "", price_cents: "", slug: "",
    image_url: "", source_url: "", fulfillment_notes: "",
    is_published: true, editingId: null as string | null,
  });

  const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "year" | "all">("day");

  const [siteContent, setSiteContent] = useState<SiteConfig>(SITE_CONFIG_FALLBACK);
  const [siteEdited, setSiteEdited] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);

  // ────────────────────────────────────────────────────────────────────────────
  // ENGINE SAFEGUARD: All backend logic is isolated below.
  // ────────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email?.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
        throw new Error("Unauthorized");
      }
      setUserEmail(session.user.email);

      const [oRes, pRes, lRes, cRes] = await Promise.allSettled([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("site_config").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (oRes.status === "fulfilled" && !oRes.value.error) setOrders(oRes.value.data ?? []);
      if (pRes.status === "fulfilled" && !pRes.value.error) setProducts(pRes.value.data ?? []);
      if (lRes.status === "fulfilled" && !lRes.value.error) setLeads(lRes.value.data ?? []);
      if (cRes.status === "fulfilled" && !cRes.value.error && cRes.value.data) {
        setSiteContent(prev => ({ ...prev, ...(cRes.value.data as Partial<SiteConfig>) }));
      }
    } catch (e) {
      console.error("[Admin] Fetch error:", e);
      toast.error("Security check failed or data unavailable.");
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
  const convRate      = activeOrders.length ? ((paidOrders.length / activeOrders.length) * 100).toFixed(1) : "0";
  const avgTicket     = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  const handleArchiveOrder = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "archived" } as any).eq("id", id);
    if (!error) { setOrders(prev => prev.filter(o => o.id !== id)); setSelectedRow(null); toast.success("Order archived"); }
    else toast.error("Failed to archive order");
  };

  const saveProduct = async () => {
    const { title, description, price_cents, slug, image_url, source_url, fulfillment_notes, is_published, editingId } = productForm;
    if (!title || !price_cents) return toast.error("Title and price required");
    
    if (title.length > 200 || (description && description.length > 2000)) {
      return toast.error("Input exceeds safety limits.");
    }

    const image_urls = image_url.split(",").map(u => u.trim()).filter(Boolean);
    if (image_urls.length > 10) return toast.error("Too many images.");

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
      if (!error) { fetchData(); resetProductForm(); toast.success("Product updated"); }
      else toast.error("Update failed");
    } else {
      const { error } = await supabase.from("products").insert([payload as any]);
      if (!error) { fetchData(); resetProductForm(); toast.success("Product created"); }
      else toast.error("Create failed");
    }
  };

  const togglePublished = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ is_published: !current } as any).eq("id", id);
    if (!error) { 
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_published: !current } : p));
      toast.success(!current ? "Product published" : "Product unpublished");
    } else toast.error("Failed to update status");
  };

  const archiveProduct = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) { setProducts(prev => prev.filter(p => p.id !== id)); setSelectedRow(null); toast.success("Product deleted"); }
    else toast.error("Failed to delete product");
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
  };

  const saveSiteConfig = async () => {
    setSiteSaving(true);
    try {
      const payload = {
        hero_headline: siteContent.hero_headline,
        hero_subheadline: siteContent.hero_subheadline,
        hero_cta: siteContent.hero_cta,
        price_display: siteContent.price_display,
        price_original: siteContent.price_original,
        launch_pricing_active: siteContent.launch_pricing_active,
        guarantee_days: siteContent.guarantee_days,
        metadata: siteContent.metadata,
        id: "main",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("site_config").upsert([payload] as any);
      if (error) throw error;
      toast.success("Site content saved.");
      setSiteEdited(false);
    } catch (e: any) {
      toast.error("Failed to save site content");
    } finally {
      setSiteSaving(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const filteredOrders = activeOrders.filter(o =>
    !searchQuery || o.email?.toLowerCase().includes(searchQuery.toLowerCase()) || o.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredLeads = leads.filter(l => !searchQuery || l.email?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleNavClick = (id: NavSection) => {
    setSection(id);
    setMobileMenuOpen(false);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // UI RENDERING: Refined Navbar, Mobile Nav, Complete Tabs
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased selection:bg-black selection:text-white"
      style={{ fontFamily: "'Space Mono', monospace" }}>

      {/* TOP NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase">ADMIN</span>
          
          {/* DESKTOP NAV */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => handleNavClick(item.id)}
                className={`text-[9px] font-bold tracking-[0.12em] uppercase transition-colors ${
                  section === item.id ? "text-black" : "text-gray-300 hover:text-black"
                }`}>
                {item.label}
              </button>
            ))}
          </div>

          {/* MOBILE MENU BUTTON */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1">
            <Menu size={18} />
          </button>

          {/* SIGN OUT */}
          <button onClick={handleSignOut} className="text-[9px] font-bold tracking-[0.12em] uppercase text-red-500 hover:text-red-700 transition-colors">
            SIGN OUT
          </button>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-2 space-y-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left text-[9px] font-bold tracking-[0.12em] uppercase px-3 py-2 rounded transition-colors ${
                    section === item.id ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] animate-pulse">AUTHENTICATING…</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* OVERVIEW SECTION */}
            {section === "overview" && (
              <div className="space-y-8 sm:space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Overview</h1>
                  <div className="flex gap-1 sm:gap-2 flex-wrap">
                    {["day", "week", "month", "all"].map(r => (
                      <button key={r} onClick={() => setRevenueRange(r as any)}
                        className={`text-[8px] sm:text-[9px] font-bold uppercase px-2 sm:px-3 py-1 rounded-full transition-all ${
                          revenueRange === r ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                  <Stat label="Revenue" value={fmt$(filteredRevenue)} sub={`${revenueRange.toUpperCase()} RANGE`} />
                  <Stat label="Orders" value={activeOrders.length} sub={`${paidOrders.length} PAID`} />
                  <Stat label="Conversion" value={`${convRate}%`} sub="VISIT TO PAID" />
                  <Stat label="Avg Ticket" value={fmt$(avgTicket)} sub="PER CUSTOMER" />
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Recent Orders</h2>
                    <button onClick={() => setSection("orders")} className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.12em] hover:underline">View All</button>
                  </div>
                  <div className="space-y-px">
                    {activeOrders.slice(0, 5).map(o => (
                      <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                        className="group flex items-center justify-between py-3 sm:py-4 border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-all">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-black opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] sm:text-xs font-bold uppercase truncate">{o.name || o.email}</p>
                            <p className="text-[8px] text-gray-400 uppercase">{fmtDateShort(o.created_at)}</p>
                          </div>
                        </div>
                        <p className="text-[9px] sm:text-xs font-bold flex-shrink-0">{fmt$(o.amount_cents)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS SECTION */}
            {section === "orders" && (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Orders</h1>
                  <input type="text" placeholder="SEARCH…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="text-[9px] font-bold uppercase border-b border-black focus:outline-none pb-1 w-full sm:w-48" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[9px] sm:text-[10px]">
                    <thead>
                      <tr className="text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
                        <th className="pb-3 sm:pb-4">Customer</th>
                        <th className="pb-3 sm:pb-4">Amount</th>
                        <th className="pb-3 sm:pb-4">Status</th>
                        <th className="pb-3 sm:pb-4 hidden sm:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOrders.map(o => (
                        <tr key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })} className="group hover:bg-gray-50/50 cursor-pointer transition-all">
                          <td className="py-3 sm:py-4">
                            <p className="text-[9px] sm:text-xs font-bold uppercase truncate">{o.name || "—"}</p>
                            <p className="text-[8px] text-gray-400 uppercase truncate">{o.email}</p>
                          </td>
                          <td className="py-3 sm:py-4 text-[9px] sm:text-xs font-bold">{fmt$(o.amount_cents)}</td>
                          <td className="py-3 sm:py-4">
                            <span className={`text-[8px] font-bold uppercase px-2 py-1 rounded-full border ${STATUS_CONFIG[o.status]?.color || "text-gray-400 border-gray-100"}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 sm:py-4 text-[8px] text-gray-400 uppercase hidden sm:table-cell">{fmtDate(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PRODUCTS SECTION */}
            {section === "products" && (
              <div className="space-y-8 sm:space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Products</h1>
                  <button onClick={resetProductForm} className="text-[9px] font-bold uppercase tracking-[0.12em] bg-black text-white px-4 sm:px-6 py-2 hover:bg-gray-800 transition-all">
                    NEW PRODUCT
                  </button>
                </div>

                {/* PRODUCT FORM */}
                <div className="bg-gray-50/50 p-4 sm:p-8 space-y-6 sm:space-y-8">
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">
                    {productForm.editingId ? "Edit Product" : "Create Product"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                    <Input label="Title" value={productForm.title} onChange={v => setProductForm(f => ({ ...f, title: v }))} />
                    <Input label="Price (USD)" value={productForm.price_cents} onChange={v => setProductForm(f => ({ ...f, price_cents: v }))} type="number" />
                    <Input label="Slug" value={productForm.slug} onChange={v => setProductForm(f => ({ ...f, slug: v }))} />
                    <Input label="Source URL" value={productForm.source_url} onChange={v => setProductForm(f => ({ ...f, source_url: v }))} />
                  </div>
                  <Input label="Image URL(s)" value={productForm.image_url} onChange={v => setProductForm(f => ({ ...f, image_url: v }))} />
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold uppercase text-gray-400 tracking-[0.12em]">Description</label>
                    <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-transparent border-b border-gray-200 focus:border-black outline-none py-2 text-[9px] font-bold uppercase resize-none" rows={2} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <button onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}
                      className={`text-[9px] font-bold uppercase px-4 py-2 rounded-full border transition-all ${
                        productForm.is_published ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                      }`}>
                      {productForm.is_published ? "PUBLISHED" : "DRAFT"}
                    </button>
                    <div className="flex gap-2 sm:gap-4">
                      {productForm.editingId && <button onClick={resetProductForm} className="text-[9px] font-bold uppercase text-gray-400 hover:text-black">Cancel</button>}
                      <button onClick={saveProduct} className="text-[9px] font-bold uppercase bg-black text-white px-6 sm:px-8 py-3 hover:bg-gray-800 transition-all">
                        {productForm.editingId ? "SAVE" : "CREATE"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* PRODUCT GRID - REFINED DENSITY */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {products.map(p => (
                    <div key={p.id} className="group space-y-2">
                      <div className="aspect-square bg-white border border-gray-100 flex items-center justify-center overflow-hidden hover:border-gray-300 transition-all">
                        {p.image_urls?.[0] ? (
                          <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                        ) : (
                          <Package className="text-gray-200" size={32} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] sm:text-[9px] font-bold uppercase truncate">{p.title}</p>
                        <p className="text-[8px] text-gray-400">{fmt$(p.price_cents)}</p>
                        <div className="flex gap-1 pt-1">
                          <button onClick={() => togglePublished(p.id, p.is_published)}
                            className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${p.is_published ? "bg-green-500" : "bg-red-500"}`}
                            title={p.is_published ? "Published" : "Draft"} />
                          <button onClick={() => startEditProduct(p)} className="text-gray-300 hover:text-black transition-colors flex-shrink-0"><Edit3 size={12} /></button>
                          <button onClick={() => archiveProduct(p.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"><Archive size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WEBSITE BUILDER SECTION */}
            {section === "site" && (
              <div className="max-w-2xl space-y-8 sm:space-y-12">
                <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Website Builder</h1>
                <div className="space-y-6 sm:space-y-8">
                  {/* Hero Section */}
                  <div className="space-y-4">
                    <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Hero Section</h2>
                    <Input label="Headline" value={siteContent.hero_headline} onChange={v => { setSiteContent(s => ({ ...s, hero_headline: v })); setSiteEdited(true); }} />
                    <Input label="Subheadline" value={siteContent.hero_subheadline} onChange={v => { setSiteContent(s => ({ ...s, hero_subheadline: v })); setSiteEdited(true); }} />
                    <Input label="CTA Text" value={siteContent.hero_cta} onChange={v => { setSiteContent(s => ({ ...s, hero_cta: v })); setSiteEdited(true); }} />
                  </div>

                  {/* Pricing Section */}
                  <div className="space-y-4">
                    <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Pricing</h2>
                    <Input label="Display Price" value={siteContent.price_display} onChange={v => { setSiteContent(s => ({ ...s, price_display: v })); setSiteEdited(true); }} />
                    <Input label="Original Price" value={siteContent.price_original} onChange={v => { setSiteContent(s => ({ ...s, price_original: v })); setSiteEdited(true); }} />
                  </div>

                  {/* Newsletter Section */}
                  <div className="space-y-4">
                    <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Newsletter</h2>
                    <Input label="Title" value={siteContent.metadata?.newsletter_title || ""} onChange={v => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_title: v } })); setSiteEdited(true); }} />
                    <Input label="Subtitle" value={siteContent.metadata?.newsletter_subtitle || ""} onChange={v => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_subtitle: v } })); setSiteEdited(true); }} />
                    <Input label="Button Text" value={siteContent.metadata?.newsletter_button_text || ""} onChange={v => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, newsletter_button_text: v } })); setSiteEdited(true); }} />
                  </div>

                  {/* Footer Section */}
                  <div className="space-y-4">
                    <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Footer</h2>
                    <Input label="Description" value={siteContent.metadata?.footer_description || ""} onChange={v => { setSiteContent(s => ({ ...s, metadata: { ...s.metadata, footer_description: v } })); setSiteEdited(true); }} />
                  </div>

                  {siteEdited && (
                    <button onClick={saveSiteConfig} disabled={siteSaving}
                      className="w-full bg-black text-white text-[9px] font-bold uppercase py-3 sm:py-4 hover:bg-gray-800 transition-all disabled:opacity-50">
                      {siteSaving ? "SAVING…" : "SAVE CHANGES"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LEADS SECTION */}
            {section === "leads" && (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Leads</h1>
                  <input type="text" placeholder="SEARCH…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="text-[9px] font-bold uppercase border-b border-black focus:outline-none pb-1 w-full sm:w-48" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[9px] sm:text-[10px]">
                    <thead>
                      <tr className="text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
                        <th className="pb-3 sm:pb-4">Email</th>
                        <th className="pb-3 sm:pb-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredLeads.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-all">
                          <td className="py-3 sm:py-4 text-[9px] sm:text-xs font-bold uppercase">{l.email}</td>
                          <td className="py-3 sm:py-4 text-[8px] text-gray-400 uppercase">{fmtDate(l.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SETTINGS SECTION */}
            {section === "settings" && (
              <div className="max-w-2xl space-y-6 sm:space-y-8">
                <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">Settings</h1>

                {/* Account */}
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Account</h2>
                  <div className="bg-gray-50/50 p-4 sm:p-6 space-y-2">
                    <p className="text-[9px] text-gray-600">Signed in as</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase">{userEmail || "…"}</p>
                  </div>
                </div>

                {/* Stripe Webhook */}
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Stripe Webhook</h2>
                  <div className="bg-gray-50/50 p-4 sm:p-6 space-y-3">
                    <p className="text-[9px] text-gray-600">Point Stripe webhook at:</p>
                    <pre className="text-[8px] sm:text-[9px] bg-white border border-gray-200 p-3 overflow-x-auto font-mono">
                      {typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe-webhook
                    </pre>
                    <p className="text-[8px] text-gray-600">Listen for: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed</p>
                  </div>
                </div>

                {/* Brand & Copy */}
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">Brand & Copy</h2>
                  <div className="bg-gray-50/50 p-4 sm:p-6 space-y-2">
                    <p className="text-[9px] text-gray-600">Brand name, default offer copy and FAQ live in <code className="bg-white px-1 py-0.5 text-[8px] font-mono border border-gray-200">src/config/site.ts</code>. Edit that file to re-skin the public site.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm" onClick={() => setSelectedRow(null)} />
          <div className="relative bg-white w-full max-w-lg p-6 sm:p-12 space-y-6 sm:space-y-8 border border-gray-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-[0.12em]">Details</h3>
              <button onClick={() => setSelectedRow(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(selectedRow).map(([k, v]) => (
                k !== "_type" && (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50 gap-4">
                    <span className="text-[8px] font-bold uppercase text-gray-400 flex-shrink-0">{k}</span>
                    <span className="text-[9px] font-bold uppercase truncate text-right">{String(v)}</span>
                  </div>
                )
              ))}
            </div>
            {selectedRow._type === "order" && (
              <button onClick={() => handleArchiveOrder(selectedRow.id)}
                className="w-full py-3 sm:py-4 text-[9px] font-bold uppercase bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                ARCHIVE ORDER
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className="text-lg sm:text-2xl font-bold tracking-tighter">{value}</p>
      <p className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.12em] text-gray-300">{sub}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[8px] font-bold uppercase text-gray-400 tracking-[0.12em]">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-gray-200 focus:border-black outline-none py-2 text-[9px] font-bold uppercase transition-all" />
    </div>
  );
}

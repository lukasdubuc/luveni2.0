import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
  RefreshCw, ExternalLink, Archive, Plus, X, ChevronDown,
  Globe, Edit3, Eye, EyeOff, Save, LogOut, Bell, Search,
  Filter, Download, MoreHorizontal, CheckCircle2, Clock,
  XCircle, Zap, BarChart2, Mail, Calendar, Tag
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const authorizedEmail = "lukasdubuc@gmail.com";
    if (!session) throw redirect({ to: "/login" });
    if (session.user.email?.toLowerCase() !== authorizedEmail.toLowerCase()) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
  },
  component: AdminDashboard,
});

type NavSection = "overview" | "orders" | "products" | "leads" | "site" | "settings";

const NAV_ITEMS = [
  { id: "overview" as NavSection, label: "Overview", icon: LayoutDashboard },
  { id: "orders" as NavSection, label: "Orders", icon: ShoppingBag },
  { id: "products" as NavSection, label: "Products", icon: Package },
  { id: "leads" as NavSection, label: "Leads", icon: Users },
  { id: "site" as NavSection, label: "Website", icon: Globe },
  { id: "settings" as NavSection, label: "Settings", icon: Settings },
];

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  paid:      { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2, label: "Paid" },
  completed: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2, label: "Completed" },
  pending:   { color: "text-amber-400 bg-amber-400/10 border-amber-400/20",       icon: Clock,        label: "Pending" },
  failed:    { color: "text-red-400 bg-red-400/10 border-red-400/20",             icon: XCircle,      label: "Failed" },
  archived:  { color: "text-slate-400 bg-slate-400/10 border-slate-400/20",       icon: Archive,      label: "Archived" },
};

function fmt$(cents: number) { return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AdminDashboard() {
  const [section, setSection] = useState<NavSection>("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Product form
  const [productForm, setProductForm] = useState({
    title: "", description: "", price_cents: "", slug: "",
    stripe_price_id: "", is_published: true, editingId: null as string | null
  });
  // Site editor: placeholder fields
  const [siteContent, setSiteContent] = useState({
    hero_headline: "A simple, modern way to actually get the result you want.",
    hero_subheadline: "Everything you need to get started in one focused, no-fluff package.",
    hero_cta: "Get instant access — $49",
    price_display: "$49",
    price_original: "$129",
    launch_pricing_active: true,
    guarantee_days: "30",
  });
  const [siteEdited, setSiteEdited] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, pRes, lRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
      ]);
      setOrders(oRes.data || []);
      setProducts(pRes.data || []);
      setLeads(lRes.data || []);
    } catch {
      toast.error("Failed to sync data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeOrders  = orders.filter(o => o.status !== "archived");
  const totalRevenue  = activeOrders.reduce((a, o) => a + (o.amount_cents || 0), 0);
  const paidOrders    = activeOrders.filter(o => o.status === "paid" || o.status === "completed");
  const pendingOrders = activeOrders.filter(o => o.status === "pending");
  const convRate      = activeOrders.length ? ((paidOrders.length / activeOrders.length) * 100).toFixed(1) : "0";
  const avgTicket     = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  const handleArchiveOrder = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "archived" } as any).eq("id", id);
    if (!error) { setOrders(prev => prev.filter(o => o.id !== id)); setSelectedRow(null); toast.success("Order archived"); }
    else toast.error("Failed to archive");
  };

  const saveProduct = async () => {
    const { title, description, price_cents, slug, stripe_price_id, is_published, editingId } = productForm;
    if (!title || !price_cents) return toast.error("Title and price required");
    const payload = {
      title, description: description || null,
      price_cents: Math.round(parseFloat(price_cents) * 100),
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      stripe_price_id: stripe_price_id || null,
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
    if (!error) { setProducts(prev => prev.map(p => p.id === id ? { ...p, is_published: !current } : p)); }
  };

  const archiveProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) { setProducts(prev => prev.filter(p => p.id !== id)); setSelectedRow(null); toast.success("Product deleted"); }
    else toast.error("Failed to delete");
  };

  const resetProductForm = () => setProductForm({
    title: "", description: "", price_cents: "", slug: "",
    stripe_price_id: "", is_published: true, editingId: null
  });

  const startEditProduct = (p: any) => {
    setProductForm({
      title: p.title, description: p.description || "",
      price_cents: (p.price_cents / 100).toString(),
      slug: p.slug, stripe_price_id: p.stripe_price_id || "",
      is_published: p.is_published, editingId: p.id
    });
    setSection("products");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 flex font-sans antialiased" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── SIDEBAR ─────────────────────────────────── */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-56"} flex-shrink-0 bg-[#13151c] border-r border-white/5 flex flex-col transition-all duration-300 relative z-10`}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          {!sidebarCollapsed && <span className="font-semibold text-sm tracking-tight">Northwind HQ</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active ? "bg-violet-500/15 text-violet-300 font-medium" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}>
                <Icon size={16} className="flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.id === "orders" && pendingOrders.length > 0 && (
                  <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">{pendingOrders.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/5 space-y-0.5">
          <a href="/" target="_blank" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all">
            <ExternalLink size={16} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>View Site</span>}
          </a>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={16} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-[#0f1117]/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
              <BarChart2 size={16} />
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, products…"
                className="bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 w-56 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
              <RefreshCw size={14} />
            </button>
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-[9px] font-bold flex items-center justify-center text-white">L</div>
              <span className="text-sm text-slate-300 font-medium">Lukas</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading data…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {section === "overview" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div>
                    <h1 className="text-xl font-semibold text-white">Overview</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Your business at a glance</p>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label="Total Revenue" value={fmt$(totalRevenue)} sub="All time" icon={DollarSign} trend={+12} color="violet" />
                    <KPICard label="Total Orders" value={paidOrders.length} sub="Completed" icon={ShoppingBag} trend={+8} color="indigo" />
                    <KPICard label="Conversion" value={`${convRate}%`} sub="Paid / Total" icon={TrendingUp} trend={+3} color="emerald" />
                    <KPICard label="Avg Ticket" value={fmt$(avgTicket)} sub="Per order" icon={Tag} trend={0} color="amber" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Recent orders */}
                    <div className="lg:col-span-2 bg-[#13151c] border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-medium text-sm text-white">Recent Orders</h2>
                        <button onClick={() => setSection("orders")} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                          View all <ArrowUpRight size={12} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {activeOrders.slice(0, 6).map(o => {
                          const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                          const Icon = cfg.icon;
                          return (
                            <div key={o.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/3 transition-colors group">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                                  {(o.name || o.email || "?")[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-200">{o.name || o.email}</p>
                                  <p className="text-xs text-slate-500">{o.email !== o.name ? o.email : ""} · {fmtDate(o.created_at)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                                  <Icon size={9} /> {cfg.label}
                                </span>
                                <span className="font-mono text-sm font-medium text-slate-200">{fmt$(o.amount_cents)}</span>
                              </div>
                            </div>
                          );
                        })}
                        {activeOrders.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No orders yet</p>}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="space-y-4">
                      <div className="bg-[#13151c] border border-white/5 rounded-xl p-5">
                        <h2 className="font-medium text-sm text-white mb-4">Products</h2>
                        <div className="space-y-2">
                          {products.slice(0, 4).map(p => (
                            <div key={p.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${p.is_published ? "bg-emerald-400" : "bg-slate-500"}`} />
                                <span className="text-sm text-slate-300 truncate max-w-[120px]">{p.title}</span>
                              </div>
                              <span className="font-mono text-sm text-slate-400">{fmt$(p.price_cents)}</span>
                            </div>
                          ))}
                          {products.length === 0 && <p className="text-sm text-slate-500">No products yet</p>}
                        </div>
                      </div>
                      <div className="bg-[#13151c] border border-white/5 rounded-xl p-5">
                        <h2 className="font-medium text-sm text-white mb-3">Email Leads</h2>
                        <p className="text-3xl font-semibold text-white">{leads.length}</p>
                        <p className="text-xs text-slate-500 mt-1">Subscribers collected</p>
                        <button onClick={() => setSection("leads")} className="mt-3 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                          View leads <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ORDERS ── */}
              {section === "orders" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-white">Orders</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{activeOrders.length} active · {paidOrders.length} paid</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                        <Filter size={13} /> Filter
                      </button>
                      <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                        <Download size={13} /> Export
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Customer", "Product", "Amount", "Status", "Date", ""].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3">
                        {activeOrders.filter(o =>
                          !searchQuery || o.email?.includes(searchQuery) || o.name?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map(o => {
                          const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
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
                              <td className="px-5 py-4 text-sm text-slate-400">{o.product_id ? products.find(p => p.id === o.product_id)?.title || o.product_id.slice(0, 8) : "—"}</td>
                              <td className="px-5 py-4 font-mono text-sm font-medium text-slate-200">{fmt$(o.amount_cents || 0)}</td>
                              <td className="px-5 py-4">
                                <span className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1.5 w-fit ${cfg.color}`}>
                                  <Icon size={9} /> {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-500">{fmtDate(o.created_at)}</td>
                              <td className="px-5 py-4">
                                <button onClick={() => setSelectedRow({ ...o, _type: "order" })}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-all p-1 rounded">
                                  <MoreHorizontal size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {activeOrders.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <ShoppingBag size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No orders yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PRODUCTS ── */}
              {section === "products" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-white">Products</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{products.length} total · {products.filter(p => p.is_published).length} published</p>
                    </div>
                  </div>

                  {/* Add / Edit Form */}
                  <div className="bg-[#13151c] border border-white/5 rounded-xl p-5">
                    <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                      {productForm.editingId ? <><Edit3 size={14} /> Edit Product</> : <><Plus size={14} /> New Product</>}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <FormInput label="Title" value={productForm.title} onChange={v => setProductForm(f => ({ ...f, title: v }))} placeholder="Starter Package" />
                      <FormInput label="Price (USD)" value={productForm.price_cents} onChange={v => setProductForm(f => ({ ...f, price_cents: v }))} placeholder="49.00" type="number" />
                      <FormInput label="Stripe Price ID" value={productForm.stripe_price_id} onChange={v => setProductForm(f => ({ ...f, stripe_price_id: v }))} placeholder="price_xxxx" />
                      <FormInput label="Slug" value={productForm.slug} onChange={v => setProductForm(f => ({ ...f, slug: v }))} placeholder="starter-package" />
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Description</label>
                        <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="What's included…" rows={2}
                          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 resize-none" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}
                          className={`w-9 h-5 rounded-full transition-colors relative ${productForm.is_published ? "bg-violet-500" : "bg-white/10"}`}>
                          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${productForm.is_published ? "left-4.5" : "left-0.75"}`} style={{ top: 3, left: productForm.is_published ? 18 : 3 }} />
                        </div>
                        <span className="text-sm text-slate-400">Published</span>
                      </label>
                      <div className="ml-auto flex gap-2">
                        {productForm.editingId && (
                          <button onClick={resetProductForm} className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-white/8 hover:bg-white/5 transition-all">
                            Cancel
                          </button>
                        )}
                        <button onClick={saveProduct} className="flex items-center gap-2 text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white px-5 py-2 rounded-lg transition-colors">
                          <Save size={13} /> {productForm.editingId ? "Save Changes" : "Create Product"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Product", "Price", "Status", "Stripe ID", "Created", ""].map(h => (
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
                            <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.stripe_price_id || "—"}</td>
                            <td className="px-5 py-4 text-sm text-slate-500">{fmtDate(p.created_at)}</td>
                            <td className="px-5 py-4">
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                <button onClick={() => startEditProduct(p)} className="text-slate-500 hover:text-violet-400 transition-colors p-1 rounded">
                                  <Edit3 size={13} />
                                </button>
                                <button onClick={() => setSelectedRow({ ...p, _type: "product" })} className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded">
                                  <Archive size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {products.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <Package size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No products yet — create your first one above</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── LEADS ── */}
              {section === "leads" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-white">Email Leads</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{leads.length} subscribers</p>
                    </div>
                    <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Email", "Source", "Date", "Metadata"].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3">
                        {leads.filter(l => !searchQuery || l.email?.includes(searchQuery)).map(l => (
                          <tr key={l.id} className="hover:bg-white/2 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <Mail size={13} className="text-slate-500" />
                                <span className="text-sm text-slate-200">{l.email}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-400 capitalize">{l.source || "homepage"}</td>
                            <td className="px-5 py-3 text-sm text-slate-500">{fmtDate(l.created_at)}</td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-600 truncate max-w-[200px]">
                              {l.metadata ? JSON.stringify(l.metadata).slice(0, 60) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {leads.length === 0 && (
                      <div className="text-center py-16 text-slate-500">
                        <Users size={28} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No leads yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SITE EDITOR ── */}
              {section === "site" && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-white">Website Editor</h1>
                      <p className="text-sm text-slate-500 mt-0.5">Edit live site content</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href="/" target="_blank" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/5 border border-white/8 px-3 py-1.5 rounded-lg transition-colors">
                        <ExternalLink size={13} /> Preview
                      </a>
                      {siteEdited && (
                        <button onClick={() => { toast.success("Site content saved (wire to Supabase/CMS)"); setSiteEdited(false); }}
                          className="flex items-center gap-2 text-sm font-medium bg-violet-500 hover:bg-violet-400 text-white px-4 py-1.5 rounded-lg transition-colors">
                          <Save size={13} /> Save Changes
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#13151c] border border-white/5 rounded-xl p-5 space-y-4">
                      <h2 className="text-sm font-medium text-white flex items-center gap-2"><Edit3 size={14} /> Hero Section</h2>
                      <SiteField label="Headline" value={siteContent.hero_headline} rows={2}
                        onChange={v => { setSiteContent(s => ({ ...s, hero_headline: v })); setSiteEdited(true); }} />
                      <SiteField label="Subheadline" value={siteContent.hero_subheadline} rows={2}
                        onChange={v => { setSiteContent(s => ({ ...s, hero_subheadline: v })); setSiteEdited(true); }} />
                      <SiteField label="CTA Button Text" value={siteContent.hero_cta}
                        onChange={v => { setSiteContent(s => ({ ...s, hero_cta: v })); setSiteEdited(true); }} />
                    </div>

                    <div className="bg-[#13151c] border border-white/5 rounded-xl p-5 space-y-4">
                      <h2 className="text-sm font-medium text-white flex items-center gap-2"><Tag size={14} /> Pricing</h2>
                      <div className="grid grid-cols-2 gap-3">
                        <SiteField label="Display Price" value={siteContent.price_display}
                          onChange={v => { setSiteContent(s => ({ ...s, price_display: v })); setSiteEdited(true); }} />
                        <SiteField label="Original Price" value={siteContent.price_original}
                          onChange={v => { setSiteContent(s => ({ ...s, price_original: v })); setSiteEdited(true); }} />
                      </div>
                      <SiteField label="Guarantee Days" value={siteContent.guarantee_days}
                        onChange={v => { setSiteContent(s => ({ ...s, guarantee_days: v })); setSiteEdited(true); }} />
                      <div className="flex items-center justify-between py-2 px-3 bg-white/3 rounded-lg">
                        <span className="text-sm text-slate-300">Launch Pricing Active</span>
                        <button onClick={() => { setSiteContent(s => ({ ...s, launch_pricing_active: !s.launch_pricing_active })); setSiteEdited(true); }}
                          className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0`}
                          style={{ backgroundColor: siteContent.launch_pricing_active ? "#8b5cf6" : "#ffffff18", height: 22, width: 40 }}>
                          <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all"
                            style={{ left: siteContent.launch_pricing_active ? 22 : 3 }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex items-start gap-3">
                    <Bell size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-300/80">
                      To make site content fully dynamic, connect these fields to a <code className="font-mono text-amber-300 bg-amber-300/10 px-1 rounded">site_config</code> Supabase table. The save button above will write to that table, and the public site will read from it.
                    </p>
                  </div>
                </div>
              )}

              {/* ── SETTINGS ── */}
              {section === "settings" && (
                <div className="space-y-5 animate-in fade-in duration-300 max-w-2xl">
                  <div>
                    <h1 className="text-xl font-semibold text-white">Settings</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Account & application settings</p>
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl divide-y divide-white/5">
                    <SettingsRow label="Admin Email" value="lukasdubuc@gmail.com" />
                    <SettingsRow label="Auth Provider" value="Google OAuth + Email" />
                    <SettingsRow label="Database" value="Supabase (PostgreSQL)" />
                    <SettingsRow label="Payments" value="Stripe" />
                    <SettingsRow label="Deployment" value="Cloudflare Workers (wrangler)" />
                  </div>
                  <div className="bg-[#13151c] border border-white/5 rounded-xl p-5">
                    <h2 className="text-sm font-medium text-white mb-4">Danger Zone</h2>
                    <button onClick={handleSignOut}
                      className="flex items-center gap-2 text-sm text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 px-4 py-2 rounded-lg transition-colors">
                      <LogOut size={13} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── ROW DETAIL MODAL ── */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedRow(null)}>
          <div className="bg-[#13151c] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{selectedRow._type === "order" ? "Order Details" : "Product Details"}</h3>
              <button onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {selectedRow._type === "order" ? (
                <>
                  <DetailRow label="Customer" value={selectedRow.name || "—"} />
                  <DetailRow label="Email" value={selectedRow.email} />
                  <DetailRow label="Amount" value={fmt$(selectedRow.amount_cents || 0)} mono />
                  <DetailRow label="Status" value={selectedRow.status} />
                  <DetailRow label="Provider" value={selectedRow.provider || "—"} />
                  <DetailRow label="Provider Ref" value={selectedRow.provider_ref || "—"} mono />
                  <DetailRow label="Date" value={fmtDate(selectedRow.created_at)} />
                </>
              ) : (
                <>
                  <DetailRow label="Title" value={selectedRow.title} />
                  <DetailRow label="Slug" value={selectedRow.slug} mono />
                  <DetailRow label="Price" value={fmt$(selectedRow.price_cents)} mono />
                  <DetailRow label="Published" value={selectedRow.is_published ? "Yes" : "No"} />
                  <DetailRow label="Stripe ID" value={selectedRow.stripe_price_id || "—"} mono />
                </>
              )}
            </div>
            <div className="flex gap-2">
              {selectedRow._type === "order" ? (
                <button onClick={() => handleArchiveOrder(selectedRow.id)}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 py-2.5 rounded-lg transition-colors">
                  <Archive size={13} /> Archive Order
                </button>
              ) : (
                <>
                  <button onClick={() => { startEditProduct(selectedRow); setSelectedRow(null); }}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-violet-400 border border-violet-400/20 bg-violet-400/5 hover:bg-violet-400/10 py-2.5 rounded-lg transition-colors">
                    <Edit3 size={13} /> Edit
                  </button>
                  <button onClick={() => archiveProduct(selectedRow.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 py-2.5 rounded-lg transition-colors">
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

// ── Sub-components ──────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, trend, color }: any) {
  const colors: Record<string, string> = {
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/15",
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/15",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/15",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/15",
  };
  const iconColors: Record<string, string> = {
    violet: "text-violet-400", indigo: "text-indigo-400", emerald: "text-emerald-400", amber: "text-amber-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <Icon size={15} className={iconColors[color]} />
      </div>
      <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {trend > 0 ? <ArrowUpRight size={11} className="text-emerald-400" /> : trend < 0 ? <ArrowDownRight size={11} className="text-red-400" /> : null}
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors" />
    </div>
  );
}

function SiteField({ label, value, onChange, rows }: any) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 resize-none transition-colors" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors" />
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: any) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500 font-medium pt-0.5 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-200 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function SettingsRow({ label, value }: any) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  );
}

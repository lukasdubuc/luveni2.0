import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { toast } from "sonner";
import { Edit3, Archive, X, Menu, RefreshCw } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES & ROUTE DEFINITION
// ────────────────────────────────────────────────────────────────────────────

type SiteContent = {
  hero_headline: string;
  hero_subheadline: string;
  hero_cta: string;
  price_display: string;
  price_original: string;
  launch_pricing_active: boolean;
  guarantee_days: number;
  theme?: string;
  metadata?: any;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  image_urls: string[];
  is_published: boolean;
  description?: string;
};

type Order = {
  id: string;
  email: string;
  name?: string;
  amount_cents: number;
  status: string;
  created_at: string;
};

type Lead = {
  id: string;
  email: string;
  created_at: string;
};

type PrintfulCatalogItem = {
  id: number;
  name: string;
  thumbnail_url: string;
  sync_variants?: any[];
};

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<"overview" | "products" | "orders" | "leads" | "settings" | "site">("overview");
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Data State ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeLeads, setActiveLeads] = useState<Lead[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // ── Site Config State ───────────────────────────────────────────────────
  const [siteContent, setSiteContent] = useState<SiteContent>({
    hero_headline: "",
    hero_subheadline: "",
    hero_cta: "",
    price_display: "",
    price_original: "",
    launch_pricing_active: false,
    guarantee_days: 30,
    theme: "light",
    metadata: {},
  });
  const [siteEdited, setSiteEdited] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);

  // ── Product Form State ──────────────────────────────────────────────────
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    editingId: null as string | null,
    title: "",
    slug: "",
    price_cents: "",
    image_url: "",
    description: "",
    is_published: true,
    source_url: "",
    hasVariants: false,
    variantsText: "[]",
  });

  // ── UI State ────────────────────────────────────────────────────────────
  const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "all">("day");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Theme Detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  // ── Auth & Data Fetch ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserEmail(user.email || null);
      await fetchData();
    };
    init();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, ordersRes, leadsRes, siteRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("orders").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("site_config").select("*").eq("id", "main").single(),
      ]);

      if (productsRes.data) setProducts(productsRes.data as Product[]);
      if (ordersRes.data) setActiveOrders(ordersRes.data as Order[]);
      if (leadsRes.data) setActiveLeads(leadsRes.data as Lead[]);
      if (siteRes.data) {
        setSiteContent(prev => ({ ...prev, ...(siteRes.data as any) }));
      }
    } catch (e) {
      console.error("[Admin] Fetch error:", e);
    }
  };

  const handleSyncPrintful = async () => {
  setIsSyncing(true);

  try {
    const res = await fetch("/api/printful-sync", {
      method: "POST",
    });

    const data = await res.json();

    console.log(
      "PRINTFUL SYNC RESPONSE:",
      data
    );

    // Handle failed HTTP responses
    if (!res.ok) {
      console.error(
        "PRINTFUL SYNC FAILED:",
        data
      );

      toast.error(
        data.error ||
        data.message ||
        "Sync failed"
      );

      return;
    }

    // Show backend sync errors if present
    if (
      Array.isArray(data.errors) &&
      data.errors.length > 0
    ) {
      console.error(
        "PRINTFUL SYNC ERRORS:",
        data.errors
      );

      toast.error(data.errors[0]);

      return;
    }

    // Successful sync
    toast.success(
      `Sync complete: ${data.synced}/${data.total} products processed.`
    );

    // Refresh admin products
    await fetchData();
  } catch (e: any) {
    console.error(
      "PRINTFUL SYNC EXCEPTION:",
      e
    );

    toast.error(
      `Sync error: ${
        e?.message || "Unknown error"
      }`
    );
  } finally {
    setIsSyncing(false);
  }
};

  const saveProduct = async () => {
    try {
      const imageUrls = productForm.image_url
        .split(",")
        .map(u => u.trim())
        .filter(u => u);

      const payload = {
        title: productForm.title,
        slug: productForm.slug,
        price_cents: parseInt(productForm.price_cents) || 0,
        image_urls: imageUrls,
        description: productForm.description,
        is_published: productForm.is_published,
        source_url: productForm.source_url,
        updated_at: new Date().toISOString(),
      };

      if (productForm.editingId) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", productForm.editingId);
        if (error) throw error;
        toast.success("Product updated.");
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
        toast.success("Product created.");
      }

      resetProductForm();
      await fetchData();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    }
  };

  const togglePublished = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_published: !currentState })
        .eq("id", id);
      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      toast.error(`Toggle failed: ${e.message}`);
    }
  };

  const archiveProduct = async (id: string) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast.success("Product archived.");
      await fetchData();
    } catch (e: any) {
      toast.error(`Archive failed: ${e.message}`);
    }
  };

  const handleArchiveOrder = async (id: string) => {
    try {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      toast.success("Order archived.");
      setSelectedRow(null);
      await fetchData();
    } catch (e: any) {
      toast.error(`Archive failed: ${e.message}`);
    }
  };

  const resetProductForm = () => {
    setProductForm({
      editingId: null,
      title: "",
      slug: "",
      price_cents: "",
      image_url: "",
      description: "",
      is_published: true,
      source_url: "",
      hasVariants: false,
      variantsText: "[]",
    });
    setProductFormOpen(false);
  };

  const startEditProduct = (p: Product) => {
    setProductForm({
      editingId: p.id,
      title: p.title,
      slug: p.slug,
      price_cents: String(p.price_cents),
      image_url: (p.image_urls || []).join(", "),
      description: p.description || "",
      is_published: p.is_published,
      source_url: "",
      hasVariants: false,
      variantsText: "[]",
    });
    setProductFormOpen(true);
    setSection("products");
  };

  const saveSiteConfig = async (updatedContent: SiteContent) => {
    setSiteSaving(true);
    try {
      const payload: any = {
        id: "main",
        hero_headline: updatedContent.hero_headline || "",
        hero_subheadline: updatedContent.hero_subheadline || "",
        hero_cta: updatedContent.hero_cta || "",
        price_display: updatedContent.price_display || "",
        price_original: updatedContent.price_original || "",
        launch_pricing_active: updatedContent.launch_pricing_active ?? false,
        guarantee_days: String(updatedContent.guarantee_days || "30"),
        theme: updatedContent.theme,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("site_config")
        .update(payload)
        .eq("id", "main");
        
      if (updateError) {
        console.error("[Admin] Update failed:", updateError);
        throw updateError;
      }
      
      toast.success("Site content saved.");
      setSiteEdited(false);
    } catch (e: any) {
      console.error("[Admin] Save catch:", e);
      const msg = e.message || e.details || "Unknown error";
      toast.error(`Failed: ${msg}`);
    } finally {
      setSiteSaving(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const filteredOrders = activeOrders.filter(o =>
    o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLeads = activeLeads.filter(l =>
    l.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paidOrders = activeOrders.filter(o => o.status === "paid");
  const filteredRevenue = activeOrders
    .filter(o => {
      const date = new Date(o.created_at);
      const now = new Date();
      if (revenueRange === "day") return date.toDateString() === now.toDateString();
      if (revenueRange === "week") return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
      if (revenueRange === "month") return date.getMonth() === now.getMonth();
      return true;
    })
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const avgTicket = paidOrders.length > 0 ? filteredRevenue / paidOrders.length : 0;
  const convRate = activeOrders.length > 0 ? Math.round((paidOrders.length / activeOrders.length) * 100) : 0;

  const fmt$ = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      <nav className={`sticky top-0 z-50 md:border-b-0 ${isDark ? "md:bg-black md:border-0 border-b border-white/10 bg-black" : "md:bg-white md:border-0 border-b border-gray-100 bg-white"}`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="md:hidden text-[10px] font-bold uppercase tracking-widest">ADMIN</div>
          <div className="hidden md:flex items-center justify-center gap-8 flex-1">
            {["overview", "products", "orders", "leads", "settings"].map(s => (
              <button
                key={s}
                onClick={() => setSection(s as any)}
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                  section === s
                    ? isDark ? "text-white" : "text-black"
                    : isDark ? "text-white/50 hover:text-white/70" : "text-black/50 hover:text-black/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden">
            <Menu size={18} />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className={`md:hidden border-t ${isDark ? "border-white/10 bg-black" : "border-gray-100 bg-white"} p-4 space-y-3`}>
            {["overview", "products", "orders", "leads", "settings"].map(s => (
              <button
                key={s}
                onClick={() => {
                  setSection(s as any);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left text-[10px] font-bold uppercase tracking-widest py-2 ${
                  section === s
                    ? isDark ? "text-white" : "text-black"
                    : isDark ? "text-white/50" : "text-black/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {section === "overview" && (
          <div className="space-y-12">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Overview</h1>
            </div>
            <div className="flex gap-4">
              {["day", "week", "month", "all"].map(r => (
                <button
                  key={r}
                  onClick={() => setRevenueRange(r as any)}
                  className={`text-[9px] font-bold uppercase px-4 py-2 transition-all ${
                    revenueRange === r
                      ? isDark ? "bg-white text-black" : "bg-black text-white"
                      : isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <Stat label="Revenue" value={fmt$(filteredRevenue)} sub={`${revenueRange} period`} isDark={isDark} />
              <Stat label="Orders" value={paidOrders.length} sub="successful payments" isDark={isDark} />
              <Stat label="Avg Ticket" value={fmt$(avgTicket)} sub="per paid order" isDark={isDark} />
              <Stat label="Conv Rate" value={`${convRate}%`} sub="checkout to paid" isDark={isDark} />
            </div>
          </div>
        )}

        {section === "products" && (
          <div className="space-y-12">
            <div className="flex items-end justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Products</h1>
              <div className="flex gap-4">
                <button onClick={handleSyncPrintful} disabled={isSyncing}
                  className={`flex items-center gap-2 text-[10px] font-bold uppercase px-6 py-3 border transition-all ${
                    isDark ? "border-white/20 text-white hover:bg-white/5" : "border-black/10 text-black hover:bg-black/5"
                  }`}>
                  <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "SYNCING…" : "SYNC PRINTFUL"}
                </button>
                <button onClick={() => setProductFormOpen(!productFormOpen)}
                  className={`text-[10px] font-bold uppercase px-8 py-3 transition-all ${
                    isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                  }`}>
                  {productFormOpen ? "CLOSE" : "NEW PRODUCT"}
                </button>
              </div>
            </div>

            {productFormOpen && (
              <div className={`p-8 space-y-8 animate-in slide-in-from-top duration-300 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>
                  {productForm.editingId ? "Edit Product" : "Create Product"}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Title" value={productForm.title} onChange={v => setProductForm(f => ({ ...f, title: v }))} isDark={isDark} />
                  <Input label="Price (USD)" value={productForm.price_cents} onChange={v => setProductForm(f => ({ ...f, price_cents: v }))} type="number" isDark={isDark} />
                  <Input label="Slug" value={productForm.slug} onChange={v => setProductForm(f => ({ ...f, slug: v }))} isDark={isDark} />
                  <Input label="Source URL" value={productForm.source_url} onChange={v => setProductForm(f => ({ ...f, source_url: v }))} isDark={isDark} />
                </div>
                <Input label="Image URL(s)" value={productForm.image_url} onChange={v => setProductForm(f => ({ ...f, image_url: v }))} isDark={isDark} />
                <div className="space-y-2">
                  <label className={`text-[9px] font-bold uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>Description</label>
                  <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                    className={`w-full bg-transparent border-b focus:border-current outline-none py-2 text-xs font-bold uppercase resize-none ${
                      isDark ? "border-white/20 text-white" : "border-gray-200 text-black"
                    }`} rows={2} />
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}
                    className={`text-[10px] font-bold uppercase px-4 py-2 rounded-full border transition-all ${
                      productForm.is_published ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                    }`}>
                    {productForm.is_published ? "PUBLISHED" : "DRAFT"}
                  </button>
                  <div className="flex gap-4">
                    <button onClick={resetProductForm} className={`text-[10px] font-bold uppercase ${isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-black"}`}>Cancel</button>
                    <button onClick={saveProduct} className={`text-[10px] font-bold uppercase px-8 py-3 transition-all ${
                      isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                    }`}>
                      {productForm.editingId ? "SAVE" : "CREATE"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-12">
             {products.map(p => (
  <div key={p.id} className="group relative">
    <div className={`relative flex aspect-[2/3] items-center justify-center overflow-hidden bg-transparent p-3 sm:p-4 group-hover:scale-105 transition-all duration-300 ${
      isDark ? "bg-white/5" : "bg-gray-50/50"
    }`}>
     {/* Ignore Printful design mockup at index 0 and use first real product image */}
{p.image_urls?.[1] ? (
  <img
    src={p.image_urls[1]}
    alt={p.title || "Product"}
    className="max-h-full max-w-full object-contain"
  />
) : (
        <span className={`text-[7px] uppercase tracking-[0.3em] ${isDark ? "text-white/20" : "text-black/20"}`}>
          No Image
        </span>
      )}
    </div>
    {/* ... rest of your card ... */}
  </div>
))}
                  </div>
                  <div className="px-2 text-center">
                    <p className={`mb-1 text-[9px] uppercase leading-tight tracking-[0.1em] truncate font-bold ${isDark ? "text-white" : "text-black"}`}>{p.title}</p>
                    <p className={`text-[9px] tracking-[0.05em] ${isDark ? "text-white/70" : "text-black/70"}`}>${(p.price_cents / 100).toFixed(0)}</p>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <button onClick={() => togglePublished(p.id, p.is_published)}
                        className={`w-2 h-2 rounded-full transition-all ${p.is_published ? "bg-green-500" : "bg-red-500"}`} />
                      <button onClick={() => startEditProduct(p)} className={`${isDark ? "text-white/40 hover:text-white" : "text-black/30 hover:text-black"} transition-colors`}><Edit3 size={12} /></button>
                      <button onClick={() => archiveProduct(p.id)} className={`${isDark ? "text-white/40 hover:text-red-400" : "text-black/30 hover:text-red-500"} transition-colors`}><Archive size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "leads" && (
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Leads</h1>
              <input type="text" placeholder="SEARCH…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`text-[10px] font-bold uppercase border-b focus:outline-none pb-1 w-48 bg-transparent ${
                  isDark ? "border-white/20 text-white placeholder-white/30" : "border-black text-black placeholder-black/30"
                }`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-[9px] font-bold uppercase tracking-widest border-b ${
                    isDark ? "text-white/50 border-white/10" : "text-gray-400 border-gray-100"
                  }`}>
                    <th className="pb-4">Email</th>
                    <th className="pb-4">Date</th>
                  </tr>
                </thead>
                <tbody className={isDark ? "divide-white/10" : "divide-gray-50"}>
                  {filteredLeads.map(l => (
                    <tr key={l.id} className={isDark ? "hover:bg-white/5" : "hover:bg-gray-50/50"}>
                      <td className="py-6 text-xs font-bold uppercase">{l.email}</td>
                      <td className={`py-6 text-[10px] uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === "settings" && (
          <div className="max-w-2xl space-y-12">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Settings</h1>
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Appearance</h2>
                <div className={`p-6 space-y-6 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest">Theme</span>
                    <div className={`flex border overflow-hidden ${isDark ? "border-white/20" : "border-black/20"}`}>
                      <button 
                        onClick={() => { 
                          setIsDark(false); 
                          saveSiteConfig({ ...siteContent, theme: "light" }); 
                        }}
                        className={`px-4 py-2 text-[9px] font-bold uppercase transition-all ${!isDark ? "bg-black text-white" : "hover:bg-white/10"}`}
                      >
                        LIGHT
                      </button>
                      <button 
                        onClick={() => { 
                          setIsDark(true); 
                          saveSiteConfig({ ...siteContent, theme: "dark" }); 
                        }}
                        className={`px-4 py-2 text-[9px] font-bold uppercase transition-all ${isDark ? "bg-white text-black" : "hover:bg-black/10"}`}
                      >
                        DARK
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Account</h2>
                <div className={`p-6 space-y-4 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                  <div>
                    <p className={`text-[10px] ${isDark ? "text-white/50" : "text-gray-400"}`}>Signed in as</p>
                    <p className="text-xs font-bold uppercase">{userEmail || "…"}</p>
                  </div>
                  <button onClick={handleSignOut} className={`w-full text-[10px] font-bold uppercase px-4 py-3 hover:transition-all ${isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-500/10 text-red-500 hover:bg-red-500/20"}`}>
                    LOGOUT
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className={`absolute inset-0 backdrop-blur-sm ${isDark ? "bg-black/90" : "bg-white/90"}`} onClick={() => setSelectedRow(null)} />
          <div className={`relative w-full max-w-lg p-12 space-y-8 border max-h-[90vh] overflow-y-auto ${
            isDark ? "bg-black border-white/10" : "bg-white border-gray-100"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-white" : "text-black"}`}>Details</h3>
              <button onClick={() => setSelectedRow(null)}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {Object.entries(selectedRow).map(([k, v]) => (
                k !== "_type" && (
                  <div key={k} className={`flex justify-between py-2 border-b gap-4 ${isDark ? "border-white/10" : "border-gray-50"}`}>
                    <span className={`text-[9px] font-bold uppercase flex-shrink-0 ${isDark ? "text-white/50" : "text-gray-400"}`}>{k}</span>
                    <span className="text-[10px] font-bold uppercase truncate text-right">{String(v)}</span>
                  </div>
                )
              ))}
            </div>
            {selectedRow._type === "order" && (
              <button onClick={() => handleArchiveOrder(selectedRow.id)}
                className={`w-full py-4 text-[10px] font-bold uppercase transition-all ${isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                ARCHIVE ORDER
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, isDark }: { label: string; value: string | number; sub: string; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>{label}</p>
      <p className="text-2xl font-bold tracking-tighter">{value}</p>
      <p className={`text-[8px] uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>{sub}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", isDark }: { label: string; value: string; onChange: (v: string) => void; type?: string; isDark: boolean }) {
  return (
    <div className="space-y-2">
      <label className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className={`w-full bg-transparent border-b focus:border-current outline-none py-2 text-xs font-bold uppercase transition-all ${
          isDark ? "border-white/20 text-white" : "border-gray-200 text-black"
        }`} />
    </div>
  );
}

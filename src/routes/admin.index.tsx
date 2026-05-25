import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { toast } from "sonner";
import { Edit3, Archive, X, Menu } from "lucide-react";

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

// ── NEW: Printful catalog item type ─────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────

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
    isSyncing: false,
  });

  // ── NEW: Printful picker state ───────────────────────────────────────────
  const [printfulCatalog, setPrintfulCatalog] = useState<PrintfulCatalogItem[]>([]);
  const [printfulPickerOpen, setPrintfulPickerOpen] = useState(false);
  const [printfulLoading, setPrintfulLoading] = useState(false);

  // ── UI State ────────────────────────────────────────────────────────────
  const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "all">("day");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // ── Theme Application (instant + persistent) ───────────────────────────
  const applyTheme = useCallback(async (theme: "light" | "dark") => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    setIsDark(theme === "dark");
    setSiteContent(s => ({ ...s, theme }));

    try {
      const { error } = await supabase
        .from("site_config")
        .update({ theme, updated_at: new Date().toISOString() })
        .eq("id", "main");
      if (error) throw error;
      toast.success(`${theme.toUpperCase()} theme applied`);
    } catch (e: any) {
      toast.error(`Theme save failed: ${e.message ?? "unknown"}`);
    }
  }, []);

  useEffect(() => {
    if (siteContent.theme) {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(siteContent.theme);
      setIsDark(siteContent.theme === "dark");
    }
  }, [siteContent.theme]);

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
        supabase.from("products").select("*").neq("is_archived", true),
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

  const saveProduct = async () => {
    try {
      const imageUrls = productForm.image_url
        .split(",")
        .map(u => u.trim())
        .filter(u => u);

      const payload = {
        title: productForm.title,
        slug: productForm.slug || productForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        price_cents: parseInt(productForm.price_cents) || 0,
        image_urls: imageUrls,
        description: productForm.description,
        is_published: productForm.is_published,
        variants: productForm.hasVariants ? JSON.parse(productForm.variantsText || "[]") : null,
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
    // We use .update() instead of .delete() to keep order history intact
    const { error } = await supabase
      .from("products")
      .update({ is_archived: true }) 
      .eq("id", id);
      
    if (error) throw error;
    
    toast.success("Product archived.");
    await fetchData(); // Refresh the list
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
      isSyncing: false,
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
      isSyncing: false,
    });
    setProductFormOpen(true);
    setSection("products");
  };

  // ── NEW: Sync from Printful ──────────────────────────────────────────────
 const syncFromPrintful = async () => {
    setPrintfulLoading(true);
    try {
      // Calls your new /api/printful-sync route
      const res = await fetch("/api/printful-sync", { method: "POST" });
      
      if (!res.ok) throw new Error("Sync failed at API route");
      
      const data = await res.json();
      toast.success(`Sync complete: ${data.synced} products processed.`);
      
      // Refresh your local list
      await fetchData(); 
    } catch (e: any) {
      toast.error("Sync failed: " + e.message);
    } finally {
      setPrintfulLoading(false);
    }
  };
      setPrintfulCatalog(items);
      setPrintfulPickerOpen(true);
      toast.success(`Found ${items.length} Printful product${items.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Sync failed: " + (e.message ?? "unknown error"));
    } finally {
      setPrintfulLoading(false);
    }
  };

  // ── NEW: Import a selected Printful product into the form ────────────────
  const importPrintfulProduct = async (item: PrintfulCatalogItem) => {
    setPrintfulLoading(true);
    try {
      const apiKey = import.meta.env.VITE_Printful_API_Key;
      if (!apiKey) throw new Error("VITE_Printful_API_Key is not set in your Lovable secrets");

      const res = await fetch(`https://api.printful.com/sync/products/${item.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`Printful error ${res.status}: ${res.statusText}`);
      const data = await res.json();

      const product = data?.result;
      if (!product) throw new Error("Empty product response");

      const syncVariants: any[] = product.sync_variants ?? [];

      // Build variants array in the shape offer.$slug.tsx expects
      const variants = syncVariants.map((v: any) => ({
        sku: v.sku ?? String(v.id),
        price_cents: Math.round(parseFloat(v.retail_price ?? "0") * 100),
        external_sku: String(v.id),
        fulfillment_provider: "printful",
        attributes: parseVariantName(v.name ?? ""),
        stock: 999, // Printful is print-on-demand; no stock limits
      }));

      // Collect all image URLs from sync variants
      const imageUrls = Array.from(
        new Set(
          syncVariants
            .map((v: any) => v.files?.find((f: any) => f.type === "preview")?.preview_url ?? "")
            .filter(Boolean)
        )
      );
      // Fallback to thumbnail if no preview images
      if (imageUrls.length === 0 && item.thumbnail_url) imageUrls.push(item.thumbnail_url);

      // Use the cheapest variant price as the base price
      const basePriceCents =
        variants.length > 0
          ? Math.min(...variants.map(v => v.price_cents).filter(p => p > 0))
          : 0;

      setProductForm(f => ({
        ...f,
        title: product.sync_product?.name ?? item.name,
        slug: (product.sync_product?.name ?? item.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        price_cents: String(basePriceCents),
        image_url: imageUrls.join(", "),
        description: "",
        hasVariants: variants.length > 0,
        variantsText: JSON.stringify(variants, null, 2),
      }));

      setPrintfulPickerOpen(false);
      toast.success(`"${item.name}" imported — review and hit CREATE`);
    } catch (e: any) {
      toast.error("Import failed: " + (e.message ?? "unknown error"));
    } finally {
      setPrintfulLoading(false);
    }
  };

  // ── NEW: Parse "Size / Color" style variant names into attributes object ─
  const parseVariantName = (name: string): Record<string, string> => {
    const parts = name.split("/").map(p => p.trim());
    const result: Record<string, string> = {};
    parts.forEach((part, i) => {
      // Heuristic: first part is often size, second is color
      if (i === 0) result["size"] = part;
      else if (i === 1) result["color"] = part;
      else result[`option_${i}`] = part;
    });
    return result;
  };

  const saveSiteConfig = async () => {
    setSiteSaving(true);
    try {
      const payload: any = {
        id: "main",
        hero_headline: siteContent.hero_headline || "",
        hero_subheadline: siteContent.hero_subheadline || "",
        hero_cta: siteContent.hero_cta || "",
        price_display: siteContent.price_display || "",
        price_original: siteContent.price_original || "",
        launch_pricing_active: siteContent.launch_pricing_active ?? false,
        guarantee_days: String(siteContent.guarantee_days || "30"),
        theme: siteContent.theme || "light",
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
  const fmtDateShort = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const STATUS_CONFIG: Record<string, any> = {
    paid: { color: "text-green-600 border-green-200 bg-green-50" },
    pending: { color: "text-yellow-600 border-yellow-200 bg-yellow-50" },
    failed: { color: "text-red-600 border-red-200 bg-red-50" },
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* NAVBAR */}
      <nav className={`sticky top-0 z-50 md:border-b-0 ${isDark ? "md:bg-black md:border-0 border-b border-white/10 bg-black" : "md:bg-white md:border-0 border-b border-gray-100 bg-white"}`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex-1">
            <div className="md:hidden text-[10px] font-bold uppercase tracking-widest">ADMIN</div>
          </div>

          <div className="hidden md:flex items-center justify-center gap-8 flex-none">
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

          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="hidden md:block" />
          </div>
        </div>

        {mobileMenuOpen && (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center md:hidden ${isDark ? "bg-black" : "bg-white"}`}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={`absolute top-6 right-6 ${isDark ? "text-white" : "text-black"}`}
            >
              <X size={24} strokeWidth={1} />
            </button>

            <div className="flex flex-col gap-8 text-center">
              {["overview", "products", "orders", "leads", "settings"].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSection(s as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-[14px] font-bold uppercase tracking-[0.3em] transition-colors ${
                    section === s
                      ? (isDark ? "text-white" : "text-black")
                      : (isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black")
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* OVERVIEW SECTION */}
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
                      : isDark ? "border border-white/20 text-white/50 hover:text-white" : "border border-gray-200 text-black/50 hover:text-black"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <Stat label="Revenue" value={fmt$(filteredRevenue)} sub={`${revenueRange.toUpperCase()} RANGE`} isDark={isDark} />
              <Stat label="Orders" value={activeOrders.length} sub={`${paidOrders.length} PAID`} isDark={isDark} />
              <Stat label="Conversion" value={`${convRate}%`} sub="VISIT TO PAID" isDark={isDark} />
              <Stat label="Avg Ticket" value={fmt$(avgTicket)} sub="PER CUSTOMER" isDark={isDark} />
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Recent Orders</h2>
                <button onClick={() => setSection("orders")} className={`text-[10px] font-bold uppercase tracking-widest hover:underline`}>View All</button>
              </div>
              <div className={`space-y-px ${isDark ? "divide-white/10" : ""}`}>
                {activeOrders.slice(0, 5).map(o => (
                  <div key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })}
                    className={`group flex items-center justify-between py-4 border-b cursor-pointer transition-all ${
                      isDark ? "border-white/10 hover:bg-white/5" : "border-gray-50 hover:bg-gray-50/50"
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-all ${isDark ? "bg-white" : "bg-black"}`} />
                      <div>
                        <p className="text-xs font-bold uppercase">{o.name || o.email}</p>
                        <p className={`text-[9px] uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{fmtDateShort(o.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold">{fmt$(o.amount_cents)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS SECTION */}
        {section === "orders" && (
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Orders</h1>
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
                    <th className="pb-4">Customer</th>
                    <th className="pb-4">Amount</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Date</th>
                  </tr>
                </thead>
                <tbody className={isDark ? "divide-white/10" : "divide-gray-50"}>
                  {filteredOrders.map(o => (
                    <tr key={o.id} onClick={() => setSelectedRow({ ...o, _type: "order" })} className={`group hover:cursor-pointer transition-all ${
                      isDark ? "hover:bg-white/5 divide-white/10" : "hover:bg-gray-50/50 divide-gray-50"
                    }`}>
                      <td className="py-6">
                        <p className="text-xs font-bold uppercase">{o.name || "—"}</p>
                        <p className={`text-[9px] uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{o.email}</p>
                      </td>
                      <td className="py-6 text-xs font-bold">{fmt$(o.amount_cents)}</td>
                      <td className="py-6">
                        <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border ${STATUS_CONFIG[o.status]?.color || (isDark ? "text-white/50 border-white/10" : "text-gray-400 border-gray-100")}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className={`py-6 text-[10px] uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTS SECTION */}
        {section === "products" && (
          <div className="space-y-12">
            <div className="flex items-end justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Products</h1>
              <button
                onClick={() => {
                  if (productFormOpen && !productForm.editingId) {
                    setProductFormOpen(false);
                  } else {
                    resetProductForm();
                    setProductFormOpen(true);
                  }
                }}
                className={`text-[10px] font-bold uppercase tracking-widest px-6 py-2 transition-all ${
                  isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {productFormOpen && !productForm.editingId ? "CLOSE" : "NEW PRODUCT"}
              </button>
            </div>

            {productFormOpen && (
              <div className={`p-8 space-y-8 animate-in slide-in-from-top duration-300 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>
                    {productForm.editingId ? "Edit Product" : "Create Product"}
                  </h2>
                  {/* ── NEW: Sync from Printful button ── */}
                  <button
                    type="button"
                    onClick={syncFromPrintful}
                    disabled={printfulLoading}
                    className={`text-[9px] font-bold uppercase px-5 py-2 border transition-all ${
                      isDark
                        ? "border-white/20 hover:bg-white/10 text-white/70 hover:text-white"
                        : "border-black/20 hover:bg-gray-100 text-black/60 hover:text-black"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {printfulLoading ? "SYNCING…" : "SYNC FROM PRINTFUL"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Title" value={productForm.title} onChange={v => setProductForm(f => ({ ...f, title: v }))} isDark={isDark} />
                  <Input label="Price (USD — cents, e.g. 2999)" value={productForm.price_cents} onChange={v => setProductForm(f => ({ ...f, price_cents: v }))} type="number" isDark={isDark} />
                </div>
                <Input label="Image URL(s) — comma separated" value={productForm.image_url} onChange={v => setProductForm(f => ({ ...f, image_url: v }))} isDark={isDark} />
                <div className="space-y-2">
                  <label className={`text-[9px] font-bold uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>Description</label>
                  <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                    className={`w-full bg-transparent border-b focus:border-current outline-none py-2 text-xs font-bold uppercase resize-none ${
                      isDark ? "border-white/20 text-white" : "border-gray-200 text-black"
                    }`} rows={2} />
                </div>

                {/* ── NEW: Variants toggle ── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setProductForm(f => ({ ...f, hasVariants: !f.hasVariants }))}
                      className={`text-[9px] font-bold uppercase px-4 py-2 border transition-all ${
                        productForm.hasVariants
                          ? isDark ? "bg-white text-black border-white" : "bg-black text-white border-black"
                          : isDark ? "border-white/20 text-white/50 hover:text-white" : "border-black/20 text-black/50 hover:text-black"
                      }`}
                    >
                      {productForm.hasVariants ? "HAS VARIANTS ✓" : "ADD VARIANTS"}
                    </button>
                    {productForm.hasVariants && (
                      <span className={`text-[9px] uppercase ${isDark ? "text-white/30" : "text-black/30"}`}>
                        Auto-filled by Printful sync, or paste JSON manually
                      </span>
                    )}
                  </div>

                  {/* ── NEW: Variants JSON editor — only shown when hasVariants is true ── */}
                  {productForm.hasVariants && (
                    <div className="space-y-2">
                      <label className={`text-[9px] font-bold uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>
                        Variants JSON
                      </label>
                      <textarea
                        value={productForm.variantsText}
                        onChange={e => setProductForm(f => ({ ...f, variantsText: e.target.value }))}
                        className={`w-full bg-transparent border focus:border-current outline-none p-3 text-[9px] font-mono resize-y ${
                          isDark ? "border-white/20 text-white/80" : "border-gray-200 text-black/80"
                        }`}
                        rows={8}
                        spellCheck={false}
                      />
                      <p className={`text-[8px] uppercase tracking-widest ${isDark ? "text-white/20" : "text-black/20"}`}>
                        Each variant: {"{ sku, price_cents, external_sku, fulfillment_provider, attributes: { size, color }, stock }"}
                      </p>
                    </div>
                  )}
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
                    {p.image_urls?.[0] ? (
                      <img src={p.image_urls[0]} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className={`text-[7px] uppercase tracking-[0.3em] ${isDark ? "text-white/20" : "text-black/20"}`}>No Image</span>
                    )}
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

        {/* WEBSITE BUILDER SECTION - HIDDEN BUT PRESERVED */}
        {section === "site" && (
          <div className="max-w-2xl space-y-12 opacity-50">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Website Builder (Hidden)</h1>
            <p className={`text-[10px] uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>This section is currently hidden from the main menu but the code remains intact for future cleanup.</p>
          </div>
        )}

        {/* LEADS SECTION */}
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

        {/* SETTINGS SECTION */}
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
                        onClick={() => applyTheme("light")}
                        className={`px-4 py-2 text-[9px] font-bold uppercase transition-all ${siteContent.theme === "light" ? (isDark ? "bg-white text-black" : "bg-black text-white") : (isDark ? "hover:bg-white/10" : "hover:bg-black/10")}`}
                      >
                        LIGHT
                      </button>
                      <button
                        onClick={() => applyTheme("dark")}
                        className={`px-4 py-2 text-[9px] font-bold uppercase transition-all ${siteContent.theme === "dark" ? (isDark ? "bg-white text-black" : "bg-black text-white") : (isDark ? "hover:bg-white/10" : "hover:bg-black/10")}`}
                      >
                        DARK
                      </button>
                    </div>
                  </div>
                  {siteEdited && (
                    <button
                      onClick={saveSiteConfig}
                      disabled={siteSaving}
                      className={`w-full py-3 text-[10px] font-bold uppercase transition-all ${
                        isDark ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-800"
                      }`}
                    >
                      {siteSaving ? "SAVING…" : "APPLY CHANGES"}
                    </button>
                  )}
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

              <div className="space-y-4">
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Stripe Webhook</h2>
                <div className={`p-6 space-y-3 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                  <p className={`text-[10px] ${isDark ? "text-white/50" : "text-gray-400"}`}>Point Stripe webhook at:</p>
                  <pre className={`text-[9px] border p-3 overflow-x-auto font-mono ${isDark ? "bg-black border-white/10" : "bg-white border-gray-200"}`}>
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe-webhook
                  </pre>
                  <p className={`text-[9px] ${isDark ? "text-white/50" : "text-gray-400"}`}>Listen for: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed</p>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Brand & Copy</h2>
                <div className={`p-6 space-y-2 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                  <p className={`text-[10px] ${isDark ? "text-white/50" : "text-gray-400"}`}>Brand name and default copy live in <code className={`px-1 py-0.5 text-[9px] font-mono border ${isDark ? "bg-black border-white/10" : "bg-white border-gray-200"}`}>src/config/site.ts</code>.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DETAIL MODAL */}
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
              {Object.entries(selectedRow).map(([k, v]) => {
                return (
                  k !== "_type" && (
                    <div key={k} className={`flex justify-between py-2 border-b gap-4 ${isDark ? "border-white/10" : "border-gray-50"}`}>
                      <span className={`text-[9px] font-bold uppercase flex-shrink-0 ${isDark ? "text-white/50" : "text-gray-400"}`}>{k}</span>
                      <span className="text-[10px] font-bold uppercase truncate text-right">{String(v)}</span>
                    </div>
                  )
                );
              })}
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

      {/* ── NEW: Printful product picker modal ── */}
      {printfulPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div
            className={`absolute inset-0 backdrop-blur-sm ${isDark ? "bg-black/90" : "bg-white/90"}`}
            onClick={() => setPrintfulPickerOpen(false)}
          />
          <div className={`relative w-full max-w-2xl border max-h-[85vh] flex flex-col ${
            isDark ? "bg-black border-white/10" : "bg-white border-gray-200"
          }`}>
            {/* Modal header */}
            <div className={`flex items-center justify-between px-8 py-6 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest">Select Printful Product</h3>
                <p className={`text-[9px] uppercase mt-1 ${isDark ? "text-white/40" : "text-black/40"}`}>
                  {printfulCatalog.length} product{printfulCatalog.length !== 1 ? "s" : ""} in your store
                </p>
              </div>
              <button onClick={() => setPrintfulPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Product list */}
            <div className="overflow-y-auto flex-1 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {printfulCatalog.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => importPrintfulProduct(item)}
                    disabled={printfulLoading}
                    className={`group text-left border p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      isDark
                        ? "border-white/10 hover:border-white/40 hover:bg-white/5"
                        : "border-gray-100 hover:border-gray-400 hover:bg-gray-50/50"
                    }`}
                  >
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.name}
                        className="w-full aspect-square object-contain mb-3"
                      />
                    ) : (
                      <div className={`w-full aspect-square flex items-center justify-center mb-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                        <span className={`text-[8px] uppercase tracking-widest ${isDark ? "text-white/20" : "text-black/20"}`}>No Image</span>
                      </div>
                    )}
                    <p className={`text-[9px] font-bold uppercase leading-tight truncate ${isDark ? "text-white" : "text-black"}`}>
                      {item.name}
                    </p>
                    <p className={`text-[8px] uppercase mt-1 ${isDark ? "text-white/30" : "text-black/30"}`}>
                      ID {item.id}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, isDark }: { label: string; value: string | number; sub: string; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>{label}</p>
      <p className="text-2xl font-bold tracking-tighter">{value}</p>
      <p className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-300"}`}>{sub}</p>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();

  const [section, setSection] = useState<
    "overview" | "products" | "orders" | "leads" | "settings"
  >("overview");

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
  });

  // ── UI State ────────────────────────────────────────────────────────────
  const [revenueRange, setRevenueRange] = useState<
    "day" | "week" | "month" | "all"
  >("day");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Theme Detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const isDarkMode =
      document.documentElement.classList.contains("dark");

    setIsDark(isDarkMode);
  }, []);

  // ── Auth & Data Fetch ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
      const [productsRes, ordersRes, leadsRes, siteRes] =
        await Promise.all([
          supabase.from("products").select("*"),
          supabase.from("orders").select("*"),
          supabase.from("leads").select("*"),
          supabase
            .from("site_config")
            .select("*")
            .eq("id", "main")
            .single(),
        ]);

      if (productsRes.data) {
        setProducts(productsRes.data as Product[]);
      }

      if (ordersRes.data) {
        setActiveOrders(ordersRes.data as Order[]);
      }

      if (leadsRes.data) {
        setActiveLeads(leadsRes.data as Lead[]);
      }

      if (siteRes.data) {
        setSiteContent((prev) => ({
          ...prev,
          ...(siteRes.data as any),
        }));
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

      if (!res.ok) {
        toast.error(
          data.error || data.message || "Sync failed"
        );
        return;
      }

      if (
        Array.isArray(data.errors) &&
        data.errors.length > 0
      ) {
        toast.error(data.errors[0]);
        return;
      }

      toast.success(
        `Sync complete: ${data.synced}/${data.total} products processed.`
      );

      await fetchData();
    } catch (e: any) {
      toast.error(
        `Sync error: ${e?.message || "Unknown error"}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const saveProduct = async () => {
    try {
      const imageUrls = productForm.image_url
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u);

      const payload = {
        title: productForm.title,
        slug: productForm.slug,
        price_cents:
          parseInt(productForm.price_cents) || 0,
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
        const { error } = await supabase
          .from("products")
          .insert([payload]);

        if (error) throw error;

        toast.success("Product created.");
      }

      resetProductForm();
      await fetchData();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    }
  };

  const togglePublished = async (
    id: string,
    currentState: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({
          is_published: !currentState,
        })
        .eq("id", id);

      if (error) throw error;

      await fetchData();
    } catch (e: any) {
      toast.error(`Toggle failed: ${e.message}`);
    }
  };

  const archiveProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Product archived.");

      await fetchData();
    } catch (e: any) {
      toast.error(`Archive failed: ${e.message}`);
    }
  };

  const handleArchiveOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", id);

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
    });

    setProductFormOpen(true);
    setSection("products");
  };

  const saveSiteConfig = async (
    updatedContent: SiteContent
  ) => {
    setSiteSaving(true);

    try {
      const payload: any = {
        id: "main",
        hero_headline:
          updatedContent.hero_headline || "",
        hero_subheadline:
          updatedContent.hero_subheadline || "",
        hero_cta: updatedContent.hero_cta || "",
        price_display:
          updatedContent.price_display || "",
        price_original:
          updatedContent.price_original || "",
        launch_pricing_active:
          updatedContent.launch_pricing_active ??
          false,
        guarantee_days: String(
          updatedContent.guarantee_days || "30"
        ),
        theme: updatedContent.theme,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } =
        await supabase
          .from("site_config")
          .update(payload)
          .eq("id", "main");

      if (updateError) {
        throw updateError;
      }

      toast.success("Site content saved.");
      setSiteEdited(false);
    } catch (e: any) {
      toast.error(
        `Failed: ${
          e.message || e.details || "Unknown error"
        }`
      );
    } finally {
      setSiteSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const filteredLeads = activeLeads.filter((l) =>
    l.email
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const paidOrders = activeOrders.filter(
    (o) => o.status === "paid"
  );

  const filteredRevenue = activeOrders
    .filter((o) => {
      const date = new Date(o.created_at);
      const now = new Date();

      if (revenueRange === "day") {
        return (
          date.toDateString() === now.toDateString()
        );
      }

      if (revenueRange === "week") {
        return (
          now.getTime() - date.getTime() <
          7 * 24 * 60 * 60 * 1000
        );
      }

      if (revenueRange === "month") {
        return (
          date.getMonth() === now.getMonth()
        );
      }

      return true;
    })
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const avgTicket =
    paidOrders.length > 0
      ? filteredRevenue / paidOrders.length
      : 0;

  const convRate =
    activeOrders.length > 0
      ? Math.round(
          (paidOrders.length /
            activeOrders.length) *
            100
        )
      : 0;

  const fmt$ = (cents: number) =>
    `$${(cents / 100).toFixed(0)}`;

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-black text-white"
          : "bg-white text-black"
      }`}
    >
      <nav
        className={`sticky top-0 z-50 ${
          isDark
            ? "bg-black border-white/10"
            : "bg-white border-gray-100"
        } border-b`}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="md:hidden text-[10px] font-bold uppercase tracking-widest">
            ADMIN
          </div>

          <div className="hidden md:flex items-center justify-center gap-8 flex-1">
            {[
              "overview",
              "products",
              "orders",
              "leads",
              "settings",
            ].map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSection(s as any)
                }
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                  section === s
                    ? isDark
                      ? "text-white"
                      : "text-black"
                    : isDark
                    ? "text-white/50 hover:text-white"
                    : "text-black/50 hover:text-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              setMobileMenuOpen(!mobileMenuOpen)
            }
            className="md:hidden"
          >
            <Menu size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* OVERVIEW */}
        {section === "overview" && (
          <div className="space-y-12">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">
              Overview
            </h1>

            <div className="flex gap-4">
              {[
                "day",
                "week",
                "month",
                "all",
              ].map((r) => (
                <button
                  key={r}
                  onClick={() =>
                    setRevenueRange(r as any)
                  }
                  className={`text-[9px] font-bold uppercase px-4 py-2 ${
                    revenueRange === r
                      ? isDark
                        ? "bg-white text-black"
                        : "bg-black text-white"
                      : isDark
                      ? "text-white/50"
                      : "text-black/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <Stat
                label="Revenue"
                value={fmt$(filteredRevenue)}
                sub={`${revenueRange} period`}
                isDark={isDark}
              />

              <Stat
                label="Orders"
                value={paidOrders.length}
                sub="successful payments"
                isDark={isDark}
              />

              <Stat
                label="Avg Ticket"
                value={fmt$(avgTicket)}
                sub="per paid order"
                isDark={isDark}
              />

              <Stat
                label="Conv Rate"
                value={`${convRate}%`}
                sub="checkout to paid"
                isDark={isDark}
              />
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {section === "products" && (
          <div className="space-y-12">
            <div className="flex items-end justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">
                Products
              </h1>

              <div className="flex gap-4">
                <button
                  onClick={handleSyncPrintful}
                  disabled={isSyncing}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase px-6 py-3 border"
                >
                  <RefreshCw
                    size={12}
                    className={
                      isSyncing
                        ? "animate-spin"
                        : ""
                    }
                  />

                  {isSyncing
                    ? "SYNCING…"
                    : "SYNC PRINTFUL"}
                </button>

                <button
                  onClick={() =>
                    setProductFormOpen(
                      !productFormOpen
                    )
                  }
                  className={`text-[10px] font-bold uppercase px-8 py-3 ${
                    isDark
                      ? "bg-white text-black"
                      : "bg-black text-white"
                  }`}
                >
                  {productFormOpen
                    ? "CLOSE"
                    : "NEW PRODUCT"}
                </button>
              </div>
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-12">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="group relative"
                >
                  <div
                    className={`relative flex aspect-[2/3] items-center justify-center overflow-hidden p-3 sm:p-4 group-hover:scale-105 transition-all duration-300 ${
                      isDark
                        ? "bg-white/5"
                        : "bg-gray-50/50"
                    }`}
                  >
                    {p.image_urls?.[1] ? (
                      <img
                        src={p.image_urls[1]}
                        alt={
                          p.title || "Product"
                        }
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span
                        className={`text-[7px] uppercase tracking-[0.3em] ${
                          isDark
                            ? "text-white/20"
                            : "text-black/20"
                        }`}
                      >
                        No Image
                      </span>
                    )}
                  </div>

                  <div className="px-2 text-center">
                    <p
                      className={`mb-1 text-[9px] uppercase leading-tight tracking-[0.1em] truncate font-bold ${
                        isDark
                          ? "text-white"
                          : "text-black"
                      }`}
                    >
                      {p.title}
                    </p>

                    <p
                      className={`text-[9px] tracking-[0.05em] ${
                        isDark
                          ? "text-white/70"
                          : "text-black/70"
                      }`}
                    >
                      $
                      {(
                        p.price_cents / 100
                      ).toFixed(0)}
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-3">
                      <button
                        onClick={() =>
                          togglePublished(
                            p.id,
                            p.is_published
                          )
                        }
                        className={`w-2 h-2 rounded-full ${
                          p.is_published
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />

                      <button
                        onClick={() =>
                          startEditProduct(p)
                        }
                      >
                        <Edit3 size={12} />
                      </button>

                      <button
                        onClick={() =>
                          archiveProduct(p.id)
                        }
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  isDark,
}: {
  label: string;
  value: string | number;
  sub: string;
  isDark: boolean;
}) {
  return (
    <div className="space-y-1">
      <p
        className={`text-[9px] font-bold uppercase tracking-widest ${
          isDark
            ? "text-white/50"
            : "text-gray-400"
        }`}
      >
        {label}
      </p>

      <p className="text-2xl font-bold tracking-tighter">
        {value}
      </p>

      <p
        className={`text-[8px] uppercase tracking-widest ${
          isDark
            ? "text-white/30"
            : "text-gray-400"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  isDark,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  isDark: boolean;
}) {
  return (
    <div className="space-y-2">
      <label
        className={`text-[9px] font-bold uppercase tracking-widest ${
          isDark
            ? "text-white/50"
            : "text-gray-400"
        }`}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className={`w-full bg-transparent border-b focus:border-current outline-none py-2 text-xs font-bold uppercase ${
          isDark
            ? "border-white/20 text-white"
            : "border-gray-200 text-black"
        }`}
      />
    </div>
  );
}

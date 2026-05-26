import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Edit3,
  Archive,
  Menu,
  RefreshCw,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
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

// ────────────────────────────────────────────────────────────────────────────
// ROUTE
// ────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      {
        title: "Admin",
      },
    ],
  }),
  component: AdminPage,
});

// ────────────────────────────────────────────────────────────────────────────
// PAGE
// ────────────────────────────────────────────────────────────────────────────

function AdminPage() {
  const [section, setSection] = useState<
    "overview" | "products" | "orders" | "leads" | "settings"
  >("overview");

  const [isDark, setIsDark] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  // DATA
  const [products, setProducts] = useState<
    Product[]
  >([]);

  const [activeOrders, setActiveOrders] =
    useState<Order[]>([]);

  const [activeLeads, setActiveLeads] =
    useState<Lead[]>([]);

  const [userEmail, setUserEmail] = useState<
    string | null
  >(null);

  // SITE CONTENT
  const [siteContent] = useState<SiteContent>({
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

  // PRODUCT FORM
  const [productFormOpen, setProductFormOpen] =
    useState(false);

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

  // UI
  const [revenueRange, setRevenueRange] =
    useState<"day" | "week" | "month" | "all">(
      "day"
    );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [isSyncing, setIsSyncing] =
    useState(false);

  // ────────────────────────────────────────────────────────────────────────
  // THEME
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const root = document.documentElement;

    const dark =
      root.classList.contains("dark");

    setIsDark(dark);
  }, []);

  const applyTheme = (dark: boolean) => {
    const root = document.documentElement;

    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    setIsDark(dark);
  };

  // ────────────────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────────────────

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

  // ────────────────────────────────────────────────────────────────────────
  // FETCH
  // ────────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [
        productsRes,
        ordersRes,
        leadsRes,
        siteRes,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*"),

        supabase
          .from("orders")
          .select("*"),

        supabase
          .from("leads")
          .select("*"),

        supabase
          .from("site_config")
          .select("*")
          .eq("id", "main")
          .single(),
      ]);

      if (productsRes.data) {
        setProducts(
          productsRes.data as Product[]
        );
      }

      if (ordersRes.data) {
        setActiveOrders(
          ordersRes.data as Order[]
        );
      }

      if (leadsRes.data) {
        setActiveLeads(
          leadsRes.data as Lead[]
        );
      }

      if (siteRes.data?.theme === "dark") {
        applyTheme(true);
      } else {
        applyTheme(false);
      }
    } catch (e) {
      console.error(
        "[ADMIN FETCH ERROR]",
        e
      );
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // PRINTFUL SYNC
  // ────────────────────────────────────────────────────────────────────────

  const handleSyncPrintful = async () => {
    setIsSyncing(true);

    try {
      const res = await fetch(
        "/api/printful-sync",
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.error ||
            data.message ||
            "Sync failed"
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
        `Sync error: ${
          e?.message || "Unknown error"
        }`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // PRODUCT SAVE
  // ────────────────────────────────────────────────────────────────────────

  const saveProduct = async () => {
    try {
      const imageUrls =
        productForm.image_url
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);

      const payload = {
        title: productForm.title,
        slug: productForm.slug,
        price_cents:
          parseInt(
            productForm.price_cents
          ) || 0,
        image_urls: imageUrls,
        description:
          productForm.description,
        is_published:
          productForm.is_published,
        source_url:
          productForm.source_url,
        updated_at:
          new Date().toISOString(),
      };

      if (productForm.editingId) {
        const { error } =
          await supabase
            .from("products")
            .update(payload)
            .eq(
              "id",
              productForm.editingId
            );

        if (error) {
          throw error;
        }

        toast.success(
          "Product updated."
        );
      } else {
        const { error } =
          await supabase
            .from("products")
            .insert([payload]);

        if (error) {
          throw error;
        }

        toast.success(
          "Product created."
        );
      }

      resetProductForm();

      await fetchData();
    } catch (e: any) {
      toast.error(
        `Save failed: ${e.message}`
      );
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // PRODUCT ACTIONS
  // ────────────────────────────────────────────────────────────────────────

  const togglePublished = async (
    id: string,
    currentState: boolean
  ) => {
    try {
      const { error } =
        await supabase
          .from("products")
          .update({
            is_published:
              !currentState,
          })
          .eq("id", id);

      if (error) {
        throw error;
      }

      await fetchData();
    } catch (e: any) {
      toast.error(
        `Toggle failed: ${e.message}`
      );
    }
  };

  const archiveProduct = async (
    id: string
  ) => {
    try {
      const { error } =
        await supabase
          .from("products")
          .delete()
          .eq("id", id);

      if (error) {
        throw error;
      }

      toast.success(
        "Product archived."
      );

      await fetchData();
    } catch (e: any) {
      toast.error(
        `Archive failed: ${e.message}`
      );
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // PRODUCT FORM HELPERS
  // ────────────────────────────────────────────────────────────────────────

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

  const startEditProduct = (
    p: Product
  ) => {
    setProductForm({
      editingId: p.id,
      title: p.title,
      slug: p.slug,
      price_cents: String(
        p.price_cents
      ),
      image_url:
        (p.image_urls || []).join(
          ", "
        ),
      description:
        p.description || "",
      is_published:
        p.is_published,
      source_url: "",
    });

    setProductFormOpen(true);

    setSection("products");
  };

  // ────────────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    await supabase.auth.signOut();

    window.location.href = "/login";
  };

  // ────────────────────────────────────────────────────────────────────────
  // FILTERS
  // ────────────────────────────────────────────────────────────────────────

  const filteredLeads =
    activeLeads.filter((l) =>
      l.email
        .toLowerCase()
        .includes(
          searchQuery.toLowerCase()
        )
    );

  const paidOrders =
    activeOrders.filter(
      (o) => o.status === "paid"
    );

  const filteredRevenue =
    activeOrders
      .filter((o) => {
        const date = new Date(
          o.created_at
        );

        const now = new Date();

        if (
          revenueRange === "day"
        ) {
          return (
            date.toDateString() ===
            now.toDateString()
          );
        }

        if (
          revenueRange === "week"
        ) {
          return (
            now.getTime() -
              date.getTime() <
            7 *
              24 *
              60 *
              60 *
              1000
          );
        }

        if (
          revenueRange === "month"
        ) {
          return (
            date.getMonth() ===
              now.getMonth() &&
            date.getFullYear() ===
              now.getFullYear()
          );
        }

        return true;
      })
      .reduce(
        (sum, o) =>
          sum + o.amount_cents,
        0
      );

  const avgTicket =
    paidOrders.length > 0
      ? filteredRevenue /
        paidOrders.length
      : 0;

  const convRate =
    activeOrders.length > 0
      ? Math.round(
          (paidOrders.length /
            activeOrders.length) *
            100
        )
      : 0;

  // ────────────────────────────────────────────────────────────────────────
  // FORMATTERS
  // ────────────────────────────────────────────────────────────────────────

  const formatCurrency = (
    cents: number
  ) =>
    `$${(
      cents / 100
    ).toFixed(0)}`;

  // ────────────────────────────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-black text-white"
          : "bg-white text-black"
      }`}
    >
      {/* NAV */}
      <nav
        className={`sticky top-0 z-50 border-b ${
          isDark
            ? "bg-black border-white/10"
            : "bg-white border-gray-100"
        }`}
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
                  setSection(
                    s as typeof section
                  )
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
              setMobileMenuOpen(
                !mobileMenuOpen
              )
            }
            className="md:hidden"
          >
            <Menu size={18} />
          </button>
        </div>
      </nav>

      {/* MAIN */}
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
                    setRevenueRange(
                      r as
                        | "day"
                        | "week"
                        | "month"
                        | "all"
                    )
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
                value={formatCurrency(
                  filteredRevenue
                )}
                sub={`${revenueRange} period`}
                isDark={isDark}
              />

              <Stat
                label="Orders"
                value={
                  paidOrders.length
                }
                sub="successful payments"
                isDark={isDark}
              />

              <Stat
                label="Avg Ticket"
                value={formatCurrency(
                  avgTicket
                )}
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
                  onClick={
                    handleSyncPrintful
                  }
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

            {/* PRODUCT FORM */}
            {productFormOpen && (
              <div
                className={`p-8 space-y-8 ${
                  isDark
                    ? "bg-white/5"
                    : "bg-gray-50/50"
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label="Title"
                    value={
                      productForm.title
                    }
                    onChange={(v) =>
                      setProductForm(
                        (
                          prev
                        ) => ({
                          ...prev,
                          title: v,
                        })
                      )
                    }
                    isDark={isDark}
                  />

                  <Input
                    label="Price"
                    value={
                      productForm.price_cents
                    }
                    onChange={(v) =>
                      setProductForm(
                        (
                          prev
                        ) => ({
                          ...prev,
                          price_cents:
                            v,
                        })
                      )
                    }
                    isDark={isDark}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={
                      saveProduct
                    }
                    className={`px-6 py-3 text-[10px] font-bold uppercase ${
                      isDark
                        ? "bg-white text-black"
                        : "bg-black text-white"
                    }`}
                  >
                    SAVE
                  </button>

                  <button
                    onClick={
                      resetProductForm
                    }
                    className="px-6 py-3 text-[10px] font-bold uppercase"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-y-12">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="group relative"
                >
                  <div
                    className={`relative flex aspect-[2/3] items-center justify-center overflow-hidden p-3 sm:p-4 transition-all duration-300 ${
                      isDark
                        ? "bg-white/5"
                        : "bg-gray-50/50"
                    }`}
                  >
                    {(p.image_urls?.[1] ?? p.image_urls?.[0]) ? (
                      <img
                        src={p.image_urls[1] ?? p.image_urls[0]}
                        alt={p.title || "Product"}
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
                      className={`mb-1 text-[9px] uppercase truncate font-bold ${
                        isDark
                          ? "text-white"
                          : "text-black"
                      }`}
                    >
                      {p.title}
                    </p>

                    <p
                      className={`text-[9px] ${
                        isDark
                          ? "text-white/70"
                          : "text-black/70"
                      }`}
                    >
                      {formatCurrency(
                        p.price_cents
                      )}
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
                          startEditProduct(
                            p
                          )
                        }
                      >
                        <Edit3 size={12} />
                      </button>

                      <button
                        onClick={() =>
                          archiveProduct(
                            p.id
                          )
                        }
                      >
                        <Archive
                          size={12}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {section === "settings" && (
          <div className="space-y-8 max-w-xl">
            <h1 className="text-2xl font-bold uppercase tracking-tighter">
              Settings
            </h1>

            <div
              className={`p-6 space-y-6 ${
                isDark
                  ? "bg-white/5"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest">
                  Theme
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      applyTheme(false)
                    }
                    className={`px-4 py-2 text-[10px] font-bold uppercase ${
                      !isDark
                        ? "bg-black text-white"
                        : "border"
                    }`}
                  >
                    LIGHT
                  </button>

                  <button
                    onClick={() =>
                      applyTheme(true)
                    }
                    className={`px-4 py-2 text-[10px] font-bold uppercase ${
                      isDark
                        ? "bg-white text-black"
                        : "border"
                    }`}
                  >
                    DARK
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase opacity-50">
                  Signed in as
                </p>

                <p className="text-sm font-bold">
                  {userEmail}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full py-3 text-[10px] font-bold uppercase border border-red-500/30 text-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

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

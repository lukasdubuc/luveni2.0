import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { toast } from "sonner";
import { Edit3, Archive, X, Menu, RefreshCw, BarChart2, Lock, CheckSquare, Square, Trash2, Eye, EyeOff, GripVertical, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { requireAdmin } from "@/lib/admin-guard";


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
  printful_id?: string | null;
  display_order?: number;
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

type PageEvent = {
  id: string;
  event_type: string;
  path: string;
  product_id?: string;
  session_id?: string;
  referrer?: string;
  country?: string;
  created_at: string;
};

type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "viewer";
  created_at: string;
};

// ── NavSection type defined at module level (outside the component) ──────────
type NavSection = "overview" | "products" | "orders" | "leads" | "analytics" | "settings";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin" }],
  }),
  beforeLoad: requireAdmin,
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();

  // ── navSections defined inside the component ─────────────────────────────
  const navSections: NavSection[] = ["overview", "products", "orders", "leads", "analytics", "settings"];

  // ── section state uses the NavSection type ───────────────────────────────
  const [section, setSection] = useState<NavSection>("overview");

  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Data State ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeLeads, setActiveLeads] = useState<Lead[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pageEvents, setPageEvents] = useState<PageEvent[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

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

  // ── Product Select / Bulk State ─────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);

  // ── Drag-to-reorder State ───────────────────────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);

  // ── Orders Filter State ─────────────────────────────────────────────────
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "paid" | "pending" | "failed">("all");

  // ── Analytics State ─────────────────────────────────────────────────────
  const [analyticsRange, setAnalyticsRange] = useState<"7" | "14" | "30">("14");

  // ── Settings: User Management ───────────────────────────────────────────
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // ── UI State ────────────────────────────────────────────────────────────
  const [revenueRange, setRevenueRange] = useState<"day" | "week" | "month" | "all">("day");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Apply saved theme from site_config once loaded
  useEffect(() => {
    if (!localStorage.getItem("theme") && siteContent.theme) {
      if (siteContent.theme === "dark") {
        document.documentElement.classList.add("dark");
        setIsDark(true);
      } else {
        document.documentElement.classList.remove("dark");
        setIsDark(false);
      }
    }
  }, [siteContent.theme]);

  // Sync orderedProducts when products update
  useEffect(() => {
    setOrderedProducts([...products].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)));
  }, [products]);

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

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    const upsertById = <T extends { id: string }>(arr: T[], row: T) => {
      const idx = arr.findIndex(r => r.id === row.id);
      if (idx === -1) return [row, ...arr];
      const next = arr.slice();
      next[idx] = { ...next[idx], ...row };
      return next;
    };
    const removeById = <T extends { id: string }>(arr: T[], id: string) =>
      arr.filter(r => r.id !== id);

    const channel = supabase
      .channel("admin_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "INSERT") setActiveOrders(prev => upsertById(prev, p.new as Order));
        else if (p.eventType === "UPDATE") setActiveOrders(prev => upsertById(prev, p.new as Order));
        else if (p.eventType === "DELETE") setActiveOrders(prev => removeById(prev, (p.old as any).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (p) => {
        if (p.eventType === "INSERT") setActiveLeads(prev => upsertById(prev, p.new as Lead));
        else if (p.eventType === "UPDATE") setActiveLeads(prev => upsertById(prev, p.new as Lead));
        else if (p.eventType === "DELETE") setActiveLeads(prev => removeById(prev, (p.old as any).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (p) => {
        if (p.eventType === "INSERT") setProducts(prev => upsertById(prev, p.new as Product));
        else if (p.eventType === "UPDATE") setProducts(prev => upsertById(prev, p.new as Product));
        else if (p.eventType === "DELETE") setProducts(prev => removeById(prev, (p.old as any).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_users" }, (p) => {
        if (p.eventType === "INSERT") setAdminUsers(prev => upsertById(prev, p.new as AdminUser));
        else if (p.eventType === "UPDATE") setAdminUsers(prev => upsertById(prev, p.new as AdminUser));
        else if (p.eventType === "DELETE") setAdminUsers(prev => removeById(prev, (p.old as any).id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "page_events" }, (p) => {
        setPageEvents(prev => {
          const next = [p.new as PageEvent, ...prev];
          return next.length > 5000 ? next.slice(0, 5000) : next;
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchData().catch(() => {});
        }
      });

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, ordersRes, leadsRes, siteRes, eventsRes, usersRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("orders").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("site_config").select("*").eq("id", "main").single(),
        supabase.from("page_events").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("admin_users").select("*"),
      ]);

      if (productsRes.data) setProducts(productsRes.data as Product[]);
      if (ordersRes.data) setActiveOrders(ordersRes.data as Order[]);
      if (leadsRes.data) setActiveLeads(leadsRes.data as Lead[]);
      if (siteRes.data) {
        setSiteContent(prev => ({ ...prev, ...(siteRes.data as any) }));
      }
      if (eventsRes.data) setPageEvents(eventsRes.data as PageEvent[]);
      if (usersRes.data) setAdminUsers(usersRes.data as AdminUser[]);
    } catch (e) {
      console.error("[Admin] Fetch error:", e);
    }
  };

  const handleSyncPrintful = async () => {
    setIsSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/printful-sync", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || "Sync failed");
        return;
      }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        toast.error(data.errors[0]);
        return;
      }
      toast.success(`Sync complete: ${data.synced}/${data.total} products processed.`);
      await fetchData();
    } catch (e: any) {
      toast.error(`Sync error: ${e?.message || "Unknown error"}`);
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
        const { error } = await supabase.from("products").update(payload as any).eq("id", productForm.editingId);
        if (error) throw error;
        toast.success("Product updated.");
      } else {
        const { error } = await supabase.from("products").insert([payload] as any);
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
      const { error } = await supabase.from("products").update({ is_published: !currentState }).eq("id", id);
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
      const { error: updateError } = await supabase.from("site_config").update(payload).eq("id", "main");
      if (updateError) throw updateError;
      toast.success("Site content saved.");
      setSiteEdited(false);
    } catch (e: any) {
      toast.error(`Failed: ${e.message || e.details || "Unknown error"}`);
    } finally {
      setSiteSaving(false);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllProducts = () => {
    if (selectedIds.size === orderedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orderedProducts.map(p => p.id)));
    }
  };

  const bulkPublish = async (publish: boolean) => {
    setIsBulkActing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").update({ is_published: publish }).in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} product(s) ${publish ? "published" : "unpublished"}.`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await fetchData();
    } catch (e: any) {
      toast.error(`Bulk action failed: ${e.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} product(s)? This cannot be undone.`)) return;
    setIsBulkActing(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} product(s) deleted.`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await fetchData();
    } catch (e: any) {
      toast.error(`Bulk delete failed: ${e.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const reordered = [...orderedProducts];
    const fromIdx = reordered.findIndex(p => p.id === draggedId);
    const toIdx = reordered.findIndex(p => p.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, display_order: i }));
    setOrderedProducts(updated);
    setDraggedId(null);
    setDragOverId(null);
    try {
      await Promise.all(updated.map(p =>
        supabase.from("products").update({ display_order: p.display_order }).eq("id", p.id)
      ));
      toast.success("Order saved.");
    } catch (e: any) {
      toast.error(`Reorder failed: ${e.message}`);
    }
  };

  const handleAddAdminUser = async () => {
    if (!newUserEmail.trim()) return;
    setIsAddingUser(true);
    try {
      const { error } = await supabase.from("admin_users").insert([{
        email: newUserEmail.trim().toLowerCase(),
        role: newUserRole,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      toast.success(`User ${newUserEmail} added as ${newUserRole}.`);
      setNewUserEmail("");
      setNewUserRole("viewer");
      await fetchData();
    } catch (e: any) {
      toast.error(`Failed to add user: ${e.message}`);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleRemoveAdminUser = async (id: string) => {
    try {
      const { error } = await supabase.from("admin_users").delete().eq("id", id);
      if (error) throw error;
      toast.success("User removed.");
      await fetchData();
    } catch (e: any) {
      toast.error(`Remove failed: ${e.message}`);
    }
  };

  const handleUpdateUserRole = async (id: string, role: "admin" | "manager" | "viewer") => {
    try {
      const { error } = await supabase.from("admin_users").update({ role }).eq("id", id);
      if (error) throw error;
      toast.success("Role updated.");
      await fetchData();
    } catch (e: any) {
      toast.error(`Update failed: ${e.message}`);
    }
  };

  // ── Computed: Revenue ───────────────────────────────────────────────────
  const filterByRange = (date: Date, range: typeof revenueRange) => {
    const now = new Date();
    if (range === "day") return date.toDateString() === now.toDateString();
    if (range === "week") return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
    if (range === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return true;
  };

  const filterByRangePrev = (date: Date, range: typeof revenueRange) => {
    const now = new Date();
    if (range === "day") {
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      return date.toDateString() === yesterday.toDateString();
    }
    if (range === "week") {
      const diff = now.getTime() - date.getTime();
      return diff >= 7 * 24 * 60 * 60 * 1000 && diff < 14 * 24 * 60 * 60 * 1000;
    }
    if (range === "month") {
      const prevMonth = new Date(now); prevMonth.setMonth(now.getMonth() - 1);
      return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear();
    }
    return false;
  };

  const paidOrders = activeOrders.filter(o => o.status === "paid");
  const pendingOrders = activeOrders.filter(o => o.status === "pending");
  const failedOrders = activeOrders.filter(o => o.status === "failed");

  const currentPeriodOrders = paidOrders.filter(o => filterByRange(new Date(o.created_at), revenueRange));
  const prevPeriodOrders = paidOrders.filter(o => filterByRangePrev(new Date(o.created_at), revenueRange));

  const filteredRevenue = currentPeriodOrders.reduce((sum, o) => sum + o.amount_cents, 0);
  const prevRevenue = prevPeriodOrders.reduce((sum, o) => sum + o.amount_cents, 0);

  const revenueDelta = prevRevenue > 0 ? Math.round(((filteredRevenue - prevRevenue) / prevRevenue) * 100) : null;

  const avgTicket = currentPeriodOrders.length > 0 ? filteredRevenue / currentPeriodOrders.length : 0;
  const prevAvgTicket = prevPeriodOrders.length > 0 ? prevRevenue / prevPeriodOrders.length : 0;
  const avgTicketDelta = prevAvgTicket > 0 ? Math.round(((avgTicket - prevAvgTicket) / prevAvgTicket) * 100) : null;

  const ordersInPeriod = currentPeriodOrders.length;
  const prevOrdersInPeriod = prevPeriodOrders.length;
  const ordersDelta = prevOrdersInPeriod > 0 ? Math.round(((ordersInPeriod - prevOrdersInPeriod) / prevOrdersInPeriod) * 100) : null;

  const convRate = activeOrders.length > 0 ? Math.round((paidOrders.length / activeOrders.length) * 100) : 0;

  const fmt$ = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ── Computed: Funnel ────────────────────────────────────────────────────
  const hasEventData = pageEvents.length > 0;
  const funnelViews = hasEventData ? pageEvents.filter(e => e.event_type === "page_view").length : 0;
  const funnelProductClicks = hasEventData ? pageEvents.filter(e => e.event_type === "product_click").length : 0;
  const funnelAddToCart = hasEventData ? pageEvents.filter(e => e.event_type === "add_to_cart").length : 0;
  const funnelCheckoutStart = hasEventData ? pageEvents.filter(e => e.event_type === "checkout_start").length : 0;
  const funnelPurchase = paidOrders.length;
  const funnelMax = Math.max(funnelViews, funnelProductClicks, funnelAddToCart, funnelCheckoutStart, funnelPurchase, 1);

  // ── Computed: Top Products ──────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map: Record<string, { title: string; revenue: number; units: number }> = {};
    paidOrders.forEach(o => {
      const key = (o as any).product_id || "store";
      const prod = products.find(p => p.id === key);
      const title = prod?.title || "All Products";
      if (!map[key]) map[key] = { title, revenue: 0, units: 0 };
      map[key].revenue += o.amount_cents;
      map[key].units += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [paidOrders, products]);

  // ── Computed: Sparkline ─────────────────────────────────────────────────
  const sparklineData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const value = paidOrders
        .filter(o => new Date(o.created_at).toDateString() === d.toDateString())
        .reduce((sum, o) => sum + o.amount_cents, 0);
      days.push({ label, value });
    }
    return days;
  }, [paidOrders]);

  const sparkMax = Math.max(...sparklineData.map(d => d.value), 1);

  // ── Computed: Filtered Orders ───────────────────────────────────────────
  const filteredOrders = activeOrders
    .filter(o => orderStatusFilter === "all" ? true : o.status === orderStatusFilter)
    .filter(o =>
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredLeads = activeLeads.filter(l =>
    l.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Computed: Analytics ─────────────────────────────────────────────────
  const analyticsRangeDays = parseInt(analyticsRange);

  const analyticsEvents = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - analyticsRangeDays);
    return pageEvents.filter(e => new Date(e.created_at) >= cutoff);
  }, [pageEvents, analyticsRangeDays]);

  const analyticsChartData = useMemo(() => {
    const days: { label: string; views: number }[] = [];
    for (let i = analyticsRangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const views = analyticsEvents.filter(e =>
        e.event_type === "page_view" && new Date(e.created_at).toDateString() === d.toDateString()
      ).length;
      days.push({ label, views });
    }
    return days;
  }, [analyticsEvents, analyticsRangeDays]);

  const chartMax = Math.max(...analyticsChartData.map(d => d.views), 1);

  const topReferrers = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter(e => e.referrer).forEach(e => {
      const ref = e.referrer || "direct";
      map[ref] = (map[ref] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [analyticsEvents]);

  const topPaths = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter(e => e.event_type === "page_view").forEach(e => {
      map[e.path] = (map[e.path] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [analyticsEvents]);

  const productClickMap = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter(e => e.event_type === "product_click" && e.product_id).forEach(e => {
      map[e.product_id!] = (map[e.product_id!] || 0) + 1;
    });
    return map;
  }, [analyticsEvents]);

  const uniqueSessions = useMemo(() => {
    const ids = new Set(analyticsEvents.filter(e => e.session_id).map(e => e.session_id));
    return ids.size;
  }, [analyticsEvents]);

  const geoBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter(e => e.country).forEach(e => {
      map[e.country!] = (map[e.country!] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [analyticsEvents]);

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* ── NAV ── */}
      <nav className={`sticky top-0 z-50 md:border-b-0 ${isDark ? "md:bg-black md:border-0 border-b border-white/10 bg-black" : "md:bg-white md:border-0 border-b border-gray-100 bg-white"}`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="md:hidden text-[10px] font-bold uppercase tracking-widest">ADMIN</div>
          <div className="hidden md:flex items-center justify-center gap-8 flex-1">
            {navSections.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
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
            {navSections.map(s => (
              <button
                key={s}
                onClick={() => { setSection(s); setMobileMenuOpen(false); }}
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

        {/* ════════════════════════════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════════════════════════════ */}
        {section === "overview" && (
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Overview</h1>
              <button
                onClick={() => navigate({ to: "/admin/jarvis" })}
                className={`text-[10px] font-bold uppercase px-6 py-3 border transition-all ${
                  isDark
                    ? "border-white/20 text-white hover:bg-white/5"
                    : "border-black/10 text-black hover:bg-black/5"
                }`}
              >
                JARVIS HUB →
              </button>
            </div>

            {/* Period Selector */}
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

            {/* ── REVENUE HERO ── */}
            <div className={`p-8 space-y-4 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Revenue</p>
              <div className="flex items-end gap-4 flex-wrap">
                <p className="text-5xl font-bold tracking-tighter leading-none">{fmt$(filteredRevenue)}</p>
                {revenueDelta !== null && (
                  <div className={`flex items-center gap-1 px-3 py-1 text-[9px] font-bold uppercase ${
                    revenueDelta > 0
                      ? "bg-green-500/10 text-green-500"
                      : revenueDelta < 0
                      ? "bg-red-500/10 text-red-500"
                      : isDark ? "bg-white/10 text-white/50" : "bg-black/5 text-black/40"
                  }`}>
                    {revenueDelta > 0 ? <TrendingUp size={10} /> : revenueDelta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {revenueDelta > 0 ? "+" : ""}{revenueDelta}% vs prior {revenueRange}
                  </div>
                )}
              </div>
              {/* 7-day sparkline */}
              <div className="flex items-end gap-1 h-12 mt-4">
                {sparklineData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full transition-all duration-300 ${isDark ? "bg-white/20 group-hover:bg-white/40" : "bg-black/10 group-hover:bg-black/30"}`}
                      style={{ height: `${(d.value / sparkMax) * 100}%`, minHeight: d.value > 0 ? "2px" : "1px" }}
                    />
                    <span className={`text-[7px] uppercase ${isDark ? "text-white/30" : "text-black/30"}`}>{d.label.slice(0, 1)}</span>
                    {d.value > 0 && (
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[7px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
                        {fmt$(d.value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── SUPPORTING STATS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              <StatWithDelta label="Orders" value={ordersInPeriod} sub="paid this period" delta={ordersDelta} isDark={isDark} />
              <StatWithDelta label="Avg Ticket" value={fmt$(avgTicket)} sub="per paid order" delta={avgTicketDelta} isDark={isDark} />
              <Stat label="Conv Rate" value={`${convRate}%`} sub="checkout to paid" isDark={isDark} />
              <Stat label="Leads" value={activeLeads.length} sub="total captured" isDark={isDark} />
            </div>

            {/* ── ORDER STATUS BREAKDOWN ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Paid", count: paidOrders.length, color: "text-green-500" },
                { label: "Pending", count: pendingOrders.length, color: isDark ? "text-yellow-400" : "text-yellow-600" },
                { label: "Failed", count: failedOrders.length, color: "text-red-500" },
                { label: "Published", count: products.filter(p => p.is_published).length, color: isDark ? "text-white" : "text-black" },
              ].map(item => (
                <div key={item.label} className={`p-4 border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}>{item.label}</p>
                  <p className={`text-xl font-bold tracking-tighter mt-1 ${item.color}`}>{item.count}</p>
                </div>
              ))}
            </div>

            {/* ── CONVERSION FUNNEL ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Conversion Funnel</p>
                {!hasEventData && (
                  <span className={`text-[8px] uppercase tracking-widest px-2 py-0.5 ${isDark ? "bg-white/5 text-white/30" : "bg-gray-100 text-gray-400"}`}>
                    Install tracker to see visitor data
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {[
                  { label: "Page Views", value: hasEventData ? funnelViews : null },
                  { label: "Product Clicks", value: hasEventData ? funnelProductClicks : null },
                  { label: "Add to Cart", value: hasEventData ? funnelAddToCart : null },
                  { label: "Checkout Started", value: hasEventData ? funnelCheckoutStart : null },
                  { label: "Purchased", value: funnelPurchase },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span className={`text-[9px] font-bold uppercase w-32 flex-shrink-0 ${isDark ? "text-white/50" : "text-gray-400"}`}>{step.label}</span>
                    <div className={`flex-1 h-1.5 ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                      {step.value !== null && (
                        <div
                          className={`h-full transition-all duration-500 ${isDark ? "bg-white" : "bg-black"}`}
                          style={{ width: `${((step.value ?? 0) / funnelMax) * 100}%`, opacity: 1 - i * 0.15 }}
                        />
                      )}
                    </div>
                    <span className={`text-[9px] font-bold w-12 text-right ${isDark ? "text-white/70" : "text-black/70"}`}>
                      {step.value !== null ? step.value.toLocaleString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {hasEventData && funnelViews > 0 && funnelPurchase > 0 && (
                <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  Overall: {((funnelPurchase / funnelViews) * 100).toFixed(2)}% visitor-to-purchase
                </p>
              )}
            </div>

            {/* ── TOP PRODUCTS ── */}
            {topProducts.length > 0 && (
              <div className="space-y-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Top Products by Revenue</p>
                <div className={`border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`text-[8px] font-bold uppercase tracking-widest border-b ${isDark ? "text-white/30 border-white/10" : "text-gray-400 border-gray-100"}`}>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                        <th className="px-4 py-3 text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i} className={`border-b last:border-0 ${isDark ? "border-white/5 hover:bg-white/3" : "border-gray-50 hover:bg-gray-50/50"}`}>
                          <td className="px-4 py-3 text-[10px] font-bold uppercase truncate max-w-[180px]">{p.title}</td>
                          <td className={`px-4 py-3 text-[10px] font-bold text-right ${isDark ? "text-white" : "text-black"}`}>{fmt$(p.revenue)}</td>
                          <td className={`px-4 py-3 text-[10px] text-right ${isDark ? "text-white/50" : "text-gray-400"}`}>{p.units}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            PRODUCTS
        ════════════════════════════════════════════════════════════════ */}
        {section === "products" && (
          <div className="space-y-12">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Products</h1>
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  className={`text-[10px] font-bold uppercase px-6 py-3 border transition-all ${
                    selectMode
                      ? isDark ? "border-white bg-white text-black" : "border-black bg-black text-white"
                      : isDark ? "border-white/20 text-white hover:bg-white/5" : "border-black/10 text-black hover:bg-black/5"
                  }`}>
                  {selectMode ? "CANCEL" : "SELECT"}
                </button>
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

            {/* ── Bulk Toolbar ── */}
            {selectMode && selectedIds.size > 0 && (
              <div className={`flex items-center gap-4 p-4 animate-in slide-in-from-top duration-200 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                <span className={`text-[9px] font-bold uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{selectedIds.size} selected</span>
                <div className="flex gap-3 ml-auto">
                  <button onClick={selectAllProducts} className={`text-[9px] font-bold uppercase px-3 py-2 border transition-all ${isDark ? "border-white/20 text-white/70 hover:text-white" : "border-black/10 text-black/50 hover:text-black"}`}>
                    {selectedIds.size === orderedProducts.length ? "DESELECT ALL" : "SELECT ALL"}
                  </button>
                  <button onClick={() => bulkPublish(true)} disabled={isBulkActing}
                    className="flex items-center gap-1.5 text-[9px] font-bold uppercase px-3 py-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all">
                    <Eye size={10} /> PUBLISH
                  </button>
                  <button onClick={() => bulkPublish(false)} disabled={isBulkActing}
                    className={`flex items-center gap-1.5 text-[9px] font-bold uppercase px-3 py-2 ${isDark ? "bg-white/5 text-white/50 hover:bg-white/10" : "bg-black/5 text-black/40 hover:bg-black/10"} transition-all`}>
                    <EyeOff size={10} /> UNPUBLISH
                  </button>
                  <button onClick={bulkDelete} disabled={isBulkActing}
                    className="flex items-center gap-1.5 text-[9px] font-bold uppercase px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                    <Trash2 size={10} /> DELETE
                  </button>
                </div>
              </div>
            )}

            {/* ── Product Form ── */}
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

            {!selectMode && (
              <p className={`text-[8px] uppercase tracking-widest ${isDark ? "text-white/20" : "text-black/20"}`}>
                Drag cards to reorder · Click SELECT for bulk actions
              </p>
            )}

            {/* ── Product Grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {orderedProducts.map(p => {
                const isPrintful = !!p.printful_id;
                const isSelected = selectedIds.has(p.id);
                const isDragging = draggedId === p.id;
                const isDragTarget = dragOverId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`group relative transition-all duration-200 ${isDragging ? "opacity-40 scale-95" : ""} ${isDragTarget ? isDark ? "ring-1 ring-white/40" : "ring-1 ring-black/20" : ""}`}
                    draggable={!selectMode}
                    onDragStart={() => handleDragStart(p.id)}
                    onDragOver={e => handleDragOver(e, p.id)}
                    onDrop={() => handleDrop(p.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    onClick={() => selectMode && toggleSelectProduct(p.id)}
                  >
                    {selectMode && (
                      <div className="absolute top-2 left-2 z-10">
                        {isSelected
                          ? <CheckSquare size={14} className={isDark ? "text-white" : "text-black"} />
                          : <Square size={14} className={isDark ? "text-white/40" : "text-black/30"} />
                        }
                      </div>
                    )}
                    {!selectMode && (
                      <div className={`absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity ${isDark ? "text-white/40" : "text-black/30"}`}>
                        <GripVertical size={12} />
                      </div>
                    )}
                    {isPrintful && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[7px] font-bold uppercase">
                        <Lock size={7} /> PF
                      </div>
                    )}
                    <div className={`relative flex aspect-[2/3] items-center justify-center overflow-hidden p-3 sm:p-4 transition-all duration-300 ${
                      isDark ? "bg-white/5" : "bg-gray-50/50"
                    } ${isSelected ? isDark ? "ring-1 ring-white" : "ring-1 ring-black" : ""} ${selectMode ? "cursor-pointer" : ""}`}>
                      {p.image_urls && p.image_urls.length > 1 ? (
                        <img src={p.image_urls[1]} alt={p.title} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-all duration-300" />
                      ) : (
                        <span className={`text-[7px] uppercase tracking-[0.3em] ${isDark ? "text-white/20" : "text-black/20"}`}>No Image</span>
                      )}
                    </div>
                    <div className="px-2 text-center mt-2">
                      <p className={`mb-1 text-[9px] uppercase leading-tight tracking-[0.1em] truncate font-bold ${isDark ? "text-white" : "text-black"}`}>{p.title}</p>
                      <p className={`text-[9px] tracking-[0.05em] ${isDark ? "text-white/70" : "text-black/70"}`}>
                        ${(p.price_cents / 100).toFixed(0)}
                      </p>
                      {!selectMode && (
                        <div className="flex items-center justify-center gap-3 mt-3">
                          <button onClick={e => { e.stopPropagation(); togglePublished(p.id, p.is_published); }}
                            className={`w-2 h-2 rounded-full transition-all ${p.is_published ? "bg-green-500" : "bg-red-500"}`} />
                          {isPrintful ? (
                            <span className={`${isDark ? "text-white/20" : "text-black/20"} cursor-not-allowed`} title="Printful products can only be edited in Printful">
                              <Edit3 size={12} />
                            </span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); startEditProduct(p); }} className={`${isDark ? "text-white/40 hover:text-white" : "text-black/30 hover:text-black"} transition-colors`}>
                              <Edit3 size={12} />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); archiveProduct(p.id); }} className={`${isDark ? "text-white/40 hover:text-red-400" : "text-black/30 hover:text-red-500"} transition-colors`}>
                            <Archive size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            ORDERS
        ════════════════════════════════════════════════════════════════ */}
        {section === "orders" && (
          <div className="space-y-8">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Orders</h1>
              <input type="text" placeholder="SEARCH…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`text-[10px] font-bold uppercase border-b focus:outline-none pb-1 w-48 bg-transparent ${
                  isDark ? "border-white/20 text-white placeholder-white/30" : "border-black text-black placeholder-black/30"
                }`} />
            </div>

            <div className={`flex gap-0 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
              {([
                { key: "all", label: "All", count: activeOrders.length },
                { key: "paid", label: "Paid", count: paidOrders.length },
                { key: "pending", label: "Pending", count: pendingOrders.length },
                { key: "failed", label: "Failed", count: failedOrders.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setOrderStatusFilter(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-all -mb-px ${
                    orderStatusFilter === tab.key
                      ? isDark ? "border-white text-white" : "border-black text-black"
                      : isDark ? "border-transparent text-white/40 hover:text-white/60" : "border-transparent text-gray-400 hover:text-black/60"
                  }`}
                >
                  {tab.label}
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                    orderStatusFilter === tab.key
                      ? isDark ? "bg-white text-black" : "bg-black text-white"
                      : isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500"
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-[9px] font-bold uppercase tracking-widest border-b ${
                    isDark ? "text-white/50 border-white/10" : "text-gray-400 border-gray-100"
                  }`}>
                    <th className="pb-4">Email</th>
                    <th className="pb-4">Name</th>
                    <th className="pb-4">Amount</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id}
                      className={`border-b cursor-pointer ${isDark ? "border-white/5 hover:bg-white/5" : "border-gray-50 hover:bg-gray-50/50"}`}
                      onClick={() => setSelectedRow({ ...o, _type: "order" })}
                    >
                      <td className="py-5 text-xs font-bold uppercase">{o.email}</td>
                      <td className={`py-5 text-[10px] uppercase ${isDark ? "text-white/60" : "text-gray-500"}`}>{o.name || "—"}</td>
                      <td className="py-5 text-xs font-bold uppercase">{fmt$(o.amount_cents)}</td>
                      <td className="py-5">
                        <span className={`text-[8px] font-bold uppercase px-2 py-1 ${
                          o.status === "paid" ? "bg-green-500/10 text-green-500" :
                          o.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-red-500/10 text-red-500"
                        }`}>{o.status}</span>
                      </td>
                      <td className={`py-5 text-[10px] uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <p className={`text-center py-12 text-[10px] uppercase tracking-widest ${isDark ? "text-white/20" : "text-gray-300"}`}>
                  No orders found
                </p>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            LEADS
        ════════════════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════════════════
            ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {section === "analytics" && (
          <div className="space-y-12">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold uppercase tracking-tighter">Analytics</h1>
              <div className="flex gap-3">
                {(["7", "14", "30"] as const).map(r => (
                  <button key={r} onClick={() => setAnalyticsRange(r)}
                    className={`text-[9px] font-bold uppercase px-4 py-2 transition-all ${
                      analyticsRange === r
                        ? isDark ? "bg-white text-black" : "bg-black text-white"
                        : isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"
                    }`}>
                    {r}D
                  </button>
                ))}
              </div>
            </div>

            {!hasEventData && (
              <div className={`p-8 border space-y-4 ${isDark ? "border-white/10 bg-white/3" : "border-gray-100 bg-gray-50/50"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Tracker Not Installed</p>
                <p className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  Add the snippet below to your frontend to start tracking page views, product clicks, add-to-cart, and checkout events.
                </p>
                <pre className={`text-[9px] p-4 overflow-x-auto font-mono ${isDark ? "bg-white/5 text-white/60" : "bg-gray-100 text-gray-600"}`}>
{`export function trackEvent(type, data = {}) {
  supabase.from('page_events').insert([{
    event_type: type,
    path: window.location.pathname,
    session_id: sessionStorage.getItem('sid') || (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem('sid', id);
      return id;
    })(),
    referrer: document.referrer || null,
    ...data
  }]);
}`}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              <Stat label="Page Views" value={analyticsEvents.filter(e => e.event_type === "page_view").length.toLocaleString()} sub={`last ${analyticsRange} days`} isDark={isDark} />
              <Stat label="Sessions" value={uniqueSessions.toLocaleString()} sub="unique visitors" isDark={isDark} />
              <Stat label="Product Clicks" value={analyticsEvents.filter(e => e.event_type === "product_click").length.toLocaleString()} sub="product page views" isDark={isDark} />
              <Stat label="Checkout Starts" value={analyticsEvents.filter(e => e.event_type === "checkout_start").length.toLocaleString()} sub="initiated checkout" isDark={isDark} />
            </div>

            <div className="space-y-4">
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Daily Page Views</p>
              <div className="flex items-end gap-1 h-32">
                {analyticsChartData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full transition-all duration-300 ${isDark ? "bg-white/20 group-hover:bg-white/40" : "bg-black/10 group-hover:bg-black/25"}`}
                      style={{ height: `${(d.views / chartMax) * 100}%`, minHeight: d.views > 0 ? "2px" : "1px" }}
                    />
                    {d.views > 0 && (
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[7px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
                        {d.views}
                      </div>
                    )}
                    {i % Math.ceil(analyticsRangeDays / 7) === 0 && (
                      <span className={`text-[7px] uppercase hidden sm:block ${isDark ? "text-white/20" : "text-black/20"}`}>{d.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Top Referrers</p>
                {topReferrers.length === 0 ? (
                  <p className={`text-[9px] uppercase ${isDark ? "text-white/20" : "text-gray-300"}`}>No referrer data yet</p>
                ) : (
                  <div className="space-y-2">
                    {topReferrers.map(([ref, count]) => (
                      <div key={ref} className="flex items-center justify-between gap-4">
                        <span className={`text-[9px] truncate font-bold uppercase ${isDark ? "text-white/60" : "text-black/60"}`}>{ref || "direct"}</span>
                        <span className={`text-[9px] font-bold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Top Pages</p>
                {topPaths.length === 0 ? (
                  <p className={`text-[9px] uppercase ${isDark ? "text-white/20" : "text-gray-300"}`}>No path data yet</p>
                ) : (
                  <div className="space-y-2">
                    {topPaths.map(([path, count]) => (
                      <div key={path} className="flex items-center justify-between gap-4">
                        <span className={`text-[9px] truncate font-mono ${isDark ? "text-white/60" : "text-black/60"}`}>{path}</span>
                        <span className={`text-[9px] font-bold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {Object.keys(productClickMap).length > 0 && (
              <div className="space-y-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Product Click-Through</p>
                <div className={`border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`text-[8px] font-bold uppercase tracking-widest border-b ${isDark ? "text-white/30 border-white/10" : "text-gray-400 border-gray-100"}`}>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(productClickMap)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([pid, clicks]) => {
                          const prod = products.find(p => p.id === pid);
                          return (
                            <tr key={pid} className={`border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-50"}`}>
                              <td className="px-4 py-3 text-[10px] font-bold uppercase">{prod?.title || pid}</td>
                              <td className="px-4 py-3 text-[10px] font-bold text-right">{clicks}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {geoBreakdown.length > 0 && (
              <div className="space-y-4">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Geographic Breakdown</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {geoBreakdown.map(([country, count]) => (
                    <div key={country} className={`p-4 border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                      <p className={`text-[9px] font-bold uppercase ${isDark ? "text-white/50" : "text-gray-400"}`}>{country}</p>
                      <p className="text-xl font-bold tracking-tighter mt-1">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SETTINGS
        ════════════════════════════════════════════════════════════════ */}
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
                          localStorage.setItem("theme", "light");
                          document.documentElement.classList.remove("dark");
                          saveSiteConfig({ ...siteContent, theme: "light" });
                        }}
                        className={`px-4 py-2 text-[9px] font-bold uppercase transition-all ${!isDark ? "bg-black text-white" : "hover:bg-white/10"}`}
                      >
                        LIGHT
                      </button>
                      <button
                        onClick={() => {
                          setIsDark(true);
                          document.documentElement.classList.add("dark");
                          localStorage.setItem("theme", "dark");
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
                <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>Team Access</h2>
                <div className={`p-6 space-y-6 ${isDark ? "bg-white/5" : "bg-gray-50/50"}`}>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      type="email"
                      placeholder="EMAIL ADDRESS"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className={`flex-1 min-w-0 bg-transparent border-b focus:outline-none pb-1 text-[10px] font-bold uppercase ${
                        isDark ? "border-white/20 text-white placeholder-white/30" : "border-black/20 text-black placeholder-black/30"
                      }`}
                    />
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value as any)}
                      className={`text-[9px] font-bold uppercase bg-transparent border-b pb-1 focus:outline-none ${
                        isDark ? "border-white/20 text-white" : "border-black/20 text-black"
                      }`}
                    >
                      <option value="viewer">VIEWER</option>
                      <option value="manager">MANAGER</option>
                      <option value="admin">ADMIN</option>
                    </select>
                    <button
                      onClick={handleAddAdminUser}
                      disabled={isAddingUser || !newUserEmail.trim()}
                      className={`text-[9px] font-bold uppercase px-6 py-2 transition-all ${
                        isDark ? "bg-white text-black hover:bg-gray-200 disabled:opacity-30" : "bg-black text-white hover:bg-gray-800 disabled:opacity-30"
                      }`}
                    >
                      {isAddingUser ? "ADDING…" : "ADD"}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { role: "viewer", desc: "Read-only access to all data" },
                      { role: "manager", desc: "Edit products & orders" },
                      { role: "admin", desc: "Full access including settings" },
                    ].map(r => (
                      <div key={r.role} className={`p-3 border ${isDark ? "border-white/10" : "border-gray-100"}`}>
                        <p className={`text-[8px] font-bold uppercase ${isDark ? "text-white" : "text-black"}`}>{r.role}</p>
                        <p className={`text-[8px] mt-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>{r.desc}</p>
                      </div>
                    ))}
                  </div>

                  {adminUsers.length > 0 ? (
                    <div className="space-y-2">
                      {adminUsers.map(u => (
                        <div key={u.id} className={`flex items-center justify-between gap-4 py-3 border-b ${isDark ? "border-white/5" : "border-gray-50"}`}>
                          <span className="text-[10px] font-bold uppercase truncate flex-1">{u.email}</span>
                          <select
                            value={u.role}
                            onChange={e => handleUpdateUserRole(u.id, e.target.value as any)}
                            className={`text-[8px] font-bold uppercase bg-transparent focus:outline-none ${isDark ? "text-white/60" : "text-black/60"}`}
                          >
                            <option value="viewer">VIEWER</option>
                            <option value="manager">MANAGER</option>
                            <option value="admin">ADMIN</option>
                          </select>
                          <button onClick={() => handleRemoveAdminUser(u.id)}
                            className={`${isDark ? "text-white/30 hover:text-red-400" : "text-black/20 hover:text-red-500"} transition-colors`}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-white/20" : "text-gray-300"}`}>No team members added yet</p>
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
            </div>
          </div>
        )}



      </main>

      {/* ── ORDER DETAIL MODAL ── */}
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

// ────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, isDark }: { label: string; value: string | number; sub: string; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>{label}</p>
      <p className="text-2xl font-bold tracking-tighter">{value}</p>
      <p className={`text-[8px] uppercase tracking-widest ${isDark ? "text-white/30" : "text-gray-400"}`}>{sub}</p>
    </div>
  );
}

function StatWithDelta({ label, value, sub, delta, isDark }: { label: string; value: string | number; sub: string; delta: number | null; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-400"}`}>{label}</p>
      <div className="flex items-end gap-2 flex-wrap">
        <p className="text-2xl font-bold tracking-tighter">{value}</p>
        {delta !== null && (
          <span className={`text-[8px] font-bold uppercase pb-0.5 ${
            delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : isDark ? "text-white/30" : "text-gray-300"
          }`}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"}{Math.abs(delta)}%
          </span>
        )}
      </div>
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

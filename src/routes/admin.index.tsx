import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { toast, Toaster } from "sonner";
import { Edit3, Archive, X, Menu, RefreshCw, BarChart2, Lock, CheckSquare, Square, Trash2, Eye, EyeOff, GripVertical, Users, TrendingUp, TrendingDown, Minus, Terminal, Cpu, Zap, Activity, AlertTriangle, Play } from "lucide-react";
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

type NavSection = "overview" | "products" | "orders" | "leads" | "analytics" | "settings";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Command Center" }],
  }),
  beforeLoad: requireAdmin,
  component: AdminPage,
});

// ────────────────────────────────────────────────────────────────────────────
// BULLETPROOF EVENT NORMALIZATION PARSER
// ────────────────────────────────────────────────────────────────────────────
const getAddToCartCount = (eventsList: PageEvent[]): number => {
  return eventsList.filter(e => {
    const type = e.event_type?.toLowerCase() || "";
    return type === "add_to_cart" || type === "add-to-cart" || type === "cart" || type === "addtocart";
  }).length;
};

// ────────────────────────────────────────────────────────────────────────────
// LED VISUAL GLOW COMPONENT
// ────────────────────────────────────────────────────────────────────────────
function LedPulse({ color, active = true }: { color: "green" | "yellow" | "red" | "cyan" | "purple" | "neutral"; active?: boolean }) {
  const colorMap = {
    green: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]",
    yellow: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.9)]",
    red: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]",
    cyan: "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]",
    purple: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.9)]",
    neutral: "bg-neutral-400 shadow-[0_0_6px_rgba(163,163,163,0.5)]",
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full transition-all duration-300 ${colorMap[color]} ${active ? "animate-pulse" : ""}`} />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// INTERACTIVE TELEMETRY CANVAS COMPONENT (TRAVERSAL EMULATOR)
// ────────────────────────────────────────────────────────────────────────────
interface TelemetryCanvasRef {
  triggerSimulatedPacket: (type: "view" | "click" | "cart" | "checkout" | "purchase") => void;
}

const TelemetryCanvas = ({ events, isDark, canvasRefExternal }: { events: PageEvent[]; isDark: boolean; canvasRefExternal?: React.RefObject<TelemetryCanvasRef | null> }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevEventsLength = useRef(events.length);

  const packets = useRef<Array<{
    x: number;
    y: number;
    targetNode: number;
    speed: number;
    color: string;
    size: number;
  }>>([]);

  const spawnPacket = useCallback((eventType: string) => {
    let targetNode = 0;
    let color = isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(0, 0, 0, 0.85)";

    const normalized = eventType.toLowerCase();
    if (normalized === "product_click") {
      targetNode = 1;
      color = "rgba(56, 189, 248, 0.95)"; 
    } else if (normalized === "add_to_cart" || normalized === "add-to-cart" || normalized === "cart") {
      targetNode = 2;
      color = "rgba(245, 158, 11, 0.95)"; 
    } else if (normalized === "checkout_start") {
      targetNode = 3;
      color = "rgba(168, 85, 247, 0.95)"; 
    } else if (normalized === "purchase" || normalized === "paid") {
      targetNode = 4;
      color = "rgba(16, 185, 129, 0.95)"; 
    }

    packets.current.push({
      x: 40,
      y: 70,
      targetNode,
      speed: 1.8 + Math.random() * 1.5,
      color,
      size: 4.5 + Math.random() * 2.5,
    });
  }, [isDark]);

  // Expose manual trigger API to other modules/buttons
  useEffect(() => {
    if (canvasRefExternal) {
      (canvasRefExternal as any).current = {
        triggerSimulatedPacket: (type: "view" | "click" | "cart" | "checkout" | "purchase") => {
          const map = {
            view: "page_view",
            click: "product_click",
            cart: "add_to_cart",
            checkout: "checkout_start",
            purchase: "purchase",
          };
          spawnPacket(map[type]);
        }
      };
    }
  }, [canvasRefExternal, spawnPacket]);

  useEffect(() => {
    if (events.length > prevEventsLength.current) {
      const difference = events.length - prevEventsLength.current;
      for (let i = 0; i < difference; i++) {
        const ev = events[i];
        if (ev) {
          spawnPacket(ev.event_type);
        }
      }
    }
    prevEventsLength.current = events.length;
  }, [events, spawnPacket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const nodes = [
      { name: "VIEW", x: 40, y: 70 },
      { name: "CLICK", x: 140, y: 70 },
      { name: "CART", x: 240, y: 70 },
      { name: "CHECKOUT", x: 340, y: 70 },
      { name: "PAID", x: 440, y: 70 },
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);

      // System background grid
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)";
      ctx.lineWidth = 1;
      const gridSpacing = 16;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const spacingX = (width - 80) / 4;
      nodes.forEach((n, idx) => {
        n.x = 40 + spacingX * idx;
        n.y = height / 2;
      });

      // Node path tracks
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < nodes.length; i++) {
        ctx.lineTo(nodes[i].x, nodes[i].y);
      }
      ctx.stroke();

      // Ambient stream simulation
      if (Math.random() < 0.015) {
        packets.current.push({
          x: nodes[0].x,
          y: nodes[0].y,
          targetNode: Math.floor(Math.random() * 4) + 1,
          speed: 1.0 + Math.random() * 1.0,
          color: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.12)",
          size: 2.5,
        });
      }

      // Draw active traveling packets
      packets.current.forEach((p, idx) => {
        const nextNode = nodes[p.targetNode];

        if (p.x < nextNode.x) {
          p.x += p.speed;
        } else {
          p.x = nextNode.x;
        }

        p.y = nextNode.y;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = isDark ? 10 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (p.x >= nextNode.x) {
          packets.current.splice(idx, 1);
        }
      });

      // Draw node terminals
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#000000" : "#ffffff";
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#ffffff" : "#000000";
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.5)";
        ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, n.y + 24);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <div 
      className="relative w-full h-32 md:h-36 border border-[#D1D1D6] dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/10 shadow-[0_12px_24px_rgba(0,0,0,0.02)] overflow-hidden"
      style={{ borderRadius: "24px", overflow: "hidden", borderColor: isDark ? "#333338" : "#D1D1D6" }}
    >
      <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[8px] font-mono tracking-widest text-neutral-400 dark:text-neutral-500 uppercase">SYS_TELEMETRY_STREAM</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COGNITIVE INTEL INTERACTIVE AI ENGINE MODULE
// ────────────────────────────────────────────────────────────────────────────
function AiAgentConsole({ isDark, onSimulatePacket }: { isDark: boolean; onSimulatePacket: (type: "view" | "click" | "cart" | "checkout" | "purchase") => void }) {
  const [logs, setLogs] = useState<string[]>([
    "SYS_COGNITIVE_ENGINE: Initializing analytical sequence...",
    "COGNITIVE_AGENT: Thread pool mounted. Listening on pg_realtime...",
  ]);
  const [thinkingSpeed, setThinkingSpeed] = useState(3000); // ms per check
  const [activeTask, setActiveTask] = useState("Awaiting telemetry...");

  // Generate automated diagnostics logs based on system tasks
  useEffect(() => {
    const tasks = [
      "Evaluating cart-to-checkout progression anomalies...",
      "Correlating landing page traffic spikes with active leads...",
      "Analyzing pricing elasticity indices on store config...",
      "Optimizing real-time cache indices for catalog retrieval...",
      "Auditing active administrator operational permissions...",
    ];

    const interval = setInterval(() => {
      const selectedTask = tasks[Math.floor(Math.random() * tasks.length)];
      setActiveTask(selectedTask);
      
      const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLogs(prev => {
        const updated = [`[${timestamp}] Jarvis_AI: ${selectedTask}`, ...prev];
        return updated.slice(0, 15); // keep log history light
      });
    }, thinkingSpeed);

    return () => clearInterval(interval);
  }, [thinkingSpeed]);

  return (
    <div 
      className={`p-6 border relative overflow-hidden transition-all duration-300 ${
        isDark ? "bg-neutral-950/45 border-neutral-800/80" : "bg-white border-[#D1D1D6] shadow-[0_24px_48px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.06)]"
      }`}
      style={{ borderRadius: "24px", overflow: "hidden", borderColor: isDark ? "#333338" : "#D1D1D6" }}
    >
      {/* Grid line indicator background */}
      <div className="absolute top-0 right-0 p-3 flex items-center gap-1.5 pointer-events-none text-[8px] font-mono tracking-widest text-neutral-400 dark:text-neutral-500 uppercase">
        <Cpu size={12} className="animate-spin" style={{ animationDuration: "10s" }} />
        <span>Jarvis Cognitive Core v4.1</span>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
            <LedPulse color="purple" />
            <span>Jarvis Cognitive Engine Diagnostics</span>
          </h3>
          <p className={`text-[10px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            ACTIVE REASONING: <span className="text-purple-400 font-bold">{activeTask}</span>
          </p>
        </div>

        {/* Live typing diagnostic output console */}
        <div className={`p-4 border rounded-[16px] font-mono text-[9px] h-32 overflow-y-auto space-y-1.5 ${
          isDark ? "bg-black/80 border-neutral-900 text-purple-300" : "bg-neutral-50 border-[#E5E5EA] text-purple-700"
        }`}>
          {logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2 animate-in fade-in duration-300">
              <span className="opacity-40">❯</span>
              <span className="leading-relaxed whitespace-pre-wrap">{log}</span>
            </div>
          ))}
        </div>

        {/* Interactable Telemetry Slider & Simulation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[8px] font-mono font-bold tracking-widest uppercase text-neutral-400">
              <span>Reasoning Throttle (Delay: {thinkingSpeed}ms)</span>
              <Zap size={10} className="text-purple-400" />
            </div>
            <input 
              type="range" 
              min={1000} 
              max={8000} 
              step={500}
              value={thinkingSpeed} 
              onChange={e => setThinkingSpeed(Number(e.target.value))}
              className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-neutral-400 block">
              Inject Telemetry Signal (Manual Override)
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {(["view", "click", "cart", "checkout", "purchase"] as const).map(signal => (
                <button
                  key={signal}
                  onClick={() => {
                    onSimulatePacket(signal);
                    setLogs(prev => {
                      const t = new Date().toLocaleTimeString("en-US", { hour12: false });
                      return [`[${t}] SYSTEM: Manual telemetry override payload [${signal.toUpperCase()}] injected.`, ...prev];
                    });
                  }}
                  className="flex-1 min-w-[50px] text-[8px] font-mono font-black uppercase tracking-widest border py-1.5 rounded-[9999px] hover:bg-purple-500/10 hover:border-purple-500/40 transition-all dark:border-neutral-850 dark:text-neutral-400 dark:hover:text-purple-300 border-[#E5E5EA] text-neutral-600 bg-white shadow-sm"
                >
                  {signal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE COMPONENT
// ────────────────────────────────────────────────────────────────────────────
function AdminPage() {
  const navigate = useNavigate();

  const navSections: NavSection[] = ["overview", "products", "orders", "leads", "analytics", "settings"];
  const [section, setSection] = useState<NavSection>("overview");

  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secure Handshake & Authentication Gate States
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // External Ref to connect AI Engine Simulator with the Telemetry Canvas
  const telemetryCanvasRef = useRef<TelemetryCanvasRef | null>(null);

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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoadingAuth(false);
          navigate({ to: "/login", replace: true } as any);
          return;
        }
        setUserEmail(user.email || null);
        await fetchData();
        setIsAuthorized(true);
      } catch (error) {
        console.error("Auth initialization failure:", error);
        navigate({ to: "/login", replace: true } as any);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    init();
  }, [navigate]);

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
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, ordersRes, leadsRes, siteRes, eventsRes, usersRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("orders").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("site_config").select("*").eq("id", "main").maybeSingle(),
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
    const ToIdx = reordered.findIndex(p => p.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(ToIdx, 0, moved);
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

  const handleOpenJarvis = async () => {
    try {
      if (
        document.documentElement.requestFullscreen &&
        !document.fullscreenElement
      ) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // Fullscreen denied or unavailable — proceed anyway
    }
    navigate({ to: "/admin/jarvis" });
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

  const fmt$ = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ── Computed: Funnel ────────────────────────────────────────────────────
  const hasEventData = pageEvents.length > 0;
  const funnelViews = hasEventData ? pageEvents.filter(e => e.event_type === "page_view").length : 0;
  const funnelProductClicks = hasEventData ? pageEvents.filter(e => e.event_type === "product_click").length : 0;
  const funnelAddToCart = hasEventData ? getAddToCartCount(pageEvents) : 0;
  const funnelCheckoutStart = hasEventData ? pageEvents.filter(e => e.event_type === "checkout_start").length : 0;
  const funnelPurchase = paidOrders.length;
  const funnelMax = Math.max(funnelViews, funnelProductClicks, funnelAddToCart, funnelCheckoutStart, funnelPurchase, 1);

  // ── Computed: Live events matching the current selected period ────────────
  const currentPeriodEvents = useMemo(() => {
    return pageEvents.filter(e => filterByRange(new Date(e.created_at), revenueRange));
  }, [pageEvents, revenueRange]);

  const currentPeriodAddToCart = useMemo(() => {
    return getAddToCartCount(currentPeriodEvents);
  }, [currentPeriodEvents]);

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

  // ── RENDER SECURITY SAFEGUARD LOADERS ───────────────────────────────────
  if (isLoadingAuth) {
    return (
      <div 
        className={`min-h-screen flex flex-col items-center justify-center ${isDark ? "bg-black text-white" : "bg-[#f5f5f7] text-black"}`}
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "SF Compact", "Helvetica Neue", Helvetica, Arial, sans-serif'
        }}
      >
        <div className="space-y-4 text-center max-w-sm px-6">
          <div className="relative w-12 h-12 mx-auto">
            <div className={`absolute inset-0 rounded-full border-2 border-t-transparent animate-spin ${isDark ? "border-white" : "border-black"}`} />
            <div className={`absolute inset-2 rounded-full border border-b-transparent animate-spin ${isDark ? "border-neutral-800" : "border-neutral-300"}`} style={{ animationDirection: "reverse" }} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono font-bold">INITIALIZING CORE CONTROL</p>
            <p className="text-[8px] uppercase tracking-widest font-mono text-neutral-500 animate-pulse">AUTHORIZING CREDENTIALS & MOUNTING SYSTEMS</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div 
      className={`admin-page min-h-screen relative ${isDark ? "bg-black text-neutral-100 selection:bg-neutral-800" : "bg-[#f5f5f7] text-neutral-900 selection:bg-neutral-200"}`}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "SF Compact", "Helvetica Neue", Helvetica, Arial, sans-serif'
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-sky-500/10 dark:bg-white/5 pointer-events-none animate-bounce z-40 opacity-40" style={{ animationDuration: "12s" }} />

      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04] z-0"
        style={{
          backgroundImage: `radial-gradient(${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      />


      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen w-56 z-50 border-r ${isDark ? "bg-neutral-950/98 border-white/[0.06]" : "bg-white/98 border-black/[0.07]"} backdrop-blur-xl`}>

        {/* Brand */}
        <div className={`px-5 pt-6 pb-5 border-b ${isDark ? "border-white/[0.05]" : "border-black/[0.06]"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" style={{ boxShadow: "0 0 6px #10b981", animation: "pulse 2s infinite" }} />
            <span className={`text-[12px] font-mono font-bold uppercase tracking-[0.2em] ${isDark ? "text-white" : "text-neutral-900"}`}>Admin</span>
          </div>
          <p className={`text-[9px] font-mono pl-4 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Section Navigation */}
        <div className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
          {navSections.map(s => {
            const icons: Record<string, string> = {
              overview: "◎", products: "▦", orders: "≡", leads: "◉", analytics: "∿", settings: "⚙"
            };
            return (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
                  section === s
                    ? isDark
                      ? "bg-white/[0.09] text-white"
                      : "bg-black/[0.07] text-black"
                    : isDark
                      ? "text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04]"
                      : "text-neutral-400 hover:text-neutral-900 hover:bg-black/[0.04]"
                }`}
              >
                <span className="text-[13px] w-4 text-center leading-none opacity-80">{icons[s] || "·"}</span>
                {s}
                {section === s && <span className={`ml-auto w-1 h-1 rounded-full ${isDark ? "bg-white" : "bg-black"}`} />}
              </button>
            );
          })}
        </div>

        {/* Live KPIs */}
        <div className={`mx-2.5 mb-2 rounded-[14px] p-3 space-y-2 ${isDark ? "bg-white/[0.03] border border-white/[0.05]" : "bg-black/[0.03] border border-black/[0.05]"}`}>
          <p className={`text-[8px] font-mono font-bold uppercase tracking-[0.2em] mb-2 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>Live</p>
          {([
            { label: "Revenue", value: fmt$(filteredRevenue) },
            { label: "Paid Orders", value: String(paidOrders.length) },
            { label: "Leads", value: String(activeLeads.length) },
            { label: "Published", value: String(products.filter(p => p.is_published).length) },
          ] as const).map(stat => (
            <div key={stat.label} className="flex justify-between items-baseline gap-2">
              <span className={`text-[9px] font-mono ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{stat.label}</span>
              <span className={`text-[11px] font-mono font-bold tabular-nums ${isDark ? "text-white" : "text-neutral-900"}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className={`px-2.5 py-3 border-t space-y-0.5 ${isDark ? "border-white/[0.05]" : "border-black/[0.06]"}`}>
          <button
            onClick={handleOpenJarvis}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[10px] font-mono font-semibold uppercase tracking-wider transition-all ${isDark ? "text-neutral-500 hover:text-white hover:bg-white/[0.05]" : "text-neutral-400 hover:text-black hover:bg-black/[0.04]"}`}
          >
            <span className="text-[12px]">◈</span> AI Console
          </button>
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[10px] font-mono font-semibold uppercase tracking-wider transition-all ${isDark ? "text-neutral-600 hover:text-rose-400 hover:bg-rose-500/[0.07]" : "text-neutral-400 hover:text-rose-600 hover:bg-rose-50"}`}
          >
            <span className="text-[12px]">↑</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── NAV ── */}
      <nav className={`md:hidden sticky top-0 z-50 backdrop-blur-xl border-b ${isDark ? "bg-black/90 border-white/[0.06]" : "bg-white/90 border-black/[0.07]"}`}>
        <div className="relative flex items-center justify-center px-6 py-3">

          {/* Centered nav pill */}
          <div className={`hidden md:flex items-center justify-center gap-0.5 p-1 rounded-[9999px] ${isDark ? "bg-neutral-900/80" : "bg-[#e8e8ed]/80"}`}>
            {navSections.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`text-[10px] font-mono font-semibold uppercase tracking-widest transition-all duration-200 px-4 py-1.5 rounded-[9999px] ${
                  section === s
                    ? isDark
                      ? "text-white bg-neutral-800 shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
                      : "text-black bg-white shadow-[0_2px_10px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]"
                    : isDark
                      ? "text-neutral-500 hover:text-neutral-200"
                      : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Mobile hamburger — pinned right */}
          <div className="absolute right-6 flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`md:hidden p-1.5 rounded-[9999px] transition-colors ${isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-900" : "text-neutral-500 hover:text-black hover:bg-neutral-100"}`}
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className={`md:hidden border-t ${isDark ? "border-neutral-900 bg-black" : "border-[#D1D1D6] bg-white"} px-5 py-3 space-y-1`}>
            {navSections.map(s => (
              <button
                key={s}
                onClick={() => { setSection(s); setMobileMenuOpen(false); }}
                className={`block w-full text-left text-[10px] font-mono font-semibold uppercase tracking-widest py-2 px-3 rounded-[9999px] transition-all ${
                  section === s
                    ? isDark ? "text-white bg-neutral-900" : "text-black bg-[#e8e8ed]"
                    : isDark ? "text-neutral-500 hover:text-neutral-200" : "text-neutral-400 hover:text-neutral-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className="relative w-full px-6 py-8 space-y-8 z-10 md:ml-56 md:px-10 md:py-10">

        {/* ════════════════════════════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════════════════════════════ */}
        {section === "overview" && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* Mobile-only header */}
            <div className="flex items-end justify-between gap-4 flex-wrap md:hidden">
              <div className="space-y-1">
                <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-neutral-950"}`} style={{ letterSpacing: "-0.03em" }}>
                  Overview
                </h1>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px #10b981" }} />
                  <p className={`text-[10px] font-mono font-medium ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Live · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenJarvis}
                className={`group flex items-center gap-2 text-[9px] font-mono font-bold tracking-widest uppercase px-5 py-2.5 transition-all duration-200 rounded-[9999px] ${
                  isDark
                    ? "border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white hover:bg-white/[0.04]"
                    : "border border-black/[0.10] text-neutral-600 bg-white hover:bg-neutral-50 hover:text-black shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
                }`}
              >
                AI Console
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </button>
            </div>
            {/* Desktop-only section header */}
            <div className="hidden md:flex items-center justify-between">
              <div>
                <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-neutral-950"}`} style={{ letterSpacing: "-0.04em" }}>Overview</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px #10b981" }} />
                  <p className={`text-[10px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Live · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Selector */}
            <div className={`inline-flex items-center gap-0.5 p-1 rounded-[9999px] ${isDark ? "bg-neutral-900/60" : "bg-neutral-100/80"}`}>
              {(["day", "week", "month", "all"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRevenueRange(r as any)}
                  className={`text-[9px] font-mono font-bold uppercase px-4 py-1.5 rounded-[9999px] transition-all duration-200 ${
                    revenueRange === r
                      ? isDark
                        ? "bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
                        : "bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                      : isDark
                        ? "text-neutral-500 hover:text-neutral-200"
                        : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {r === "day" ? "Today" : r === "week" ? "Week" : r === "month" ? "Month" : "All"}
                </button>
              ))}
            </div>

            {/* ── REVENUE HERO + STATS DESKTOP BENTO ── */}
            {/* On desktop these stack in a 2-column grid with period selector inline */}
            <div className="md:grid md:grid-cols-3 md:gap-5">
              <div className="md:col-span-2 space-y-5">

            {/* ── REVENUE HERO ── */}
            <div className={`relative rounded-[28px] overflow-hidden transition-all duration-500 ${
              isDark
                ? "border border-white/[0.07] bg-neutral-950/70"
                : "border border-black/[0.07] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]"
            }`}>
              {/* Subtle ambient glow */}
              {isDark && (
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(34,211,238,0.05), transparent)"
                }} />
              )}

              <div className="p-8 flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
                {/* Left — metric */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 8px #22d3ee" }} />
                    <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.18em] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                      Revenue · {revenueRange === "day" ? "Today" : revenueRange === "week" ? "This Week" : revenueRange === "month" ? "This Month" : "All Time"}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-neutral-950"}`}
                      style={{ letterSpacing: "-0.04em", fontFeatureSettings: '"tnum"' }}
                    >
                      {fmt$(filteredRevenue)}
                    </p>
                  </div>
                  {revenueDelta !== null && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9999px] text-[9px] font-mono font-bold uppercase tracking-wider ${
                      revenueDelta > 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : revenueDelta < 0
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : isDark ? "bg-neutral-800 text-neutral-400 border border-neutral-700" : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                    }`}>
                      {revenueDelta > 0 ? <TrendingUp size={10} /> : revenueDelta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                      {revenueDelta > 0 ? "+" : ""}{revenueDelta}% vs prior {revenueRange}
                    </div>
                  )}
                </div>

                {/* Right — SVG area sparkline */}
                <div className="w-full md:w-72 space-y-1">
                  <svg viewBox="0 0 280 72" className="w-full h-16" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isDark ? "#22d3ee" : "#0ea5e9"} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={isDark ? "#22d3ee" : "#0ea5e9"} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {sparklineData.length > 1 && (() => {
                      const W = 280, H = 60, pad = 6;
                      const pts = sparklineData.map((d, i) => ({
                        x: pad + (i / (sparklineData.length - 1)) * (W - pad * 2),
                        y: pad + (1 - d.value / sparkMax) * (H - pad * 2),
                      }));
                      const linePath = pts.map((p, i) => {
                        if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                        const prev = pts[i - 1];
                        const cx = ((prev.x + p.x) / 2).toFixed(1);
                        return `C ${cx} ${prev.y.toFixed(1)} ${cx} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                      }).join(" ");
                      const last = pts[pts.length - 1];
                      const first = pts[0];
                      const areaPath = linePath + ` L ${last.x.toFixed(1)} ${H} L ${first.x.toFixed(1)} ${H} Z`;
                      return (
                        <>
                          <path d={areaPath} fill="url(#sparkGrad)" />
                          <path d={linePath} fill="none" stroke={isDark ? "rgba(34,211,238,0.7)" : "rgba(14,165,233,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {/* End dot */}
                          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="3" fill={isDark ? "#22d3ee" : "#0ea5e9"} />
                        </>
                      );
                    })()}
                  </svg>
                  {/* Day labels */}
                  <div className="flex justify-between px-1">
                    {sparklineData.map((d, i) => (
                      <span key={i} className={`text-[8px] font-mono ${isDark ? "text-neutral-700" : "text-neutral-400"}`}>
                        {d.label.slice(0, 1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SUPPORTING STATS GRID ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatWithDelta label="Orders" value={ordersInPeriod} sub="paid this period" delta={ordersDelta} isDark={isDark} />
              <StatWithDelta label="Avg Ticket" value={fmt$(avgTicket)} sub="per paid order" delta={avgTicketDelta} isDark={isDark} />
              <Stat label="Conv Rate" value={`${convRate}%`} sub="checkout to paid" isDark={isDark} />
              <Stat label="Leads" value={activeLeads.length} sub="total captured" isDark={isDark} />
            </div>
              </div>{/* end md:col-span-2 */}

              {/* Desktop right column: quick condensed metrics */}
              <div className="hidden md:flex flex-col gap-4">
                <div className={`p-5 rounded-[20px] border flex-1 ${isDark ? "border-white/[0.06] bg-neutral-950/50" : "border-black/[0.07] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]"}`}>
                  <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.15em] mb-4 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Order Pipeline</p>
                  <div className="space-y-3">
                    {([
                      { label: "Paid", count: paidOrders.length, color: "#10b981" },
                      { label: "Pending", count: pendingOrders.length, color: isDark ? "#fbbf24" : "#d97706" },
                      { label: "Failed", count: failedOrders.length, color: "#ef4444" },
                    ] as const).map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className={`text-[9px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{item.label}</span>
                        <span className="text-[18px] font-bold tabular-nums" style={{ color: item.color, letterSpacing: "-0.03em" }}>{item.count}</span>
                      </div>
                    ))}
                    <div className={`pt-2 border-t ${isDark ? "border-white/[0.05]" : "border-black/[0.05]"} flex items-center justify-between`}>
                      <span className={`text-[9px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Published</span>
                      <span className={`text-[18px] font-bold tabular-nums ${isDark ? "text-neutral-300" : "text-neutral-700"}`} style={{ letterSpacing: "-0.03em" }}>{products.filter(p => p.is_published).length}</span>
                    </div>
                  </div>
                </div>
                <div className={`p-5 rounded-[20px] border ${isDark ? "border-white/[0.06] bg-neutral-950/50" : "border-black/[0.07] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]"}`}>
                  <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.15em] mb-4 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Conversion</p>
                  <div className="space-y-3">
                    {([
                      { label: "Conv Rate", value: `${convRate}%` },
                      { label: "Avg Ticket", value: fmt$(avgTicket) },
                      { label: "Leads", value: String(activeLeads.length) },
                    ] as const).map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className={`text-[9px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{item.label}</span>
                        <span className={`text-[15px] font-bold tabular-nums ${isDark ? "text-white" : "text-neutral-900"}`} style={{ letterSpacing: "-0.02em" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>{/* end md:grid bento */}

            {/* ── TELEMETRY CANVAS ── */}
            <div className="space-y-3">
              <p className={`text-[10px] font-mono font-semibold tracking-[0.15em] uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Telemetry</p>
              <TelemetryCanvas events={pageEvents} isDark={isDark} canvasRefExternal={telemetryCanvasRef} />
            </div>

            {/* ── COGNITIVE INTEL AI ENGINE ── */}
            <AiAgentConsole 
              isDark={isDark} 
              onSimulatePacket={(type) => {
                if (telemetryCanvasRef.current) {
                  telemetryCanvasRef.current.triggerSimulatedPacket(type);
                }
              }} 
            />

            {/* ── CONVERSION FUNNEL ── */}
            <div className={`p-6 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} space-y-4`}>
              <div className="flex items-center gap-4 justify-between">
                <p className={`text-[10px] font-mono font-semibold tracking-[0.15em] uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Conversion Funnel</p>
                {!hasEventData && (
                  <span className={`text-[8px] font-mono tracking-wider uppercase px-2.5 py-0.5 border ${isDark ? "border-neutral-800 text-neutral-500" : "border-[#D1D1D6] text-neutral-450 bg-white rounded-[9999px] shadow-sm"}`}>
                    Telemetry hook standby
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {([
                  { label: "Page Views",      value: hasEventData ? funnelViews : null,         color: "#22d3ee", track: isDark ? "#0e3040" : "#e0f8ff" },
                  { label: "Product Clicks",  value: hasEventData ? funnelProductClicks : null,  color: "#818cf8", track: isDark ? "#1e1a40" : "#eef0ff" },
                  { label: "Checkout Inits",  value: hasEventData ? funnelCheckoutStart : null,  color: "#facc15", track: isDark ? "#352e10" : "#fefce8" },
                  { label: "Purchases",       value: funnelPurchase,                             color: "#34d399", track: isDark ? "#0d2e1e" : "#f0fdf4" },
                ] as const).map((step) => {
                  const pct = step.value !== null ? ((step.value ?? 0) / funnelMax) * 100 : 0;
                  return (
                    <div key={step.label} className="flex items-center gap-4 group">
                      <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider w-28 flex-shrink-0 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                        {step.label}
                      </span>
                      <div className="flex-1 h-2 rounded-[9999px] overflow-hidden" style={{ background: step.track }}>
                        <div
                          className="h-full rounded-[9999px] transition-all duration-700 ease-out"
                          style={{ width: `${pct}%`, background: step.color, boxShadow: `0 0 8px ${step.color}60` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-semibold w-12 text-right tabular-nums" style={{ color: step.value ? step.color : isDark ? "#525252" : "#a3a3a3" }}>
                        {step.value !== null ? step.value.toLocaleString() : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hasEventData && funnelViews > 0 && funnelPurchase > 0 && (
                <p className={`text-[8px] font-mono uppercase text-right ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  Overall Ratio: {((funnelPurchase / funnelViews) * 100).toFixed(2)}% visitor-to-purchase
                </p>
              )}
            </div>

            {/* ── TOP PRODUCTS ── */}
            {topProducts.length > 0 && (
              <div className="space-y-3">
                <p className={`text-[10px] font-mono font-semibold tracking-[0.15em] uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Top Products</p>
                <div className={`border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"}`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`text-[8px] font-mono font-semibold uppercase tracking-[0.14em] border-b ${isDark ? "text-neutral-600 border-white/[0.06] bg-white/[0.02]" : "text-neutral-400 border-black/[0.07] bg-neutral-50/80"}`}>
                        <th className="px-5 py-3 w-8">#</th>
                        <th className="px-5 py-3">Product</th>
                        <th className="px-5 py-3 hidden md:table-cell">Share</th>
                        <th className="px-5 py-3 text-right">Revenue</th>
                        <th className="px-5 py-3 text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => {
                        const topRevenue = topProducts[0]?.revenue || 1;
                        const share = Math.round((p.revenue / topRevenue) * 100);
                        return (
                          <tr key={i} className={`border-b last:border-0 transition-colors duration-150 ${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-black/[0.05] hover:bg-neutral-50"}`}>
                            <td className={`px-5 py-3.5 text-[9px] font-mono font-bold ${isDark ? "text-neutral-700" : "text-neutral-300"}`}>{i + 1}</td>
                            <td className={`px-5 py-3.5 text-[11px] font-semibold truncate max-w-[180px] ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>{p.title}</td>
                            <td className="px-5 py-3.5 hidden md:table-cell w-32">
                              <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-neutral-900" : "bg-neutral-100"}`}>
                                <div className="h-full rounded-full bg-cyan-500/70 transition-all duration-500" style={{ width: `${share}%` }} />
                              </div>
                            </td>
                            <td className={`px-5 py-3.5 text-[11px] font-mono font-semibold text-right tabular-nums ${isDark ? "text-white" : "text-neutral-900"}`}>{fmt$(p.revenue)}</td>
                            <td className={`px-5 py-3.5 text-[10px] font-mono text-right tabular-nums ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{p.units}</td>
                          </tr>
                        );
                      })}
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
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex items-end justify-between flex-wrap gap-4 border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
              <div>
                <h1 className="text-xl font-medium tracking-tight">Products</h1>
                <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>MANAGE DEPLOYED ITEMS</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  className={`text-[9px] font-mono font-semibold uppercase px-4 py-2 border transition-all rounded-[9999px] ${
                    selectMode
                      ? isDark ? "border-white bg-white text-black" : "border-black bg-black text-white shadow-sm"
                      : isDark ? "border-neutral-800 text-neutral-355 hover:bg-neutral-900/40" : "border-[#D1D1D6] text-neutral-705 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:bg-neutral-50"
                  }`}>
                  {selectMode ? "Cancel" : "Select"}
                </button>
                <button onClick={handleSyncPrintful} disabled={isSyncing}
                  className={`flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase px-4 py-2 border transition-all rounded-[9999px] ${
                    isDark ? "border-neutral-800 text-neutral-355 hover:bg-neutral-900/40" : "border-[#D1D1D6] text-neutral-705 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:bg-neutral-50"
                  }`}>
                  <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing" : "Sync Printful"}
                </button>
                <button onClick={() => setProductFormOpen(!productFormOpen)}
                  className={`text-[9px] font-mono font-bold uppercase px-5 py-2 transition-all rounded-[9999px] ${
                    isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800 shadow-sm"
                  }`}>
                  {productFormOpen ? "Close Form" : "New Product"}
                </button>
              </div>
            </div>

            {/* ── Bulk Toolbar ── */}
            {selectMode && selectedIds.size > 0 && (
              <div className={`flex items-center gap-4 p-3 rounded-[9999px] animate-in slide-in-from-top-2 duration-200 border ${isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"}`}>
                <span className={`text-[9px] font-mono font-semibold uppercase ${isDark ? "text-neutral-400" : "text-neutral-550"}`}>{selectedIds.size} selected</span>
                <div className="flex gap-2 ml-auto">
                  <button onClick={selectAllProducts} className={`text-[9px] font-mono uppercase px-3 py-1.5 border rounded-[9999px] transition-all ${isDark ? "border-neutral-800 text-neutral-400 hover:text-white" : "border-neutral-200 text-neutral-600 hover:text-black bg-white shadow-sm"}`}>
                    {selectedIds.size === orderedProducts.length ? "Deselect All" : "Select All"}
                  </button>
                  <button onClick={() => bulkPublish(true)} disabled={isBulkActing}
                    className="flex items-center gap-1 text-[9px] font-mono font-semibold uppercase px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-[9999px] transition-all">
                    <Eye size={10} /> Publish
                  </button>
                  <button onClick={() => bulkPublish(false)} disabled={isBulkActing}
                    className={`flex items-center gap-1 text-[9px] font-mono font-semibold uppercase px-3 py-1.5 rounded-[9999px] transition-all ${isDark ? "bg-neutral-900 text-neutral-400 hover:bg-neutral-800" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                    <EyeOff size={10} /> Unpublish
                  </button>
                  <button onClick={bulkDelete} disabled={isBulkActing}
                    className="flex items-center gap-1 text-[9px] font-mono font-semibold uppercase px-3 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-[9999px] transition-all">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              </div>
            )}

            {/* ── Product Form ── */}
            {productFormOpen && (
              <div className={`p-6 border rounded-[24px] overflow-hidden space-y-6 animate-in slide-in-from-top-3 duration-300 ${isDark ? "bg-neutral-950/40 border-neutral-800" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"}`}>
                <h2 className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  {productForm.editingId ? "Modify Product Engine" : "Create Product Hook"}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Title" value={productForm.title} onChange={v => setProductForm(f => ({ ...f, title: v }))} isDark={isDark} />
                  <Input label="Price (USD)" value={productForm.price_cents} onChange={v => setProductForm(f => ({ ...f, price_cents: v }))} type="number" isDark={isDark} />
                  <Input label="Slug" value={productForm.slug} onChange={v => setProductForm(f => ({ ...f, slug: v }))} isDark={isDark} />
                  <Input label="Source URL" value={productForm.source_url} onChange={v => setProductForm(f => ({ ...f, source_url: v }))} isDark={isDark} />
                </div>
                <Input label="Image URL(s)" value={productForm.image_url} onChange={v => setProductForm(f => ({ ...f, image_url: v }))} isDark={isDark} />
                <div className="space-y-1.5">
                  <label className={`text-[9px] font-mono font-semibold uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Description</label>
                  <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                    className={`w-full bg-transparent border rounded-[16px] px-4 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-1 ${
                      isDark ? "border-neutral-800 text-white focus:border-white focus:ring-white/20" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/5 bg-white shadow-sm"
                    }`} rows={3} />
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => setProductForm(f => ({ ...f, is_published: !f.is_published }))}
                    className={`text-[9px] font-mono font-semibold uppercase px-4 py-1.5 rounded-[9999px] border transition-all ${
                      productForm.is_published ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    }`}>
                    {productForm.is_published ? "Status: Deployed" : "Status: Draft"}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={resetProductForm} className={`text-[9px] font-mono uppercase px-3 py-2 ${isDark ? "text-neutral-500 hover:text-white" : "text-neutral-450 hover:text-black"}`}>Cancel</button>
                    <button onClick={saveProduct} className={`text-[9px] font-mono font-bold uppercase px-6 py-2 transition-all rounded-[9999px] ${
                      isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800 shadow-sm"
                    }`}>
                      {productForm.editingId ? "Save Engine" : "Build Hook"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!selectMode && (
              <p className={`text-[9px] font-mono uppercase tracking-wider ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                ● Drag items to sort directory · Click SELECT for directory operations
              </p>
            )}

            {/* ── Product Grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {orderedProducts.map(p => {
                const isPrintful = !!p.printful_id;
                const isSelected = selectedIds.has(p.id);
                const isDragging = draggedId === p.id;
                const isDragTarget = dragOverId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`group relative transition-all duration-300 rounded-[24px] overflow-hidden border ${
                      isDark 
                        ? isSelected ? "border-neutral-100 bg-neutral-900/40" : "border-neutral-900 bg-neutral-950/20 hover:border-neutral-800" 
                        : isSelected 
                          ? "border-black bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]" 
                          : "border-[#D1D1D6] bg-white hover:border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
                    } ${isDragging ? "opacity-35 scale-95" : ""} ${isDragTarget ? isDark ? "ring-1 ring-white/30" : "ring-1 ring-black/10" : ""}`}
                    draggable={!selectMode}
                    onDragStart={() => handleDragStart(p.id)}
                    onDragOver={e => handleDragOver(e, p.id)}
                    onDrop={() => handleDrop(p.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    onClick={() => selectMode && toggleSelectProduct(p.id)}
                  >
                    {selectMode && (
                      <div className="absolute top-2.5 left-2.5 z-10">
                        {isSelected
                          ? <CheckSquare size={13} className={isDark ? "text-white" : "text-black"} />
                          : <Square size={13} className={isDark ? "text-neutral-600" : "text-neutral-400"} />
                        }
                      </div>
                    )}
                    {!selectMode && (
                      <div className={`absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                        <GripVertical size={11} />
                      </div>
                    )}
                    {isPrintful && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-[9999px] bg-sky-500/10 text-sky-400 text-[7px] font-mono font-bold uppercase border border-sky-500/10">
                        <Lock size={6} /> PF
                      </div>
                    )}
                    {/* ── Product Image with Apple-style drop shadow ── */}
                    <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden p-4 bg-[#FAFAFA] rounded-t-[24px]">
                      {p.image_urls && p.image_urls.length > 1 ? (
                        <img
                          src={p.image_urls[1]}
                          alt={p.title}
                          className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition-all duration-500 rounded-[16px]"
                          style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.13)) drop-shadow(0 2px 6px rgba(0,0,0,0.08))" }}
                        />
                      ) : p.image_urls && p.image_urls[0] ? (
                        <img
                          src={p.image_urls[0]}
                          alt={p.title}
                          className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition-all duration-500 rounded-[16px]"
                          style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.13)) drop-shadow(0 2px 6px rgba(0,0,0,0.08))" }}
                        />
                      ) : (
                        <span className={`text-[8px] font-mono uppercase tracking-widest ${isDark ? "text-neutral-800" : "text-neutral-300"}`}>Empty visual</span>
                      )}
                    </div>
                    <div className={`px-3.5 pb-3.5 pt-2 border-t ${isDark ? "bg-neutral-950/40 border-neutral-900/40" : "bg-white border-[#F2F2F7]"}`}>
                      <p className={`mb-0.5 text-[10px] uppercase tracking-wider truncate font-medium ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>{p.title}</p>
                      <p className={`text-[10px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-555"}`}>
                        ${(p.price_cents / 100).toFixed(2)}
                      </p>
                      {!selectMode && (
                        <div className="flex items-center justify-end gap-2.5 mt-2 pt-2 border-t border-neutral-200/20 dark:border-neutral-900/40">
                          <button onClick={e => { e.stopPropagation(); togglePublished(p.id, p.is_published); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${p.is_published ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {isPrintful ? (
                            <span className={`${isDark ? "text-neutral-800" : "text-neutral-305"} cursor-not-allowed`} title="Printful products are synced from supplier hub">
                              <Edit3 size={11} />
                            </span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); startEditProduct(p); }} className={`${isDark ? "text-neutral-500 hover:text-white" : "text-neutral-400 hover:text-black"} transition-colors`}>
                              <Edit3 size={11} />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); archiveProduct(p.id); }} className={`${isDark ? "text-neutral-500 hover:text-rose-455" : "text-neutral-400 hover:text-rose-600"} transition-colors`}>
                            <Archive size={11} />
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
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-end justify-between flex-wrap gap-4 border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
              <div>
                <h1 className="text-xl font-medium tracking-tight">Ledger Registry</h1>
                <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>ORDER INVOICING RECORDS</p>
              </div>

              <input type="text" placeholder="FILTER LEDGER…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`text-[9px] font-mono border rounded-[9999px] px-4 py-2 w-48 bg-transparent focus:outline-none focus:ring-1 ${
                  isDark ? "border-neutral-800 text-white focus:border-white focus:ring-white/20" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/10 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                }`} />
            </div>

            <div className="flex gap-2 p-1 bg-[#e8e8ed]/40 dark:bg-neutral-900/40 rounded-[9999px] w-fit">
              {([
                { key: "all", label: "Registry", count: activeOrders.length },
                { key: "paid", label: "Paid", count: paidOrders.length },
                { key: "pending", label: "Pending", count: pendingOrders.length },
                { key: "failed", label: "Failed", count: failedOrders.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setOrderStatusFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-widest transition-all rounded-[9999px] ${
                    orderStatusFilter === tab.key
                      ? isDark ? "text-white bg-neutral-900 shadow-sm" : "text-black bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                      : isDark ? "text-neutral-550 hover:text-neutral-355" : "text-neutral-555 hover:text-neutral-800"
                  }`}
                >
                  {tab.label}
                  <span className={`text-[8px] font-mono px-2 py-0.5 rounded-[9999px] ${
                    orderStatusFilter === tab.key
                      ? isDark ? "bg-white text-black" : "bg-black text-white"
                      : isDark ? "bg-neutral-900 text-neutral-500" : "bg-neutral-100 text-neutral-500"
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            <div className={`overflow-x-auto border rounded-[24px] overflow-hidden ${isDark ? "border-neutral-900" : "border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} bg-white dark:bg-transparent`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-[8px] font-mono uppercase tracking-widest border-b ${
                    isDark ? "text-neutral-500 border-neutral-900 bg-neutral-950/50" : "text-neutral-500 border-[#D1D1D6] bg-[#f5f5f7]"
                  }`}>
                    <th className="px-5 py-3 font-semibold">Invoicing Email</th>
                    <th className="px-5 py-3 font-semibold">Recipient Identity</th>
                    <th className="px-5 py-3 font-semibold">Invoice Payload</th>
                    <th className="px-5 py-3 font-semibold">Pipeline State</th>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id}
                      className={`border-b last:border-0 cursor-pointer ${isDark ? "border-neutral-900 hover:bg-neutral-900/30" : "border-[#F2F2F7] hover:bg-neutral-50/50"}`}
                      onClick={() => setSelectedRow({ ...o, _type: "order" })}
                    >
                      <td className="px-5 py-3.5 text-xs font-semibold lowercase font-mono">{o.email}</td>
                      <td className={`px-5 py-3.5 text-[10px] uppercase font-mono ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>{o.name || "—"}</td>
                      <td className="px-5 py-3.5 text-xs font-mono font-medium">{fmt$(o.amount_cents)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[8px] font-mono font-bold uppercase px-2.5 py-1 rounded-[9999px] flex items-center gap-1.5 w-fit ${
                          o.status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                          o.status === "pending" ? "bg-amber-500/10 text-amber-500" :
                          "bg-rose-500/10 text-rose-500"
                        }`}>
                          <LedPulse color={o.status === "paid" ? "green" : o.status === "pending" ? "yellow" : "red"} active={false} />
                          {o.status}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-[10px] font-mono uppercase ${isDark ? "text-neutral-550" : "text-neutral-400"}`}>{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <p className={`text-center py-10 text-[9px] font-mono uppercase tracking-widest ${isDark ? "text-neutral-750" : "text-neutral-300"}`}>
                  Registry empty
                </p>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            LEADS
        ════════════════════════════════════════════════════════════════ */}
        {section === "leads" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-end justify-between flex-wrap gap-4 border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
              <div>
                <h1 className="text-xl font-medium tracking-tight">Leads Engine</h1>
                <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>MARKETING CAPTURE HOOKS</p>
              </div>

              <input type="text" placeholder="FILTER LEADS…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`text-[9px] font-mono border rounded-[9999px] px-4 py-2 w-48 bg-transparent focus:outline-none focus:ring-1 ${
                  isDark ? "border-neutral-800 text-white focus:border-white focus:ring-white/20" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/10 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                }`} />
            </div>
            <div className={`overflow-x-auto border rounded-[24px] overflow-hidden ${isDark ? "border-neutral-900" : "border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} bg-white dark:bg-transparent`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-[8px] font-mono uppercase tracking-widest border-b ${
                    isDark ? "text-neutral-500 border-neutral-900 bg-neutral-950/50" : "text-neutral-500 border-[#D1D1D6] bg-[#f5f5f7]"
                  }`}>
                    <th className="px-5 py-3 font-semibold">Capture email</th>
                    <th className="px-5 py-3 font-semibold">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(l => (
                    <tr key={l.id} className={`border-b last:border-0 ${isDark ? "border-neutral-900 hover:bg-neutral-900/30" : "border-[#F2F2F7] hover:bg-neutral-50/50"}`}>
                      <td className="px-5 py-4 text-xs font-semibold lowercase font-mono">{l.email}</td>
                      <td className={`px-5 py-4 text-[10px] font-mono uppercase ${isDark ? "text-neutral-550" : "text-neutral-455"}`}>{fmtDate(l.created_at)}</td>
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
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex items-end justify-between flex-wrap gap-4 border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
              <div>
                <h1 className="text-xl font-medium tracking-tight">System Telemetry</h1>
                <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>USER ACTIVITY CORE LOGS</p>
              </div>

              <div className="flex gap-1">
                {(["7", "14", "30"] as const).map(r => (
                  <button key={r} onClick={() => setAnalyticsRange(r)}
                    className={`text-[9px] font-mono font-bold uppercase px-3 py-1.5 transition-all rounded-[9999px] ${
                      analyticsRange === r
                        ? isDark ? "bg-white text-black" : "bg-black text-white"
                        : isDark ? "text-neutral-455 hover:text-white" : "text-neutral-555 bg-white border border-[#D1D1D6] hover:text-black shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
                    }`}>
                    {r}D
                  </button>
                ))}
              </div>
            </div>


            {/* ── ORDER STATUS BREAKDOWN ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: "Paid", count: paidOrders.length, dot: "#10b981", glow: "rgba(16,185,129,0.15)", textColor: "#10b981" },
                { label: "Pending", count: pendingOrders.length, dot: "#f59e0b", glow: "rgba(245,158,11,0.12)", textColor: isDark ? "#fbbf24" : "#d97706" },
                { label: "Failed", count: failedOrders.length, dot: "#ef4444", glow: "rgba(239,68,68,0.12)", textColor: "#ef4444" },
                { label: "Published", count: products.filter(p => p.is_published).length, dot: isDark ? "#a3a3a3" : "#525252", glow: "rgba(115,115,115,0.08)", textColor: isDark ? "#d4d4d4" : "#262626" },
              ] as const).map(item => (
                <div
                  key={item.label}
                  className={`p-5 rounded-[20px] border relative overflow-hidden transition-all duration-300 ${
                    isDark ? "border-white/[0.06] bg-neutral-950/50" : "border-black/[0.07] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                  }`}
                  style={{ background: isDark ? `radial-gradient(circle at top right, ${item.glow}, transparent 70%)` : undefined }}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.15em] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{item.label}</p>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.dot, boxShadow: `0 0 6px ${item.dot}` }} />
                  </div>
                  <p className="text-2xl font-bold tracking-tight" style={{ color: item.textColor, letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"' }}>{item.count}</p>
                </div>
              ))}
            </div>

            {!hasEventData && (
              <div className={`p-6 border rounded-[24px] overflow-hidden space-y-4 ${isDark ? "border-neutral-900 bg-neutral-950/30" : "border-[#D1D1D6] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"}`}>
                <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Tracker Inactive</p>
                <p className={`text-xs leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  Bind the client-side telemetry dispatcher to monitor user sessions, clicks, and page view triggers.
                </p>
                <pre className={`text-[9px] p-4 overflow-x-auto font-mono rounded-2xl ${isDark ? "bg-neutral-950 border border-neutral-900 text-neutral-400" : "bg-neutral-50 border border-[#D1D1D6] text-neutral-600"}`}>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Page Views" value={analyticsEvents.filter(e => e.event_type === "page_view").length.toLocaleString()} sub={`last ${analyticsRange} days`} isDark={isDark} />
              <Stat label="Sessions" value={uniqueSessions.toLocaleString()} sub="unique visitors" isDark={isDark} />
              <Stat label="Product Clicks" value={analyticsEvents.filter(e => e.event_type === "product_click").length.toLocaleString()} sub="product page views" isDark={isDark} />
              <Stat label="Checkout Starts" value={analyticsEvents.filter(e => e.event_type === "checkout_start").length.toLocaleString()} sub="initiated checkout" isDark={isDark} />
            </div>

            <div className={`p-6 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} space-y-4`}>
              <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Daily Telemetry Pulse</p>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {analyticsChartData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div
                      className={`w-full transition-all duration-300 rounded-[9999px] ${isDark ? "bg-neutral-800 group-hover:bg-neutral-550" : "bg-neutral-200 group-hover:bg-neutral-355"}`}
                      style={{ height: `${(d.views / chartMax) * 100}%`, minHeight: d.views > 0 ? "3px" : "1px" }}
                    />
                    {d.views > 0 && (
                      <div className={`absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] font-mono font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border ${isDark ? "bg-neutral-900 text-white border-neutral-850" : "bg-white text-black border-[#D1D1D6] shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-[9999px]"}`}>
                        {d.views}
                      </div>
                    )}
                    {i % Math.ceil(analyticsRangeDays / 7) === 0 && (
                      <span className={`text-[8px] font-mono hidden sm:block ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{d.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Origin Referrers</p>
                {topReferrers.length === 0 ? (
                  <p className={`text-[9px] font-mono uppercase ${isDark ? "text-neutral-700" : "text-neutral-300"}`}>Empty logs</p>
                ) : (
                  <div className={`p-4 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} space-y-2.5`}>
                    {topReferrers.map(([ref, count]) => (
                      <div key={ref} className={`flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-neutral-900/40 border-[#F2F2F7]`}>
                        <span className={`text-[10px] font-mono truncate uppercase ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{ref || "direct"}</span>
                        <span className={`text-[10px] font-mono font-semibold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Node Access Directory</p>
                {topPaths.length === 0 ? (
                  <p className={`text-[9px] font-mono uppercase ${isDark ? "text-neutral-700" : "text-neutral-300"}`}>Empty logs</p>
                ) : (
                  <div className={`p-4 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"} space-y-2.5`}>
                    {topPaths.map(([path, count]) => (
                      <div key={path} className={`flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-neutral-900/40 border-[#F2F2F7]`}>
                        <span className={`text-[9px] font-mono truncate ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{path}</span>
                        <span className={`text-[10px] font-mono font-semibold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {Object.keys(productClickMap).length > 0 && (
              <div className="space-y-3">
                <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Interaction CTR</p>
                <div className={`border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]"}`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`text-[8px] font-mono uppercase tracking-widest border-b ${isDark ? "text-neutral-500 border-neutral-900 bg-neutral-950/50" : "text-neutral-500 border-[#D1D1D6] bg-[#f5f5f7]"}`}>
                        <th className="px-5 py-3 font-semibold">Node Item</th>
                        <th className="px-5 py-3 font-semibold text-right">Activity Pulses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(productClickMap)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([pid, clicks]) => {
                          const prod = products.find(p => p.id === pid);
                          return (
                            <tr key={pid} className={`border-b last:border-0 ${isDark ? "border-neutral-900" : "border-[#F2F2F7]"}`}>
                              <td className="px-5 py-3 text-[10px] font-medium uppercase">{prod?.title || pid}</td>
                              <td className="px-5 py-3 text-[11px] font-mono font-medium text-right">{clicks}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {geoBreakdown.length > 0 && (
              <div className="space-y-3">
                <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Geographic Distribution</p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {geoBreakdown.map(([country, count]) => (
                    <div key={country} className={`p-4 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "border-neutral-900 bg-neutral-950/20" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"}`}>
                      <p className={`text-[8px] font-mono uppercase tracking-wider ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>{country}</p>
                      <p className="text-lg font-bold tracking-tight mt-1">{count}</p>
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
          <div className="max-w-2xl space-y-10 animate-in fade-in duration-500">
            <div className="border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
              <h1 className="text-xl font-medium tracking-tight">System Settings</h1>
              <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>ROOT HOOK CONTROL</p>
            </div>

            <div className="space-y-10">

              <div className="space-y-3">
                <h2 className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Theme Adaptation</h2>
                <div className={`p-5 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "bg-neutral-950/30 border-neutral-900" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"} space-y-4`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase trackingest">Interface Mode</span>
                    <div className={`flex border rounded-[9999px] overflow-hidden ${isDark ? "border-neutral-800" : "border-[#D1D1D6]"}`}>
                      <button
                        onClick={() => {
                          setIsDark(false);
                          localStorage.setItem("theme", "light");
                          document.documentElement.classList.remove("dark");
                          saveSiteConfig({ ...siteContent, theme: "light" });
                        }}
                        className={`px-3 py-1.5 text-[9px] font-mono font-bold uppercase transition-all rounded-[9999px] ${!isDark ? "bg-black text-white" : "text-neutral-400 hover:bg-neutral-900"}`}
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
                        className={`px-3 py-1.5 text-[9px] font-mono font-bold uppercase transition-all rounded-[9999px] ${isDark ? "bg-white text-black" : "text-neutral-555 hover:bg-neutral-100"}`}
                      >
                        DARK
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Team Registry Access</h2>
                <div className={`p-5 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "bg-neutral-950/30 border-neutral-900" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"} space-y-6`}>
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      <label className={`text-[8px] font-mono font-semibold uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>ADD TEAM MEMBER</label>
                      <input
                        type="email"
                        placeholder="EMAIL ADDR…"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        className={`w-full bg-transparent border rounded-[9999px] px-4 py-1.5 text-[10px] font-mono uppercase focus:outline-none focus:ring-1 ${
                          isDark ? "border-neutral-850 text-white placeholder-neutral-700 focus:border-white focus:ring-white/25" : "border-[#D1D1D6] text-black placeholder-neutral-350 focus:border-black focus:ring-black/10 bg-white shadow-sm"
                        }`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[8px] font-mono font-semibold uppercase ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>PIPELINE ROLE</label>
                      <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as any)}
                        className={`text-[9px] font-mono font-semibold uppercase bg-transparent border rounded-[9999px] px-3 py-1.5 focus:outline-none focus:ring-1 ${
                          isDark ? "border-neutral-850 text-white focus:border-white focus:ring-white/25" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/10 bg-white shadow-sm"
                        }`}
                      >
                        <option value="viewer">VIEWER</option>
                        <option value="manager">MANAGER</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAddAdminUser}
                      disabled={isAddingUser || !newUserEmail.trim()}
                      className={`text-[9px] font-mono font-bold uppercase px-4 py-1.5 rounded-[9999px] transition-all ${
                        isDark ? "bg-white text-black hover:bg-neutral-200 disabled:opacity-30" : "bg-black text-white hover:bg-neutral-800 disabled:opacity-30 shadow-sm"
                      }`}
                    >
                      {isAddingUser ? "Deploying" : "Deploy"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { role: "viewer", desc: "Read-only access to diagnostics" },
                      { role: "manager", desc: "Write access to database & inventory" },
                      { role: "admin", desc: "Root execution permissions on settings" },
                    ].map(r => (
                      <div key={r.role} className={`p-3 border rounded-[16px] ${isDark ? "border-neutral-900 bg-neutral-950/10" : "border-[#D1D1D6] bg-neutral-50"}`}>
                        <p className={`text-[8px] font-mono font-bold uppercase ${isDark ? "text-neutral-300" : "text-neutral-800"}`}>{r.role}</p>
                        <p className={`text-[8px] font-mono mt-1 leading-relaxed ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>{r.desc}</p>
                      </div>
                    ))}
                  </div>

                  {adminUsers.length > 0 ? (
                    <div className="space-y-1.5 pt-4 border-t dark:border-neutral-900 border-[#D1D1D6]">
                      {adminUsers.map(u => (
                        <div key={u.id} className={`flex items-center justify-between gap-4 py-2 border-b last:border-0 dark:border-neutral-900 border-[#F2F2F7]`}>
                          <span className="text-[10px] font-mono font-semibold truncate flex-1">{u.email}</span>
                          <select
                            value={u.role}
                            onChange={e => handleUpdateUserRole(u.id, e.target.value as any)}
                            className={`text-[8px] font-mono font-semibold uppercase bg-transparent focus:outline-none focus:ring-1 border rounded-[9999px] px-3 py-0.5 ${isDark ? "text-neutral-400 border-neutral-800" : "text-neutral-550 border-[#D1D1D6] bg-white"}`}
                          >
                            <option value="viewer">VIEWER</option>
                            <option value="manager">MANAGER</option>
                            <option value="admin">ADMIN</option>
                          </select>
                          <button onClick={() => handleRemoveAdminUser(u.id)}
                            className={`${isDark ? "text-neutral-650 hover:text-rose-455" : "text-neutral-400 hover:text-rose-600"} transition-colors`}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-[9px] font-mono uppercase tracking-widest ${isDark ? "text-neutral-750" : "text-neutral-300"}`}>Registry empty</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Identity Verification</h2>
                <div className={`p-5 border rounded-[24px] overflow-hidden transition-all duration-300 ${isDark ? "bg-neutral-950/30 border-neutral-900" : "bg-white border-[#D1D1D6] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]"}`} style={{ borderRadius: "24px", overflow: "hidden", borderColor: isDark ? "#333338" : "#D1D1D6" }}>
                  <div>
                    <p className={`text-[9px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>Identified Payload</p>
                    <p className="text-xs font-mono font-semibold uppercase">{userEmail || "…"}</p>
                  </div>
                  <button onClick={handleSignOut} className={`w-full rounded-[9999px] text-[10px] font-mono font-semibold uppercase px-4 py-2.5 transition-all ${isDark ? "bg-rose-500/10 text-rose-455 hover:bg-rose-500/20" : "bg-rose-50 text-rose-655 hover:bg-rose-100"}`}>
                    TERMINATE SESSION
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── ORDER DETAIL MODAL ── */}
      {selectedRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-355">
          <div className="absolute inset-0 backdrop-blur-md bg-black/60 dark:bg-black/80" onClick={() => setSelectedRow(null)} />
          <div className={`relative w-full max-w-lg p-8 border rounded-[24px] overflow-hidden space-y-6 max-h-[85vh] overflow-y-auto ${
            isDark ? "bg-neutral-950 border-neutral-850" : "bg-white border-[#D1D1D6] shadow-[0_32px_64px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)]"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 dark:border-neutral-900 border-[#D1D1D6]`}>
              <h3 className={`text-xs font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-300" : "text-neutral-800"}`}>System Ledger Metadata</h3>
              <button onClick={() => setSelectedRow(null)} className={`${isDark ? "text-neutral-500 hover:text-white" : "text-neutral-400 hover:text-black"}`}><X size={14} /></button>
            </div>
            <div className="space-y-2">
              {Object.entries(selectedRow).map(([k, v]) => (
                k !== "_type" && (
                  <div key={k} className={`flex justify-between py-1.5 border-b last:border-0 gap-4 ${isDark ? "border-neutral-900" : "border-[#F2F2F7]"}`}>
                    <span className={`text-[8px] font-mono font-semibold uppercase flex-shrink-0 ${isDark ? "text-neutral-500" : "text-neutral-455"}`}>{k}</span>
                    <span className="text-[10px] font-mono font-medium truncate text-right">{String(v)}</span>
                  </div>
                )
              ))}
            </div>
            {selectedRow._type === "order" && (
              <button onClick={() => handleArchiveOrder(selectedRow.id)}
                className={`w-full py-2.5 rounded-[9999px] text-[9px] font-mono font-bold uppercase tracking-wide transition-all ${isDark ? "bg-rose-500/10 text-rose-455 hover:bg-rose-500/20" : "bg-rose-50 text-rose-655 hover:bg-rose-100"}`}>
                Archive Order Record
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SHARED STAT COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

const ACCENT_MAP = {
  green:   { dot: "#10b981", glow: "rgba(16,185,129,0.14)"  },
  yellow:  { dot: "#f59e0b", glow: "rgba(245,158,11,0.12)"  },
  red:     { dot: "#ef4444", glow: "rgba(239,68,68,0.12)"   },
  cyan:    { dot: "#22d3ee", glow: "rgba(34,211,238,0.12)"  },
  purple:  { dot: "#a78bfa", glow: "rgba(167,139,250,0.12)" },
  neutral: { dot: "#737373", glow: "rgba(115,115,115,0.07)" },
} as const;

function Stat({ label, value, sub, isDark, led = "cyan" }: { label: string; value: string | number; sub: string; isDark: boolean; led?: "green" | "yellow" | "red" | "cyan" | "purple" | "neutral" }) {
  const accent = ACCENT_MAP[led];
  return (
    <div
      className={`p-5 rounded-[20px] border relative overflow-hidden transition-all duration-300 ${
        isDark
          ? "border-white/[0.06] bg-neutral-950/50 hover:border-white/[0.10]"
          : "bg-white border-black/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)]"
      }`}
      style={{ background: isDark ? `radial-gradient(circle at top right, ${accent.glow}, transparent 65%)` : undefined }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.14em] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{label}</p>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: accent.dot, boxShadow: `0 0 5px ${accent.dot}` }} />
      </div>
      <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-neutral-950"}`} style={{ letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"' }}>
        {value}
      </p>
      <p className={`text-[9px] font-mono mt-2 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{sub}</p>
    </div>
  );
}

function StatWithDelta({ label, value, sub, delta, isDark }: { label: string; value: string | number; sub: string; delta: number | null; isDark: boolean }) {
  const led = delta !== null && delta > 0 ? "green" as const : delta !== null && delta < 0 ? "red" as const : "neutral" as const;
  const accent = ACCENT_MAP[led];

  return (
    <div
      className={`p-5 rounded-[20px] border relative overflow-hidden transition-all duration-300 ${
        isDark
          ? "border-white/[0.06] bg-neutral-950/50 hover:border-white/[0.10]"
          : "bg-white border-black/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)]"
      }`}
      style={{ background: isDark ? `radial-gradient(circle at top right, ${accent.glow}, transparent 65%)` : undefined }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.14em] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{label}</p>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: accent.dot, boxShadow: `0 0 5px ${accent.dot}` }} />
      </div>
      <div className="flex items-end gap-2.5 flex-wrap">
        <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-neutral-950"}`} style={{ letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"' }}>
          {value}
        </p>
        {delta !== null && (
          <span className={`mb-0.5 text-[8px] font-mono font-bold uppercase px-2.5 py-1 rounded-[9999px] border ${
            delta > 0
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : delta < 0
              ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
              : isDark ? "text-neutral-600 bg-neutral-900 border-neutral-800" : "text-neutral-400 bg-neutral-100 border-neutral-200"
          }`}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className={`text-[9px] font-mono mt-2 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{sub}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", isDark }: { label: string; value: string; onChange: (v: string) => void; type?: string; isDark: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className={`text-[9px] font-mono font-semibold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className={`w-full bg-transparent border rounded-[9999px] px-4 py-1.5 text-xs font-mono transition-all focus:outline-none focus:ring-1 ${
          isDark ? "border-neutral-800 text-white focus:border-white focus:ring-white/20" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/5 bg-white shadow-sm"
        }`} />
    </div>
  );
}

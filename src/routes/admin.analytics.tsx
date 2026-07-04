import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAdmin,
  component: AnalyticsPage,
});

type PageEvent = {
  created_at: string;
  event_type: string;
  path: string;
  referrer?: string | null;
  session_id?: string | null;
  product_id?: string | null;
  country?: string | null;
};
type Order = { status: string; created_at: string };
type Product = { id: string; title: string; is_published: boolean };

function useIsDark() {
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function Stat({ label, value, sub, isDark }: { label: string; value: string | number; sub: string; isDark: boolean }) {
  return (
    <div className={`p-5 rounded-[20px] border ${isDark ? "border-white/[0.06] bg-neutral-955/50" : "border-black/[0.07] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]"}`}>
      <p className={`text-[9px] font-mono font-semibold uppercase tracking-[0.15em] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={{ letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"' }}>{value}</p>
      <p className={`mt-1 text-[9px] font-mono uppercase ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{sub}</p>
    </div>
  );
}

function AnalyticsPage() {
  const isDark = useIsDark();
  const [pageEvents, setPageEvents] = useState<PageEvent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<"7" | "14" | "30">("14");

  useEffect(() => {
    (async () => {
      const [ev, ord, prod] = await Promise.all([
        supabase.from("page_events").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("orders").select("status, created_at"),
        supabase.from("products").select("id, title, is_published"),
      ]);
      setPageEvents((ev.data ?? []) as PageEvent[]);
      setOrders((ord.data ?? []) as Order[]);
      setProducts((prod.data ?? []) as Product[]);
    })();
  }, []);

  const paidOrders = orders.filter((o) => o.status === "paid");
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const failedOrders = orders.filter((o) => o.status === "failed");
  const hasEventData = pageEvents.length > 0;
  const analyticsRangeDays = parseInt(analyticsRange);

  const analyticsEvents = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - analyticsRangeDays);
    return pageEvents.filter((e) => new Date(e.created_at) >= cutoff);
  }, [pageEvents, analyticsRangeDays]);

  const analyticsChartData = useMemo(() => {
    const days: { label: string; views: number }[] = [];
    for (let i = analyticsRangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const views = analyticsEvents.filter(
        (e) => e.event_type === "page_view" && new Date(e.created_at).toDateString() === d.toDateString(),
      ).length;
      days.push({ label, views });
    }
    return days;
  }, [analyticsEvents, analyticsRangeDays]);

  const chartMax = Math.max(...analyticsChartData.map((d) => d.views), 1);

  const topReferrers = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter((e) => e.referrer).forEach((e) => {
      const ref = e.referrer || "direct";
      map[ref] = (map[ref] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [analyticsEvents]);

  const topPaths = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter((e) => e.event_type === "page_view").forEach((e) => {
      map[e.path] = (map[e.path] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [analyticsEvents]);

  const productClickMap = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter((e) => e.event_type === "product_click" && e.product_id).forEach((e) => {
      map[e.product_id!] = (map[e.product_id!] || 0) + 1;
    });
    return map;
  }, [analyticsEvents]);

  const uniqueSessions = useMemo(
    () => new Set(analyticsEvents.filter((e) => e.session_id).map((e) => e.session_id)).size,
    [analyticsEvents],
  );

  const geoBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    analyticsEvents.filter((e) => e.country).forEach((e) => {
      map[e.country!] = (map[e.country!] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [analyticsEvents]);

  const cardCls = isDark
    ? "border-neutral-900 bg-neutral-955/20"
    : "bg-white border-[#D1D1D6] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]";

  return (
    <div className="space-y-10 pb-16">
      <div className="flex items-end justify-between flex-wrap gap-4 border-b pb-4 dark:border-neutral-900 border-[#D1D1D6]">
        <div>
          <h1 className="text-xl font-medium tracking-tight">System Telemetry</h1>
          <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>USER ACTIVITY CORE LOGS</p>
        </div>
        <div className="flex gap-1">
          {(["7", "14", "30"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setAnalyticsRange(r)}
              className={`text-[9px] font-mono font-bold uppercase px-3 py-1.5 rounded-full transition-all ${
                analyticsRange === r
                  ? isDark ? "bg-white text-black" : "bg-black text-white"
                  : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 bg-white border border-[#D1D1D6] hover:text-black"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {/* order status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: "Paid", count: paidOrders.length },
          { label: "Pending", count: pendingOrders.length },
          { label: "Failed", count: failedOrders.length },
          { label: "Published", count: products.filter((p) => p.is_published).length },
        ] as const).map((item) => (
          <Stat key={item.label} label={item.label} value={item.count} sub="orders" isDark={isDark} />
        ))}
      </div>

      {!hasEventData && (
        <div className={`p-6 border rounded-[24px] ${cardCls}`}>
          <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Tracker inactive</p>
          <p className={`mt-2 text-xs ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>No page events recorded yet.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Page Views" value={analyticsEvents.filter((e) => e.event_type === "page_view").length.toLocaleString()} sub={`last ${analyticsRange} days`} isDark={isDark} />
        <Stat label="Sessions" value={uniqueSessions.toLocaleString()} sub="unique visitors" isDark={isDark} />
        <Stat label="Product Clicks" value={analyticsEvents.filter((e) => e.event_type === "product_click").length.toLocaleString()} sub="product page views" isDark={isDark} />
        <Stat label="Checkout Starts" value={analyticsEvents.filter((e) => e.event_type === "checkout_start").length.toLocaleString()} sub="initiated checkout" isDark={isDark} />
      </div>

      {/* daily pulse */}
      <div className={`p-6 border rounded-[24px] space-y-4 ${cardCls}`}>
        <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Daily telemetry pulse</p>
        <div className="flex items-end gap-1.5 h-32 pt-4">
          {analyticsChartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <div
                className={`w-full rounded-full transition-all ${isDark ? "bg-neutral-800 group-hover:bg-neutral-600" : "bg-neutral-200 group-hover:bg-neutral-400"}`}
                style={{ height: `${(d.views / chartMax) * 100}%`, minHeight: d.views > 0 ? "3px" : "1px" }}
              />
              {i % Math.ceil(analyticsRangeDays / 7) === 0 && (
                <span className={`text-[8px] font-mono hidden sm:block ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{d.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* referrers + paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-3">
          <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Origin referrers</p>
          <div className={`p-4 border rounded-[24px] space-y-2.5 ${cardCls}`}>
            {topReferrers.length === 0 ? (
              <p className="text-[9px] font-mono uppercase text-neutral-500">Empty logs</p>
            ) : topReferrers.map(([ref, count]) => (
              <div key={ref} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-neutral-900/40 border-[#F2F2F7]">
                <span className={`text-[10px] font-mono truncate uppercase ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{ref || "direct"}</span>
                <span className={`text-[10px] font-mono font-semibold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Node access directory</p>
          <div className={`p-4 border rounded-[24px] space-y-2.5 ${cardCls}`}>
            {topPaths.length === 0 ? (
              <p className="text-[9px] font-mono uppercase text-neutral-500">Empty logs</p>
            ) : topPaths.map(([path, count]) => (
              <div key={path} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-0 dark:border-neutral-900/40 border-[#F2F2F7]">
                <span className={`text-[9px] font-mono truncate ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>{path}</span>
                <span className={`text-[10px] font-mono font-semibold ${isDark ? "text-white" : "text-black"}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {Object.keys(productClickMap).length > 0 && (
        <div className="space-y-3">
          <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Interaction CTR</p>
          <div className={`border rounded-[24px] overflow-hidden ${cardCls}`}>
            <table className="w-full text-left">
              <thead>
                <tr className={`text-[8px] font-mono uppercase tracking-widest border-b ${isDark ? "text-neutral-500 border-neutral-900" : "text-neutral-500 border-[#D1D1D6] bg-[#f5f5f7]"}`}>
                  <th className="px-5 py-3 font-semibold">Node item</th>
                  <th className="px-5 py-3 font-semibold text-right">Activity pulses</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(productClickMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pid, clicks]) => {
                  const prod = products.find((p) => p.id === pid);
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
          <p className={`text-[9px] font-mono tracking-widest uppercase ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Geographic distribution</p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {geoBreakdown.map(([country, count]) => (
              <div key={country} className={`p-4 border rounded-[24px] ${cardCls}`}>
                <p className={`text-[8px] font-mono uppercase tracking-wider ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>{country}</p>
                <p className="text-lg font-bold tracking-tight mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Layers, Sparkles, Pencil, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/compare")({
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Compare · Luveni" }] }),
  component: ComparePage,
});

// Manufacturer cost assumptions for markup math until live catalog costs are
// wired (Printful catalog API). Per-blank base cost, cents.
const MFR = {
  printful: { label: "Printful", baseCost: 1100, lead: "2–5 days", color: "#38bdf8" },
  apliq: { label: "Apliiq", baseCost: 1500, lead: "5–9 days", color: "#a855f7" },
};

type Project = {
  id: string; name: string; template_key: string; price_cents: number;
  thumbnail_url: string | null; status: string; source: string;
};

function ComparePage() {
  const [isDark, setIsDark] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("studio_projects")
      .select("id,name,template_key,price_cents,thumbnail_url,status,source")
      .eq("source", "ai_auto")
      .order("created_at", { ascending: false })
      .limit(60);
    setProjects((data as Project[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sub = isDark ? "text-neutral-500" : "text-neutral-555";
  const card = isDark ? "border-neutral-850 bg-neutral-955/40" : "border-[#D1D1D6] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]";

  const publish = async (p: Project, mfr: keyof typeof MFR) => {
    if (!p.thumbnail_url) { toast.error("No render to publish"); return; }
    const { data, error } = await supabase.functions.invoke("publish-design", {
      body: { projectId: p.id, imageUrl: p.thumbnail_url, title: p.name, retailPriceCents: p.price_cents, templateKey: mfr === "apliq" ? "tee_apliq" : p.template_key },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message || "Publish failed"); return; }
    toast.success(`Published via ${MFR[mfr].label}.`);
    load();
  };

  return (
    <div className={`admin-page min-h-screen ${isDark ? "bg-black text-white" : "bg-[#f5f5f7] text-black"} font-mono`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <Link to="/admin" className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${sub} hover:opacity-70`}>
          <ArrowLeft size={11} /> Back to Admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Sparkles size={18} className="opacity-70" /> AI Auto · Manufacturer Compare</h1>
        <p className={`text-[11px] mt-1 mb-7 ${sub}`}>
          Autonomous AI drafts, shown side-by-side on each manufacturer with cost &amp; markup. Choose one to publish, or modify in the Studio.
        </p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin opacity-50" /></div>
        ) : projects.length === 0 ? (
          <div className={`rounded-[24px] border border-dashed py-20 text-center ${isDark ? "border-neutral-850 text-neutral-555" : "border-[#D1D1D6] text-neutral-455"}`}>
            <Sparkles size={28} className="mx-auto opacity-30 mb-3" />
            <p className="text-[11px]">No AI-automated drafts yet.</p>
            <p className="text-[10px] mt-1 opacity-70">The autonomous generator will populate this. Manual designs live in the Studio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {projects.map((p) => (
              <div key={p.id} className={`rounded-[24px] border overflow-hidden ${card}`}>
                <div className="p-4 flex items-center justify-between">
                  <p className="text-[12px] font-medium truncate">{p.name}</p>
                  {p.status === "published" && <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-widest">Live</span>}
                </div>
                <div className="grid grid-cols-2">
                  {(["printful", "apliq"] as const).map((m) => {
                    const cost = MFR[m].baseCost;
                    const markup = p.price_cents - cost;
                    return (
                      <div key={m} className={`p-4 border-t ${isDark ? "border-neutral-850" : "border-[#E5E5EA]"} ${m === "printful" ? (isDark ? "border-r border-r-neutral-850" : "border-r border-r-[#E5E5EA]") : ""}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: MFR[m].color }} />
                          <p className="text-[10px] font-semibold">{MFR[m].label}</p>
                        </div>
                        <div className="aspect-square rounded-[14px] bg-[#FAFAFA] overflow-hidden mb-3 flex items-center justify-center">
                          {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-contain" /> : <Layers size={22} className="opacity-20" />}
                        </div>
                        <div className={`text-[10px] space-y-0.5 ${sub}`}>
                          <p>Retail <span className="text-current font-medium">${(p.price_cents / 100).toFixed(2)}</span></p>
                          <p>Cost ~${(cost / 100).toFixed(2)} · {MFR[m].lead}</p>
                          <p>Margin <span className={markup > 0 ? "text-emerald-500" : "text-rose-500"}>${(markup / 100).toFixed(2)}</span></p>
                        </div>
                        <button onClick={() => publish(p, m)}
                          className={`mt-3 w-full flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest py-2 rounded-full ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
                          <Check size={11} /> Publish via {MFR[m].label}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <a href={`/admin/studio?open=${p.id}`}
                  className={`flex items-center justify-center gap-1.5 text-[10px] py-3 border-t ${isDark ? "border-neutral-850 hover:bg-neutral-900/40" : "border-[#E5E5EA] hover:bg-neutral-50"}`}>
                  <Pencil size={11} /> Modify in Studio
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { Sparkles, Loader2, Trash2, ArrowLeft, Plus, Wand2, Layers, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { computeRetailCents, realizedMargin } from "@/lib/pricing";

export const Route = createFileRoute("/admin/studio")({
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Studio · Luveni" }] }),
  component: StudioPage,
});

// Editor pulls in Konva (DOM-only) — load it lazily so it never runs on SSR.
const StudioEditor = lazy(() => import("@/components/studio/StudioEditor"));

type Blank = { id: number | string; key: string; label: string; mfr: string; type?: string; brand?: string | null; image: string | null; variant_count?: number; error?: string };
type BlankColor = { name: string; code: string | null; image: string | null; variant_id?: number | null };
type PrintArea = { placement: string; width_px: number; height_px: number; dpi: number; width_in: number; height_in: number };
type Frac = { x: number; y: number; w: number; h: number };
type Template = { image_url: string | null; background_url: string | null; template_w: number; template_h: number; print_area: Frac; print_px: { width: number; height: number } };
type Placement = Template & { placement: string };
type BlankDetail = { id: number | string; key: string; label: string; mfr: string; type?: string; image: string | null; min_cost_cents: number; max_cost_cents: number; colors: BlankColor[]; sizes: string[]; variant_count: number; print_area?: PrintArea | null; template?: Template | null; placements?: Placement[] | null };
type MfrStatus = { available: boolean; error: string | null; count: number };

type Project = {
  id: string; name: string; manufacturer: string; template_key: string;
  price_cents: number; canvas: any; artboard_w: number; artboard_h: number;
  thumbnail_url: string | null; status: string; created_at: string;
  template_image?: string | null; canvas_kind?: string;
  print_area?: { x: number; y: number; w: number; h: number } | null;
};
type Design = { id: string; title: string | null; prompt: string | null; image_url: string; width: number; height: number; model: string };

// Utility function to transparently rewrite Printful and Apliiq image CDN URLs 
// to go through our Supabase Edge Function proxy, avoiding canvas/WebGL CORS blocks.
export const getProxyImageUrl = (url: string | null): string => {
  if (!url) return "";
  if (url.includes("files.cdn.printful.com") || url.includes("apliiq.com")) {
    const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL || "";
    if (supabaseUrl) {
      return `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(url)}`;
    }
  }
  return url;
};

function StudioPage() {
  const [isDark, setIsDark] = useState(false);
  const [tab, setTab] = useState<"projects" | "assets">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [loadingBlanks, setLoadingBlanks] = useState(false);
  const [manufacturer, setManufacturer] = useState<"all" | "printful" | "apliiq">("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [mfrStatus, setMfrStatus] = useState<{ printful?: MfrStatus; apliiq?: MfrStatus }>({});
  const [detail, setDetail] = useState<BlankDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const loadProjects = async () => {
    const { data } = await supabase.from("studio_projects").select("*").order("updated_at", { ascending: false }).limit(60);
    if (data) setProjects(data as Project[]);
  };
  const loadDesigns = async () => {
    const { data } = await supabase.from("designs").select("*").order("created_at", { ascending: false }).limit(60);
    if (data) setDesigns(data as Design[]);
  };
  useEffect(() => { loadProjects(); loadDesigns(); }, []);

  // Update browser URL query params dynamically to enable session recovery upon refresh
  const handleSetEditing = (p: Project | null) => {
    setEditing(p);
    const url = new URL(window.location.href);
    if (p) {
      url.searchParams.set("open", p.id);
    } else {
      url.searchParams.delete("open");
    }
    window.history.pushState({}, "", url.toString());
  };

  // Deep-link: /admin/studio?open=<projectId> opens that project (used by page refreshes)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("studio_projects").select("*").eq("id", id).maybeSingle();
      if (data) setEditing(data as Project);
    })();
  }, []);

  // Pull the full real-time catalog for the selected manufacturer(s).
  const loadCatalog = async (mfr: "all" | "printful" | "apliiq") => {
    setLoadingBlanks(true);
    setBlanks([]);
    setCategory("all");
    try {
      const { data, error } = await supabase.functions.invoke("printful-catalog", { body: { action: "list", manufacturer: mfr } });
      if (!error && data?.blanks) setBlanks(data.blanks as Blank[]);
      if (data?.manufacturers) setMfrStatus(data.manufacturers);
      if (data?.error) toast.error(data.error);
    } finally { setLoadingBlanks(false); }
  };

  const openNew = async () => {
    setNewOpen(true);
    setDetail(null);
    setQuery("");
    await loadCatalog(manufacturer);
  };

  const switchManufacturer = async (mfr: "all" | "printful" | "apliiq") => {
    setManufacturer(mfr);
    setDetail(null);
    setQuery("");
    await loadCatalog(mfr);
  };

  // Selecting a product fetches its live colors / sizes / price range.
  const openBlankDetail = async (b: Blank) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const { data, error } = await supabase.functions.invoke("printful-catalog", { body: { action: "detail", manufacturer: b.mfr, id: b.id } });
      if (error || !data?.detail) { toast.error(data?.error || error?.message || "Could not load product"); return; }
      setDetail(data.detail as BlankDetail);
    } finally { setLoadingDetail(false); }
  };

  const createFromDetail = async (d: BlankDetail, color: BlankColor | null) => {
    setCreating(true);
    try {
      const tee = /t-?shirt|tee|hoodie|sweat|long\s*sleeve|crew/i.test(d.type || d.label);
      // Manufacturer cost → margin → retail. price_cents is the storefront retail;
      // the raw blank cost is preserved on the product ref for the live calculator.
      const costCents = d.min_cost_cents || 0;
      const retailCents = computeRetailCents(costCents);
      const pa = d.print_area;
      // Use Printful's real mockup template when available: the artboard becomes
      // the exact template (so the product image fills it without warping) and
      // the dashed guide is the real print area — 100% accurate to Printful.
      // Fall back through front template → first placement → variant photo.
      const placements = d.placements && d.placements.length ? d.placements : [];
      const tpl = d.template || placements[0] || null;
      const { data, error } = await supabase.from("studio_projects").insert({
        name: `${color ? color.name + " " : ""}${d.label}`,
        manufacturer: d.mfr,
        template_key: d.key,
        price_cents: retailCents,
        artboard_w: tpl?.template_w || (tee ? 4500 : 5400),
        artboard_h: tpl?.template_h || 5400,
        template_image: tpl?.image_url || color?.image || d.image,
        canvas_kind: "product",
        print_area: tpl?.print_area || null,
        // Persist ALL print locations so the editor can offer per-placement
        // surfaces (front/back/sleeves) — see docs/STUDIO_OVERHAUL.md.
        canvas: { layers: [], product: { id: d.id, mfr: d.mfr, color: color?.name || null, variant_id: color?.variant_id ?? null, sizes: d.sizes, cost_cents: costCents, print: pa || null, placements } },
      }).select("*").single();
      if (error || !data) { toast.error(error?.message || "Could not create project"); return; }
      setNewOpen(false); setDetail(null); await loadProjects(); handleSetEditing(data as Project);
    } finally { setCreating(false); }
  };

  const createBlankCanvas = async () => {
    const { data, error } = await supabase.from("studio_projects").insert({
      name: "Blank canvas", manufacturer: "none", template_key: "canvas",
      price_cents: 0, artboard_w: 4000, artboard_h: 4000,
      canvas_kind: "canvas", template_image: null, canvas: { layers: [] },
    }).select("*").single();
    if (error || !data) { toast.error(error?.message || "Could not create project"); return; }
    setNewOpen(false); await loadProjects(); handleSetEditing(data as Project);
  };

  const removeProject = async (id: string) => {
    const { error } = await supabase.from("studio_projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setProjects((p) => p.filter((x) => x.id !== id));
    toast.success("Project deleted.");
  };

  const removeDesign = async (id: string) => {
    const { error } = await supabase.from("designs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setDesigns((d) => d.filter((x) => x.id !== id));
    toast.success("AI asset deleted.");
  };

  const card = isDark ? "border-neutral-850 bg-neutral-955/40 hover:border-neutral-700" : "border-[#D1D1D6] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]";
  const sub = isDark ? "text-neutral-500" : "text-neutral-555";

  // Derived catalog filters for the picker.
  const categories = Array.from(new Set(blanks.map((b) => b.type).filter(Boolean) as string[])).sort();
  const q = query.trim().toLowerCase();
  const visibleBlanks = blanks.filter((b) => {
    if (category !== "all" && b.type !== category) return false;
    if (!q) return true;
    return `${b.label} ${b.type || ""} ${b.brand || ""} ${b.mfr}`.toLowerCase().includes(q);
  });

  return (
    <div className={`admin-page min-h-screen relative font-mono bg-[#f5f5f7] text-neutral-900 selection:bg-neutral-200 dark:bg-black dark:text-neutral-105 dark:selection:bg-neutral-800`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <Link to="/admin" preload={false} className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${sub} hover:opacity-70`}>
          <ArrowLeft size={11} /> Back to Admin
        </Link>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-xl font-medium tracking-tight flex items-center gap-2"><Wand2 size={16} className="opacity-70" /> Design Studio</h1>
            <p className={`text-[11px] mt-1 ${sub}`}>Free Illustrator-grade editor · AI magic · manufacturer templates</p>
          </div>
          {tab === "projects" && (
            <button onClick={openNew}
              className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-[9999px] ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
              <Plus size={13} /> New project
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-[9999px] w-fit mb-7 ${isDark ? "bg-neutral-900/50" : "bg-[#e8e8ed]/60"}`}>
          {([["projects", "Projects", Layers], ["assets", "AI Assets", ImageIcon]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-[9px] font-semibold uppercase tracking-widest rounded-[9999px] transition-all ${
                tab === k ? (isDark ? "bg-white text-black" : "bg-white text-black shadow") : sub
              }`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Projects grid */}
        {tab === "projects" && (
          projects.length === 0 ? (
            <Empty isDark={isDark} text="No projects yet. Start a new one." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {projects.map((p) => (
                <div key={p.id} className={`group relative rounded-[20px] overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 ${card}`}>
                  <button onClick={() => handleSetEditing(p)} className="block w-full text-left">
                    <div className={`aspect-square flex items-center justify-center overflow-hidden ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}>
                      {p.thumbnail_url ? (
                        <img src={getProxyImageUrl(p.thumbnail_url)} alt="" loading="lazy" className="w-full h-full object-contain" />
                      ) : p.template_image ? (
                        <img src={getProxyImageUrl(p.template_image)} alt="" loading="lazy" className="w-full h-full object-contain opacity-50" />
                      ) : (
                        <Layers size={26} className="opacity-20" />
                      )}
                    </div>
                    <div className="px-3 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate normal-case">{p.name}</p>
                        <p className={`text-[9px] mt-0.5 uppercase tracking-wider ${sub}`}>{p.manufacturer} · ${(p.price_cents / 100).toFixed(2)}</p>
                      </div>
                      {p.status === "published" && <span className="shrink-0 text-[7px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-widest">Live</span>}
                    </div>
                  </button>
                  <button onClick={() => removeProject(p.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* AI assets gallery (Phase 1 generator) */}
        {tab === "assets" && (
          <AssetsTab
            isDark={isDark}
            designs={designs}
            reload={loadDesigns}
            onRemove={removeDesign}
          />
        )}
      </div>

      {/* New project modal */}
      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setNewOpen(false); setDetail(null); }}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl rounded-[24px] border p-6 ${isDark ? "bg-neutral-955 border-neutral-850" : "bg-white border-[#D1D1D6]"}`}>

            {/* ── Detail step: choose color, see live price ── */}
            {detail ? (
              <ColorStep isDark={isDark} sub={sub} detail={detail} creating={creating}
                onBack={() => setDetail(null)}
                onCreate={(c) => createFromDetail(detail, c)} />
            ) : (
              <>
                <h2 className="text-[13px] font-semibold mb-1">New project</h2>
                <p className={`text-[10px] mb-4 ${sub}`}>Start from a blank canvas, or design on a real blank from the full live catalog — the artboard becomes that exact product at its real cost.</p>

                {/* Blank canvas */}
                <button onClick={createBlankCanvas}
                  className={`w-full flex items-center gap-3 p-4 rounded-[16px] border mb-4 transition-all ${isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"}`}>
                  <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}><Layers size={18} className="opacity-50" /></div>
                  <div className="text-left"><p className="text-[11px] font-semibold normal-case">Blank Canvas</p><p className={`text-[9px] mt-0.5 ${sub}`}>4000 × 4000 · free-form artwork</p></div>
                </button>

                {/* Manufacturer + category controls */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-[9px] uppercase tracking-widest ${sub}`}>Store</span>
                  <div className={`flex gap-1 p-1 rounded-[9999px] ${isDark ? "bg-neutral-900/60" : "bg-[#e8e8ed]/70"}`}>
                    {(["all", "printful", "apliiq"] as const).map((m) => (
                      <button key={m} onClick={() => switchManufacturer(m)}
                        className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-[9999px] transition-all ${manufacturer === m ? (isDark ? "bg-white text-black" : "bg-white text-black shadow") : sub}`}>
                        {m === "all" ? "Both" : m}
                      </button>
                    ))}
                  </div>
                  {categories.length > 1 && (
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                      className={`ml-auto text-[10px] rounded-[9999px] px-3 py-1.5 border focus:outline-none ${isDark ? "bg-neutral-900 border-neutral-800 text-neutral-200" : "bg-white border-[#D1D1D6]"}`}>
                      <option value="all">All categories ({blanks.length})</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>

                {/* Search Box */}
                <div className="mb-4">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search blanks (e.g., canvas, shirt, heavyweight)..."
                    className={`w-full bg-transparent border rounded-[9999px] px-4 py-2 text-[11px] focus:outline-none ${isDark ? "border-neutral-800 text-white placeholder-neutral-500" : "border-[#D1D1D6] text-black placeholder-neutral-400"}`}
                  />
                </div>

                {/* Per-manufacturer status (errors surface here, never blank the picker) */}
                {(mfrStatus.printful?.error || mfrStatus.apliiq?.error) && (
                  <div className={`text-[9px] mb-2 ${sub}`}>
                    {mfrStatus.printful?.error && <span className="mr-3 text-red-500">Printful: {mfrStatus.printful.error}</span>}
                    {mfrStatus.apliiq?.error && <span className="text-red-500">Apliiq: {mfrStatus.apliiq.error}</span>}
                  </div>
                )}

                {loadingBlanks ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin opacity-50" /></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                    {visibleBlanks.map((b) => (
                      <button key={b.key} onClick={() => openBlankDetail(b)} disabled={loadingDetail}
                        className={`text-left rounded-[16px] border overflow-hidden transition-all disabled:opacity-50 ${isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"}`}>
                        <div className={`aspect-square flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}>
                          {b.image ? <img src={getProxyImageUrl(b.image)} alt={b.label} loading="lazy" className="w-full h-full object-contain" /> : <Layers size={20} className="opacity-30" />}
                        </div>
                        <div className="p-2.5">
                          <p className="text-[10px] font-semibold normal-case truncate">{b.label}</p>
                          <p className={`text-[8px] mt-0.5 uppercase tracking-wider ${sub}`}>{b.mfr}{b.type ? ` · ${b.type}` : ""}</p>
                        </div>
                      </button>
                    ))}
                    {visibleBlanks.length === 0 && !loadingBlanks && (
                      <p className={`text-[10px] col-span-full text-center py-4 ${sub}`}>No products found matching your filter criteria.</p>
                    )}
                  </div>
                )}
                {loadingDetail && <div className="flex items-center gap-2 mt-3 text-[10px]"><Loader2 size={12} className="animate-spin" /> Loading colors & pricing…</div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Editor (client-only) */}
      {editing && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin" /></div>}>
          <StudioEditor
            projectId={editing.id}
            initialCanvas={editing.canvas}
            artboardW={editing.artboard_w}
            artboardH={editing.artboard_h}
            templateKey={editing.template_key}
            templateImage={editing.template_image || null}
            canvasKind={editing.canvas_kind || "product"}
            projectName={editing.name}
            priceCents={editing.price_cents}
            printArea={editing.print_area || null}
            isDark={isDark}
            onClose={() => { handleSetEditing(null); loadProjects(); }}
          />
        </Suspense>
      )}
    </div>
  );
}

// Color/size/price chooser shown after a blank is selected. The chosen color's
// mockup becomes the artboard template so the studio + 3D view reflect reality.
function ColorStep({ isDark, sub, detail, creating, onBack, onCreate }: {
  isDark: boolean; sub: string; detail: BlankDetail; creating: boolean;
  onBack: () => void; onCreate: (color: BlankColor | null) => void;
}) {
  const [color, setColor] = useState<BlankColor | null>(detail.colors[0] || null);
  const priceLabel = detail.min_cost_cents
    ? detail.max_cost_cents && detail.max_cost_cents !== detail.min_cost_cents
      ? `$${(detail.min_cost_cents / 100).toFixed(2)}–$${(detail.max_cost_cents / 100).toFixed(2)}`
      : `from $${(detail.min_cost_cents / 100).toFixed(2)}`
    : "price unavailable";
  // Live retail from the blank cost (cost → margin → retail).
  const retailCents = computeRetailCents(detail.min_cost_cents);
  const marginPct = Math.round(realizedMargin(detail.min_cost_cents, retailCents) * 100);

  return (
    <>
      <button onClick={onBack} className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${sub} hover:opacity-70`}>
        <ArrowLeft size={11} /> Back to catalog
      </button>
      <div className="flex gap-4">
        <div className={`w-40 h-40 shrink-0 rounded-[16px] overflow-hidden flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}>
          {(color?.image || detail.image) ? <img src={getProxyImageUrl(color?.image || detail.image || "")} alt={detail.label} className="w-full h-full object-contain" /> : <Layers size={24} className="opacity-30" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold normal-case">{detail.label}</h2>
          <p className={`text-[10px] mt-0.5 uppercase tracking-wider ${sub}`}>{detail.mfr}{detail.type ? ` · ${detail.type}` : ""}</p>
          <p className={`text-[9px] mt-2 uppercase tracking-wider ${sub}`}>Blank cost · {priceLabel}</p>
          {retailCents > 0 && (
            <p className="text-[13px] font-semibold mt-0.5">
              Retail ${(retailCents / 100).toFixed(2)}
              <span className={`ml-2 text-[9px] font-normal uppercase tracking-wider ${sub}`}>{marginPct}% margin</span>
            </p>
          )}
          {detail.sizes.length > 0 && <p className={`text-[9px] mt-1 ${sub}`}>Sizes: {detail.sizes.join(", ")}</p>}

          {detail.colors.length > 0 && (
            <>
              <p className={`text-[9px] uppercase tracking-widest mt-3 mb-1.5 ${sub}`}>Color · {color?.name || "—"}</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {detail.colors.map((c) => (
                  <button key={c.name} onClick={() => setColor(c)} title={c.name}
                    className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${color?.name === c.name ? "ring-2 ring-offset-1 ring-current" : ""} ${isDark ? "border-neutral-700 ring-offset-neutral-955" : "border-neutral-300 ring-offset-white"}`}
                    style={{ backgroundColor: c.code ? (c.code.startsWith("#") ? c.code : `#${c.code}`) : "#ccc" }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <button onClick={() => onCreate(color)} disabled={creating}
        className={`w-full mt-5 flex items-center justify-center gap-2 py-3 rounded-[9999px] text-[10px] font-bold uppercase tracking-widest ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
        {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create project
      </button>
    </>
  );
}

function Empty({ isDark, text }: { isDark: boolean; text: string }) {
  return (
    <div className={`rounded-[24px] border border-dashed py-20 text-center ${isDark ? "border-neutral-850 text-neutral-555" : "border-[#D1D1D6] text-neutral-455"}`}>
      <Sparkles size={28} className="mx-auto opacity-30 mb-3" />
      <p className="text-[11px]">{text}</p>
    </div>
  );
}

function AssetsTab({ isDark, designs, reload, onRemove }: { isDark: boolean; designs: Design[]; reload: () => void; onRemove: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const sub = isDark ? "text-neutral-500" : "text-neutral-555";

  const generate = async () => {
    if (prompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", { body: { prompt: prompt.trim(), width: 1024, height: 1024, style: "apparel" } });
      let msg = data?.error as string | undefined;
      if (!msg && error) { const ctx = (error as any).context; if (ctx?.json) { try { msg = (await ctx.json())?.error; } catch {} } msg = msg || error.message; }
      if (msg) { toast.error(msg); return; }
      setPrompt(""); reload();
      toast.success("Generated.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className={`rounded-[20px] border p-4 mb-6 flex gap-2 items-center ${isDark ? "border-neutral-850 bg-neutral-955/40" : "border-[#D1D1D6] bg-white"}`}>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Generate an asset… e.g. 'gothic rose line art, white on transparent'"
          className={`flex-1 bg-transparent border rounded-[9999px] px-4 py-2 text-[11px] focus:outline-none ${isDark ? "border-neutral-800" : "border-[#D1D1D6]"}`} />
        <button onClick={generate} disabled={busy}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase rounded-[9999px] ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
        </button>
      </div>
      {designs.length === 0 ? <Empty isDark={isDark} text="No AI assets yet." /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((d) => (
            <div key={d.id} className={`rounded-[20px] overflow-hidden border transition-all duration-300 hover:-translate-y-0.5 ${isDark ? "border-neutral-850 bg-neutral-955/40 hover:border-neutral-700" : "border-[#D1D1D6] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]"}`}>
              <div className="aspect-square bg-[#FAFAFA] overflow-hidden">
                <img src={d.image_url} alt={d.title ?? ""} className="w-full h-full object-cover" />
              </div>
              <div className="p-2.5">
                <p className="text-[10px] truncate opacity-90">{d.title || d.prompt}</p>
                <p className={`text-[9px] ${sub}`}>{d.model} · {d.width}×{d.height}</p>
              </div>
              <button onClick={() => onRemove(d.id)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

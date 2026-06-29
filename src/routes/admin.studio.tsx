import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { Sparkles, Loader2, Trash2, ArrowLeft, Plus, Wand2, Layers, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/studio")({
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Studio · Luveni" }] }),
  component: StudioPage,
});

// Editor pulls in Konva (DOM-only) — load it lazily so it never runs on SSR.
const StudioEditor = lazy(() => import("@/components/studio/StudioEditor"));

type Blank = { key: string; label: string; mfr: string; catalog_id: number; image: string | null; template_image?: string | null; thumb?: string | null; cost_cents: number; variant_count: number; error?: string; artboard_w?: number; artboard_h?: number; print_area?: { x: number; y: number; w: number; h: number } | null };

type Project = {
  id: string; name: string; manufacturer: string; template_key: string;
  price_cents: number; canvas: any; artboard_w: number; artboard_h: number;
  thumbnail_url: string | null; status: string; created_at: string;
  template_image?: string | null; canvas_kind?: string;
  print_area?: { x: number; y: number; w: number; h: number } | null;
};
type Design = { id: string; title: string | null; prompt: string | null; image_url: string; width: number; height: number; model: string };

function StudioPage() {
  const [isDark, setIsDark] = useState(false);
  const [tab, setTab] = useState<"projects" | "assets">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [blanks, setBlanks] = useState<Blank[]>([]);
  const [loadingBlanks, setLoadingBlanks] = useState(false);

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

  // Pull the real manufacturer blanks (image + cost) when the modal opens.
  const openNew = async () => {
    setNewOpen(true);
    if (blanks.length === 0) {
      setLoadingBlanks(true);
      try {
        const { data, error } = await supabase.functions.invoke("printful-catalog", { body: {} });
        if (!error && data?.blanks) setBlanks(data.blanks as Blank[]);
        else if (data?.error) toast.error(data.error);
      } finally { setLoadingBlanks(false); }
    }
  };

  const createFromBlank = async (b: Blank) => {
    // Pull the dynamic template proportions directly from the printful-catalog API
    const { data, error } = await supabase.from("studio_projects").insert({
      name: `${b.label} design`,
      manufacturer: b.mfr,
      template_key: b.key,
      price_cents: b.cost_cents,
      artboard_w: b.artboard_w || 4500,
      artboard_h: b.artboard_h || 5400,
      template_image: b.template_image || b.image,
      canvas_kind: "product",
      print_area: b.print_area || null,
      canvas: { layers: [] },
    }).select("*").single();
    if (error || !data) { toast.error(error?.message || "Could not create project"); return; }
    setNewOpen(false); await loadProjects(); handleSetEditing(data as Project);
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

  return (
    <div className={`admin-page min-h-screen relative font-mono bg-[#f5f5f7] text-neutral-900 selection:bg-neutral-200 dark:bg-black dark:text-neutral-105 dark:selection:bg-neutral-800`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <Link to="/admin" className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${sub} hover:opacity-70`}>
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
                        <img src={p.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-contain" />
                      ) : p.template_image ? (
                        <img src={p.template_image} alt="" loading="lazy" className="w-full h-full object-contain opacity-50" />
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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setNewOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg rounded-[24px] border p-6 ${isDark ? "bg-neutral-955 border-neutral-850" : "bg-white border-[#D1D1D6]"}`}>
            <h2 className="text-[13px] font-semibold mb-1">New project</h2>
            <p className={`text-[10px] mb-5 ${sub}`}>Start from a blank canvas, or design directly on a real manufacturer blank — the artboard becomes that exact product at its real cost.</p>

            {/* Blank canvas */}
            <button onClick={createBlankCanvas}
              className={`w-full flex items-center gap-3 p-4 rounded-[16px] border mb-4 transition-all ${isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"}`}>
              <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}><Layers size={18} className="opacity-50" /></div>
              <div className="text-left"><p className="text-[11px] font-semibold normal-case">Blank Canvas</p><p className={`text-[9px] mt-0.5 ${sub}`}>4000 × 4000 · free-form artwork</p></div>
            </button>

            <p className={`text-[9px] uppercase tracking-widest mb-2 ${sub}`}>Manufacturer blanks</p>
            {loadingBlanks ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin opacity-50" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                {blanks.map((b) => (
                  <button key={b.key} onClick={() => createFromBlank(b)} disabled={!!b.error}
                    className={`text-left rounded-[16px] border overflow-hidden transition-all disabled:opacity-40 ${isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"}`}>
                    <div className={`aspect-square flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-[#f0f0f3]"}`}>
                      {b.image ? <img src={b.image} alt={b.label} className="w-full h-full object-contain" /> : <Layers size={20} className="opacity-30" />}
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-semibold normal-case">{b.label}</p>
                      <p className={`text-[9px] mt-0.5 ${sub}`}>{b.mfr} · from ${(b.cost_cents / 100).toFixed(2)}{b.error ? " · unavailable" : ""}</p>
                    </div>
                  </button>
                ))}
                {blanks.length === 0 && !loadingBlanks && <p className={`text-[10px] col-span-2 ${sub}`}>Could not load manufacturer blanks (check PRINTFUL_API_KEY).</p>}
              </div>
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

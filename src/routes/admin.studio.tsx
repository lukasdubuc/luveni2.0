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

// Manufacturer blank templates. Artboard is print-resolution (300dpi-ish).
// Real garment mockups arrive when we wire the Printful Mockup API (Phase 3);
// for now each is a print-area artboard with a sensible base price.
const TEMPLATES = [
  { key: "tee", label: "T-Shirt", w: 4500, h: 5400, price: 2499, mfr: "printful" },
  { key: "hoodie", label: "Hoodie", w: 4500, h: 5400, price: 4499, mfr: "printful" },
  { key: "hat", label: "Hat / Cap", w: 2400, h: 1200, price: 2299, mfr: "printful" },
  { key: "poster", label: "Poster", w: 3600, h: 5400, price: 1899, mfr: "printful" },
  { key: "tee_apliq", label: "T-Shirt (Apliiq)", w: 4500, h: 5400, price: 2899, mfr: "apliq" },
];

type Project = {
  id: string; name: string; manufacturer: string; template_key: string;
  price_cents: number; canvas: any; artboard_w: number; artboard_h: number;
  thumbnail_url: string | null; status: string; created_at: string;
};
type Design = { id: string; title: string | null; prompt: string | null; image_url: string; width: number; height: number; model: string };

function StudioPage() {
  const [isDark, setIsDark] = useState(false);
  const [tab, setTab] = useState<"projects" | "assets">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [newOpen, setNewOpen] = useState(false);

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

  const createProject = async (tpl: typeof TEMPLATES[number]) => {
    const { data, error } = await supabase
      .from("studio_projects")
      .insert({
        name: `${tpl.label} design`,
        manufacturer: tpl.mfr,
        template_key: tpl.key,
        price_cents: tpl.price,
        artboard_w: tpl.w,
        artboard_h: tpl.h,
        canvas: { layers: [] },
      })
      .select("*")
      .single();
    if (error || !data) { toast.error(error?.message || "Could not create project"); return; }
    setNewOpen(false);
    await loadProjects();
    setEditing(data as Project);
  };

  const removeProject = async (id: string) => {
    const { error } = await supabase.from("studio_projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setProjects((p) => p.filter((x) => x.id !== id));
    toast.success("Project deleted.");
  };

  const card = isDark ? "border-neutral-850 bg-neutral-955/40 hover:border-neutral-700" : "border-[#D1D1D6] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]";
  const sub = isDark ? "text-neutral-500" : "text-neutral-555";

  return (
    <div className={`admin-page min-h-screen ${isDark ? "bg-black text-white" : "bg-[#f5f5f7] text-black"} font-mono`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <Link to="/admin" className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${sub} hover:opacity-70`}>
          <ArrowLeft size={11} /> Back to Admin
        </Link>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Wand2 size={18} className="opacity-70" /> Design Studio</h1>
            <p className={`text-[11px] mt-1 ${sub}`}>Free Illustrator-grade editor · AI magic · manufacturer templates</p>
          </div>
          {tab === "projects" && (
            <button onClick={() => setNewOpen(true)}
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
                <div key={p.id} className={`group relative rounded-[20px] overflow-hidden border ${card}`}>
                  <button onClick={() => setEditing(p)} className="block w-full text-left">
                    <div className="aspect-square bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
                      {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-contain" /> : <Layers size={26} className="opacity-20" />}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[10px] truncate">{p.name}</p>
                      <p className={`text-[9px] mt-0.5 ${sub}`}>{p.manufacturer} · ${(p.price_cents / 100).toFixed(2)}</p>
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
        {tab === "assets" && <AssetsTab isDark={isDark} designs={designs} reload={loadDesigns} />}
      </div>

      {/* New project modal */}
      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setNewOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg rounded-[24px] border p-6 ${isDark ? "bg-neutral-955 border-neutral-850" : "bg-white border-[#D1D1D6]"}`}>
            <h2 className="text-[13px] font-semibold mb-1">Choose a template</h2>
            <p className={`text-[10px] mb-5 ${sub}`}>Pick the manufacturer blank + print size. Price is the suggested retail; you can change it at publish.</p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => createProject(t)}
                  className={`text-left p-4 rounded-[16px] border transition-all ${isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"}`}>
                  <p className="text-[11px] font-semibold">{t.label}</p>
                  <p className={`text-[9px] mt-1 ${sub}`}>{t.mfr} · {t.w}×{t.h}</p>
                  <p className={`text-[10px] mt-2`}>${(t.price / 100).toFixed(2)}</p>
                </button>
              ))}
            </div>
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
            projectName={editing.name}
            priceCents={editing.price_cents}
            isDark={isDark}
            onClose={() => { setEditing(null); loadProjects(); }}
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

function AssetsTab({ isDark, designs, reload }: { isDark: boolean; designs: Design[]; reload: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const sub = isDark ? "text-neutral-500" : "text-neutral-555";

  const generate = async () => {
    if (prompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", { body: { prompt: prompt.trim(), width: 1024, height: 1024 } });
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
            <div key={d.id} className={`rounded-[20px] overflow-hidden border ${isDark ? "border-neutral-850 bg-neutral-955/40" : "border-[#D1D1D6] bg-white"}`}>
              <div className="aspect-square bg-[#FAFAFA] overflow-hidden">
                <img src={d.image_url} alt={d.title ?? ""} className="w-full h-full object-cover" />
              </div>
              <div className="p-2.5"><p className="text-[10px] truncate opacity-90">{d.title || d.prompt}</p><p className={`text-[9px] ${sub}`}>{d.model} · {d.width}×{d.height}</p></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

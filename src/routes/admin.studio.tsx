import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Trash2, ArrowLeft, ShoppingBag, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export const Route = createFileRoute("/admin/studio")({
  beforeLoad: requireAdmin,
  head: () => ({ meta: [{ title: "Studio · Luveni" }] }),
  component: StudioPage,
});

type Design = {
  id: string;
  title: string | null;
  prompt: string | null;
  image_url: string;
  width: number;
  height: number;
  model: string;
  status: string;
  created_at: string;
};

const MODELS = [
  { id: "flux", label: "Flux (default)", hint: "Best all-round quality" },
  { id: "flux-realism", label: "Flux Realism", hint: "Photoreal" },
  { id: "flux-anime", label: "Flux Anime", hint: "Anime / illustration" },
  { id: "flux-3d", label: "Flux 3D", hint: "3D-rendered look" },
  { id: "turbo", label: "Turbo", hint: "Fast, lower fidelity" },
];

const DIMS = [
  { w: 1024, h: 1024, label: "Square" },
  { w: 1024, h: 1408, label: "Portrait" },
  { w: 1408, h: 1024, label: "Landscape" },
  { w: 2048, h: 2048, label: "Print HD" },
];

function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [dim, setDim] = useState(DIMS[0]);
  const [generating, setGenerating] = useState(false);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [selected, setSelected] = useState<Design | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Theme detection mirrors the rest of /admin (root toggles .dark on <html>).
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("designs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (data) setDesigns(data as Design[]);
    })();
    const ch = supabase
      .channel("designs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "designs" }, (p) => {
        if (p.eventType === "INSERT") setDesigns((d) => [p.new as Design, ...d].slice(0, 100));
        else if (p.eventType === "UPDATE") setDesigns((d) => d.map((x) => (x.id === (p.new as any).id ? (p.new as Design) : x)));
        else if (p.eventType === "DELETE") setDesigns((d) => d.filter((x) => x.id !== (p.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const generate = async () => {
    if (prompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: prompt.trim(), model, width: dim.w, height: dim.h },
      });
      if (error) {
        let msg = error.message || "Generation failed";
        const ctx = (error as any).context;
        if (ctx?.json) { try { const b = await ctx.json(); if (b?.error) msg = b.error; } catch {} }
        toast.error(msg);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Generated.");
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const removeDesign = async (id: string) => {
    const { error } = await supabase.from("designs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected?.id === id) setSelected(null);
    toast.success("Deleted.");
  };

  const useAsProduct = (d: Design) => {
    // Hand-off to admin products: open the new-product form pre-filled with
    // this design's image. (admin.index.tsx reads the query params on load.)
    const params = new URLSearchParams({ new_from_design: "1", image: d.image_url, title: d.title || "" });
    window.location.href = `/admin?${params.toString()}`;
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-[#f5f5f7] text-black"} font-mono`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/admin" className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-3 ${isDark ? "text-neutral-500 hover:text-white" : "text-neutral-555 hover:text-black"}`}>
              <ArrowLeft size={11} /> Back to Admin
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Wand2 size={18} className="opacity-70" /> Studio
            </h1>
            <p className={`text-[11px] mt-1 ${isDark ? "text-neutral-500" : "text-neutral-555"}`}>
              AI design generation · Pollinations · Free · Flux
            </p>
          </div>
        </div>

        {/* Prompt panel */}
        <div className={`rounded-[24px] border p-5 mb-8 ${isDark ? "border-neutral-850 bg-neutral-955/40" : "border-[#D1D1D6] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]"}`}>
          <label className={`block text-[9px] uppercase tracking-widest mb-2 ${isDark ? "text-neutral-500" : "text-neutral-555"}`}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A minimalist black bonsai logo, high contrast, vector style…"
            rows={3}
            maxLength={500}
            className={`w-full rounded-[16px] px-4 py-3 text-[12px] resize-none bg-transparent border focus:outline-none focus:ring-1 ${
              isDark ? "border-neutral-800 text-white focus:border-white focus:ring-white/20" : "border-[#D1D1D6] text-black focus:border-black focus:ring-black/10"
            }`}
          />

          <div className="flex flex-wrap gap-4 mt-4 items-end">
            <div>
              <p className={`text-[8px] uppercase tracking-widest mb-1.5 ${isDark ? "text-neutral-500" : "text-neutral-555"}`}>Model</p>
              <div className="flex gap-1.5 flex-wrap">
                {MODELS.map((m) => (
                  <button key={m.id} onClick={() => setModel(m.id)}
                    title={m.hint}
                    className={`text-[9px] font-semibold uppercase px-3 py-1.5 rounded-[9999px] border transition-all ${
                      model === m.id
                        ? isDark ? "bg-white text-black border-white" : "bg-black text-white border-black"
                        : isDark ? "border-neutral-800 text-neutral-355 hover:bg-neutral-900/40" : "border-[#D1D1D6] text-neutral-705 bg-white"
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className={`text-[8px] uppercase tracking-widest mb-1.5 ${isDark ? "text-neutral-500" : "text-neutral-555"}`}>Size</p>
              <div className="flex gap-1.5 flex-wrap">
                {DIMS.map((d) => (
                  <button key={d.label} onClick={() => setDim(d)}
                    className={`text-[9px] font-semibold uppercase px-3 py-1.5 rounded-[9999px] border transition-all ${
                      dim.label === d.label
                        ? isDark ? "bg-white text-black border-white" : "bg-black text-white border-black"
                        : isDark ? "border-neutral-800 text-neutral-355 hover:bg-neutral-900/40" : "border-[#D1D1D6] text-neutral-705 bg-white"
                    }`}>{d.label} · {d.w}×{d.h}</button>
                ))}
              </div>
            </div>

            <div className="ml-auto">
              <button
                onClick={generate}
                disabled={generating || prompt.trim().length < 3}
                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-[9999px] transition-all ${
                  isDark ? "bg-white text-black hover:bg-neutral-100 disabled:opacity-40" : "bg-black text-white hover:bg-neutral-800 disabled:opacity-30"
                }`}
              >
                {generating ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate</>}
              </button>
            </div>
          </div>

          <p className={`text-[9px] mt-3 ${isDark ? "text-neutral-555" : "text-neutral-455"}`}>
            Generation typically takes 5–15 seconds. Image saves automatically. Realtime — new designs appear below as they finish.
          </p>
        </div>

        {/* Gallery */}
        <h2 className="text-[10px] uppercase tracking-widest mb-3 opacity-70">Designs · {designs.length}</h2>
        {designs.length === 0 ? (
          <div className={`rounded-[24px] border border-dashed py-20 text-center ${isDark ? "border-neutral-850 text-neutral-555" : "border-[#D1D1D6] text-neutral-455"}`}>
            <Sparkles size={28} className="mx-auto opacity-30 mb-3" />
            <p className="text-[11px]">Nothing yet. Generate your first design above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {designs.map((d) => (
              <div key={d.id}
                onClick={() => setSelected(d)}
                className={`group relative rounded-[20px] overflow-hidden border cursor-pointer transition-all ${
                  isDark ? "border-neutral-850 bg-neutral-955/40 hover:border-neutral-700" : "border-[#D1D1D6] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
                }`}
              >
                <div className="aspect-square overflow-hidden bg-[#FAFAFA]">
                  <img src={d.image_url} alt={d.title ?? ""} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] truncate opacity-90">{d.title || d.prompt || "Untitled"}</p>
                  <p className={`text-[9px] mt-0.5 ${isDark ? "text-neutral-555" : "text-neutral-455"}`}>{d.model} · {d.width}×{d.height}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected design panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-8 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl rounded-[24px] border overflow-hidden flex flex-col md:flex-row ${isDark ? "bg-neutral-955 border-neutral-850" : "bg-white border-[#D1D1D6]"}`}
          >
            <div className="md:w-1/2 bg-[#FAFAFA] aspect-square md:aspect-auto">
              <img src={selected.image_url} alt={selected.title ?? ""} className="w-full h-full object-contain" />
            </div>
            <div className="md:w-1/2 p-6 flex flex-col gap-4">
              <div>
                <p className={`text-[9px] uppercase tracking-widest mb-1 ${isDark ? "text-neutral-555" : "text-neutral-455"}`}>Title</p>
                <p className="text-[13px] font-medium">{selected.title || "Untitled"}</p>
              </div>
              {selected.prompt && (
                <div>
                  <p className={`text-[9px] uppercase tracking-widest mb-1 ${isDark ? "text-neutral-555" : "text-neutral-455"}`}>Prompt</p>
                  <p className="text-[11px] opacity-80 leading-relaxed">{selected.prompt}</p>
                </div>
              )}
              <div>
                <p className={`text-[9px] uppercase tracking-widest mb-1 ${isDark ? "text-neutral-555" : "text-neutral-455"}`}>Meta</p>
                <p className="text-[10px] opacity-70">{selected.model} · {selected.width}×{selected.height}</p>
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <button onClick={() => useAsProduct(selected)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-[9999px] transition-all ${
                    isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-black text-white hover:bg-neutral-800"
                  }`}>
                  <ShoppingBag size={12} /> Create product from this image
                </button>
                <a href={selected.image_url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest rounded-[9999px] border transition-all ${
                    isDark ? "border-neutral-800 hover:bg-neutral-900/40" : "border-[#D1D1D6] hover:bg-neutral-50"
                  }`}>Open original</a>
                <button onClick={() => removeDesign(selected.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest rounded-[9999px] border transition-all ${
                    isDark ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10" : "border-rose-500/30 text-rose-600 hover:bg-rose-50"
                  }`}>
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

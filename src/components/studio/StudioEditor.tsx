// ─────────────────────────────────────────────────────────────
//  Luveni GM — StudioEditor
//  Free, Konva-powered design editor. Layers, text, images,
//  transform, undo/redo, AI new-layer, and region-select AI
//  (marquee a space → generate into it). Client-only (Konva needs DOM).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Group, Transformer } from "react-konva";
import type Konva from "konva";
import {
  Type, ImagePlus, Sparkles, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Download, Loader2, Wand2, X, RefreshCw, Undo2, Redo2, SquareDashed,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type StudioLayer = {
  id: string; type: "image" | "text"; name: string; visible: boolean;
  x: number; y: number; rotation: number; opacity: number;
  src?: string; width?: number; height?: number;
  text?: string; fontSize?: number; fill?: string; fontStyle?: string; fontFamily?: string;
};

type Props = {
  projectId: string;
  initialCanvas: { layers?: StudioLayer[] } | null;
  artboardW: number; artboardH: number; templateKey: string;
  onClose: () => void; isDark: boolean;
};

const uid = () => crypto.randomUUID();
const clone = (ls: StudioLayer[]) => ls.map((l) => ({ ...l }));

function useHtmlImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const im = new window.Image();
    im.crossOrigin = "anonymous";
    im.src = src;
    im.onload = () => setImg(im);
    im.onerror = () => setImg(null);
  }, [src]);
  return img;
}

function ImageNode({ layer, onChange, onSelect, nodeRef, listening }: any) {
  const img = useHtmlImage(layer.src);
  if (!layer.visible) return null;
  return (
    <KImage
      ref={nodeRef} image={img || undefined}
      x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      rotation={layer.rotation} opacity={layer.opacity}
      draggable={listening} listening={listening}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const n = e.target as Konva.Image; const sx = n.scaleX(); const sy = n.scaleY();
        n.scaleX(1); n.scaleY(1);
        onChange({ x: n.x(), y: n.y(), width: Math.max(10, n.width() * sx), height: Math.max(10, n.height() * sy), rotation: n.rotation() });
      }}
    />
  );
}

function TextNode({ layer, onChange, onSelect, nodeRef, listening }: any) {
  if (!layer.visible) return null;
  return (
    <KText
      ref={nodeRef} text={layer.text}
      x={layer.x} y={layer.y} fontSize={layer.fontSize} fill={layer.fill}
      fontStyle={layer.fontStyle} fontFamily={layer.fontFamily || "Space Mono"}
      rotation={layer.rotation} opacity={layer.opacity}
      draggable={listening} listening={listening}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const n = e.target as Konva.Text; const sx = n.scaleX();
        n.scaleX(1); n.scaleY(1);
        onChange({ x: n.x(), y: n.y(), fontSize: Math.max(6, (layer.fontSize || 48) * sx), rotation: n.rotation() });
      }}
    />
  );
}

export default function StudioEditor({ projectId, initialCanvas, artboardW, artboardH, templateKey, onClose, isDark }: Props) {
  const [layers, setLayers] = useState<StudioLayer[]>(initialCanvas?.layers ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [regionMode, setRegionMode] = useState(false);
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const past = useRef<StudioLayer[][]>([]);
  const future = useRef<StudioLayer[][]>([]);
  const drawing = useRef<{ x: number; y: number } | null>(null);

  // History — snapshot BEFORE a mutation, then apply.
  const commit = useCallback((updater: (ls: StudioLayer[]) => StudioLayer[]) => {
    setLayers((cur) => { past.current.push(clone(cur)); if (past.current.length > 60) past.current.shift(); future.current = []; return updater(cur); });
  }, []);
  const undo = useCallback(() => {
    setLayers((cur) => { const prev = past.current.pop(); if (!prev) return cur; future.current.push(clone(cur)); return prev; });
    setSelectedId(null);
  }, []);
  const redo = useCallback(() => {
    setLayers((cur) => { const nxt = future.current.pop(); if (!nxt) return cur; past.current.push(clone(cur)); return nxt; });
    setSelectedId(null);
  }, []);

  // Keyboard: Cmd/Ctrl+Z undo, +Shift redo. Ignore while typing in fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) { e.preventDefault(); commit((ls) => ls.filter((l) => l.id !== selectedId)); setSelectedId(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, commit, selectedId]);

  const [scale, setScale] = useState(0.15);
  useEffect(() => {
    const fit = () => {
      const availW = Math.min(window.innerWidth - 420, 920);
      const availH = window.innerHeight - 220;
      setScale(Math.min(availW / artboardW, availH / artboardH, 1));
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [artboardW, artboardH]);

  useEffect(() => {
    const tr = trRef.current; if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node && !regionMode ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers, regionMode]);

  const patchLayer = useCallback((id: string, patch: Partial<StudioLayer>) => {
    commit((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, [commit]);
  // live patch (no history) for sliders mid-drag
  const livePatch = useCallback((id: string, patch: Partial<StudioLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const addText = () => {
    const l: StudioLayer = { id: uid(), type: "text", name: "Text", visible: true, x: artboardW / 2 - 400, y: artboardH / 2, rotation: 0, opacity: 1, text: "Your text", fontSize: 200, fill: "#000000", fontStyle: "bold", fontFamily: "Space Mono" };
    commit((ls) => [...ls, l]); setSelectedId(l.id);
  };

  const addImageAt = (src: string, name: string, box?: { x: number; y: number; w: number; h: number }) => {
    const place = (w: number, h: number, x: number, y: number) => {
      const l: StudioLayer = { id: uid(), type: "image", name, visible: true, x, y, rotation: 0, opacity: 1, src, width: w, height: h };
      commit((ls) => [...ls, l]); setSelectedId(l.id);
    };
    if (box) { place(box.w, box.h, box.x, box.y); return; }
    const im = new window.Image(); im.crossOrigin = "anonymous"; im.src = src;
    im.onload = () => {
      const ratio = im.width / im.height; const w = Math.min(artboardW * 0.7, im.width); const h = w / ratio;
      place(w, h, (artboardW - w) / 2, (artboardH - h) / 2);
    };
  };

  const uploadImage = (file: File) => { const r = new FileReader(); r.onload = () => addImageAt(r.result as string, file.name); r.readAsDataURL(file); };

  const runAi = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("ai-generate-image", { body });
    const msg = await extractFnError(error, data);
    if (msg) { toast.error(msg); return null; }
    return data.image_url as string;
  };

  const aiNewLayer = async () => {
    if (aiPrompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setAiBusy(true);
    try { const url = await runAi({ prompt: aiPrompt.trim(), width: 1024, height: 1024, persist: true }); if (url) { addImageAt(url, aiPrompt.slice(0, 24)); setAiPrompt(""); toast.success("AI layer added."); } }
    finally { setAiBusy(false); }
  };

  const aiRegenerateSelected = async () => {
    const sel = layers.find((l) => l.id === selectedId);
    if (!sel || sel.type !== "image" || !sel.src) { toast.error("Select an image layer first"); return; }
    if (aiPrompt.trim().length < 3) { toast.error("Enter a prompt"); return; }
    setAiBusy(true);
    try { const url = await runAi({ prompt: aiPrompt.trim(), image: sel.src, width: 1024, height: 1024, persist: false }); if (url) { patchLayer(sel.id, { src: url }); setAiPrompt(""); toast.success("Layer reimagined."); } }
    finally { setAiBusy(false); }
  };

  // Region marquee → generate INTO that space.
  const finalizeRegion = async (r: { x: number; y: number; w: number; h: number }) => {
    if (r.w < 40 || r.h < 40) { setRegion(null); return; }
    if (aiPrompt.trim().length < 3) { toast.error("Type a prompt first, then draw the region"); setRegion(null); return; }
    setAiBusy(true);
    try {
      // size sent to the model, clamped, preserving region aspect
      const longest = Math.max(r.w, r.h); const k = Math.min(1, 1024 / longest);
      const gw = Math.round(r.w * k); const gh = Math.round(r.h * k);
      const url = await runAi({ prompt: aiPrompt.trim(), width: gw, height: gh, persist: false });
      if (url) { addImageAt(url, aiPrompt.slice(0, 24), r); setAiPrompt(""); toast.success("Generated into region."); }
    } finally { setAiBusy(false); setRegion(null); setRegionMode(false); }
  };

  const move = (id: string, dir: -1 | 1) => commit((ls) => {
    const i = ls.findIndex((l) => l.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ls.length) return ls;
    const c = [...ls]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  const save = async () => {
    setSaving(true);
    try {
      let thumbnail: string | undefined;
      try { thumbnail = stageRef.current?.toDataURL({ pixelRatio: 0.12 }); } catch { /* tainted */ }
      const { error } = await supabase.from("studio_projects").update({ canvas: { layers }, thumbnail_url: thumbnail, updated_at: new Date().toISOString() }).eq("id", projectId);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved.");
    } finally { setSaving(false); }
  };

  const exportPng = () => {
    setSelectedId(null);
    setTimeout(() => {
      try { const uri = stageRef.current?.toDataURL({ pixelRatio: 1 }); if (!uri) return; const a = document.createElement("a"); a.download = "luveni-design.png"; a.href = uri; a.click(); }
      catch { toast.error("Export blocked by a cross-origin image."); }
    }, 60);
  };

  const selected = layers.find((l) => l.id === selectedId);
  const pill = `flex items-center gap-1.5 text-[10px] font-medium px-3.5 py-2 rounded-full transition-all ${isDark ? "text-neutral-300 hover:bg-white/10" : "text-neutral-700 hover:bg-black/[0.06]"}`;
  const isHat = templateKey?.startsWith("hat");
  const isPoster = templateKey?.startsWith("poster");

  // Print-area guide proportions vary by product.
  const pa = isHat ? { x: 0.28, y: 0.32, w: 0.44, h: 0.36 } : isPoster ? { x: 0.06, y: 0.05, w: 0.88, h: 0.9 } : { x: 0.2, y: 0.14, w: 0.6, h: 0.62 };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? "bg-neutral-950 text-white" : "bg-[#f5f5f7] text-black"} font-mono`}>
      {/* Toolbar — floating pill cluster */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className={`flex items-center gap-1 p-1 rounded-full ${isDark ? "bg-neutral-900/80 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)]"}`}>
          <button onClick={onClose} className={pill}><X size={13} /> Close</button>
          <span className="w-px h-4 opacity-10 bg-current" />
          <button onClick={undo} className={pill} title="Undo (⌘Z)"><Undo2 size={13} /></button>
          <button onClick={redo} className={pill} title="Redo (⌘⇧Z)"><Redo2 size={13} /></button>
          <span className="w-px h-4 opacity-10 bg-current" />
          <button onClick={addText} className={pill}><Type size={13} /> Text</button>
          <label className={pill + " cursor-pointer"}><ImagePlus size={13} /> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} /></label>
          <button onClick={() => { setRegionMode((v) => !v); setSelectedId(null); }} className={pill + (regionMode ? (isDark ? " bg-white/15" : " bg-black/10") : "")} title="Draw a region for AI">
            <SquareDashed size={13} /> Region AI
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPng} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-white/90 shadow"}`}><Download size={13} /> Export</button>
          <button onClick={save} disabled={saving} className={`flex items-center gap-1.5 text-[10px] font-semibold px-4 py-2.5 rounded-full ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>
      </div>

      {/* AI prompt bar — always visible capsule */}
      <div className="px-4 pb-2">
        <div className={`flex items-center gap-2 px-2 py-2 rounded-full ${isDark ? "bg-neutral-900/70 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}`}>
          <Sparkles size={14} className="opacity-50 ml-2" />
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={regionMode ? "Type a prompt, then drag a region on the canvas…" : selected?.type === "image" ? "Reimagine the selected layer, or add a new one…" : "Describe an image to generate…"}
            className="flex-1 bg-transparent text-[11px] px-2 focus:outline-none" />
          {aiBusy && <Loader2 size={14} className="animate-spin opacity-60" />}
          <button onClick={aiNewLayer} disabled={aiBusy} className={pill}><Sparkles size={12} /> New layer</button>
          {selected?.type === "image" && <button onClick={aiRegenerateSelected} disabled={aiBusy} className={pill}><RefreshCw size={12} /> Reimagine</button>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-6">
          <div className="rounded-[28px] overflow-hidden" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.28)" }}>
            <Stage
              ref={stageRef}
              width={artboardW * scale} height={artboardH * scale} scaleX={scale} scaleY={scale}
              onMouseDown={(e) => {
                if (regionMode) { const p = e.target.getStage()!.getRelativePointerPosition()!; drawing.current = { x: p.x, y: p.y }; setRegion({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
                if (e.target === e.target.getStage() || (e.target as any).attrs?.name === "bg") setSelectedId(null);
              }}
              onMouseMove={(e) => { if (regionMode && drawing.current) { const p = e.target.getStage()!.getRelativePointerPosition()!; const s = drawing.current; setRegion({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); } }}
              onMouseUp={() => { if (regionMode && drawing.current && region) { drawing.current = null; finalizeRegion(region); } }}
            >
              <Layer>
                {/* Product blank: tinted body + print-area guide */}
                <Rect name="bg" x={0} y={0} width={artboardW} height={artboardH} fill={isDark ? "#0d0d0d" : "#ffffff"} listening />
                <Rect x={artboardW * 0.06} y={artboardH * 0.05} width={artboardW * 0.88} height={artboardH * 0.9} cornerRadius={artboardW * 0.06} fill={isDark ? "#161616" : "#f1f1f3"} listening={false} />
                <Rect x={artboardW * pa.x} y={artboardH * pa.y} width={artboardW * pa.w} height={artboardH * pa.h} stroke="#9ca3af" strokeWidth={4} dash={[26, 18]} cornerRadius={20} listening={false} />

                {layers.map((l) => l.type === "image" ? (
                  <ImageNode key={l.id} layer={l} listening={!regionMode}
                    nodeRef={(n: any) => (nodeRefs.current[l.id] = n)}
                    onSelect={() => setSelectedId(l.id)} onChange={(patch: any) => patchLayer(l.id, patch)} />
                ) : (
                  <TextNode key={l.id} layer={l} listening={!regionMode}
                    nodeRef={(n: any) => (nodeRefs.current[l.id] = n)}
                    onSelect={() => setSelectedId(l.id)} onChange={(patch: any) => patchLayer(l.id, patch)} />
                ))}

                {region && <Rect x={region.x} y={region.y} width={region.w} height={region.h} stroke="#6366f1" strokeWidth={4} dash={[16, 12]} fill="rgba(99,102,241,0.08)" listening={false} />}
                <Transformer ref={trRef} rotateEnabled keepRatio={false} anchorCornerRadius={20} borderStroke="#6366f1" anchorStroke="#6366f1" />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right rail */}
        <div className="w-[300px] p-3 overflow-y-auto">
          {selected && (
            <div className={`rounded-[20px] p-4 mb-3 ${isDark ? "bg-neutral-900/60" : "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]"}`}>
              <p className="text-[9px] uppercase tracking-widest opacity-50 mb-3">Properties</p>
              {selected.type === "text" && (
                <div className="space-y-2.5">
                  <input value={selected.text} onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                    className={`w-full bg-transparent border rounded-full px-3.5 py-2 text-[11px] ${isDark ? "border-neutral-800" : "border-[#E2E2E6]"}`} />
                  <div className="flex items-center gap-2">
                    <input type="color" value={selected.fill} onChange={(e) => patchLayer(selected.id, { fill: e.target.value })} className="w-8 h-8 rounded-full bg-transparent border-0 cursor-pointer" />
                    <input type="number" value={Math.round(selected.fontSize || 0)} onChange={(e) => patchLayer(selected.id, { fontSize: parseInt(e.target.value) || 48 })}
                      className={`w-20 bg-transparent border rounded-full px-3 py-1.5 text-[11px] ${isDark ? "border-neutral-800" : "border-[#E2E2E6]"}`} />
                    <button onClick={() => patchLayer(selected.id, { fontStyle: selected.fontStyle === "bold" ? "normal" : "bold" })} className={pill + " !px-3 font-bold"}>B</button>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Opacity</p>
                <input type="range" min={0} max={1} step={0.05} value={selected.opacity}
                  onMouseDown={() => { past.current.push(clone(layers)); future.current = []; }}
                  onChange={(e) => livePatch(selected.id, { opacity: parseFloat(e.target.value) })} className="w-full" />
              </div>
            </div>
          )}

          <div className={`rounded-[20px] p-4 ${isDark ? "bg-neutral-900/60" : "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]"}`}>
            <p className="text-[9px] uppercase tracking-widest opacity-50 mb-3">Layers · {layers.length}</p>
            {layers.length === 0 && <p className="text-[10px] opacity-40">Add text, image, or AI.</p>}
            <div className="space-y-1">
              {[...layers].reverse().map((l) => (
                <div key={l.id} onClick={() => setSelectedId(l.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-full cursor-pointer text-[10px] ${selectedId === l.id ? (isDark ? "bg-white/10" : "bg-black/[0.06]") : "hover:bg-current/5"}`}>
                  <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }); }}>{l.visible ? <Eye size={12} /> : <EyeOff size={12} className="opacity-40" />}</button>
                  <span className="flex-1 truncate">{l.type === "text" ? (l.text || "Text") : l.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }}><ArrowUp size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }}><ArrowDown size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); commit((ls) => ls.filter((x) => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }} className="text-rose-500"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function extractFnError(error: any, data: any): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;
  const ctx = error.context;
  if (ctx?.json) { try { const b = await ctx.json(); if (b?.error) return b.error; } catch {} }
  return error.message || "Request failed";
}

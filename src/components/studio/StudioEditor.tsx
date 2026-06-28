// ─────────────────────────────────────────────────────────────
//  Luveni GM — StudioEditor
//  Free, Konva-powered design editor (Illustrator/Photoshop-grade
//  foundation). Layers, text, images, transform, AI-generated layers,
//  per-layer AI regeneration (img2img). Client-only (Konva needs DOM).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import {
  Type, ImagePlus, Sparkles, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Download, Loader2, Wand2, X, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type StudioLayer = {
  id: string;
  type: "image" | "text";
  name: string;
  visible: boolean;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  // image
  src?: string;
  width?: number;
  height?: number;
  // text
  text?: string;
  fontSize?: number;
  fill?: string;
  fontStyle?: string;
  fontFamily?: string;
};

type Props = {
  projectId: string;
  initialCanvas: { layers?: StudioLayer[] } | null;
  artboardW: number;
  artboardH: number;
  templateKey: string;
  onClose: () => void;
  isDark: boolean;
};

const uid = () => crypto.randomUUID();

// Loads an image element for Konva with CORS enabled so the stage can be
// exported (toDataURL) without tainting the canvas.
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

function ImageNode({ layer, onChange, onSelect, isSelected, nodeRef }: any) {
  const img = useHtmlImage(layer.src);
  if (!layer.visible) return null;
  return (
    <KImage
      ref={nodeRef}
      image={img || undefined}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Image;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1); node.scaleY(1);
        onChange({
          x: node.x(), y: node.y(),
          width: Math.max(10, node.width() * sx),
          height: Math.max(10, node.height() * sy),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

function TextNode({ layer, onChange, onSelect, nodeRef }: any) {
  if (!layer.visible) return null;
  return (
    <KText
      ref={nodeRef}
      text={layer.text}
      x={layer.x}
      y={layer.y}
      fontSize={layer.fontSize}
      fill={layer.fill}
      fontStyle={layer.fontStyle}
      fontFamily={layer.fontFamily || "Space Mono"}
      rotation={layer.rotation}
      opacity={layer.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target as Konva.Text;
        const sx = node.scaleX();
        node.scaleX(1); node.scaleY(1);
        onChange({
          x: node.x(), y: node.y(),
          fontSize: Math.max(6, (layer.fontSize || 48) * sx),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

export default function StudioEditor({ projectId, initialCanvas, artboardW, artboardH, onClose, isDark }: Props) {
  const [layers, setLayers] = useState<StudioLayer[]>(initialCanvas?.layers ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  // Fit the (large, print-resolution) artboard into the viewport.
  const [scale, setScale] = useState(0.15);
  useEffect(() => {
    const fit = () => {
      const availW = Math.min(window.innerWidth - 420, 900);
      const availH = window.innerHeight - 220;
      setScale(Math.min(availW / artboardW, availH / artboardH, 1));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [artboardW, artboardH]);

  // Attach the Transformer to the selected node.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  const patchLayer = useCallback((id: string, patch: Partial<StudioLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const addText = () => {
    const l: StudioLayer = {
      id: uid(), type: "text", name: "Text", visible: true,
      x: artboardW / 2 - 400, y: artboardH / 2, rotation: 0, opacity: 1,
      text: "Your text", fontSize: 200, fill: "#000000", fontStyle: "bold", fontFamily: "Space Mono",
    };
    setLayers((ls) => [...ls, l]);
    setSelectedId(l.id);
  };

  const addImageLayer = (src: string, name = "Image") => {
    const im = new window.Image();
    im.crossOrigin = "anonymous";
    im.src = src;
    im.onload = () => {
      const maxW = artboardW * 0.7;
      const ratio = im.width / im.height;
      const w = Math.min(maxW, im.width);
      const h = w / ratio;
      const l: StudioLayer = {
        id: uid(), type: "image", name, visible: true,
        x: (artboardW - w) / 2, y: (artboardH - h) / 2, rotation: 0, opacity: 1,
        src, width: w, height: h,
      };
      setLayers((ls) => [...ls, l]);
      setSelectedId(l.id);
    };
  };

  const uploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => addImageLayer(reader.result as string, file.name);
    reader.readAsDataURL(file);
  };

  // AI: generate a brand-new image layer from a prompt.
  const aiGenerate = async () => {
    if (aiPrompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: aiPrompt.trim(), width: 1024, height: 1024, persist: true },
      });
      const errMsg = await extractFnError(error, data);
      if (errMsg) { toast.error(errMsg); return; }
      addImageLayer(data.image_url, aiPrompt.slice(0, 24));
      setAiPrompt(""); setAiOpen(false);
      toast.success("AI layer added.");
    } finally {
      setAiBusy(false);
    }
  };

  // AI magic: regenerate the SELECTED image layer using itself as the init
  // image (img2img) guided by a prompt — "reimagine this region".
  const aiRegenerateSelected = async () => {
    const sel = layers.find((l) => l.id === selectedId);
    if (!sel || sel.type !== "image" || !sel.src) { toast.error("Select an image layer first"); return; }
    if (aiPrompt.trim().length < 3) { toast.error("Enter a prompt for the magic"); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: aiPrompt.trim(), image: sel.src, width: 1024, height: 1024, persist: false },
      });
      const errMsg = await extractFnError(error, data);
      if (errMsg) { toast.error(errMsg); return; }
      patchLayer(sel.id, { src: data.image_url });
      setAiPrompt(""); setAiOpen(false);
      toast.success("Layer reimagined.");
    } finally {
      setAiBusy(false);
    }
  };

  const removeLayer = (id: string) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const copy = [...ls];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      let thumbnail: string | undefined;
      try { thumbnail = stageRef.current?.toDataURL({ pixelRatio: 0.12 }); } catch { /* tainted */ }
      const { error } = await supabase
        .from("studio_projects")
        .update({ canvas: { layers }, thumbnail_url: thumbnail, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) { toast.error(error.message); return; }
      toast.success("Project saved.");
    } finally {
      setSaving(false);
    }
  };

  const exportPng = () => {
    try {
      setSelectedId(null);
      setTimeout(() => {
        const uri = stageRef.current?.toDataURL({ pixelRatio: 1 });
        if (!uri) return;
        const a = document.createElement("a");
        a.download = "luveni-design.png";
        a.href = uri;
        a.click();
      }, 50);
    } catch {
      toast.error("Export failed (an image blocked cross-origin export).");
    }
  };

  const selected = layers.find((l) => l.id === selectedId);
  const panel = isDark ? "bg-neutral-955 border-neutral-850" : "bg-white border-[#D1D1D6]";
  const btn = `flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase px-3 py-2 rounded-[9999px] border transition-all ${
    isDark ? "border-neutral-800 text-neutral-355 hover:bg-neutral-900/40" : "border-[#D1D1D6] text-neutral-705 bg-white hover:bg-neutral-50"
  }`;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? "bg-black text-white" : "bg-[#f5f5f7] text-black"} font-mono`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? "border-neutral-850" : "border-[#D1D1D6]"}`}>
        <button onClick={onClose} className={btn}><X size={12} /> Close</button>
        <div className="w-px h-5 bg-current opacity-10 mx-1" />
        <button onClick={addText} className={btn}><Type size={12} /> Text</button>
        <label className={btn + " cursor-pointer"}>
          <ImagePlus size={12} /> Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        </label>
        <button onClick={() => setAiOpen((v) => !v)} className={btn}><Wand2 size={12} /> AI Magic</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPng} className={btn}><Download size={12} /> Export</button>
          <button onClick={save} disabled={saving}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-4 py-2 rounded-[9999px] ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>
      </div>

      {/* AI panel */}
      {aiOpen && (
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? "border-neutral-850 bg-neutral-955/60" : "border-[#D1D1D6] bg-white"}`}>
          <Sparkles size={13} className="opacity-60" />
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={selected?.type === "image" ? "Describe how to reimagine the selected layer…" : "Describe an image to add as a new layer…"}
            className={`flex-1 bg-transparent border rounded-[9999px] px-4 py-2 text-[11px] focus:outline-none ${isDark ? "border-neutral-800" : "border-[#D1D1D6]"}`}
          />
          <button onClick={aiGenerate} disabled={aiBusy} className={btn}>
            {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} New layer
          </button>
          {selected?.type === "image" && (
            <button onClick={aiRegenerateSelected} disabled={aiBusy} className={btn}>
              <RefreshCw size={12} /> Reimagine selected
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas stage */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-6">
          <div style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <Stage
              ref={stageRef}
              width={artboardW * scale}
              height={artboardH * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
            >
              <Layer>
                {/* Artboard background + print-area guide */}
                <Rect x={0} y={0} width={artboardW} height={artboardH} fill="#ffffff" />
                <Rect
                  x={artboardW * 0.12} y={artboardH * 0.1}
                  width={artboardW * 0.76} height={artboardH * 0.8}
                  stroke="#9ca3af" strokeWidth={4} dash={[24, 18]} listening={false}
                />
                {layers.map((l) =>
                  l.type === "image" ? (
                    <ImageNode
                      key={l.id} layer={l}
                      nodeRef={(n: any) => (nodeRefs.current[l.id] = n)}
                      isSelected={l.id === selectedId}
                      onSelect={() => setSelectedId(l.id)}
                      onChange={(patch: any) => patchLayer(l.id, patch)}
                    />
                  ) : (
                    <TextNode
                      key={l.id} layer={l}
                      nodeRef={(n: any) => (nodeRefs.current[l.id] = n)}
                      onSelect={() => setSelectedId(l.id)}
                      onChange={(patch: any) => patchLayer(l.id, patch)}
                    />
                  ),
                )}
                <Transformer ref={trRef} rotateEnabled keepRatio={false} />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Right rail: layers + properties */}
        <div className={`w-[300px] border-l overflow-y-auto ${isDark ? "border-neutral-850" : "border-[#D1D1D6]"}`}>
          {/* Properties */}
          {selected && (
            <div className={`p-4 border-b ${isDark ? "border-neutral-850" : "border-[#D1D1D6]"}`}>
              <p className="text-[9px] uppercase tracking-widest opacity-60 mb-3">Properties</p>
              {selected.type === "text" && (
                <div className="space-y-2.5">
                  <input value={selected.text}
                    onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                    className={`w-full bg-transparent border rounded-[10px] px-3 py-2 text-[11px] ${isDark ? "border-neutral-800" : "border-[#D1D1D6]"}`} />
                  <div className="flex items-center gap-2">
                    <input type="color" value={selected.fill}
                      onChange={(e) => patchLayer(selected.id, { fill: e.target.value })}
                      className="w-8 h-8 rounded bg-transparent border-0" />
                    <input type="number" value={Math.round(selected.fontSize || 0)}
                      onChange={(e) => patchLayer(selected.id, { fontSize: parseInt(e.target.value) || 48 })}
                      className={`w-20 bg-transparent border rounded-[10px] px-2 py-1.5 text-[11px] ${isDark ? "border-neutral-800" : "border-[#D1D1D6]"}`} />
                    <button onClick={() => patchLayer(selected.id, { fontStyle: selected.fontStyle === "bold" ? "normal" : "bold" })}
                      className={btn + " !px-3"}>B</button>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[8px] uppercase tracking-widest opacity-50 mb-1">Opacity</p>
                <input type="range" min={0} max={1} step={0.05} value={selected.opacity}
                  onChange={(e) => patchLayer(selected.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full" />
              </div>
            </div>
          )}

          {/* Layers list */}
          <div className="p-4">
            <p className="text-[9px] uppercase tracking-widest opacity-60 mb-3">Layers · {layers.length}</p>
            {layers.length === 0 && <p className="text-[10px] opacity-40">Add text, image, or AI layer.</p>}
            <div className="space-y-1">
              {[...layers].reverse().map((l) => (
                <div key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-[10px] cursor-pointer text-[10px] ${
                    selectedId === l.id ? (isDark ? "bg-white/10" : "bg-black/[0.06]") : "hover:bg-current/5"
                  }`}>
                  <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }); }}>
                    {l.visible ? <Eye size={12} /> : <EyeOff size={12} className="opacity-40" />}
                  </button>
                  <span className="flex-1 truncate">{l.type === "text" ? (l.text || "Text") : l.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} title="Up"><ArrowUp size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} title="Down"><ArrowDown size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }} className="text-rose-500"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// supabase-js wraps non-2xx as a generic message; pull the real error body.
async function extractFnError(error: any, data: any): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;
  const ctx = error.context;
  if (ctx?.json) { try { const b = await ctx.json(); if (b?.error) return b.error; } catch {} }
  return error.message || "Request failed";
}
